// Who's Bringing What: JSON API (Cloudflare Pages Function + D1).
// One event = categories (Mains, Sides, ...) holding items. An item is either a host-made slot
// ("Side dish", "Cranberry sauce") that a guest claims, or a guest's own extra.
// Guests join with a name only; each member gets a random token (stored hashed).

const DIETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-allergy'];
const TAGS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'contains-nuts'];
const KINDS = ['friendsgiving', 'christmas', 'potluck', 'bbq', 'party', 'newyear', 'blank'];
const LIM = { categories: 12, items: 150, perCategory: 40, members: 150 };
const DAY = 86400000;
const TTL_DAYS = 180;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const fail = (status, error) => json({ error }, status);
class HttpError extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

function rid(n = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const x of b) s += abc[x % abc.length];
  return s;
}
function newToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Collapse whitespace, strip control characters, cap the length.
function clean(v, max, { required = false, name = 'value' } = {}) {
  let s = typeof v === 'string' ? v : v == null ? '' : String(v);
  s = s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (required && !s) throw bad(`Please enter ${name}.`);
  if (s.length > max) throw bad(`${name[0].toUpperCase() + name.slice(1)} is too long (max ${max} characters).`);
  return s;
}
function cleanNote(v, max) {
  let s = typeof v === 'string' ? v : '';
  s = s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (s.length > max) throw bad(`The note is too long (max ${max} characters).`);
  return s;
}
function cleanDate(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + 'T12:00:00Z'))) throw bad('That date does not look right.');
  return s;
}
function cleanTime(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw bad('That time does not look right.');
  return s;
}
const pick = (arr, allowed) => [...new Set((Array.isArray(arr) ? arr : []).filter((x) => allowed.includes(x)))].join(',');
const split = (s) => (s ? s.split(',').filter(Boolean) : []);

async function body(request) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 32000) throw bad('Request too large.');
  try {
    const t = await request.text();
    if (t.length > 32000) throw bad('Request too large.');
    return t ? JSON.parse(t) : {};
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw bad('Invalid request.');
  }
}

// Fixed-window rate limit per IP, kept in D1 so it holds across isolates.
async function limit(env, request, bucket, max, windowMs = 3600000) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const k = `${bucket}:${await sha(ip)}`;
  const now = Date.now();
  const row = await env.DB.prepare(
    `INSERT INTO rate (k, n, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT(k) DO UPDATE SET
       n = CASE WHEN rate.reset_at < ?3 THEN 1 ELSE rate.n + 1 END,
       reset_at = CASE WHEN rate.reset_at < ?3 THEN ?2 ELSE rate.reset_at END
     RETURNING n`
  )
    .bind(k, now + windowMs, now)
    .first();
  // Expired windows are dead rows (the privacy page promises the counters last about an hour); sweep them now and then.
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM rate WHERE reset_at < ?1').bind(now).run();
  if (row && row.n > max) throw new HttpError(429, 'Too many requests from your connection. Please wait a bit and try again.');
}

async function getEvent(env, id) {
  if (!/^[A-Za-z0-9]{6,16}$/.test(id || '')) throw new HttpError(404, 'This list does not exist (or was deleted).');
  const ev = await env.DB.prepare('SELECT * FROM events WHERE id = ?1').bind(id).first();
  if (!ev) throw new HttpError(404, 'This list does not exist (or was deleted).');
  return ev;
}
async function whoAmI(env, request, eventId) {
  const tok = request.headers.get('x-token');
  if (!tok || tok.length > 100) return null;
  const m = await env.DB.prepare('SELECT * FROM members WHERE token_hash = ?1 AND event_id = ?2').bind(await sha(tok), eventId).first();
  return m || null;
}
async function needMember(env, request, eventId) {
  const m = await whoAmI(env, request, eventId);
  if (!m) throw new HttpError(401, 'Add your name first.');
  return m;
}
async function needHost(env, request, eventId) {
  const m = await needMember(env, request, eventId);
  if (!m.is_host) throw new HttpError(403, 'Only the host can do that.');
  return m;
}
const touch = (env, id) => env.DB.prepare('UPDATE events SET updated_at = ?2 WHERE id = ?1').bind(id, Date.now());

async function nameTaken(env, eventId, name, exceptId = '') {
  const r = await env.DB.prepare('SELECT id FROM members WHERE event_id = ?1 AND lower(name) = lower(?2) AND id != ?3')
    .bind(eventId, name, exceptId)
    .first();
  return !!r;
}

