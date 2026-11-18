// Quadradinhos com nome: cada um do lembrete (ao acordar, 10h, pós almoço) marca só ele mesmo. Rode: node --test "esboco-planner/tests/*.test.js"
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
const dia = (date) => S.get().days[date] || { tasks: [], done: {}, counts: {}, note: '' };
const on = (date, id) => S.remindersOn(date).find((x) => x.reminder.id === id);
const comum = (extra = {}) => S.saveReminder({ ...S.newReminder({ since: '2026-11-02' }), title: 'Teste', ...extra });
const nomeado = (extra = {}) => comum({ title: 'Água do dia', target: 4, labels: ['Ao acordar', 'Pós café', '', '16h'], ...extra });

test('o exemplo traz nomes nos quadradinhos das refeições', () => {
  fresh();
  assert.deepEqual(S.reminder('r-refeicoes').labels, ['Café da manhã', 'Almoço', 'Lanche', 'Jantar']);
  assert.deepEqual(S.reminder('r-agua').labels, [], 'a água do exemplo continua só contando copos');
});

test('quadradinhos com nome: cada um guarda o seu, até a meta, e o que sobra sai', () => {
  fresh();
  const r = nomeado({ labels: ['  Ao acordar  ', 'Pós café', '', '16h', 'passou da meta', ''] });
  assert.deepEqual(r.labels, ['Ao acordar', 'Pós café', '', '16h'], 'sem espaços nas pontas, o vazio do meio fica no lugar, o que passa da meta sai');
  assert.deepEqual(nomeado({ labels: ['a', '', ''] }).labels, ['a'], 'vazios no fim saem');
  assert.deepEqual(nomeado({ labels: ['', ''] }).labels, [], 'só vazios: sem nomes');
  assert.deepEqual(nomeado({ target: 1, labels: ['x'] }).labels, [], 'uma vez só não tem quadradinhos para nomear');
  assert.deepEqual(nomeado({ target: 13, labels: Array(13).fill('x') }).labels, [], 'acima de 12 vira contador de mais e menos, sem nomes');
  assert.equal(nomeado({ labels: ['x'.repeat(40)] }).labels[0].length, 24, 'nome curto');
  assert.deepEqual(nomeado({ labels: 'lixo' }).labels, []);
  assert.deepEqual(comum().labels, [], 'lembrete comum não tem nomes');
});

test('com nomes, cada quadradinho marca só ele mesmo e a conta é quantos estão marcados', () => {
  fresh();
  const r = nomeado();
  const d = '2026-11-17';
  const get = () => on(d, r.id);
  assert.deepEqual(get().ticked, [false, false, false, false]);
  S.toggleTick(d, r.id, 2);
  assert.deepEqual(get().ticked, [false, false, true, false], 'só o terceiro');
  assert.equal(get().count, 1);
  S.toggleTick(d, r.id, 0);
  assert.deepEqual(get().ticked, [true, false, true, false]);
  assert.equal(get().count, 2);
  assert.equal(dia(d).counts[r.id], 2, 'o quadro de constância lê a contagem');
  S.toggleTick(d, r.id, 2);
  assert.deepEqual(get().ticked, [true, false, false, false], 'desmarca só o terceiro e deixa o primeiro');
  [1, 2, 3].forEach((i) => S.toggleTick(d, r.id, i));
  assert.equal(get().done, true, 'todos marcados cumpre o lembrete');
  assert.equal(dia(d).done[r.id], true);
  S.toggleTick(d, r.id, 3);
  assert.equal(get().done, false, 'tirar um desfaz o cumprido');
  assert.equal(dia(d).done[r.id], undefined);
  [0, 1, 2].forEach((i) => S.toggleTick(d, r.id, i));
  assert.equal(get().count, 0);
  assert.equal(dia(d).counts[r.id], undefined, 'zerou: sem rastro');
  assert.equal((dia(d).ticks || {})[r.id], undefined);
  assert.equal(dia(d).done[r.id], undefined);
});

