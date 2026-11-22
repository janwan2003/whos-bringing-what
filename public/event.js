import { h, api, store, toast, copyText, DIETS, TAGS, similarDishes, fmtDate, fmtTime } from './common.js';

const id = location.pathname.split('/')[2] || '';
const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheet-root');
const isNew = new URLSearchParams(location.search).has('new');
if (isNew) history.replaceState(null, '', location.pathname + location.hash);

// A personal link carries the member token in the hash (#k=...). Save it, then strip it from the URL.
const hk = new URLSearchParams(location.hash.slice(1)).get('k');
if (hk) {
  store.set(id, hk);
  history.replaceState(null, '', location.pathname + location.search);
}
let token = store.get(id);
let data = null;
let editMode = false;
let busy = false;

const GENERIC_LABELS = new Set(['Main dish', 'Side dish', 'Dessert', 'Drinks', 'Starter', 'Side or salad', 'Something to grill', 'Snack', 'Something sweet',
  'Snack or dish', 'Bottle for midnight', 'Dish', 'Item']);
const PLACEHOLDER = {
  'Main dish': 'e.g. Roast turkey, lasagna', 'Side dish': 'e.g. Mashed potatoes', Dessert: 'e.g. Pumpkin pie', Drinks: 'e.g. Red wine, sparkling water',
  Starter: 'e.g. Soup, cheese board', 'Side or salad': 'e.g. Potato salad', 'Something to grill': 'e.g. Burgers, veggie skewers', Snack: 'e.g. Chips & dip',
  'Something sweet': 'e.g. Brownies', 'Snack or dish': 'e.g. Sliders', 'Bottle for midnight': 'e.g. Prosecco',
};

const url = () => `${location.origin}/e/${id}`;
const personalLink = () => `${url()}#k=${token}`;
const meM = () => (data && data.me ? data.members.find((m) => m.id === data.me) : null);
const memberName = (mid) => (data.members.find((m) => m.id === mid) || {}).name || 'someone';
const claimed = () => data.items.filter((i) => i.claimedBy);
const slots = () => data.items.filter((i) => i.isSlot);
const tagLabel = (t) => (TAGS.find((x) => x[0] === t) || [t, t])[1];
const tagShort = (t) => (TAGS.find((x) => x[0] === t) || [t, t, t])[2];
const dietLabel = (d) => (DIETS.find((x) => x[0] === d) || [d, d])[1];
const ico = (name) => h('span', { class: `ico ${name}`, 'aria-hidden': 'true' });

async function load() {
  try {
    data = await api('GET', `events/${id}`, undefined, token);
    if (token && !data.me) {
      // Token no longer valid here (removed by host or list re-created).
      store.drop(id);
      token = null;
    }
    if (data.me) store.remember(id, data.event.name);
    document.title = `${data.event.name} · Who's bringing what?`;
    render();
  } catch (e) {
    if (e.status === 404) {
      store.drop(id);
      app.replaceChildren(h('div', { class: 'card empty' },
        h('h1', {}, 'This list is gone'),
        h('p', { class: 'muted' }, 'It was deleted by the host, or the link is incomplete.'),
        h('p', {}, h('a', { class: 'btn primary', href: '/' }, 'Start a new list'))));
    } else if (!data) {
      app.replaceChildren(h('div', { class: 'card empty' }, h('p', {}, e.message), h('button', { onclick: load }, 'Try again')));
    } else toast(e.message);
  }
}

async function act(fn, okMsg) {
  if (busy) return false;
  busy = true;
  try {
    await fn();
    if (okMsg) toast(okMsg);
    await load();
    return true;
  } catch (e) {
    toast(e.message);
    if (e.status === 409 || e.status === 404) await load();
    return false;
  } finally {
    busy = false;
  }
}

