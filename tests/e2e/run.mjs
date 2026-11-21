// End-to-end test in real Chromium with 7 separate browser contexts (host on desktop, guests on phones):
// create from a template, claim, duplicate warning, nut-allergy warning, claim race, duplicate name,
// live update without reload, dietary summary, edit/drop, personal link on a new device, host edit mode,
// menu card, leave, delete. Screenshots at phone and desktop width go to shots/.
// Usage: BASE=http://127.0.0.1:8788 node tests/e2e/run.mjs
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const SHOTS = process.env.SHOTS || 'shots';
fs.mkdirSync(SHOTS, { recursive: true });

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const root = path.join(os.homedir(), '.cache/ms-playwright');
  for (const d of fs.readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
    const p = path.join(root, d, 'chrome-linux64/chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 860 } };
const errors = [];
const browser = await chromium.launch({ executablePath: findChrome() });
const expected409 = new Set(['Eve', 'Fay']);
let deleted = false; // after the host deletes the list, a guest's reload is meant to get a 404

async function person(label, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !(expected409.has(label) && /status of 409/.test(m.text())) && !(deleted && label === 'Cy' && /status of 404/.test(m.text()))) errors.push(`${label}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  return { label, ctx, page };
}
const step = (s) => console.log('·', s);
const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, name), fullPage: true });
const sheet = (p) => p.locator('.sheet');
const cat = (p, name) => p.locator('section.cat', { has: p.locator('h2 > span', { hasText: new RegExp(`^${name}$`) }) });

async function chips(p, labels, group = 'Dish details') {
  const g = sheet(p).getByRole('group', { name: group });
  for (const l of labels) await g.getByRole('button', { name: l, exact: true }).click();
}
// Claim the first open slot in a category.
async function claim(p, catName, { name, diet = [], dish, tags = [] }) {
  await cat(p, catName).locator('.item.open').first().getByRole('button', { name: 'I’ll bring it' }).click();
  await sheet(p).waitFor();
  if (name) await sheet(p).getByLabel('Your name').fill(name);
  if (diet.length) await chips(p, diet, 'Dietary needs');
  if (dish) await sheet(p).getByLabel('What exactly?').fill(dish);
  if (tags.length) await chips(p, tags);
}
const submit = (p) => sheet(p).locator('button[type=submit]').click();

let eventId;
try {
  // ---------- host creates ----------
  const host = await person('Sam', DESKTOP);
  step('home page');
  await host.page.goto(BASE + '/');
  await host.page.getByRole('heading', { name: /Who's bringing what\?/ }).waitFor();
  await shot(host.page, 'home-desktop.png');
  await host.page.getByRole('button', { name: /Christmas dinner/ }).click();
  assert.equal(await host.page.locator('#name').inputValue(), 'Christmas dinner');
  await host.page.getByRole('button', { name: /Friendsgiving/ }).click();
  await host.page.locator('#create button[type=submit]').click();
  assert.match(await host.page.locator('#err').textContent(), /your name/i, 'host name required');
  await host.page.locator('#name').fill("Friendsgiving at Sam's");
  await host.page.locator('#date').fill('2026-11-27');
  await host.page.locator('#time').fill('18:30');
  await host.page.locator('#host').fill('Sam');
  await host.page.getByRole('button', { name: 'Fewer Sides' }).click(); // 5 -> 4 sides
  step('create');
  await host.page.locator('#create button[type=submit]').click();
  await host.page.waitForURL(/\/e\/[A-Za-z0-9]+\?new=1/);
  eventId = new URL(host.page.url()).pathname.split('/')[2];
  await host.page.locator('#new-banner').waitFor();
  assert.equal(await host.page.locator('#covered').textContent(), '0 of 11 covered');
  assert.equal(await cat(host.page, 'Sides').locator('.item').count(), 4);
  await claim(host.page, 'Mains', { dish: 'Roast turkey' });
  await submit(host.page);
  await host.page.locator('.item.mine', { hasText: 'Roast turkey' }).waitFor();
  assert.equal(await host.page.locator('#covered').textContent(), '1 of 11 covered');
  const link = `${BASE}/e/${eventId}`;

  step('link preview (Open Graph) shows live state');
  const og = async () => (await (await fetch(link)).text()).match(/property="og:description" content="([^"]*)"/)[1];
  const og1 = await og();
  assert.match(og1, /1 person in · 1 of 11 covered/);
  assert.match(og1, /Still needed: 4 sides, 2 desserts, 2 drinks, 2 extras/);
  assert.match(await (await fetch(link)).text(), /og:title" content="Friendsgiving at Sam&#39;s · Who&#39;s bringing what\?"/);

  // ---------- guests ----------
  const ana = await person('Ana', PHONE);
  step('Ana joins by claiming a side (vegetarian)');
  await ana.page.goto(link);
  await ana.page.getByRole('heading', { name: "Friendsgiving at Sam's" }).waitFor();
  await shot(ana.page, 'event-phone-guest-first-open.png');
  await claim(ana.page, 'Sides', { name: 'Ana', diet: ['Vegetarian'], dish: 'Mashed potatoes', tags: ['Vegetarian'] });
  await ana.page.waitForTimeout(400);
  await shot(ana.page, 'claim-sheet-phone.png');
  await submit(ana.page);
  await ana.page.locator('.item.mine', { hasText: 'Mashed potatoes' }).waitFor();
  assert.match(await ana.page.locator('#me h2').textContent(), /as Ana/);

  step('Sam sees it live, without reloading');
  await host.page.locator('.item', { hasText: 'Mashed potatoes' }).waitFor({ timeout: 25000 });

  const ben = await person('Ben', PHONE);
  step('Ben adds his name only (nut allergy), then claims drinks');
  await ben.page.goto(link);
  await ben.page.getByRole('button', { name: 'Add my name' }).click();
  await sheet(ben.page).getByLabel('Your name').fill('Ben');
  await chips(ben.page, ['Nut allergy'], 'Dietary needs');
  await submit(ben.page);
  await ben.page.locator('#me h2', { hasText: 'as Ben' }).waitFor();
  await claim(ben.page, 'Drinks', { dish: 'Sparkling cider', tags: ['Vegan', 'Gluten-free'] });
  await submit(ben.page);
  await ben.page.locator('.item.mine', { hasText: 'Sparkling cider' }).waitFor();

  const cy = await person('Cy', PHONE);
  step('Cy: duplicate warning on an extra, then a nut dessert with an allergy warning');
  await cy.page.goto(link);
  await cat(cy.page, 'Sides').getByRole('button', { name: '+ Bring something else' }).click();
  await sheet(cy.page).getByLabel('Your name').fill('Cy');
  await sheet(cy.page).getByLabel('What will you bring?').fill('mashed potato');
  await sheet(cy.page).locator('.alert', { hasText: 'Ana is already bringing “Mashed potatoes”' }).waitFor();
  await sheet(cy.page).getByLabel('What will you bring?').fill('Green bean casserole');
  assert.equal(await sheet(cy.page).locator('.alert').count(), 0, 'warning clears for a different dish');
  await submit(cy.page);
  await cy.page.locator('.item.mine', { hasText: 'Green bean casserole' }).waitFor();
  await claim(cy.page, 'Desserts', { dish: 'Pecan pie', tags: ['Contains nuts'] });
  await sheet(cy.page).locator('.alert', { hasText: 'Ben has a nut allergy' }).waitFor();
  await submit(cy.page);
  await cy.page.locator('.item.mine', { hasText: 'Pecan pie' }).waitFor();

  step('claim race: Dee and Eve open the same slot, Dee wins, Eve gets a clear message');
  const dee = await person('Dee', PHONE);
  const eve = await person('Eve', PHONE);
  await dee.page.goto(link);
  await eve.page.goto(link);
  for (const [p, n] of [[dee.page, 'Dee'], [eve.page, 'Eve']]) {
    await cat(p, 'Extras').locator('.item.open', { hasText: 'Ice' }).getByRole('button', { name: 'I’ll bring it' }).click();
    await sheet(p).getByLabel('Your name').fill(n);
    assert.equal(await sheet(p).getByLabel('What exactly?').inputValue(), 'Ice', 'specific item pre-fills the dish');
  }
  await submit(dee.page);
  await dee.page.locator('.item.mine', { hasText: 'Ice' }).waitFor();
  await submit(eve.page);
  await sheet(eve.page).locator('.err', { hasText: 'Dee just took that one' }).waitFor();
  await sheet(eve.page).getByRole('button', { name: 'Cancel' }).click();
  await eve.page.locator('#me h2', { hasText: 'as Eve' }).waitFor(); // Eve still joined
  await claim(eve.page, 'Desserts', { dish: 'Apple crumble', tags: ['Vegetarian'] });
  await submit(eve.page);
  await eve.page.locator('.item.mine', { hasText: 'Apple crumble' }).waitFor();

  step('duplicate name is rejected');
  const fay = await person('Fay', PHONE);
  await fay.page.goto(link);
  await claim(fay.page, 'Sides', { name: 'ana', dish: 'Rolls' });
  await submit(fay.page);
  await sheet(fay.page).locator('.err', { hasText: 'already on this list' }).waitFor();
  await fay.ctx.close();

  step('dietary summary');
  await ana.page.reload();
  const diet = ana.page.locator('#diet');
  await diet.waitFor();
  const dietText = await diet.textContent();
  assert.match(dietText, /Vegetarian · Ana/);
  assert.match(dietText, /Nut allergy · Ben/);
  assert.match(dietText, /Nut allergy \(Ben\): “Pecan pie” contains nuts/);
  assert.match(dietText, /Contains nuts1 of 7/);
  await shot(ana.page, 'event-phone-guest.png');

  step('Ana edits, drops and re-claims');
  await ana.page.locator('.item.mine', { hasText: 'Mashed potatoes' }).getByRole('button', { name: 'Edit' }).click();
  await sheet(ana.page).getByLabel('What are you bringing?').fill('Garlic mashed potatoes');
  await submit(ana.page);
  await ana.page.locator('.item.mine', { hasText: 'Garlic mashed potatoes' }).waitFor();
  await ana.page.locator('.item.mine', { hasText: 'Garlic mashed potatoes' }).getByRole('button', { name: /Drop/ }).click();
  await sheet(ana.page).getByRole('button', { name: 'Drop it' }).click();
  await ana.page.locator('.toast', { hasText: 'open again' }).waitFor();
  assert.equal(await ana.page.locator('.item.mine').count(), 0);
  await claim(ana.page, 'Sides', { dish: 'Garlic mashed potatoes', tags: ['Vegetarian', 'Gluten-free'] });
  await submit(ana.page);
  await ana.page.locator('.item.mine', { hasText: 'Garlic mashed potatoes' }).waitFor();

  step('personal link works on a new device and is stripped from the URL');
  const tok = await ana.page.evaluate((id) => localStorage.getItem('wbw:' + id), eventId);
  const ana2 = await person('Ana-laptop', DESKTOP);
  await ana2.page.goto(`${link}#k=${tok}`);
  await ana2.page.locator('#me h2', { hasText: 'as Ana' }).waitFor();
  assert.ok(!ana2.page.url().includes('#k='), 'token removed from URL');
  await ana2.ctx.close();

  step('host: menu card, edit mode, remove a guest, rename a category');
  await host.page.reload();
  await host.page.getByRole('button', { name: 'Menu card' }).click();
  const menu = await host.page.locator('.menu-card').textContent();
  assert.match(menu, /Roast turkey/);
  assert.match(menu, /Pecan pie · Cy · Nuts/);
  await host.page.waitForTimeout(400);
  await shot(host.page, 'menu-card-desktop.png');
  await sheet(host.page).getByRole('button', { name: 'Close' }).click();
  await host.page.getByRole('button', { name: 'Edit list & people' }).click();
  await host.page.locator('#people li', { hasText: 'Eve' }).getByRole('button', { name: 'Remove Eve' }).click();
  await sheet(host.page).getByRole('button', { name: 'Remove' }).click();
  await host.page.locator('#people li', { hasText: 'Eve' }).waitFor({ state: 'detached' });
  assert.equal(await host.page.locator('.item', { hasText: 'Apple crumble' }).count(), 0, "Eve's dish freed");
  await cat(host.page, 'Extras').getByRole('button', { name: 'Rename' }).first().click();
  await sheet(host.page).getByLabel('Category name').fill('Supplies');
  await submit(host.page);
  await cat(host.page, 'Supplies').waitFor();
  await host.page.getByRole('button', { name: 'Done editing' }).click();
  await shot(host.page, 'event-desktop-host.png');
  await host.page.setViewportSize({ width: 390, height: 844 });
  await shot(host.page, 'event-phone-host.png');
  await host.page.setViewportSize(DESKTOP.viewport);
  const covered = await host.page.locator('#covered').textContent();
  assert.equal(covered, '5 of 11 covered'); // main, side, drinks, dessert, ice (Eve's dessert was freed; Cy's beans are an extra)
  assert.match(await og(), /5 people in · 5 of 11 covered/);

  step('Ben leaves');
  await ben.page.reload();
  await ben.page.getByRole('button', { name: 'Leave the list' }).click();
  await sheet(ben.page).getByRole('button', { name: 'Leave' }).click();
  await ben.page.getByRole('button', { name: 'Add my name' }).waitFor();
  assert.equal(await ben.page.locator('.item', { hasText: 'Sparkling cider' }).count(), 0);

  step('home on phone shows the list under "Your lists"');
  const home = await host.ctx.newPage();
  await home.setViewportSize({ width: 390, height: 844 });
  await home.goto(BASE + '/');
  await home.locator('#recent a', { hasText: "Friendsgiving at Sam's" }).waitFor();
  await shot(home, 'home-phone.png');
  await home.close();

  step('host deletes the list');
  await host.page.getByRole('button', { name: 'Delete list' }).click();
  await sheet(host.page).getByRole('button', { name: 'Delete' }).click();
  await host.page.waitForURL(BASE + '/');
  eventId = null;
  deleted = true;
  await cy.page.reload();
  await cy.page.getByRole('heading', { name: 'This list is gone' }).waitFor();
  assert.equal((await fetch(`${BASE}/api/events/${new URL(link).pathname.split('/')[2]}`)).status, 404);

  assert.deepEqual(errors, [], 'no console errors');
  console.log('\nPASS: all e2e steps');
} catch (e) {
  console.error('\nFAIL:', e.message);
  if (errors.length) console.error('console errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