test('toggleTick ignora índice fora da meta, lembrete que não existe e lembrete sem nomes', () => {
  fresh();
  const r = nomeado();
  S.toggleTick('2026-11-17', r.id, 4);
  S.toggleTick('2026-11-17', r.id, -1);
  S.toggleTick('2026-11-17', r.id, 1.5);
  S.toggleTick('2026-11-17', 'nao-existe', 0);
  assert.equal(on('2026-11-17', r.id).count, 0);
  S.setProgress('2026-11-17', 'r-agua', 5);
  S.toggleTick('2026-11-17', 'r-agua', 0);
  assert.equal(on('2026-11-17', 'r-agua').count, 5, 'sem nomes, marcar o quinto marca até o quinto e toggleTick não mexe');
  assert.equal(on('2026-11-17', 'r-agua').ticked, undefined, 'sem nomes, não há marcas por quadradinho');
  assert.equal((dia('2026-11-17').ticks || {})['r-agua'], undefined);
});

test('só a contagem (cópia antiga ou histórico do exemplo): vira os primeiros quadradinhos marcados', () => {
  fresh();
  const r = nomeado();
  S.setProgress('2026-11-17', r.id, 2);
  assert.deepEqual(on('2026-11-17', r.id).ticked, [true, true, false, false]);
  assert.deepEqual(dia('2026-11-17').ticks[r.id], [0, 1]);
  S.setProgress('2026-11-17', r.id, 0);
  assert.equal((dia('2026-11-17').ticks || {})[r.id], undefined);
  S.get().days['2026-11-18'] = { tasks: [], done: {}, counts: { [r.id]: 3 }, note: '' };
  assert.deepEqual(on('2026-11-18', r.id).ticked, [true, true, true, false]);
  S.toggleTick('2026-11-18', r.id, 1);
  assert.deepEqual(on('2026-11-18', r.id).ticked, [true, false, true, false], 'a partir da contagem, desmarca só o do meio');
  assert.equal(on('2026-11-18', r.id).count, 2);
});

test('a caixa de marcar do dia enche ou zera todos os quadradinhos com nome', () => {
  fresh();
  const r = nomeado();
  S.setDone('2026-11-17', r.id, true);
  assert.deepEqual(on('2026-11-17', r.id).ticked, [true, true, true, true]);
  assert.equal(on('2026-11-17', r.id).done, true);
  S.setDone('2026-11-17', r.id, false);
  assert.deepEqual(on('2026-11-17', r.id).ticked, [false, false, false, false]);
});

test('marcas que não batem com a contagem (arquivo mexido à mão) não enganam: vale a contagem', () => {
  fresh();
  const r = nomeado();
  S.get().days['2026-11-17'] = { tasks: [], done: {}, counts: { [r.id]: 2 }, ticks: { [r.id]: [3] }, note: '' };
  assert.deepEqual(on('2026-11-17', r.id).ticked, [true, true, false, false]);
});

test('mudar a meta de um lembrete com nomes corta os nomes que sobram', () => {
  fresh();
  const r = nomeado();
  S.toggleTick('2026-11-17', r.id, 0);
  S.saveReminder({ ...S.reminder(r.id), target: 2 });
  assert.deepEqual(S.reminder(r.id).labels, ['Ao acordar', 'Pós café']);
  assert.equal(on('2026-11-17', r.id).ticked.length, 2);
  assert.equal(on('2026-11-17', r.id).target, 2);
});

test('cópia de segurança leva e traz os nomes e as marcas por quadradinho', () => {
  fresh();
  const r = nomeado();
  S.toggleTick('2026-11-17', r.id, 1);
  const copia = S.exportJSON();
  gaveta.clear();
  S.resetSample();
  assert.equal(S.importJSON(copia).ok, true);
  assert.deepEqual(S.reminder(r.id).labels, ['Ao acordar', 'Pós café', '', '16h']);
  assert.deepEqual(on('2026-11-17', r.id).ticked, [false, true, false, false]);
});