// ---------- share ----------
function stillNeeded() {
  const out = [];
  for (const c of data.categories) {
    const open = data.items.filter((i) => i.categoryId === c.id && i.isSlot && !i.claimedBy);
    if (open.length) out.push(open.length === 1 ? open[0].label.toLowerCase() : `${open.length} ${c.name.toLowerCase()}`);
  }
  return out;
}
async function share() {
  const need = stillNeeded();
  const text = `Who's bringing what to ${data.event.name}?${need.length ? ` Still needed: ${need.join(', ')}.` : ''} Tap to claim a dish:`;
  if (navigator.share) {
    try {
      await navigator.share({ title: data.event.name, text, url: url() });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  if (await copyText(`${text} ${url()}`)) toast('Link copied. Paste it in your group chat.');
  else prompt('Copy this link:', url());
}

function menuText() {
  const ev = data.event;
  const lines = [`${ev.name}${ev.date ? ' · ' + fmtDate(ev.date) : ''}`];
  for (const c of data.categories) {
    const its = data.items.filter((i) => i.categoryId === c.id);
    if (!its.length) continue;
    lines.push('', c.name.toUpperCase());
    for (const i of its) {
      if (i.claimedBy) lines.push(`• ${i.dish}${i.tags.length ? ' (' + i.tags.map(tagShort).join(', ') + ')' : ''}: ${memberName(i.claimedBy)}`);
    }
    const open = its.filter((i) => !i.claimedBy).length;
    if (open) lines.push(`• still needed: ${its.filter((i) => !i.claimedBy).map((i) => i.label).join(', ')}`);
  }
  lines.push('', `Claim a dish: ${url()}`);
  return lines.join('\n');
}

// ---------- sheets ----------
let sheetOpener = null;
let sheetOnClose = null;
function closeSheet() {
  if (!sheetRoot.childElementCount) return;
  sheetRoot.replaceChildren();
  document.body.style.overflow = '';
  const cb = sheetOnClose;
  sheetOnClose = null;
  if (cb) cb();
  // Give focus back to the button that opened the sheet (if it survived a re-render).
  if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll: true });
  sheetOpener = null;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetRoot.childElementCount) closeSheet(); });
function openSheet(title, sub, content, onSubmit, submitLabel = 'Save', opts = {}) {
  const err = h('div', { class: 'err', role: 'alert' });
  const submit = h('button', { class: opts.danger ? 'primary' : 'primary', type: 'submit', style: opts.danger ? 'background:var(--danger);border-color:var(--danger)' : null }, submitLabel);
  const form = h('form', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, novalidate: true },
    h('h2', {}, title), sub ? h('p', { class: 'muted small' }, sub) : null, content, err,
    h('div', { class: 'actions' }, h('button', { type: 'button', onclick: closeSheet }, 'Cancel'), submit));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    submit.disabled = true;
    try {
      await onSubmit(err);
    } catch (ex) {
      err.textContent = ex.message;
      if (ex.status === 409 && opts.reloadOn409) load();
    } finally {
      submit.disabled = false;
    }
  });
  const back = h('div', { class: 'sheet-back', onclick: (e) => e.target === back && closeSheet() }, form);
  sheetOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  sheetOnClose = opts.onClose || null;
  sheetRoot.replaceChildren(back);
  document.body.style.overflow = 'hidden';
  const first = form.querySelector('input:not([type=hidden]), textarea');
  if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
  return form;
}
function confirmSheet(title, text, okLabel) {
  return new Promise((resolve) => {
    let ok = false;
    openSheet(title, null, h('p', {}, text), async () => { ok = true; closeSheet(); }, okLabel,
      { danger: true, noFocus: true, onClose: () => resolve(ok) });
  });
}
function chipGroup(options, selected, label) {
  const set = new Set(selected || []);
  const el = h('div', { class: 'chips', role: 'group', 'aria-label': label },
    options.map(([k, l]) => h('button', { type: 'button', class: 'chip', 'data-k': k, 'aria-pressed': String(set.has(k)),
      onclick: (e) => {
        const b = e.currentTarget;
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        on ? set.add(k) : set.delete(k);
        el.dispatchEvent(new Event('change'));
      } }, l)));
  el.values = () => [...set];
  return el;
}
const field = (labelText, input, hint) => h('div', {}, h('label', { for: input.id }, labelText), input, hint ? h('p', { class: 'hint' }, hint) : null);
let fid = 0;
const input = (attrs) => h('input', { type: 'text', id: `f${++fid}`, autocomplete: 'off', ...attrs });

