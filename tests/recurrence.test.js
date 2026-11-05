const test = require('node:test');
const assert = require('node:assert/strict');
const { toISO, fromISO, addDays, weekday, lastDayOfMonth, compare } = require('../js/logic/dates.js');
const { nextOccurrence, occursOn, rotinaStatus, completeRotina, undoRotina } = require('../js/logic/recurrence.js');

const rotina = (freq, startDate) => ({ kind: 'rotina', freq, startDate, doneThrough: null, completions: [] });
const daily = (startDate) => rotina({ type: 'daily' }, startDate);
const weeklySeg = (startDate) => rotina({ type: 'weekly', weekday: 1 }, startDate);
const monthly5 = (startDate) => rotina({ type: 'monthly', day: 5 }, startDate);

test('toISO usa o dia local, mesmo perto da meia-noite', () => {
  assert.equal(toISO(new Date(2026, 10, 5, 23, 30)), '2026-11-05');
  assert.equal(toISO(new Date(2026, 10, 5, 0, 5)), '2026-11-05');
});

test('fromISO cria a data local sem deslocar o dia', () => {
  const d = fromISO('2026-11-05');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 10, 5]);
});

test('addDays atravessa o mês e o ano', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('weekday, lastDayOfMonth e compare', () => {
  assert.equal(weekday('2026-11-05'), 4);
  assert.equal(lastDayOfMonth(2028, 2), 29);
  assert.equal(lastDayOfMonth(2026, 2), 28);
  assert.equal(compare('2026-01-01', '2026-01-02'), -1);
  assert.equal(compare('2026-01-02', '2026-01-02'), 0);
  assert.equal(compare('2026-01-03', '2026-01-02'), 1);
});

test('mensal dia 31 cai no último dia dos meses curtos', () => {
  const m31 = { type: 'monthly', day: 31 };
  assert.equal(nextOccurrence(m31, '2026-01-31'), '2026-02-28');
  assert.equal(nextOccurrence(m31, '2028-01-31'), '2028-02-29');
  assert.equal(nextOccurrence(m31, '2026-02-28'), '2026-03-31');
  assert.equal(occursOn(m31, '2026-02-28'), true);
  assert.equal(occursOn(m31, '2026-03-30'), false);
});

test('mensal retorna a data do próprio mês quando ainda não passou', () => {
  assert.equal(nextOccurrence({ type: 'monthly', day: 5 }, '2026-11-04'), '2026-11-05');
  assert.equal(nextOccurrence({ type: 'monthly', day: 5 }, '2026-11-05'), '2026-12-05');
});

test('semanal retorna a próxima segunda, estritamente depois', () => {
  assert.equal(nextOccurrence({ type: 'weekly', weekday: 1 }, '2026-11-02'), '2026-11-09');
  assert.equal(nextOccurrence({ type: 'weekly', weekday: 1 }, '2026-11-01'), '2026-11-02');
  assert.equal(occursOn({ type: 'weekly', weekday: 1 }, '2026-11-02'), true);
  assert.equal(occursOn({ type: 'weekly', weekday: 1 }, '2026-11-03'), false);
});

test('diária não acumula', () => {
  assert.deepEqual(rotinaStatus(daily('2026-11-01'), '2026-11-05'), { state: 'due', date: '2026-11-05' });
});

test('diária concluída hoje volta pendente amanhã', () => {
  const done = completeRotina(daily('2026-11-01'), '2026-11-05');
  assert.deepEqual(rotinaStatus(done, '2026-11-05'), { state: 'done', date: '2026-11-06' });
  assert.deepEqual(rotinaStatus(done, '2026-11-06'), { state: 'due', date: '2026-11-06' });
});

test('diária com início no futuro fica aguardando', () => {
  assert.deepEqual(rotinaStatus(daily('2026-11-10'), '2026-11-05'), { state: 'upcoming', date: '2026-11-10' });
});

test('semanal atrasada vira uma pendência com a data mais antiga', () => {
  assert.deepEqual(rotinaStatus(weeklySeg('2026-10-01'), '2026-11-05'), { state: 'overdue', date: '2026-10-05' });
});

test('concluir uma atrasada acerta todos os ciclos até hoje', () => {
  const done = completeRotina(weeklySeg('2026-10-01'), '2026-11-05');
  assert.equal(done.doneThrough, '2026-11-02');
  assert.deepEqual(rotinaStatus(done, '2026-11-05'), { state: 'done', date: '2026-11-09' });
});

test('rotina concluída volta sozinha na próxima data', () => {
  const done = completeRotina(weeklySeg('2026-10-01'), '2026-11-05');
  assert.deepEqual(rotinaStatus(done, '2026-11-09'), { state: 'due', date: '2026-11-09' });
});

test('rotina nova sem ocorrência até hoje fica aguardando', () => {
  assert.deepEqual(rotinaStatus(monthly5('2026-11-06'), '2026-11-06'), { state: 'upcoming', date: '2026-12-05' });
});

test('concluir uma rotina aguardando adianta um ciclo', () => {
  const done = completeRotina(monthly5('2026-11-06'), '2026-11-06');
  assert.equal(done.doneThrough, '2026-12-05');
  assert.deepEqual(rotinaStatus(done, '2026-11-06'), { state: 'done', date: '2027-01-05' });
});

test('desfazer restaura o atraso', () => {
  const r = weeklySeg('2026-10-01');
  const undone = undoRotina(completeRotina(r, '2026-11-05'));
  assert.deepEqual(rotinaStatus(undone, '2026-11-05'), { state: 'overdue', date: '2026-10-05' });
  assert.equal(undone.completions.length, 0);
});

test('concluir registra a conclusão e não altera o original', () => {
  const r = weeklySeg('2026-10-01');
  const done = completeRotina(r, '2026-11-05');
  assert.deepEqual(done.completions, [{ occurrence: '2026-11-02', doneOn: '2026-11-05', prevDoneThrough: null }]);
  assert.equal(r.doneThrough, null);
  assert.equal(r.completions.length, 0);
});