test('marcas por quadradinho em arquivo ruim são ignoradas sem quebrar', () => {
  fresh();
  const r = nomeado();
  const obj = JSON.parse(S.exportJSON());
  obj.days['2026-11-17'] = { tasks: [], done: {}, counts: { [r.id]: 1 }, ticks: 'lixo', note: '' };
  obj.days['2026-11-18'] = { tasks: [], done: {}, counts: { [r.id]: 1 }, ticks: { [r.id]: 'lixo' }, note: '' };
  assert.equal(S.importJSON(JSON.stringify(obj)).ok, true);
  assert.deepEqual(on('2026-11-17', r.id).ticked, [true, false, false, false]);
  assert.deepEqual(on('2026-11-18', r.id).ticked, [true, false, false, false]);
});

test('nomes com buraco na lista ou que não são texto nunca viram null', () => {
  fresh();
  const buraco = [];
  buraco[0] = 'Manhã';
  buraco[2] = 'Noite';
  assert.deepEqual(nomeado({ target: 3, labels: buraco }).labels, ['Manhã', '', 'Noite'], 'a janela deixa buracos quando o campo do meio nunca foi tocado');
  assert.deepEqual(nomeado({ target: 3, labels: ['a', null, 7] }).labels, ['a']);
  assert.ok(S.reminders().every((r) => r.labels.every((x) => typeof x === 'string')), 'todo nome é texto, nada de null na cópia de segurança');
  assert.ok(!JSON.stringify(S.reminders().map((r) => r.labels)).includes('null'));
});

test('mover o dia leva também as marcas por quadradinho com nome, e desfazer devolve', () => {
  fresh();
  const r = S.saveReminder({ ...S.newReminder({ since: '2026-11-02' }), title: 'Nomeado', target: 3, labels: ['a', 'b', 'c'] });
  S.toggleTick('2027-11-17', r.id, 1);
  const mv = S.moveDay('2027-11-17', '2026-11-17');
  assert.equal(mv.ok, true);
  assert.deepEqual(on('2026-11-17', r.id).ticked, [false, true, false]);
  assert.equal(S.get().days['2027-11-17'], undefined);
  assert.equal(mv.undo().ok, true);
  assert.deepEqual(on('2027-11-17', r.id).ticked, [false, true, false]);
});

test('a partir de 7 quadradinhos com nome o lembrete vira lista numerada (rotina)', () => {
  fresh();
  const seis = nomeado({ title: 'Seis', target: 6, labels: ['a', 'b', 'c', 'd', 'e', 'f'] });
  const sete = nomeado({ title: 'Sete', target: 7, labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] });
  const semNomes = comum({ title: 'Sem nomes', target: 9 });
  const d = '2026-11-17';
  assert.equal(S.LIST_FROM, 7);
  assert.equal(on(d, seis.id).list, false, 'até 6 ficam em linha, como a água');
  assert.equal(on(d, sete.id).list, true, '7 ou mais viram lista, um por linha, na ordem');
  assert.equal(on(d, semNomes.id).list, false, 'sem nomes continua contando');
  assert.equal(on(d, 'r-louca').list, false, 'uma caixa só nunca é lista');
});

test('uma rotina de 9 passos cumpre o dia só com todos marcados, na ordem que quiser', () => {
  fresh();
  const passos = ['Guardar a mochila', 'Trocar de roupa', 'Roupa de amanhã', 'Potes whey e hiper', 'Snacks na mochila', 'Descer a marmita', 'Ovos para cozinhar', 'Tomar banho', 'Planejar o amanhã'];
  const r = comum({ title: 'Rotina da noite', target: 9, unit: 'passos', labels: passos });
  const d = '2026-11-17';
  [8, 0, 3, 1, 2, 4, 5, 6].forEach((i) => S.toggleTick(d, r.id, i));
  assert.equal(on(d, r.id).count, 8);
  assert.equal(on(d, r.id).done, false, 'falta o passo 8');
  S.toggleTick(d, r.id, 7);
  assert.equal(on(d, r.id).done, true);
  assert.equal(dia(d).counts[r.id], 9, 'o quadro de constância lê 9 de 9');
  assert.equal(on(d, r.id).list, true);
});