function joinFields() {
  const name = input({ maxlength: 40, placeholder: 'First name', autocomplete: 'given-name', name: 'name' });
  const diet = chipGroup(DIETS, [], 'Dietary needs');
  const note = input({ maxlength: 80, placeholder: 'e.g. no shellfish' });
  const el = h('div', {},
    field('Your name', name),
    h('label', {}, 'Anything you can’t eat? ', h('span', { class: 'muted small' }, '(optional, helps the host)')), diet,
    h('div', { style: 'margin-top:8px' }, note));
  note.setAttribute('aria-label', 'Other dietary note');
  return { el, get: () => ({ name: name.value, diet: diet.values(), dietNote: note.value }) };
}

async function ensureJoined(jf) {
  if (data.me) return;
  const r = await api('POST', `events/${id}/join`, jf.get());
  token = r.token;
  store.set(id, token);
  store.remember(id, data.event.name);
}

function dishSheet({ item, category }) {
  const cat = category || data.categories.find((c) => c.id === item.categoryId);
  const jf = data.me ? null : joinFields();
  const specific = item && !GENERIC_LABELS.has(item.label);
  const dish = input({ maxlength: 80, placeholder: (item && PLACEHOLDER[item.label]) || 'What are you bringing?', value: specific ? item.label : '' });
  const tags = chipGroup(TAGS.map(([k, l]) => [k, l]), [], 'Dish details');
  const warn = h('div', {});
  const check = () => {
    const sims = similarDishes(dish.value, claimed());
    const nuts = tags.values().includes('contains-nuts') ? data.members.filter((m) => m.diet.includes('nut-allergy')) : [];
    warn.replaceChildren(...[
      sims.length ? h('div', { class: 'alert' }, `Heads up: ${sims.slice(0, 3).map((s) => `${memberName(s.claimedBy)} is already bringing “${s.dish}”`).join('; ')}.`) : null,
      nuts.length ? h('div', { class: 'alert' }, `${nuts.map((m) => m.name).join(', ')} ${nuts.length === 1 ? 'has' : 'have'} a nut allergy. Maybe label it at the table too.`) : null,
    ].filter(Boolean));
  };
  dish.addEventListener('input', check);
  tags.addEventListener('change', check);
  const title = item ? `Bring: ${item.label}` : `Add to ${cat.name}`;
  openSheet(title, jf ? 'Just your name. No sign-up.' : null,
    h('div', {}, jf && jf.el, field(item ? 'What exactly?' : 'What will you bring?', dish), warn,
      h('label', {}, 'Good to know ', h('span', { class: 'muted small' }, '(optional)')), tags),
    async () => {
      const d = dish.value.trim();
      if (!d && !item) throw new Error('Say what you’ll bring.');
      await ensureJoined(jf || { get: () => ({}) });
      try {
        if (item) await api('POST', `events/${id}/items/${item.id}/claim`, { dish: d, tags: tags.values() }, token);
        else await api('POST', `events/${id}/items`, { categoryId: cat.id, dish: d, tags: tags.values(), claim: true }, token);
      } finally {
        if (jf) await load(); // joined: show the member even if the claim failed
      }
      closeSheet();
      toast(`Thanks! You’re bringing ${d || item.label}.`);
      await load();
    }, item ? 'I’ll bring it' : 'Add it', { reloadOn409: true });
}