async function snapshot(env, ev, me) {
  const [cats, items, members] = await env.DB.batch([
    env.DB.prepare('SELECT id, name, position FROM categories WHERE event_id = ?1 ORDER BY position, rowid').bind(ev.id),
    env.DB.prepare(
      'SELECT id, category_id, label, is_slot, position, claimed_by, dish, tags FROM items WHERE event_id = ?1 ORDER BY position, created_at, rowid'
    ).bind(ev.id),
    env.DB.prepare('SELECT id, name, diet, diet_note, is_host FROM members WHERE event_id = ?1 ORDER BY created_at, rowid').bind(ev.id),
  ]);
  return {
    event: {
      id: ev.id,
      name: ev.name,
      date: ev.event_date,
      time: ev.event_time,
      place: ev.place,
      note: ev.note,
      kind: ev.kind,
      updatedAt: ev.updated_at,
    },
    categories: cats.results.map((c) => ({ id: c.id, name: c.name })),
    items: items.results.map((i) => ({
      id: i.id,
      categoryId: i.category_id,
      label: i.label,
      isSlot: !!i.is_slot,
      claimedBy: i.claimed_by,
      dish: i.dish,
      tags: split(i.tags),
    })),
    members: members.results.map((m) => ({ id: m.id, name: m.name, diet: split(m.diet), dietNote: m.diet_note, isHost: !!m.is_host })),
    me: me ? me.id : null,
    isHost: !!(me && me.is_host),
  };
}

async function countItems(env, eventId, categoryId) {
  const r = await env.DB.prepare(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN category_id = ?2 THEN 1 ELSE 0 END) AS cat FROM items WHERE event_id = ?1'
  )
    .bind(eventId, categoryId || '')
    .first();
  return { total: r.total || 0, cat: r.cat || 0 };
}

// ---------- handlers ----------

async function createEvent(env, request) {
  await limit(env, request, 'create', 20);
  const b = await body(request);
  const name = clean(b.name, 80, { required: true, name: 'a name for the event' });
  const hostName = clean(b.hostName, 40, { required: true, name: 'your name' });
  const date = cleanDate(b.date);
  const time = cleanTime(b.time);
  const place = clean(b.place, 120, { name: 'the place' });
  const note = cleanNote(b.note, 600);
  const kind = KINDS.includes(b.kind) ? b.kind : 'potluck';
  const cats = Array.isArray(b.categories) ? b.categories : [];
  if (cats.length > LIM.categories) throw bad(`Up to ${LIM.categories} categories.`);
  const now = Date.now();
  const id = rid(10);
  const hostId = rid(10);
  const token = newToken();
  const stmts = [
    env.DB.prepare('INSERT INTO events (id, name, event_date, event_time, place, note, kind, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8)').bind(
      id, name, date, time, place, note, kind, now
    ),
    env.DB.prepare('INSERT INTO members (id, event_id, name, token_hash, diet, diet_note, is_host, created_at) VALUES (?1,?2,?3,?4,?5,?6,1,?7)').bind(
      hostId, id, hostName, await sha(token), pick(b.diet, DIETS), clean(b.dietNote, 80, { name: 'the dietary note' }), now
    ),
  ];
  let total = 0;
  cats.forEach((c, ci) => {
    const cname = clean(c && c.name, 40, { name: 'the category name' });
    if (!cname) return;
    const cid = rid(8);
    stmts.push(env.DB.prepare('INSERT INTO categories (id, event_id, name, position) VALUES (?1,?2,?3,?4)').bind(cid, id, cname, ci));
    const slots = Array.isArray(c.slots) ? c.slots : [];
    if (slots.length > LIM.perCategory) throw bad(`Up to ${LIM.perCategory} items per category.`);
    slots.forEach((s, si) => {
      const label = clean(s, 60, { name: 'the item name' }) || cname;
      total++;
      stmts.push(
        env.DB.prepare('INSERT INTO items (id, event_id, category_id, label, is_slot, position, created_at) VALUES (?1,?2,?3,?4,1,?5,?6)').bind(
          rid(8), id, cid, label, si, now + si
        )
      );
    });
  });
  if (total > LIM.items) throw bad(`Up to ${LIM.items} items per list.`);
  await env.DB.batch(stmts);
  // Opportunistic cleanup of old events (no cron on Pages).
  const old = now - TTL_DAYS * DAY;
  const stale = await env.DB.prepare('SELECT id FROM events WHERE created_at < ?1 LIMIT 20').bind(old).all();
  if (stale.results.length) await deleteEvents(env, stale.results.map((r) => r.id));
  return json({ id, token }, 201);
}

