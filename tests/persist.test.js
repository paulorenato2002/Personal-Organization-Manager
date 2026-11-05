const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../js/data/seed.js');
const { validateImport } = require('../js/data/persist.js');

test('recusa formatos inválidos', () => {
  for (const bad of [null, [], {}, 'x', 5]) {
    assert.equal(validateImport(bad).ok, false);
  }
});

test('recusa versão mais nova que a do app', () => {
  const s = seed.initialState({ start: 'vazio' });
  assert.equal(validateImport({ ...s, version: 99 }).ok, false);
});

test('recusa listas com tipo errado ou ausentes', () => {
  const s = seed.initialState({ start: 'vazio' });
  assert.equal(validateImport({ ...s, items: 'x' }).ok, false);
  const semSessoes = { ...s };
  delete semSessoes.sessions;
  assert.equal(validateImport(semSessoes).ok, false);
});

test('aceita um estado válido e dá a mensagem em português ao recusar', () => {
  assert.equal(validateImport(seed.initialState({ start: 'vazio' })).ok, true);
  assert.match(validateImport({}).error, /arquivo/i);
});