function editDishSheet(item) {
  const dish = input({ maxlength: 80, value: item.dish });
  const tags = chipGroup(TAGS.map(([k, l]) => [k, l]), item.tags, 'Dish details');
  openSheet('Edit your dish', null, h('div', {}, field('What are you bringing?', dish), h('label', {}, 'Good to know'), tags), async () => {
    await api('PATCH', `events/${id}/items/${item.id}`, { dish: dish.value, tags: tags.values() }, token);
    closeSheet();
    await load();
  });
}

function hostAddSheet(cat) {
  const label = input({ maxlength: 60, placeholder: 'e.g. Cranberry sauce, or just “Side dish”' });
  const mine = h('input', { type: 'checkbox', id: `f${++fid}` });
  openSheet(`Add to ${cat.name}`, 'Ask for something specific, or add what you’re bringing yourself.',
    h('div', {}, field('What’s needed?', label), h('label', { style: 'display:flex;gap:8px;align-items:center;font-weight:500' }, mine, 'I’ll bring this myself')),
    async () => {
      const l = label.value.trim();
      if (!l) throw new Error('Say what’s needed.');
      await api('POST', `events/${id}/items`, { categoryId: cat.id, label: l, dish: mine.checked ? l : '', claim: mine.checked }, token);
      closeSheet();
      await load();
    }, 'Add');
}

function meSheet() {
  const m = meM();
  const name = input({ maxlength: 40, value: m.name });
  const diet = chipGroup(DIETS, m.diet, 'Dietary needs');
  const note = input({ maxlength: 80, value: m.dietNote, placeholder: 'e.g. no shellfish' });
  note.setAttribute('aria-label', 'Other dietary note');
  openSheet('Your details', null, h('div', {}, field('Your name', name), h('label', {}, 'Anything you can’t eat?'), diet, h('div', { style: 'margin-top:8px' }, note)), async () => {
    await api('PATCH', `events/${id}/me`, { name: name.value, diet: diet.values(), dietNote: note.value }, token);
    closeSheet();
    await load();
  });
}

function detailsSheet() {
  const ev = data.event;
  const name = input({ maxlength: 80, value: ev.name });
  const date = h('input', { type: 'date', id: `f${++fid}`, value: ev.date });
  const time = h('input', { type: 'time', id: `f${++fid}`, value: ev.time });
  const place = input({ maxlength: 120, value: ev.place, placeholder: 'Address or “Sam’s place”' });
  const note = h('textarea', { id: `f${++fid}`, maxlength: 600, placeholder: 'e.g. Turkey’s on me! Bring your dish ready to serve.' });
  note.value = ev.note;
  openSheet('Event details', null,
    h('div', {}, field('Event name', name), h('div', { class: 'two' }, field('Date', date), field('Time', time)), field('Place', place), field('Note for guests', note)),
    async () => {
      await api('PATCH', `events/${id}`, { name: name.value, date: date.value, time: time.value, place: place.value, note: note.value }, token);
      closeSheet();
      await load();
    });
}

function categorySheet(cat) {
  const name = input({ maxlength: 40, value: cat ? cat.name : '', placeholder: 'e.g. Appetizers' });
  openSheet(cat ? 'Rename category' : 'Add a category', null, field('Category name', name), async () => {
    if (cat) await api('PATCH', `events/${id}/categories/${cat.id}`, { name: name.value }, token);
    else await api('POST', `events/${id}/categories`, { name: name.value }, token);
    closeSheet();
    await load();
  }, cat ? 'Save' : 'Add');
}

function labelSheet(item) {
  const label = input({ maxlength: 60, value: item.label });
  openSheet('Rename item', null, field('What’s needed?', label), async () => {
    await api('PATCH', `events/${id}/items/${item.id}`, { label: label.value }, token);
    closeSheet();
    await load();
  });
}

