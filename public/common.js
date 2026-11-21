// Shared helpers: safe DOM builder, API client, per-event token storage, templates,
// dietary labels and the "is this a duplicate dish?" matcher.

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

const KEY = (id) => `wbw:${id}`;
export const store = {
  get: (id) => {
    try { return localStorage.getItem(KEY(id)); } catch { return null; }
  },
  set: (id, tok) => {
    try { localStorage.setItem(KEY(id), tok); } catch {}
  },
  remember: (id, name) => {
    try {
      const all = JSON.parse(localStorage.getItem('wbw:recent') || '[]').filter((x) => x.id !== id);
      all.unshift({ id, name, t: Date.now() });
      localStorage.setItem('wbw:recent', JSON.stringify(all.slice(0, 20)));
    } catch {}
  },
  drop: (id) => {
    try { localStorage.removeItem(KEY(id)); } catch {}
    try {
      const all = JSON.parse(localStorage.getItem('wbw:recent') || '[]').filter((x) => x.id !== id);
      localStorage.setItem('wbw:recent', JSON.stringify(all));
    } catch {}
  },
  recent: () => {
    try { return JSON.parse(localStorage.getItem('wbw:recent') || '[]'); } catch { return []; }
  },
};

export async function api(method, path, data, token) {
  const headers = {};
  if (data !== undefined) headers['content-type'] = 'application/json';
  if (token) headers['x-token'] = token;
  let res;
  try {
    res = await fetch('/api/' + path, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) });
  } catch {
    throw Object.assign(new Error('No connection. Check your internet and try again.'), { status: 0 });
  }
  let out = {};
  try { out = await res.json(); } catch {}
  if (!res.ok) throw Object.assign(new Error(out.error || `Error ${res.status}`), { status: res.status });
  return out;
}

let toastTimer;
export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

export const DIETS = [
  ['vegetarian', 'Vegetarian'],
  ['vegan', 'Vegan'],
  ['gluten-free', 'Gluten-free'],
  ['dairy-free', 'Dairy-free'],
  ['nut-allergy', 'Nut allergy'],
];
export const TAGS = [
  ['vegetarian', 'Vegetarian', 'V'],
  ['vegan', 'Vegan', 'VG'],
  ['gluten-free', 'Gluten-free', 'GF'],
  ['dairy-free', 'Dairy-free', 'DF'],
  ['contains-nuts', 'Contains nuts', 'Nuts'],
];

const s = (label, n) => Array(n).fill(label);
export const TEMPLATES = {
  friendsgiving: {
    label: 'Friendsgiving', emoji: '🦃', name: 'Friendsgiving',
    categories: [
      { name: 'Mains', slots: s('Main dish', 1) },
      { name: 'Sides', slots: s('Side dish', 5) },
      { name: 'Desserts', slots: s('Dessert', 2) },
      { name: 'Drinks', slots: s('Drinks', 2) },
      { name: 'Extras', slots: ['Ice', 'Plates & napkins'] },
    ],
  },
  christmas: {
    label: 'Christmas dinner', emoji: '🎄', name: 'Christmas dinner',
    categories: [
      { name: 'Starters', slots: s('Starter', 2) },
      { name: 'Mains', slots: s('Main dish', 1) },
      { name: 'Sides', slots: s('Side dish', 4) },
      { name: 'Desserts', slots: s('Dessert', 2) },
      { name: 'Drinks', slots: s('Drinks', 3) },
    ],
  },
  potluck: {
    label: 'Potluck', emoji: '🥘', name: 'Potluck',
    categories: [
      { name: 'Mains', slots: s('Main dish', 3) },
      { name: 'Sides & salads', slots: s('Side or salad', 4) },
      { name: 'Desserts', slots: s('Dessert', 2) },
      { name: 'Drinks', slots: s('Drinks', 2) },
      { name: 'Supplies', slots: ['Plates & cutlery', 'Cups'] },
    ],
  },
  bbq: {
    label: 'BBQ', emoji: '🔥', name: 'BBQ',
    categories: [
      { name: 'For the grill', slots: s('Something to grill', 3) },
      { name: 'Sides & salads', slots: s('Side or salad', 3) },
      { name: 'Snacks', slots: s('Snack', 2) },
      { name: 'Desserts', slots: s('Dessert', 1) },
      { name: 'Drinks', slots: s('Drinks', 3) },
      { name: 'Supplies', slots: ['Ice', 'Charcoal', 'Plates & cups'] },
    ],
  },
  party: {
    label: 'Party / game night', emoji: '🎉', name: 'Party',
    categories: [
      { name: 'Snacks', slots: s('Snack', 4) },
      { name: 'Drinks', slots: s('Drinks', 3) },
      { name: 'Sweets', slots: s('Something sweet', 1) },
      { name: 'Supplies', slots: ['Ice', 'Cups'] },
    ],
  },
  newyear: {
    label: "New Year's Eve", emoji: '🥂', name: "New Year's Eve",
    categories: [
      { name: 'Food', slots: s('Snack or dish', 4) },
      { name: 'Drinks', slots: s('Drinks', 3) },
      { name: 'Bubbly', slots: s('Bottle for midnight', 2) },
      { name: 'Extras', slots: ['Ice', 'Cups'] },
    ],
  },
  blank: { label: 'Start blank', emoji: '✏️', name: '', categories: [{ name: 'Food', slots: s('Dish', 3) }, { name: 'Drinks', slots: s('Drinks', 2) }] },
};

// ---- duplicate matcher (also unit-tested in node) ----
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'with', 'my', 'some', 'homemade', 'home', 'made', 'fresh', 'big', 'small', 'mini',
  'dish', 'side', 'main', 'dessert', 'drink', 'drinks', 'something', 'bottle', 'bottles', 'box', 'bag', 'tray', 'plate', 'bowl', 'of', 'for', 'to', 'grill']);
function stem(w) {
  // Crude English singular, applied the same way to both sides: cookies/cookie -> cooky, potatoes/potato -> potato.
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('ie')) w = w.slice(0, -2) + 'y';
  else if (w.length > 3 && w.endsWith('oe')) w = w.slice(0, -1);
  return w;
}
export function words(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9À-￿]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem);
}
// Returns the existing dishes that look like the same thing as `dish`.
// Same thing = same words after cleanup, or sharing a specific word of 4+ letters ("potatoes" ~ "mashed potato").
const GENERIC = new Set(['salad', 'sauce', 'bread', 'cake', 'cookie', 'chip', 'snack', 'wine', 'beer', 'soda', 'juice', 'water', 'roll', 'veggie', 'vegetable', 'cheese', 'dip'].map(stem));
export function similarDishes(dish, existing) {
  const a = words(dish);
  if (!a.length) return [];
  const aj = a.join(' ');
  const out = [];
  for (const e of existing) {
    const b = words(e.dish);
    if (!b.length) continue;
    if (b.join(' ') === aj) { out.push(e); continue; }
    const shared = a.filter((w) => b.includes(w));
    const specific = shared.filter((w) => w.length >= 4 && !GENERIC.has(w));
    if (specific.length || (shared.length && shared.length === Math.min(a.length, b.length) && shared.length >= 2)) out.push(e);
  }
  return out;
}

export function fmtDate(d, long) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00Z');
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString(undefined, { weekday: long ? 'long' : 'short', month: long ? 'long' : 'short', day: 'numeric', timeZone: 'UTC' });
}
export function fmtTime(t) {
  if (!t) return '';
  const [H, M] = t.split(':').map(Number);
  const d = new Date(Date.UTC(2000, 0, 1, H, M));
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}