async function deleteEvents(env, ids) {
  const stmts = [];
  for (const id of ids)
    for (const t of ['items', 'categories', 'members'])
      stmts.push(env.DB.prepare(`DELETE FROM ${t} WHERE event_id = ?1`).bind(id));
  for (const id of ids) stmts.push(env.DB.prepare('DELETE FROM events WHERE id = ?1').bind(id));
  await env.DB.batch(stmts);
}

async function join(env, request, ev) {
  await limit(env, request, 'join', 60);
  const b = await body(request);
  const name = clean(b.name, 40, { required: true, name: 'your name' });
  const c = await env.DB.prepare('SELECT COUNT(*) AS c FROM members WHERE event_id = ?1').bind(ev.id).first();
  if (c.c >= LIM.members) throw bad('This list is full.');
  if (await nameTaken(env, ev.id, name))
    throw new HttpError(409, `Someone called ${name} is already on this list. If that's you on another phone, use your personal link. Otherwise add an initial.`);
  const token = newToken();
  const mid = rid(10);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO members (id, event_id, name, token_hash, diet, diet_note, is_host, created_at) VALUES (?1,?2,?3,?4,?5,?6,0,?7)').bind(
      mid, ev.id, name, await sha(token), pick(b.diet, DIETS), clean(b.dietNote, 80, { name: 'the dietary note' }), Date.now()
    ),
    touch(env, ev.id),
  ]);
  return json({ token, id: mid }, 201);
}

async function updateMe(env, request, ev) {
  const me = await needMember(env, request, ev.id);
  const b = await body(request);
  const name = b.name === undefined ? me.name : clean(b.name, 40, { required: true, name: 'your name' });
  if (name.toLowerCase() !== me.name.toLowerCase() && (await nameTaken(env, ev.id, name, me.id)))
    throw new HttpError(409, `Someone called ${name} is already on this list.`);
  const diet = b.diet === undefined ? me.diet : pick(b.diet, DIETS);
  const dietNote = b.dietNote === undefined ? me.diet_note : clean(b.dietNote, 80, { name: 'the dietary note' });
  await env.DB.batch([
    env.DB.prepare('UPDATE members SET name = ?2, diet = ?3, diet_note = ?4 WHERE id = ?1').bind(me.id, name, diet, dietNote),
    touch(env, ev.id),
  ]);
  return json({ ok: true });
}

async function leave(env, request, ev) {
  const me = await needMember(env, request, ev.id);
  if (me.is_host) throw bad('The host cannot leave. Delete the list instead.');
  await removeMember(env, ev.id, me.id);
  return json({ ok: true });
}
async function removeMember(env, eventId, mid) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM items WHERE event_id = ?1 AND claimed_by = ?2 AND is_slot = 0').bind(eventId, mid),
    env.DB.prepare("UPDATE items SET claimed_by = NULL, dish = '', tags = '', claimed_at = NULL WHERE event_id = ?1 AND claimed_by = ?2").bind(eventId, mid),
    env.DB.prepare('DELETE FROM members WHERE id = ?1 AND event_id = ?2').bind(mid, eventId),
    touch(env, eventId),
  ]);
}

async function updateEvent(env, request, ev) {
  await needHost(env, request, ev.id);
  const b = await body(request);
  const v = {
    name: b.name === undefined ? ev.name : clean(b.name, 80, { required: true, name: 'a name for the event' }),
    date: b.date === undefined ? ev.event_date : cleanDate(b.date),
    time: b.time === undefined ? ev.event_time : cleanTime(b.time),
    place: b.place === undefined ? ev.place : clean(b.place, 120, { name: 'the place' }),
    note: b.note === undefined ? ev.note : cleanNote(b.note, 600),
  };
  await env.DB.prepare('UPDATE events SET name=?2, event_date=?3, event_time=?4, place=?5, note=?6, updated_at=?7 WHERE id=?1')
    .bind(ev.id, v.name, v.date, v.time, v.place, v.note, Date.now())
    .run();
  return json({ ok: true });
}