function menuSheet() {
  const ev = data.event;
  const card = h('div', { class: 'menu-card' },
    h('div', { class: 'kicker' }, 'The menu'),
    h('h3', {}, ev.name),
    ev.date ? h('div', { class: 'muted' }, fmtDate(ev.date, true), ev.time ? ` · ${fmtTime(ev.time)}` : '') : null,
    data.categories.map((c) => {
      const its = data.items.filter((i) => i.categoryId === c.id && i.claimedBy);
      const open = data.items.filter((i) => i.categoryId === c.id && !i.claimedBy).length;
      if (!its.length && !open) return null;
      return [h('h4', {}, c.name), h('ul', {},
        its.map((i) => h('li', {}, i.dish, ' ', h('small', {}, `· ${memberName(i.claimedBy)}${i.tags.length ? ' · ' + i.tags.map(tagShort).join(' ') : ''}`))),
        open ? h('li', {}, h('small', {}, `${open} still needed`)) : null)];
    }),
    h('div', { class: 'foot' }, `Made with Who’s Bringing What · ${location.host}`));
  const form = openSheet('Menu card', 'Screenshot it, or copy it as text for the group chat.', card, async () => {
    if (await copyText(menuText())) toast('Menu copied. Paste it anywhere.');
  }, 'Copy as text', { noFocus: true });
  form.querySelector('.actions button[type=button]').textContent = 'Close';
}

// ---------- render ----------
function itemRow(i) {
  const mine = i.claimedBy && i.claimedBy === data.me;
  const acts = [];
  if (!i.claimedBy && !editMode) acts.push(h('button', { class: 'primary', onclick: () => dishSheet({ item: i }) }, 'I’ll bring it'));
  if (mine && !editMode) {
    acts.push(h('button', { class: 'ghost', onclick: () => editDishSheet(i) }, 'Edit'));
    acts.push(h('button', { class: 'ghost', 'aria-label': `Drop ${i.dish}`, title: 'I can’t bring it after all',
      onclick: async () => { if (await confirmSheet('Drop this?', `“${i.dish}” goes back on the list for someone else.`, 'Drop it')) act(() => api('POST', `events/${id}/items/${i.id}/unclaim`, {}, token), 'Done. It’s open again.'); } }, 'Drop'));
  }
  if (editMode) {
    if (i.claimedBy) acts.push(h('button', { class: 'ghost', onclick: () => act(() => api('POST', `events/${id}/items/${i.id}/unclaim`, {}, token)) }, i.isSlot ? 'Free up' : 'Remove'));
    if (i.isSlot && !i.claimedBy) acts.push(h('button', { class: 'ghost', onclick: () => labelSheet(i) }, 'Rename'));
    if (i.isSlot) acts.push(h('button', { class: 'ghost danger', 'aria-label': `Delete ${i.label}`, onclick: () => act(() => api('DELETE', `events/${id}/items/${i.id}`, undefined, token)) }, '✕'));
  }
  const tags = i.tags.map((t) => h('span', { class: 'tag' + (t === 'contains-nuts' ? ' nuts' : ''), title: tagLabel(t) }, tagShort(t)));
  const body = i.claimedBy
    ? h('div', {}, h('div', { class: 'what' }, i.dish, tags), h('div', { class: 'who' }, mine ? 'You' : memberName(i.claimedBy), i.isSlot && i.label !== i.dish && !GENERIC_LABELS.has(i.label) ? ` · for “${i.label}”` : ''))
    : h('div', {}, h('div', { class: 'what' }, i.label), h('div', { class: 'who' }, 'Open'));
  return h('li', { class: 'item' + (i.claimedBy ? '' : ' open') + (mine ? ' mine' : ''), 'data-item': i.id }, body, h('div', { class: 'acts' }, acts));
}

