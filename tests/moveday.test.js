// Mover o dia: corrigir de vez um dia anotado na data errada (por exemplo, no ano errado). Rode: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');

const gaveta = new Map();
globalThis.localStorage = {
  getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
  setItem: (k, v) => { gaveta.set(k, String(v)); },
  removeItem: (k) => { gaveta.delete(k); },
};
require('../js/dates.js');
require('../js/holidays.js');
require('../js/recur.js');
require('../js/habits.js');
const S = require('../js/store.js');

const fresh = () => { gaveta.clear(); S.resetSample(); };
const days = () => S.get().days;
const clone = (o) => JSON.parse(JSON.stringify(o));
// O caso real: seis tarefas anotadas em 17/11/2027 em vez de 17/11/2026.
const errado = () => {
  S.addTask('2027-11-17', { text: 'Primeira', blockId: 'e-pessoais', tag: 'pessoal' });
  S.addTask('2027-11-17', { text: 'Segunda', blockId: 'e-pessoais', tag: 'pessoal' });
  S.addTask('2027-11-17', { text: 'Solta', tag: 'trabalho' });
  S.setNote('2027-11-17', 'lembrar do contador');
  S.setDone('2027-11-17', 'e-acordar', true);
};

test('movable: diz o que há no dia (tarefas, anotação, marcas) ou nada', () => {
  fresh();
  assert.equal(S.movable('2027-11-17'), null, 'dia sem registro');
  S.addTask('2027-11-17', { text: 'A', tag: 'trabalho' });
  assert.deepEqual(S.movable('2027-11-17'), { tasks: 1, note: false, marks: 0, events: 0 });
  S.setNote('2027-11-17', 'oi');
  S.setDone('2027-11-17', 'e-acordar', true);
  assert.deepEqual(S.movable('2027-11-17'), { tasks: 1, note: true, marks: 1, events: 0 });
  S.removeTask('2027-11-17', S.get().days['2027-11-17'].tasks[0].id);
  S.setNote('2027-11-17', '');
  S.setDone('2027-11-17', 'e-acordar', false);
  assert.equal(S.movable('2027-11-17'), null, 'tudo apagado: de novo nada para mover');
});

test('mover o dia: tarefas, anotação e marcas vão para a data certa e a errada some', () => {
  fresh();
  errado();
  const ids = days()['2027-11-17'].tasks.map((t) => t.id);
  const r = S.moveDay('2027-11-17', '2026-11-17');
  assert.equal(r.ok, true);
  assert.deepEqual([r.tasks, r.note, r.marks, r.events], [3, true, 1, 0]);
  assert.equal(days()['2027-11-17'], undefined, 'o dia errado deixa de existir');
  const certo = days()['2026-11-17'];
  assert.deepEqual(certo.tasks.map((t) => t.id), ids, 'mesmas tarefas, mesma ordem, mesmos ids');
  assert.deepEqual(certo.tasks.map((t) => t.blockId), ['e-pessoais', 'e-pessoais', null], 'continuam presas aos blocos');
  assert.equal(certo.note, 'lembrar do contador');
  assert.equal(certo.done['e-acordar'], true);
  assert.equal(S.dayModel('2026-11-17').slots.find((s) => s.ev.id === 'e-pessoais').tasks.length, 2, 'e aparecem dentro do bloco no dia certo');
});

test('mover para um dia que já tem coisas: junta, sem perder nada de nenhum lado', () => {
  fresh();
  S.addTask('2026-11-17', { text: 'Já estava', tag: 'trabalho' });
  S.setNote('2026-11-17', 'nota que já existia');
  S.setDone('2026-11-17', 'e-acordar', true);
  S.setProgress('2026-11-17', 'r-agua', 3);
  errado();
  S.setProgress('2027-11-17', 'r-agua', 5);
  S.setProgress('2027-11-17', 'r-refeicoes', 2);
  const r = S.moveDay('2027-11-17', '2026-11-17');
  assert.equal(r.ok, true);
  const certo = days()['2026-11-17'];
  assert.deepEqual(certo.tasks.map((t) => t.text), ['Já estava', 'Primeira', 'Segunda', 'Solta'], 'as de lá entram no fim');
  assert.equal(certo.note, 'nota que já existia\nlembrar do contador');
  assert.equal(certo.counts['r-agua'], 3, 'o que já estava marcado no destino vale');
  assert.equal(certo.counts['r-refeicoes'], 2, 'o que só existia na origem entra');
  assert.equal(certo.done['e-acordar'], true);
});

