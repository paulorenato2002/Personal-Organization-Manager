// Constância: o que conta como dia cumprido, o nível de cada quadradinho e as sequências. Rode: node --test esboco-planner/tests
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/dates.js');
require('../js/holidays.js');
require('../js/recur.js');
const HB = require('../js/habits.js');

const base = (over = {}) => ({
  id: 'h1', title: 'Estudar', time: '19:30', end: '', date: '2026-11-01', tag: 'estudo', kind: 'compromisso',
  repeat: { freq: 'daily', interval: 1 }, skip: [], items: [], notes: '',
  track: { goalId: null, objId: null, target: 1, unit: '', since: '2026-11-01' }, ...over,
});
const counter = (id, target = 8, over = {}) => base({ id, title: id, track: { goalId: null, objId: null, target, unit: 'copos', since: '2026-11-01' }, ...over });
// Registro dos dias: feito[evento] = datas; contagem[evento] = { data: n }
const days = ({ feito = {}, contagem = {} } = {}) => {
  const out = {};
  const day = (d) => (out[d] = out[d] || { tasks: [], done: {}, counts: {}, note: '' });
  Object.entries(feito).forEach(([id, list]) => list.forEach((d) => { day(d).done[id] = true; }));
  Object.entries(contagem).forEach(([id, map]) => Object.entries(map).forEach(([d, n]) => { day(d).counts[id] = n; }));
  return out;
};
const cell = (events, registro, date, today) => HB.cellOn(events, registro, date, today);

test('valor e fração do dia: marcar feito, contar e quanto vale cada um', () => {
  const check = base();
  assert.equal(HB.valueOf(check, undefined), 0, 'sem registro do dia');
  assert.equal(HB.valueOf(check, { done: { h1: true } }), 1);
  assert.equal(HB.fractionOf(check, { done: {} }), 0);
  const agua = counter('agua', 8);
  assert.equal(HB.valueOf(agua, { counts: { agua: 4 } }), 4);
  assert.equal(HB.fractionOf(agua, { counts: { agua: 4 } }), 0.5);
  assert.equal(HB.valueOf(agua, { done: { agua: true } }), 8, 'marcado sem contagem vale a meta inteira');
  assert.equal(HB.valueOf(agua, { done: { agua: true }, counts: { agua: 3 } }), 3, 'a contagem manda sobre a marca');
  assert.equal(HB.fractionOf(agua, { counts: { agua: 12 } }), 1, 'passar da meta continua valendo 100%');
  assert.equal(HB.valueOf(agua, { counts: { agua: -2 } }), 0, 'contagem negativa vira zero');
});

test('nível do quadradinho: de cinza a verde escuro', () => {
  assert.equal(HB.levelOf(0), 0);
  assert.equal(HB.levelOf(0.1), 1);
  assert.equal(HB.levelOf(0.34), 2);
  assert.equal(HB.levelOf(0.5), 2);
  assert.equal(HB.levelOf(0.67), 3);
  assert.equal(HB.levelOf(0.99), 3);
  assert.equal(HB.levelOf(1), 4);
  assert.equal(HB.levelOf(1.5), 4);
});

test('dia previsto respeita início da contagem, repetição, dia pulado e fim', () => {
  const ev = base({ date: '2026-11-01', track: { goalId: null, objId: null, target: 1, unit: '', since: '2026-11-05' } });
  assert.ok(!HB.expectedOn(ev, '2026-11-03'), 'antes de começar a contar');
  assert.ok(HB.expectedOn(ev, '2026-11-05'));
  const pulado = base({ skip: ['2026-11-03'] });
  assert.ok(!HB.expectedOn(pulado, '2026-11-03'));
  const ate = base({ repeat: { freq: 'daily', interval: 1, until: '2026-11-04' } });
  assert.ok(HB.expectedOn(ate, '2026-11-04'));
  assert.ok(!HB.expectedOn(ate, '2026-11-05'));
  const semTrack = base({ track: null });
  assert.ok(!HB.expectedOn(semTrack, '2026-11-05'), 'tarefa que não é acompanhada nunca é prevista');
});