function categoryCard(c) {
  const its = data.items.filter((i) => i.categoryId === c.id);
  const sl = its.filter((i) => i.isSlot);
  const covered = sl.filter((i) => i.claimedBy).length;
  const extras = its.length - sl.length;
  const countText = sl.length ? `${covered} of ${sl.length}${extras ? ` + ${extras} extra` : ''}` : `${its.length} ${its.length === 1 ? 'dish' : 'dishes'}`;
  return h('section', { class: 'card cat', 'data-cat': c.id },
    h('h2', {}, h('span', {}, c.name), h('span', { class: 'count' + (sl.length && covered === sl.length ? ' done' : '') }, sl.length && covered === sl.length ? `✓ ${countText}` : countText)),
    editMode ? h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: () => categorySheet(c) }, 'Rename'),
      h('button', { class: 'ghost danger', onclick: async () => { if (await confirmSheet(`Delete ${c.name}?`, `Removes the category and its ${its.length} items, including dishes people claimed.`, 'Delete')) act(() => api('DELETE', `events/${id}/categories/${c.id}`, undefined, token)); } }, 'Delete category')) : null,
    its.length ? h('ul', { class: 'items' }, its.map(itemRow)) : h('p', { class: 'muted small' }, 'Nothing here yet.'),
    h('div', { class: 'add-line' }, h('button', { class: 'ghost', onclick: () => (data.isHost ? hostAddSheet(c) : dishSheet({ category: c })) },
      data.isHost ? `+ Add to ${c.name}` : `+ Bring something else`)));
}

function dietCard() {
  const ms = data.members;
  const needs = DIETS.map(([k, l]) => [l, ms.filter((m) => m.diet.includes(k))]).filter(([, a]) => a.length);
  const notes = ms.filter((m) => m.dietNote);
  const dishes = claimed();
  const tagCounts = TAGS.map(([k, l]) => [k, l, dishes.filter((d) => d.tags.includes(k))]).filter(([, , a]) => a.length);
  if (!needs.length && !notes.length && !tagCounts.length) return null;
  const alerts = [];
  const nutAllergy = ms.filter((m) => m.diet.includes('nut-allergy'));
  const nutDishes = dishes.filter((d) => d.tags.includes('contains-nuts'));
  if (nutAllergy.length && nutDishes.length)
    alerts.push(`Nut allergy (${nutAllergy.map((m) => m.name).join(', ')}): ${nutDishes.map((d) => `“${d.dish}”`).join(', ')} ${nutDishes.length === 1 ? 'contains' : 'contain'} nuts.`);
  const fits = (k) => dishes.filter((d) => d.tags.includes(k) || (k === 'vegetarian' && d.tags.includes('vegan'))).length;
  for (const k of ['vegetarian', 'vegan', 'gluten-free', 'dairy-free']) {
    const who = ms.filter((m) => m.diet.includes(k));
    if (who.length && dishes.length && !fits(k)) alerts.push(`${who.map((m) => m.name).join(', ')} ${who.length === 1 ? 'is' : 'are'} ${dietLabel(k).toLowerCase()}, and no dish is marked ${dietLabel(k).toLowerCase()} yet.`);
  }
  return h('section', { class: 'card', id: 'diet' },
    h('h2', {}, 'Good to know'),
    needs.length || notes.length
      ? h('div', {}, h('h3', { class: 'small muted' }, 'Guests’ dietary needs'),
        h('div', { class: 'diet-grid' }, needs.flatMap(([l, a]) => [h('span', {}, l, h('span', { class: 'muted small' }, ` · ${a.map((m) => m.name).join(', ')}`)), h('span', {}, a.length)])),
        notes.map((m) => h('p', { class: 'small' }, h('b', {}, m.name), `: ${m.dietNote}`)))
      : h('p', { class: 'muted small' }, 'Nobody has listed dietary needs.'),
    tagCounts.length ? h('div', { style: 'margin-top:12px' }, h('h3', { class: 'small muted' }, 'Dishes'),
      h('div', { class: 'diet-grid' }, tagCounts.flatMap(([k, l, a]) => [h('span', {}, k === 'contains-nuts' ? '⚠ ' + l : l), h('span', {}, `${a.length} of ${dishes.length}`)]))) : null,
    alerts.map((a) => h('div', { class: 'alert' }, a)),
    !alerts.length && needs.length && dishes.length ? h('div', { class: 'okline' }, 'Every dietary need has at least one matching dish so far.') : null);
}

