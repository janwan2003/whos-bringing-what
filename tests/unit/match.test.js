import { test } from 'node:test';
import assert from 'node:assert/strict';
import { similarDishes, words, TEMPLATES } from '../../public/common.js';

const list = (...d) => d.map((dish, i) => ({ id: String(i), dish }));
const hit = (dish, ...existing) => similarDishes(dish, list(...existing)).map((x) => x.dish);

test('same dish in different words is flagged', () => {
  assert.deepEqual(hit('Mashed potatoes', 'mashed potato'), ['mashed potato']);
  assert.deepEqual(hit('potatoes', 'Mashed Potatoes'), ['Mashed Potatoes']);
  assert.deepEqual(hit('Mac & cheese', 'Mac and Cheese'), ['Mac and Cheese']);
  assert.deepEqual(hit('Homemade pumpkin pie', 'Pumpkin pie'), ['Pumpkin pie']);
  assert.deepEqual(hit('Cranberry sauce', 'cranberries'), ['cranberries']);
});

test('different dishes sharing a generic word are not flagged', () => {
  assert.deepEqual(hit('Apple pie', 'Pumpkin pie'), []);
  assert.deepEqual(hit('Green salad', 'Potato salad'), []);
  assert.deepEqual(hit('Red wine', 'White wine'), []);
  assert.deepEqual(hit('Chips & dip', 'Chocolate cake'), []);
  assert.deepEqual(hit('Sugar cookies', 'Oatmeal cookie'), []);
  assert.deepEqual(hit('', 'Anything'), []);
});

test('words() strips stop words, accents and plurals', () => {
  assert.deepEqual(words('The Crème Brûlées!'), ['creme', 'brulee']);
  assert.deepEqual(words('Some homemade cookies'), words('cookie'));
  assert.deepEqual(words('brownies'), words('Brownie'));
  assert.deepEqual(words('potatoes'), words('potato'));
});

test('every template is within server limits', () => {
  for (const t of Object.values(TEMPLATES)) {
    assert.ok(t.categories.length <= 12);
    const n = t.categories.reduce((a, c) => a + c.slots.length, 0);
    assert.ok(n > 0 && n <= 150);
    for (const c of t.categories) for (const s of c.slots) assert.ok(s.length <= 60 && c.name.length <= 40);
  }
});
