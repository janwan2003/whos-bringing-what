import { h, api, store, TEMPLATES } from './common.js';

const $ = (id) => document.getElementById(id);
let kind = new URLSearchParams(location.search).get('kind');
if (!TEMPLATES[kind]) kind = 'friendsgiving';
let cats = [];
let nameTouched = false;

function setKind(k) {
  kind = k;
  const t = TEMPLATES[k];
  cats = t.categories.map((c) => ({ name: c.name, slots: [...c.slots] }));
  if (!nameTouched) $('name').value = t.name;
  renderKinds();
  renderCats();
}

function renderKinds() {
  $('kinds').replaceChildren(
    ...Object.entries(TEMPLATES).map(([k, t]) =>
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(k === kind), onclick: () => setKind(k) }, `${t.emoji} ${t.label}`)
    )
  );
}

// Each category keeps its slot labels; the stepper adds or removes copies of the generic label.
function genericLabel(c) {
  const counts = {};
  for (const s of c.slots) counts[s] = (counts[s] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] > 1 ? top[0] : c.name.replace(/s$/, '') || 'Item';
}

function renderCats() {
  $('cats').replaceChildren(
    ...cats.map((c, i) => {
      const n = c.slots.length;
      return h('div', { class: 'cat-edit' },
        h('input', { type: 'text', value: c.name, maxlength: 40, 'aria-label': 'Category name', oninput: (e) => (c.name = e.target.value) }),
        h('div', { class: 'stepper', role: 'group', 'aria-label': `How many ${c.name}` },
          h('button', { type: 'button', 'aria-label': `Fewer ${c.name}`, disabled: n === 0, onclick: () => { c.slots.pop(); renderCats(); } }, '−'),
          h('span', { 'aria-live': 'polite' }, n),
          h('button', { type: 'button', 'aria-label': `More ${c.name}`, disabled: n >= 40, onclick: () => { c.slots.push(genericLabel(c)); renderCats(); } }, '+')
        ),
        h('button', { type: 'button', class: 'icon-btn ghost', 'aria-label': `Remove ${c.name}`, title: 'Remove', onclick: () => { cats.splice(i, 1); renderCats(); } }, '✕')
      );
    })
  );
  $('addcat').disabled = cats.length >= 12;
}

$('addcat').addEventListener('click', () => {
  cats.push({ name: '', slots: ['Item', 'Item'] });
  renderCats();
  const inputs = $('cats').querySelectorAll('input');
  inputs[inputs.length - 1].focus();
});
$('name').addEventListener('input', () => (nameTouched = true));

$('create').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('err');
  err.textContent = '';
  const name = $('name').value.trim();
  const hostName = $('host').value.trim();
  if (!name) { err.textContent = 'Give your event a name.'; $('name').focus(); return; }
  if (!hostName) { err.textContent = 'Add your name so guests know who is hosting.'; $('host').focus(); return; }
  const categories = cats
    .map((c) => ({ name: c.name.trim(), slots: c.slots.map((s) => (s === 'Item' && c.name.trim() ? c.name.trim().replace(/s$/, '') : s)) }))
    .filter((c) => c.name);
  const btn = $('go');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const r = await api('POST', 'events', {
      name, hostName, kind, categories,
      date: $('date').value, time: $('time').value, place: $('place').value,
    });
    store.set(r.id, r.token);
    store.remember(r.id, name);
    location.href = `/e/${r.id}?new=1`;
  } catch (ex) {
    err.textContent = ex.message;
    btn.disabled = false;
    btn.textContent = 'Create the list';
  }
});

function renderRecent() {
  const list = store.recent().filter((x) => store.get(x.id));
  if (!list.length) return;
  $('recent-box').hidden = false;
  $('recent').replaceChildren(...list.map((x) => h('li', {}, h('a', { href: `/e/${x.id}` }, x.name || 'Untitled list'), h('span', { class: 'muted small' }, 'Open →'))));
}

setKind(kind);
renderRecent();