function peopleCard() {
  return h('section', { class: 'card', id: 'people' },
    h('h2', {}, `Who’s coming · ${data.members.length}`),
    h('ul', { class: 'people' }, data.members.map((m) => {
      const n = data.items.filter((i) => i.claimedBy === m.id).length;
      return h('li', {},
        h('span', {}, h('b', {}, m.name), m.isHost ? h('span', { class: 'tag host' }, 'Host') : null, m.id === data.me ? h('span', { class: 'muted small' }, ' (you)') : null,
          m.diet.map((d) => h('span', { class: 'tag diet', title: dietLabel(d) }, dietLabel(d)))),
        h('span', { class: 'row' }, h('span', { class: 'muted small' }, n ? `${n} ${n === 1 ? 'item' : 'items'}` : 'nothing yet'),
          editMode && !m.isHost ? h('button', { class: 'ghost danger', 'aria-label': `Remove ${m.name}`,
            onclick: async () => { if (await confirmSheet(`Remove ${m.name}?`, 'Their dishes go back on the list.', 'Remove')) act(() => api('DELETE', `events/${id}/members/${m.id}`, undefined, token)); } }, 'Remove') : null));
    })));
}

function meCard() {
  const m = meM();
  if (!m) {
    return h('section', { class: 'card' }, h('h2', {}, 'Coming, but not sure what to bring?'),
      h('p', { class: 'muted' }, 'Add your name (and any dietary needs) so the host knows. You can pick a dish later.'),
      h('button', { onclick: () => {
        const jf = joinFields();
        openSheet('Add your name', 'No sign-up. Just so the host knows you’re coming.', jf.el, async () => {
          await ensureJoined(jf);
          closeSheet();
          await load();
        }, 'Add me');
      } }, 'Add my name'));
  }
  const mine = data.items.filter((i) => i.claimedBy === m.id);
  return h('section', { class: 'card', id: 'me' },
    h('div', { class: 'spread' }, h('h2', {}, `You’re on the list as ${m.name}`), h('button', { class: 'ghost', onclick: meSheet }, 'Edit')),
    h('p', { class: 'muted' }, mine.length ? `You’re bringing: ${mine.map((i) => i.dish).join(', ')}.` : 'You haven’t picked anything yet. Tap “I’ll bring it” on anything open.'),
    h('label', {}, data.isHost ? 'Your host link' : 'Your personal link'),
    h('p', { class: 'hint', style: 'margin-top:0' }, data.isHost ? 'Keep it private. It lets you manage this list from any device.' : 'Open it on another device to be you there too. Keep it private.'),
    h('div', { class: 'row' }, h('button', { onclick: async () => toast((await copyText(personalLink())) ? 'Personal link copied.' : 'Could not copy.') }, 'Copy my link'),
      !data.isHost ? h('button', { class: 'ghost danger', onclick: async () => { if (await confirmSheet('Leave this list?', 'Your name and dishes are removed.', 'Leave')) act(async () => { await api('DELETE', `events/${id}/me`, undefined, token); store.drop(id); token = null; }, 'You left the list.'); } }, 'Leave the list') : null));
}

function hostCard() {
  if (!data.isHost) return null;
  return h('section', { class: 'card', id: 'host' },
    h('h2', {}, 'Host tools'),
    h('div', { class: 'row' },
      h('button', { onclick: detailsSheet }, 'Edit details'),
      h('button', { onclick: () => categorySheet(null) }, '+ Category'),
      h('button', { 'aria-pressed': String(editMode), onclick: () => { editMode = !editMode; render(); } }, editMode ? 'Done editing' : 'Edit list & people'),
      h('button', { class: 'ghost danger', onclick: async () => {
        if (await confirmSheet('Delete this list?', 'Everyone loses access. This can’t be undone.', 'Delete'))
          try { await api('DELETE', `events/${id}`, undefined, token); store.drop(id); location.href = '/'; } catch (e) { toast(e.message); }
      } }, 'Delete list')));
}