async function addCategory(env, request, ev) {
  await needHost(env, request, ev.id);
  const b = await body(request);
  const name = clean(b.name, 40, { required: true, name: 'a category name' });
  const r = await env.DB.prepare('SELECT COUNT(*) AS c, COALESCE(MAX(position), -1) AS p FROM categories WHERE event_id = ?1').bind(ev.id).first();
  if (r.c >= LIM.categories) throw bad(`Up to ${LIM.categories} categories.`);
  const id = rid(8);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO categories (id, event_id, name, position) VALUES (?1,?2,?3,?4)').bind(id, ev.id, name, r.p + 1),
    touch(env, ev.id),
  ]);
  return json({ id }, 201);
}

async function getCategory(env, ev, cid) {
  const c = await env.DB.prepare('SELECT * FROM categories WHERE id = ?1 AND event_id = ?2').bind(cid, ev.id).first();
  if (!c) throw new HttpError(404, 'That category is gone. Refresh the page.');
  return c;
}

async function editCategory(env, request, ev, cid, method) {
  await needHost(env, request, ev.id);
  await getCategory(env, ev, cid);
  if (method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM items WHERE category_id = ?1 AND event_id = ?2').bind(cid, ev.id),
      env.DB.prepare('DELETE FROM categories WHERE id = ?1').bind(cid),
      touch(env, ev.id),
    ]);
    return json({ ok: true });
  }
  const b = await body(request);
  const name = clean(b.name, 40, { required: true, name: 'a category name' });
  await env.DB.batch([env.DB.prepare('UPDATE categories SET name = ?2 WHERE id = ?1').bind(cid, name), touch(env, ev.id)]);
  return json({ ok: true });
}

// Add an item. Host: an open slot ("Cranberry sauce"), optionally claimed by the host at once.
// Guest: their own extra dish, claimed by them.
async function addItem(env, request, ev) {
  const me = await needMember(env, request, ev.id);
  const b = await body(request);
  const cat = await getCategory(env, ev, String(b.categoryId || ''));
  const n = await countItems(env, ev.id, cat.id);
  if (n.total >= LIM.items) throw bad(`This list is full (${LIM.items} items).`);
  if (n.cat >= LIM.perCategory) throw bad(`Up to ${LIM.perCategory} items per category.`);
  const claim = me.is_host ? !!b.claim : true;
  const dish = clean(b.dish, 80, { required: claim, name: 'what you are bringing' });
  const label = me.is_host ? clean(b.label, 60, { required: !claim, name: 'what you need' }) : '';
  const now = Date.now();
  const id = rid(8);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO items (id, event_id, category_id, label, is_slot, position, claimed_by, dish, tags, claimed_at, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)'
    ).bind(
      id, ev.id, cat.id, label, me.is_host && label ? 1 : 0, 1000 + n.cat, claim ? me.id : null, claim ? dish : '',
      claim ? pick(b.tags, TAGS) : '', claim ? now : null, now
    ),
    touch(env, ev.id),
  ]);
  return json({ id }, 201);
}

async function getItem(env, ev, iid) {
  const it = await env.DB.prepare('SELECT * FROM items WHERE id = ?1 AND event_id = ?2').bind(iid, ev.id).first();
  if (!it) throw new HttpError(404, 'That item was removed. Refresh the page.');
  return it;
}

async function claimItem(env, request, ev, iid) {
  const me = await needMember(env, request, ev.id);
  const it = await getItem(env, ev, iid);
  const b = await body(request);
  const dish = clean(b.dish, 80, { name: 'what you are bringing' }) || it.label;
  if (!dish) throw bad('Please enter what you are bringing.');
  const r = await env.DB.prepare(
    'UPDATE items SET claimed_by = ?3, dish = ?4, tags = ?5, claimed_at = ?6 WHERE id = ?1 AND event_id = ?2 AND claimed_by IS NULL'
  )
    .bind(iid, ev.id, me.id, dish, pick(b.tags, TAGS), Date.now())
    .run();
  if (!r.meta.changes) {
    const who = await env.DB.prepare('SELECT m.name FROM items i JOIN members m ON m.id = i.claimed_by WHERE i.id = ?1').bind(iid).first();
    throw new HttpError(409, who ? `${who.name} just took that one. Pick another or add your own.` : 'Someone just took that one.');
  }
  await touch(env, ev.id).run();
  return json({ ok: true });
}