test('quadradinho de um hábito de marcar: feito, não feito, hoje em aberto e futuro', () => {
  const ev = base();
  const reg = days({ feito: { h1: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07'] } });
  const hoje = '2026-11-08';
  assert.equal(cell([ev], reg, '2026-11-03', hoje).level, 4, 'cumprido');
  const falhou = cell([ev], reg, '2026-11-06', hoje);
  assert.equal(falhou.level, 0, 'previsto e não feito, no passado');
  assert.equal(falhou.expected, 1);
  const aberto = cell([ev], reg, hoje, hoje);
  assert.equal(aberto.level, null, 'hoje ainda pode ser feito: não pinta de cinza');
  assert.equal(aberto.pending, true);
  assert.equal(aberto.today, true);
  const futuro = cell([ev], reg, '2026-11-09', hoje);
  assert.equal(futuro.level, null);
  assert.equal(futuro.future, true);
  assert.equal(futuro.pending, false, 'só hoje fica em aberto; o futuro é só futuro');
});

test('hábito só de dias úteis: fim de semana não é previsto e não quebra nada', () => {
  const ev = base({ date: '2026-11-02', repeat: { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }, track: { goalId: null, objId: null, target: 1, unit: '', since: '2026-11-02' } });
  const reg = days({ feito: { h1: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09'] } });
  const hoje = '2026-11-10';
  const sabado = cell([ev], reg, '2026-11-07', hoje);
  assert.equal(sabado.expected, 0);
  assert.equal(sabado.level, null);
  assert.equal(HB.history({ events: [ev], days: reg, today: hoje }).current, 6, 'sexta e segunda ficam emendadas');
  const extra = days({ feito: { h1: ['2026-11-07'] } });
  const feitoNoSabado = cell([ev], extra, '2026-11-07', hoje);
  assert.equal(feitoNoSabado.extra, true, 'fez fora do combinado');
  assert.equal(feitoNoSabado.level, 4, 'e o quadradinho acende mesmo assim');
  assert.equal(feitoNoSabado.expected, 0);
});

test('hábito de contar (água): o nível acompanha quanto foi bebido', () => {
  const agua = counter('agua', 8);
  const reg = days({ contagem: { agua: { '2026-11-02': 8, '2026-11-03': 4, '2026-11-04': 1, '2026-11-05': 7, '2026-11-06': 0 } } });
  const hoje = '2026-11-09';
  const nivel = (d) => cell([agua], reg, d, hoje).level;
  assert.deepEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map(nivel), [4, 2, 1, 3, 0]);
  assert.equal(cell([agua], reg, '2026-11-03', hoje).detail[0].value, 4);
  assert.equal(cell([agua], reg, '2026-11-03', hoje).detail[0].target, 8);
  assert.equal(HB.history({ events: [agua], days: reg, today: '2026-11-02' }).current, 1, 'só dia cheio entra na sequência');
  assert.equal(HB.history({ events: [agua], days: reg, today: '2026-11-04' }).current, 0, 'dia pela metade quebra a sequência');
});

test('vários hábitos juntos: o quadradinho mostra a fração cumprida do dia', () => {
  const a = base({ id: 'a' });
  const b = base({ id: 'b' });
  const reg = days({ feito: { a: ['2026-11-02', '2026-11-03'], b: ['2026-11-03'] } });
  const hoje = '2026-11-08';
  const metade = cell([a, b], reg, '2026-11-02', hoje);
  assert.equal(metade.expected, 2);
  assert.equal(metade.frac, 0.5);
  assert.equal(metade.level, 2);
  assert.equal(cell([a, b], reg, '2026-11-03', hoje).level, 4);
  assert.equal(cell([a, b], reg, '2026-11-04', hoje).level, 0);
});

test('série do período e resumo por mês', () => {
  const ev = base({ date: '2026-10-30', track: { goalId: null, objId: null, target: 1, unit: '', since: '2026-10-30' } });
  const reg = days({ feito: { h1: ['2026-10-30', '2026-10-31', '2026-11-01'] } });
  const hoje = '2026-11-03';
  const cells = HB.series({ events: [ev], days: reg, from: '2026-10-28', to: '2026-11-04', today: hoje });
  assert.equal(cells.length, 8);
  assert.deepEqual(cells.map((c) => c.date), ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']);
  assert.equal(cells[0].expected, 0, 'antes do início da contagem');
  const sum = HB.summary(cells, hoje);
  assert.equal(sum.done, 3);
  assert.equal(sum.total, 4, 'dia 2 foi perdido; hoje em aberto não entra');
  assert.equal(sum.pct, 75);
  assert.deepEqual(sum.byMonth.map((m) => [m.month, m.done, m.total, m.pct]), [['2026-10', 2, 2, 100], ['2026-11', 1, 2, 50]]);
  const hojeFeito = HB.summary(HB.series({ events: [ev], days: days({ feito: { h1: ['2026-11-03'] } }), from: '2026-11-03', to: '2026-11-03', today: hoje }), hoje);
  assert.equal(hojeFeito.total, 1, 'hoje entra quando já foi cumprido');
});

test('sequência atual e maior sequência: hoje em aberto não quebra, dia perdido quebra', () => {
  const ev = base();
  const reg = days({ feito: { h1: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07'] } });
  const hoje = '2026-11-08';
  const h = HB.history({ events: [ev], days: reg, today: hoje });
  assert.equal(h.current, 1, 'só o dia 7: o dia 6 foi perdido e hoje ainda está aberto');
  assert.equal(h.longest, 5);
  const feito = days({ feito: { h1: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08'] } });
  assert.equal(HB.history({ events: [ev], days: feito, today: hoje }).current, 2, 'hoje cumprido entra na conta');
  assert.equal(HB.history({ events: [], days: {}, today: hoje }).current, 0);
});

test('últimos 30 dias: porcentagem dos dias previstos que foram cumpridos', () => {
  const ev = base();
  const reg = days({ feito: { h1: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07'] } });
  const r = HB.last30({ events: [ev], days: reg, today: '2026-11-08' });
  assert.equal(r.total, 7, 'de 1 a 7 de novembro; hoje em aberto não conta');
  assert.equal(r.done, 6);
  assert.equal(r.pct, 86);
  assert.equal(HB.last30({ events: [], days: {}, today: '2026-11-08' }).pct, null, 'sem hábito, sem porcentagem');
});

test('descrição curta do que o hábito pede por dia', () => {
  assert.equal(HB.goalText(base()), 'marcar feito');
  assert.equal(HB.goalText(counter('agua', 8)), '8 copos');
  assert.equal(HB.goalText(counter('x', 4, { track: { target: 4, unit: '', since: '2026-11-01' } })), 'meta de 4');
});

test('grade do ano: uma coluna por semana, sete linhas, nada fora do ano', () => {
  const seg = HB.weeksOf(2026, 1);
  assert.equal(seg.length, 53);
  assert.ok(seg.every((w) => w.length === 7));
  assert.equal(seg[0][0], null, '29/12/2025 é de 2025');
  assert.equal(seg[0][3], '2026-01-01', 'quinta-feira na semana que começa na segunda');
  assert.equal(seg[52][3], '2026-12-31');
  assert.equal(seg[52][4], null, '1/1/2027 é de 2027');
  assert.equal(seg.flat().filter(Boolean).length, 365);
  const dom = HB.weeksOf(2026, 0);
  assert.equal(dom[0][4], '2026-01-01', 'quinta-feira na semana que começa no domingo');
  assert.equal(HB.weeksOf(2028, 1).flat().filter(Boolean).length, 366, 'ano bissexto');
});

test('nome dos meses no topo da grade: a coluna onde cada mês começa', () => {
  const marks = HB.monthStarts(HB.weeksOf(2026, 1));
  assert.equal(marks.length, 12);
  assert.deepEqual(marks[0], { week: 0, month: 1 });
  assert.deepEqual(marks[1], { week: 4, month: 2 }, '1/2/2026 cai na quinta semana');
  assert.ok(marks.every((m, i) => i === 0 || m.week > marks[i - 1].week), 'colunas crescentes, sem dois meses na mesma coluna');
});

test('porcentagem é a média do cumprimento: dia pela metade vale metade', () => {
  const agua = counter('agua', 8);
  const reg = days({ contagem: { agua: { '2026-11-02': 8, '2026-11-03': 4 } } });
  const cells = HB.series({ events: [agua], days: reg, from: '2026-11-02', to: '2026-11-03', today: '2026-11-04' });
  const sum = HB.summary(cells, '2026-11-04');
  assert.equal(sum.total, 2);
  assert.equal(sum.done, 1, 'só um dia cheio');
  assert.equal(sum.pct, 75, '(100% + 50%) / 2');
  assert.deepEqual(sum.byMonth.map((m) => [m.done, m.total, m.pct]), [[1, 2, 75]]);
});

test('grade de um período qualquer: semanas completas, fora do período fica vazio', () => {
  const w = HB.weeksBetween('2026-11-04', '2026-11-15', 1);
  assert.equal(w.length, 2);
  assert.deepEqual(w[0], [null, null, '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'], 'segunda e terça são antes do período');
  assert.deepEqual(w[1], ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(HB.weeksBetween('2026-11-09', '2026-11-15', 1).length, 1, 'uma semana exata');
  assert.deepEqual(HB.weeksOf(2026, 1), HB.weeksBetween('2026-01-01', '2026-12-31', 1), 'o ano é um período como outro');
});

test('texto da sequência: singular e plural, de um hábito ou de vários', () => {
  assert.equal(HB.streakText(0, false), '0 seguidos');
  assert.equal(HB.streakText(1, false), '1 seguido');
  assert.equal(HB.streakText(10, false), '10 seguidos');
  assert.equal(HB.streakText(1, true), '1 dia completo seguido');
  assert.equal(HB.streakText(0, true), '0 dias completos seguidos');
  assert.equal(HB.streakText(3, true), '3 dias completos seguidos');
});

test('quando o hábito acontece: lembrete fixo, hora marcada ou dia todo', () => {
  assert.equal(HB.whenText({ kind: 'lembrete', time: '' }), 'lembrete fixo');
  assert.equal(HB.whenText({ kind: 'compromisso', time: '19:30' }), '19:30');
  assert.equal(HB.whenText({ kind: 'rotina', time: '' }), 'dia todo');
});

test('janela de 52 semanas até hoje: semana inteira nas pontas e nunca antes do começo do caderno', () => {
  const a = HB.rollingRange('2026-11-16', 52, 1);
  assert.equal(a.to, '2026-11-22', 'termina no domingo da semana de hoje');
  assert.equal(a.from, '2026-01-01', 'não passa do começo do caderno');
  const b = HB.rollingRange('2027-11-16', 52, 1);
  assert.equal(b.to, '2027-11-21');
  assert.equal(b.from, '2026-11-23', '51 semanas antes da segunda-feira da semana de hoje');
  assert.equal(HB.weeksBetween(b.from, b.to, 1).length, 52, 'são 52 colunas');
  const c = HB.rollingRange('2026-11-16', 52, 0);
  assert.equal(c.to, '2026-11-21', 'semana que começa no domingo');
  const d = HB.rollingRange('2040-12-31', 26, 1); // segunda-feira: a semana dela terminaria em 2041
  assert.equal(d.to, '2040-12-31', 'nunca depois do fim do caderno');
});
