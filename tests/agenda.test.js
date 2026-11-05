const test = require('node:test');
const assert = require('node:assert/strict');
const { eventsBetween, monthGrid, weekDays, layoutDay } = require('../js/logic/agenda.js');

const rotina = (id, freq, startDate) => ({ id, kind: 'rotina', freq, startDate, doneThrough: null, completions: [] });

test('reúne compromissos, pontuais com data e rotinas nas datas em que ocorrem', () => {
  const items = [
    { id: 'c', kind: 'compromisso', start: '2026-11-05T14:00', durationMin: 60 },
    { id: 'p', kind: 'pontual', dueDate: '2026-11-06' },
    { id: 'semData', kind: 'pontual', dueDate: null },
    rotina('seg', { type: 'weekly', weekday: 1 }, '2026-11-01'),
  ];
  const ev = eventsBetween(items, '2026-11-02', '2026-11-09');
  assert.deepEqual(Object.keys(ev).sort(), ['2026-11-02', '2026-11-05', '2026-11-06', '2026-11-09']);
  assert.equal(ev['2026-11-05'][0].id, 'c');
  assert.equal(ev['2026-11-06'][0].id, 'p');
  assert.equal(ev['2026-11-02'][0].id, 'seg');
});

test('rotina não aparece antes do início', () => {
  const ev = eventsBetween([rotina('d', { type: 'daily' }, '2026-11-05')], '2026-11-03', '2026-11-06');
  assert.deepEqual(Object.keys(ev).sort(), ['2026-11-05', '2026-11-06']);
});

test('excluídos ficam de fora', () => {
  const items = [
    { id: 'p', kind: 'pontual', dueDate: '2026-11-06', deletedAt: 'x' },
    { id: 'c', kind: 'compromisso', start: '2026-11-06T10:00', deletedAt: 'x' },
  ];
  assert.deepEqual(eventsBetween(items, '2026-11-01', '2026-11-30'), {});
});

test('mensal dia 31 aparece no último dia de fevereiro', () => {
  const ev = eventsBetween([rotina('m', { type: 'monthly', day: 31 }, '2026-01-01')], '2026-02-01', '2026-02-28');
  assert.deepEqual(Object.keys(ev), ['2026-02-28']);
});

test('grade do mês começa no domingo e tem semanas completas', () => {
  const grid = monthGrid(2026, 11);
  assert.equal(grid[0], '2026-11-01');
  assert.equal(grid[grid.length - 1], '2026-12-05');
  assert.equal(grid.length, 35);
  const fev = monthGrid(2026, 2);
  assert.equal(fev.length % 7, 0);
  assert.equal(fev[0], '2026-02-01');
});

test('semana vai de domingo a sábado', () => {
  const week = weekDays('2026-11-05');
  assert.equal(week.length, 7);
  assert.equal(week[0], '2026-11-01');
  assert.equal(week[6], '2026-11-07');
});

test('compromissos sobrepostos ocupam faixas lado a lado', () => {
  const layout = layoutDay([
    { id: 'a', start: '2026-11-05T10:00', durationMin: 60 },
    { id: 'b', start: '2026-11-05T10:30', durationMin: 60 },
    { id: 'c', start: '2026-11-05T12:00', durationMin: 30 },
  ]);
  const by = Object.fromEntries(layout.map((x) => [x.item.id, x]));
  assert.notEqual(by.a.lane, by.b.lane);
  assert.equal(by.a.lanes, 2);
  assert.equal(by.c.lane, 0);
  assert.equal(by.c.lanes, 1);
});
