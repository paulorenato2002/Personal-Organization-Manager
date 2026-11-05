const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../js/logic/quickadd.js');

test('separa cliente e título', () => {
  assert.deepEqual(parse('ACME - enviar boletos'), { clientName: 'ACME', title: 'enviar boletos' });
});

test('separa só no primeiro separador', () => {
  assert.deepEqual(parse('ACME - revisar - urgente'), { clientName: 'ACME', title: 'revisar - urgente' });
});

test('hífen sem espaços não separa', () => {
  assert.deepEqual(parse('pagar-contas'), { clientName: null, title: 'pagar-contas' });
});

test('sem cliente antes do separador vira só título', () => {
  assert.deepEqual(parse('  - sem cliente '), { clientName: null, title: '- sem cliente' });
});

test('sem título depois do separador vira só título', () => {
  assert.deepEqual(parse('ACME - '), { clientName: null, title: 'ACME -' });
});

test('texto vazio retorna null', () => {
  assert.equal(parse('   '), null);
  assert.equal(parse(''), null);
});