function render() {
  const ev = data.event;
  const sl = slots();
  const covered = sl.filter((i) => i.claimedBy).length;
  const pct = sl.length ? Math.round((covered / sl.length) * 100) : 0;
  const host = data.members.find((m) => m.isHost);
  const need = stillNeeded();
  const meta = [
    ev.date ? h('span', {}, ico('cal'), fmtDate(ev.date, true)) : null,
    ev.time ? h('span', {}, ico('clock'), fmtTime(ev.time)) : null,
    ev.place ? h('span', {}, ico('pin'), ev.place) : null,
    host ? h('span', {}, ico('host'), 'Hosted by ', host.name) : null,
  ];
  const scrollY = window.scrollY;
  const parts = [
    isNew && data.isHost ? h('div', { class: 'banner', id: 'new-banner' }, h('b', {}, 'Your list is ready. '),
      'Now drop the link in your group chat. People claim dishes from their phones, no sign-up.') : null,
    h('section', { class: 'card ev-head' },
      h('h1', {}, ev.name),
      h('div', { class: 'meta-line' }, meta),
      ev.note ? h('div', { class: 'note' }, ev.note) : null,
      sl.length ? [h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': sl.length, 'aria-valuenow': covered, 'aria-label': 'Items covered' }, h('i', { style: `width:${pct}%` })),
        h('div', { class: 'spread small' }, h('b', { id: 'covered' }, covered === sl.length ? `All ${sl.length} covered 🎉` : `${covered} of ${sl.length} covered`),
          h('span', { class: 'muted' }, `${data.members.length} ${data.members.length === 1 ? 'person' : 'people'} in`)),
        need.length ? h('p', { class: 'muted small' }, `Still needed: ${need.join(', ')}`) : null] : null,
      h('div', { class: 'share-row' }, h('button', { class: 'primary', id: 'share', onclick: share }, ico('share'), 'Share the list'), h('button', { id: 'menu', onclick: menuSheet }, 'Menu card'))),
    !data.me ? h('p', { class: 'muted small', style: 'margin:0 4px 12px' }, 'Tap “I’ll bring it” on anything open. You only need your first name.') : null,
    editMode ? h('div', { class: 'okline', style: 'margin-bottom:14px' }, 'Editing: rename or remove items and categories, free up claimed dishes, remove people. Tap “Done editing” when finished.') : null,
    data.categories.map(categoryCard),
    !data.categories.length ? h('div', { class: 'card empty muted' }, data.isHost ? 'Add a category to get started.' : 'The host hasn’t added anything yet.') : null,
    dietCard(),
    meCard(),
    peopleCard(),
    hostCard(),
    data.isHost ? null : h('section', { class: 'card start-own' }, h('h2', {}, 'Hosting something too?'),
      h('p', { class: 'muted' }, 'Make your own who’s-bringing-what list in 20 seconds. Free, no sign-up.'),
      h('a', { class: 'btn primary', href: '/?ref=list' }, 'Start your own list')),
  ];
  app.replaceChildren(...parts.flat(Infinity).filter(Boolean));
  window.scrollTo(0, scrollY);
}

// ---------- live updates: cheap version check, full reload only on change ----------
let lastPoll = Date.now();
async function poll() {
  if (document.hidden || busy || !data) return;
  if (sheetRoot.childElementCount) return; // don't shift the page under an open form
  lastPoll = Date.now();
  try {
    const r = await api('GET', `events/${id}/v`);
    if (r.v !== data.event.updatedAt) await load();
  } catch {}
}
setInterval(poll, 10000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastPoll > 4000) poll(); });

load();
