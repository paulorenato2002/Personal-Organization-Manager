// Lembretes fixos: o registro simples, à parte da agenda. Rode: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert/strict');

// O store grava no localStorage; aqui é uma gaveta de mentira, para o teste não depender do navegador.
const gaveta = new Map();
globalThis.localStorage = {
  getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
  setItem: (k, v) => { gaveta.set(k, String(v)); },
  removeItem: (k) => { gaveta.delete(k); },
};
const D = require('../js/dates.js');
require('../js/holidays.js');
require('../js/recur.js');
const HB = require('../js/habits.js');
const S = require('../js/store.js');

const fresh = () => { gaveta.clear(); S.resetSample(); };
const dia = (date) => S.get().days[date] || { tasks: [], done: {}, counts: {}, note: '' };
const on = (date, id) => S.remindersOn(date).find((x) => x.reminder.id === id);
const novo = (extra = {}) => S.saveReminder({ ...S.newReminder({ since: '2026-11-02' }), title: 'Teste', ...extra });

test('o exemplo traz lembretes fixos, e água e refeições deixam de ser tarefas da agenda', () => {
  fresh();
  const ids = S.reminders().map((r) => r.id);
  ['r-agua', 'r-refeicoes', 'r-louca', 'r-varrer'].forEach((id) => assert.ok(ids.includes(id), `falta ${id}: ${ids.join()}`));
  assert.ok(!S.get().events.some((e) => e.id === 'e-agua' || e.id === 'e-alimentacao'), 'água e refeições não são eventos');
  assert.equal(S.reminder('r-agua').target, 8);
  assert.equal(S.reminder('r-agua').unit, 'copos');
});

test('lembrete novo nasce simples: todo dia, uma vez por dia, a partir da data escolhida', () => {
  fresh();
  const r = S.newReminder({ since: '2026-11-16' });
  assert.match(r.id, /^r-/);
  assert.equal(r.title, '');
  assert.equal(r.target, 1);
  assert.deepEqual(r.repeat, { freq: 'daily', interval: 1 });
  assert.equal(r.since, '2026-11-16');
  assert.equal(r.goalId, null);
  assert.equal(r.objId, null);
  assert.ok(S.tag(r.tag), 'já vem com uma categoria que existe');
});

test('salvar exige nome; salvar de novo com o mesmo id atualiza em vez de repetir', () => {
  fresh();
  const antes = S.reminders().length;
  assert.equal(S.saveReminder({ ...S.newReminder({ since: '2026-11-16' }), title: '   ' }), null);
  assert.equal(S.reminders().length, antes, 'sem nome não salva');
  const r = S.saveReminder({ ...S.newReminder({ since: '2026-11-16' }), title: ' Tomar remédio ', icon: '💊' });
  assert.equal(r.title, 'Tomar remédio', 'espaços nas pontas saem');
  assert.equal(S.reminders().length, antes + 1);
  S.saveReminder({ ...r, title: 'Tomar o remédio' });
  assert.equal(S.reminders().length, antes + 1, 'mesmo id atualiza');
  assert.equal(S.reminder(r.id).title, 'Tomar o remédio');
  assert.equal(S.reminder(r.id).icon, '💊');
});

test('aparece só nos dias em que repete, e só depois de começar', () => {
  fresh();
  const varrer = novo({ repeat: { freq: 'weekly', interval: 1, weekdays: [1, 3, 5] } });
  assert.ok(on('2026-11-02', varrer.id), 'segunda');
  assert.ok(!on('2026-11-03', varrer.id), 'terça');
  assert.ok(on('2026-11-04', varrer.id), 'quarta');
  assert.ok(on('2026-11-06', varrer.id), 'sexta');
  assert.ok(!on('2026-11-07', varrer.id), 'sábado');
  assert.ok(!on('2026-10-30', varrer.id), 'sexta antes de começar');
});

test('dia sim, dia não', () => {
  fresh();
  const areia = novo({ repeat: { freq: 'daily', interval: 2 }, since: '2026-11-01' });
  const dias = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => !!on(d, areia.id));
  assert.deepEqual(dias, [true, false, true, false, true]);
});

