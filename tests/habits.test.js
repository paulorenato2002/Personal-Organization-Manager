const test = require('node:test');
const assert = require('node:assert/strict');
const { dayLevel, gridCell, dayScore, formatAmount, stepLabel } = require('../js/logic/habits.js');

const check = { id: 'c', type: 'check', startDate: '2026-11-01' };
const agua = { id: 'w', type: 'counter', goal: 3000, step: 500, unit: 'ml', startDate: '2026-11-01' };
const list = { id: 'l', type: 'list', listItems: ['Café', 'Almoço', 'Jantar'], startDate: '2026-11-01' };

test('sim ou não só fica completo ou vazio', () => {
  assert.equal(dayLevel(check, true), 'full');
  assert.equal(dayLevel(check, false), 'none');
  assert.equal(dayLevel(check, undefined), 'none');
});

test('quantidade fica parcial até atingir a meta', () => {
  assert.equal(dayLevel(agua, 3000), 'full');
  assert.equal(dayLevel(agua, 3500), 'full');
  assert.equal(dayLevel(agua, 500), 'partial');
  assert.equal(dayLevel(agua, 0), 'none');
  assert.equal(dayLevel(agua, undefined), 'none');
});

test('lista fica parcial até marcar todos', () => {
  assert.equal(dayLevel(list, ['Café', 'Almoço', 'Jantar']), 'full');
  assert.equal(dayLevel(list, ['Café']), 'partial');
  assert.equal(dayLevel(list, []), 'none');
});

test('grade: verde, amarelo e vermelho nos dias passados', () => {
  const log = { '2026-11-02': { w: 3000 }, '2026-11-03': { w: 500 } };
  assert.equal(gridCell(agua, log, '2026-11-02', '2026-11-05'), 'full');
  assert.equal(gridCell(agua, log, '2026-11-03', '2026-11-05'), 'partial');
  assert.equal(gridCell(agua, log, '2026-11-04', '2026-11-05'), 'none');
});

test('grade: hoje fica neutro até haver progresso', () => {
  assert.equal(gridCell(agua, {}, '2026-11-05', '2026-11-05'), 'pending');
  assert.equal(gridCell(agua, { '2026-11-05': { w: 500 } }, '2026-11-05', '2026-11-05'), 'partial');
  assert.equal(gridCell(agua, { '2026-11-05': { w: 3000 } }, '2026-11-05', '2026-11-05'), 'full');
});

test('grade: antes da meta existir e no futuro fica em branco', () => {
  assert.equal(gridCell(agua, {}, '2026-10-31', '2026-11-05'), 'blank');
  assert.equal(gridCell(agua, {}, '2026-11-06', '2026-11-05'), 'blank');
});

test('grade: registro feito antes do início conta', () => {
  assert.equal(gridCell(agua, { '2026-10-31': { w: 3000 } }, '2026-10-31', '2026-11-05'), 'full');
});

test('placar do dia conta só as metas que já existiam', () => {
  const log = { '2026-11-05': { c: true, w: 500 } };
  const novo = { ...check, id: 'n', startDate: '2026-11-06' };
  assert.deepEqual(dayScore([check, agua, list, novo], log, '2026-11-05'), { done: 1, total: 3 });
});

test('quantidades aparecem em unidades legíveis', () => {
  assert.equal(formatAmount(agua, 500), '500 ml');
  assert.equal(formatAmount(agua, 3000), '3 L');
  assert.equal(formatAmount(agua, 1500), '1,5 L');
  const horas = { unit: 'min' };
  assert.equal(formatAmount(horas, 30), '30 min');
  assert.equal(formatAmount(horas, 120), '2 h');
  assert.equal(formatAmount(horas, 90), '1 h 30');
  assert.equal(formatAmount({ unit: 'páginas' }, 10), '10 páginas');
  assert.equal(formatAmount({ unit: '' }, 3), '3');
});

test('botão mostra o passo', () => {
  assert.equal(stepLabel(agua), '+500 ml');
  assert.equal(stepLabel({ step: 60, unit: 'min' }), '+1 h');
});