async function editItem(env, request, ev, iid) {
  const me = await needMember(env, request, ev.id);
  const it = await getItem(env, ev, iid);
  const b = await body(request);
  const mine = it.claimed_by === me.id;
  if (!mine && !me.is_host) throw new HttpError(403, 'Only the person bringing it (or the host) can change that.');
  const sets = [];
  const vals = [];
  if (b.dish !== undefined && it.claimed_by) {
    sets.push('dish');
    vals.push(clean(b.dish, 80, { required: true, name: 'what you are bringing' }));
  }
  if (b.tags !== undefined && it.claimed_by) {
    sets.push('tags');
    vals.push(pick(b.tags, TAGS));
  }
  if (b.label !== undefined && me.is_host && it.is_slot) {
    sets.push('label');
    vals.push(clean(b.label, 60, { required: true, name: 'what you need' }));
  }
  if (!sets.length) return json({ ok: true });
  const sql = `UPDATE items SET ${sets.map((s, i) => `${s} = ?${i + 2}`).join(', ')} WHERE id = ?1`;
  await env.DB.batch([env.DB.prepare(sql).bind(iid, ...vals), touch(env, ev.id)]);
  return json({ ok: true });
}

async function unclaimItem(env, request, ev, iid) {
  const me = await needMember(env, request, ev.id);
  const it = await getItem(env, ev, iid);
  if (it.claimed_by !== me.id && !me.is_host) throw new HttpError(403, 'Only the person bringing it (or the host) can change that.');
  const stmt = it.is_slot
    ? env.DB.prepare("UPDATE items SET claimed_by = NULL, dish = '', tags = '', claimed_at = NULL WHERE id = ?1").bind(iid)
    : env.DB.prepare('DELETE FROM items WHERE id = ?1').bind(iid);
  await env.DB.batch([stmt, touch(env, ev.id)]);
  return json({ ok: true });
}

async function deleteItem(env, request, ev, iid) {
  const me = await needMember(env, request, ev.id);
  const it = await getItem(env, ev, iid);
  if (!me.is_host && !(it.claimed_by === me.id && !it.is_slot)) throw new HttpError(403, 'Only the host can remove that.');
  await env.DB.batch([env.DB.prepare('DELETE FROM items WHERE id = ?1').bind(iid), touch(env, ev.id)]);
  return json({ ok: true });
}

async function route(request, env, parts) {
  const m = request.method;
  if (parts[0] !== 'events') throw new HttpError(404, 'Not found.');
  if (parts.length === 1 && m === 'POST') return createEvent(env, request);
  const ev = await getEvent(env, parts[1]);
  const [, , a, b, c] = parts;
  if (m !== 'GET') await limit(env, request, 'write', 600);
  if (!a) {
    if (m === 'GET') return json(await snapshot(env, ev, await whoAmI(env, request, ev.id)));
    if (m === 'PATCH') return updateEvent(env, request, ev);
    if (m === 'DELETE') {
      await needHost(env, request, ev.id);
      await deleteEvents(env, [ev.id]);
      return json({ ok: true });
    }
  }
  if (a === 'v' && m === 'GET') return json({ v: ev.updated_at });
  if (a === 'join' && m === 'POST') return join(env, request, ev);
  if (a === 'me' && !b) {
    if (m === 'PATCH') return updateMe(env, request, ev);
    if (m === 'DELETE') return leave(env, request, ev);
  }
  if (a === 'members' && b && m === 'DELETE') {
    const host = await needHost(env, request, ev.id);
    if (b === host.id) throw bad('The host cannot be removed.');
    await removeMember(env, ev.id, b);
    return json({ ok: true });
  }
  if (a === 'categories') {
    if (!b && m === 'POST') return addCategory(env, request, ev);
    if (b && (m === 'PATCH' || m === 'DELETE')) return editCategory(env, request, ev, b, m);
  }
  if (a === 'items') {
    if (!b && m === 'POST') return addItem(env, request, ev);
    if (b && !c && m === 'PATCH') return editItem(env, request, ev, b);
    if (b && !c && m === 'DELETE') return deleteItem(env, request, ev, b);
    if (b && c === 'claim' && m === 'POST') return claimItem(env, request, ev, b);
    if (b && c === 'unclaim' && m === 'POST') return unclaimItem(env, request, ev, b);
  }
  throw new HttpError(404, 'Not found.');
}

export async function onRequest({ request, env, params }) {
  const parts = [].concat(params.path || []).filter(Boolean);
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, 'Cross-site request blocked.');
    }
    return await route(request, env, parts);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error(e);
    return fail(500, 'Something went wrong on our side. Please try again.');
  }
}