test('marcar um lembrete de uma vez só (louça): marca e desmarca sem deixar rastro', () => {
  fresh();
  const d = '2026-11-17';
  assert.equal(on(d, 'r-louca').done, false);
  assert.equal(on(d, 'r-louca').target, 1);
  S.setDone(d, 'r-louca', true);
  assert.equal(on(d, 'r-louca').done, true);
  assert.equal(on(d, 'r-louca').count, 1);
  S.setDone(d, 'r-louca', false);
  assert.equal(on(d, 'r-louca').done, false);
  assert.equal(on(d, 'r-louca').count, 0);
  assert.equal((dia(d).done || {})['r-louca'], undefined);
});

test('contar (água, 8 copos): vai subindo, cumpre na meta e zera sem deixar rastro', () => {
  fresh();
  const d = '2026-11-17';
  S.setProgress(d, 'r-agua', 3);
  assert.deepEqual([on(d, 'r-agua').count, on(d, 'r-agua').target, on(d, 'r-agua').done], [3, 8, false]);
  S.setProgress(d, 'r-agua', 8);
  assert.equal(on(d, 'r-agua').done, true, 'chegar na meta cumpre');
  S.setProgress(d, 'r-agua', 7);
  assert.equal(on(d, 'r-agua').done, false, 'abaixo da meta desmarca');
  assert.equal(on(d, 'r-agua').count, 7);
  S.setProgress(d, 'r-agua', 0);
  assert.equal(dia(d).counts['r-agua'], undefined);
  assert.equal(dia(d).done['r-agua'], undefined);
});

test('a caixa de marcar de um lembrete de contar enche ou zera o dia', () => {
  fresh();
  const d = '2026-11-17';
  S.setDone(d, 'r-agua', true);
  assert.equal(on(d, 'r-agua').count, 8);
  assert.equal(on(d, 'r-agua').done, true);
  S.setDone(d, 'r-agua', false);
  assert.equal(on(d, 'r-agua').count, 0);
});

test('os lembretes contam no quadro de constância como hábitos', () => {
  fresh();
  const agua = S.habits().find((h) => h.id === 'r-agua');
  assert.ok(agua, 'água está entre os hábitos');
  assert.equal(agua.track.target, 8);
  assert.equal(agua.track.unit, 'copos');
  assert.equal(agua.kind, 'lembrete');
  S.setProgress('2026-11-14', 'r-agua', 8);
  const cheio = HB.cellOn([agua], S.get().days, '2026-11-14', '2026-11-16');
  assert.equal(cheio.level, 4);
  assert.equal(cheio.expected, 1);
  S.setProgress('2026-11-13', 'r-agua', 4);
  const meio = HB.cellOn([agua], S.get().days, '2026-11-13', '2026-11-16');
  assert.equal(meio.frac, 0.5);
  assert.equal(HB.cellOn([agua], S.get().days, '2026-08-01', '2026-11-16').expected, 0, 'antes de começar a contar não é previsto');
});

test('lembrete ligado a um objetivo aparece nos hábitos dele e se solta quando o objetivo é apagado', () => {
  fresh();
  assert.ok(S.habitsOf('g-pilares', 'p-fisica').some((h) => h.id === 'r-agua'));
  S.deleteObjective('g-pilares', 'p-fisica');
  assert.ok(S.reminder('r-agua'), 'o lembrete continua existindo');
  assert.equal(S.reminder('r-agua').objId, null);
  assert.equal(S.reminder('r-agua').goalId, null);
  assert.equal(S.habitsOf('g-pilares', 'p-fisica').length, 0);
});

test('apagar a bolha inteira também solta os lembretes dela', () => {
  fresh();
  S.deleteGoal('g-pilares');
  assert.equal(S.reminder('r-refeicoes').goalId, null);
});

test('excluir um lembrete tira da lista, dos dias e do quadro', () => {
  fresh();
  const antes = S.reminders().length;
  S.deleteReminder('r-louca');
  assert.equal(S.reminders().length, antes - 1);
  assert.equal(S.reminder('r-louca'), null);
  assert.ok(!on('2026-11-17', 'r-louca'));
  assert.ok(!S.habits().some((h) => h.id === 'r-louca'));
});