test('desfazer devolve os dois dias exatamente como estavam', () => {
  fresh();
  S.addTask('2026-11-17', { text: 'Já estava', tag: 'trabalho' });
  errado();
  const antesOrigem = clone(days()['2027-11-17']);
  const antesDestino = clone(days()['2026-11-17']);
  const r = S.moveDay('2027-11-17', '2026-11-17');
  const u = r.undo();
  assert.equal(u.ok, true);
  assert.deepEqual(days()['2027-11-17'], antesOrigem);
  assert.deepEqual(days()['2026-11-17'], antesDestino);
});

test('desfazer quando o destino não existia: o destino volta a não existir', () => {
  fresh();
  errado();
  const antes = clone(days()['2027-11-17']);
  const r = S.moveDay('2027-11-17', '2026-11-17');
  assert.equal(r.undo().ok, true);
  assert.equal(days()['2026-11-17'], undefined);
  assert.deepEqual(days()['2027-11-17'], antes);
});

test('desfazer não passa por cima do que a pessoa fez depois de mover', () => {
  fresh();
  errado();
  const r = S.moveDay('2027-11-17', '2026-11-17');
  S.addTask('2026-11-17', { text: 'Feita depois', tag: 'trabalho' });
  const u = r.undo();
  assert.equal(u.ok, false);
  assert.match(u.error, /alterado/);
  assert.ok(days()['2026-11-17'].tasks.some((t) => t.text === 'Feita depois'), 'nada foi perdido');
  assert.equal(days()['2027-11-17'], undefined);
});

test('mover recusa o que não faz sentido e não mexe em nada', () => {
  fresh();
  errado();
  const antes = JSON.stringify(S.get());
  assert.deepEqual(S.moveDay('2027-11-17', '2027-11-17'), { ok: false, error: 'Escolha um dia diferente.' });
  assert.deepEqual(S.moveDay('2027-11-17', 'amanhã'), { ok: false, error: 'Escolha uma data válida.' });
  assert.deepEqual(S.moveDay('2027-11-17', '2041-01-01'), { ok: false, error: 'Escolha uma data válida.' });
  assert.deepEqual(S.moveDay('2027-11-17', '2025-12-31'), { ok: false, error: 'Escolha uma data válida.' });
  assert.deepEqual(S.moveDay('2030-01-01', '2026-11-17'), { ok: false, error: 'Não há nada neste dia para mover.' });
  assert.equal(JSON.stringify(S.get()), antes, 'nenhuma tentativa recusada mexeu nos dados');
});

test('mover leva também a tarefa com horário que não se repete, e desfazer devolve a data dela', () => {
  fresh();
  const reuniao = S.newEvent({ date: '2027-11-17', time: '10:00', title: 'Reunião errada' });
  S.saveEvent(reuniao);
  const serie = { ...S.newEvent({ date: '2027-11-17', time: '11:00', title: 'Série' }), repeat: { freq: 'daily', interval: 1 } };
  S.saveEvent(serie);
  assert.deepEqual(S.movable('2027-11-17'), { tasks: 0, note: false, marks: 0, events: 1 }, 'só a que não se repete, mesmo sem registro do dia');
  const r = S.moveDay('2027-11-17', '2026-11-17');
  assert.equal(r.ok, true);
  assert.equal(r.events, 1);
  assert.equal(S.event(reuniao.id).date, '2026-11-17');
  assert.equal(S.event(serie.id).date, '2027-11-17', 'uma série não é de um dia só: fica onde está');
  assert.ok(S.dayModel('2026-11-17').slots.some((x) => x.ev.id === reuniao.id), 'aparece na agenda do dia certo');
  assert.equal(days()['2026-11-17'], undefined, 'sem nada além da tarefa com horário, não cria registro do dia à toa');
  assert.equal(r.undo().ok, true);
  assert.equal(S.event(reuniao.id).date, '2027-11-17');
});

test('desfazer não passa por cima de uma tarefa com horário editada depois de mover', () => {
  fresh();
  const reuniao = S.newEvent({ date: '2027-11-17', time: '10:00', title: 'Reunião errada' });
  S.saveEvent(reuniao);
  const r = S.moveDay('2027-11-17', '2026-11-17');
  S.saveEvent({ ...S.event(reuniao.id), title: 'Reunião certa', date: '2026-11-20' });
  const u = r.undo();
  assert.equal(u.ok, false);
  assert.match(u.error, /alterado/);
  assert.equal(S.event(reuniao.id).title, 'Reunião certa');
  assert.equal(S.event(reuniao.id).date, '2026-11-20');
});
