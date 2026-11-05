const test = require('node:test');
const assert = require('node:assert/strict');
const { pendingByDay, todayList, dayProgress, historyByDay, activityLog } = require('../js/logic/pending.js');

const TODAY = '2026-11-05';
const p = (id, dueDate, extra = {}) => ({ id, kind: 'pontual', dueDate, log: [], ...extra });
const ids = (list) => list.map((x) => x.id);

test('pendências agrupam pontuais abertas de datas passadas, mais recente primeiro', () => {
  const groups = pendingByDay([p('a', '2026-11-02'), p('b', '2026-11-04'), p('c', '2026-11-04')], TODAY);
  assert.deepEqual(groups.map((g) => [g.date, ids(g.items)]), [
    ['2026-11-04', ['b', 'c']],
    ['2026-11-02', ['a']],
  ]);
});

test('pendências excluem o que não é pontual atrasada aberta', () => {
  const items = [
    p('semData', null),
    p('hoje', TODAY),
    p('futura', '2026-11-20'),
    p('feita', '2026-11-01', { doneAt: '2026-11-01T10:00:00' }),
    p('excluida', '2026-11-01', { deletedAt: '2026-11-01T10:00:00' }),
    { id: 'rot', kind: 'rotina', freq: { type: 'daily' }, startDate: '2026-01-01', doneThrough: null, completions: [], log: [] },
    { id: 'comp', kind: 'compromisso', start: '2026-11-01T10:00', durationMin: 60, log: [] },
  ];
  assert.deepEqual(pendingByDay(items, TODAY), []);
});

test('lista de hoje reúne rotinas, compromissos e pontuais do dia', () => {
  const items = [
    { id: 'diaria', kind: 'rotina', freq: { type: 'daily' }, startDate: '2026-11-01', doneThrough: null, completions: [], log: [] },
    { id: 'atrasada', kind: 'rotina', freq: { type: 'weekly', weekday: 1 }, startDate: '2026-11-01', doneThrough: null, completions: [], log: [] },
    { id: 'feitaHoje', kind: 'rotina', freq: { type: 'weekly', weekday: 1 }, startDate: '2026-11-01', doneThrough: '2026-11-02',
      completions: [{ occurrence: '2026-11-02', doneOn: TODAY, prevDoneThrough: null }], log: [] },
    { id: 'feitaAntes', kind: 'rotina', freq: { type: 'weekly', weekday: 1 }, startDate: '2026-11-01', doneThrough: '2026-11-02',
      completions: [{ occurrence: '2026-11-02', doneOn: '2026-11-02', prevDoneThrough: null }], log: [] },
    { id: 'compHoje', kind: 'compromisso', start: `${TODAY}T14:00`, durationMin: 60, log: [] },
    { id: 'compOutro', kind: 'compromisso', start: '2026-11-06T14:00', durationMin: 60, log: [] },
    { id: 'compExcl', kind: 'compromisso', start: `${TODAY}T14:00`, durationMin: 60, deletedAt: 'x', log: [] },
    p('pontHoje', TODAY),
    p('pontFeita', TODAY, { doneAt: `${TODAY}T10:00:00` }),
    p('pontAtrasada', '2026-11-04'),
    p('pontExcl', TODAY, { deletedAt: 'x' }),
  ];
  assert.deepEqual(ids(todayList(items, TODAY)).sort(), ['atrasada', 'compHoje', 'diaria', 'feitaHoje', 'pontFeita', 'pontHoje'].sort());
});

test('progresso conta feitas sobre a lista de hoje', () => {
  const items = [p('a', TODAY), p('b', TODAY, { doneAt: `${TODAY}T10:00:00` }), p('c', '2026-11-01')];
  assert.deepEqual(dayProgress(items, TODAY), { done: 1, total: 2 });
});

test('histórico agrupa por dia e ignora criação e rotinas', () => {
  const items = [
    p('a', TODAY, { log: [
      { day: '2026-11-03', action: 'created' },
      { day: '2026-11-04', action: 'moved', from: '2026-11-04', to: TODAY },
      { day: TODAY, action: 'done' },
    ] }),
    p('b', '2026-11-04', { deletedAt: 'x', log: [{ day: '2026-11-04', action: 'deleted' }] }),
    { id: 'r', kind: 'rotina', log: [{ day: TODAY, action: 'done' }] },
  ];
  const h = historyByDay(items);
  assert.deepEqual(h.map((d) => d.date), [TODAY, '2026-11-04']);
  assert.deepEqual(ids(h[0].done), ['a']);
  assert.deepEqual(ids(h[1].moved), ['a']);
  assert.deepEqual(ids(h[1].deleted), ['b']);
  assert.deepEqual(h[1].moved[0].entry.to, TODAY);
});

test('atividade lista tudo, da mais recente para a mais antiga', () => {
  const items = [
    p('a', TODAY, { title: 'A', log: [
      { day: '2026-11-03', at: '2026-11-03T10:00:00Z', action: 'created' },
      { day: TODAY, at: '2026-11-05T12:00:00Z', action: 'done' },
    ] }),
    { id: 'r', kind: 'rotina', title: 'R', log: [{ day: '2026-11-04', at: '2026-11-04T09:00:00Z', action: 'done' }] },
    { id: 'semLog', kind: 'pontual', title: 'S' },
  ];
  assert.deepEqual(activityLog(items).map((e) => [e.title, e.action, e.day]), [
    ['A', 'done', TODAY],
    ['R', 'done', '2026-11-04'],
    ['A', 'created', '2026-11-03'],
  ]);
});