test('o modelo do dia traz os lembretes e não mexe no "feitos de total" do dia', () => {
  fresh();
  const d = '2026-11-17';
  const antes = S.dayModel(d);
  assert.ok(antes.reminders.length >= 3, 'água, refeições e louça pelo menos');
  S.setProgress(d, 'r-agua', 8);
  S.setDone(d, 'r-louca', true);
  const depois = S.dayModel(d);
  assert.equal(depois.total, antes.total);
  assert.equal(depois.done, antes.done);
  assert.equal(depois.reminders.find((x) => x.reminder.id === 'r-agua').done, true);
  assert.equal(depois.slots.some((s) => s.ev.id === 'r-agua'), false, 'não vira linha da agenda');
});

test('cópia de segurança leva e traz os lembretes; arquivo antigo, sem lembretes, abre', () => {
  fresh();
  const copia = S.exportJSON();
  const obj = JSON.parse(copia);
  assert.ok(Array.isArray(obj.reminders) && obj.reminders.length >= 4);
  gaveta.clear();
  S.resetSample();
  S.deleteReminder('r-agua');
  assert.equal(S.importJSON(copia).ok, true);
  assert.deepEqual(S.reminders().map((r) => r.id), obj.reminders.map((r) => r.id));
  delete obj.reminders;
  assert.equal(S.importJSON(JSON.stringify(obj)).ok, true);
  assert.deepEqual(S.reminders(), []);
  assert.equal(S.dayModel('2026-11-17').reminders.length, 0);
});

test('lembrete com dado ruim é limpo ou descartado ao abrir uma cópia', () => {
  fresh();
  const obj = JSON.parse(S.exportJSON());
  obj.reminders = [
    { id: 'sem-nome' },
    'lixo',
    { id: 'r-ok', title: '  Ler  ', icon: '📖'.repeat(20), target: 500, repeat: { freq: 'monthly' }, since: 'ontem', unit: 'x'.repeat(50), goalId: 7 },
    { id: 'r-ok', title: 'Duplicado' },
  ];
  assert.equal(S.importJSON(JSON.stringify(obj)).ok, true);
  const lista = S.reminders();
  assert.deepEqual(lista.map((r) => r.id), ['r-ok'], 'só o válido, sem repetir o id');
  const r = lista[0];
  assert.equal(r.title, 'Ler');
  assert.ok(Array.from(r.icon).length <= 8, 'ícone curto');
  assert.equal(r.target, 99);
  assert.equal(r.repeat.freq, 'daily', 'repetição que a folha não entende vira todo dia');
  assert.ok(D.isDate(r.since));
  assert.equal(r.unit.length, 24);
  assert.equal(r.goalId, null);
});

test('na folha, os lembretes saem por categoria e, dentro dela, na ordem em que foram criados', () => {
  fresh();
  const a = novo({ title: 'Zzz', tag: 'estudo' });
  const b = novo({ title: 'Aaa', tag: 'estudo' });
  const ids = S.remindersOn('2026-11-17').map((x) => x.reminder.id);
  assert.ok(ids.indexOf(a.id) < ids.indexOf(b.id), 'ordem de criação, não alfabética');
  const ordem = S.get().tags.map((t) => t.id);
  const seq = ids.map((id) => ordem.indexOf(S.reminder(id).tag));
  assert.deepEqual(seq, [...seq].sort((x, y) => x - y), 'categorias na ordem das categorias');
});

test('apagar o objetivo solta também a tarefa acompanhada (a que tem hora)', () => {
  fresh();
  assert.equal(S.event('e-estudo-ingles').track.objId, 'o-ingles');
  S.deleteObjective('g-2027', 'o-ingles');
  assert.ok(S.event('e-estudo-ingles').track, 'continua acompanhada');
  assert.equal(S.event('e-estudo-ingles').track.objId, null);
  assert.equal(S.event('e-estudo-ingles').track.goalId, null);
});
