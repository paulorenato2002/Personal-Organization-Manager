// Verificação mínima da lógica de datas, feriados e recorrência. Rode: node --test tests
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/dates.js');
const H = require('../js/holidays.js');
const R = require('../js/recur.js');

test('Páscoa de 2026 a 2040', () => {
  const esperado = {
    2026: '04-05', 2027: '03-28', 2028: '04-16', 2029: '04-01', 2030: '04-21', 2031: '04-13', 2032: '03-28', 2033: '04-17',
    2034: '04-09', 2035: '03-25', 2036: '04-13', 2037: '04-05', 2038: '04-25', 2039: '04-10', 2040: '04-01',
  };
  for (const [ano, md] of Object.entries(esperado)) assert.equal(H.easter(Number(ano)), `${ano}-${md}`, `Páscoa ${ano}`);
});

test('feriados móveis e fixos de 2026', () => {
  assert.equal(H.of('2026-02-16').name, 'Carnaval');
  assert.equal(H.of('2026-04-03').name, 'Sexta-feira Santa');
  assert.equal(H.of('2026-06-04').name, 'Corpus Christi');
  assert.equal(H.of('2026-11-20').kind, 'feriado');
  assert.equal(H.of('2026-11-16'), null);
  assert.equal(H.of('2023-11-20'), null, 'Consciência Negra só vira feriado nacional em 2024');
  assert.match(H.of('2030-04-21').name, /Tiradentes/);
  assert.match(H.of('2030-04-21').name, /Páscoa/);
});

test('semana ISO e dia da semana', () => {
  assert.equal(D.weekday('2026-11-16'), 1);
  assert.equal(D.isoWeek('2026-11-16'), 47);
  assert.equal(D.weekNumber('2026-11-22', 1), 47);
  assert.equal(D.isoWeek('2027-01-01'), 53);
  assert.equal(D.startOfWeek('2026-11-18', 1), '2026-11-16');
  assert.equal(D.startOfWeek('2026-11-18', 0), '2026-11-15');
});

test('formatação em português', () => {
  assert.equal(D.fmt.long('2026-11-16'), '16 de novembro de 2026');
  assert.equal(D.fmt.range('2026-11-16', '2026-11-22'), '16 a 22 de novembro de 2026');
  assert.equal(D.fmt.range('2026-11-29', '2026-12-05'), '29 de novembro a 5 de dezembro de 2026');
});

const base = { id: 'x', title: 'x', time: '09:00', date: '2026-01-01', skip: [], repeat: { freq: 'none' } };
const rep = (repeat, extra = {}) => ({ ...base, repeat, ...extra });

test('sem repetição ocorre só na data', () => {
  const ev = rep({ freq: 'none' }, { date: '2026-11-17' });
  assert.ok(R.occursOn(ev, '2026-11-17'));
  assert.ok(!R.occursOn(ev, '2026-11-18'));
});

test('dias úteis em semanas', () => {
  const ev = rep({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] });
  assert.ok(R.occursOn(ev, '2026-11-16'));
  assert.ok(!R.occursOn(ev, '2026-11-22'));
  assert.ok(!R.occursOn(ev, '2025-12-31'), 'não ocorre antes do início');
});

test('a cada 2 semanas', () => {
  const ev = rep({ freq: 'weekly', interval: 2, weekdays: [1] }, { date: '2026-11-02' });
  assert.ok(R.occursOn(ev, '2026-11-02'));
  assert.ok(!R.occursOn(ev, '2026-11-09'));
  assert.ok(R.occursOn(ev, '2026-11-16'));
});

test('dia 20 adiando quando não for dia útil', () => {
  const ev = rep({ freq: 'monthly', interval: 1, mode: 'day', day: 20, shift: 'next' });
  assert.ok(!R.occursOn(ev, '2026-11-20'), '20/11/2026 é feriado');
  assert.ok(R.occursOn(ev, '2026-11-23'));
  assert.ok(R.occursOn(ev, '2026-12-21'), '20/12/2026 cai no domingo');
});

test('dia 20 antecipando', () => {
  const ev = rep({ freq: 'monthly', interval: 1, mode: 'day', day: 20, shift: 'prev' });
  assert.ok(R.occursOn(ev, '2026-11-19'));
  assert.ok(!R.occursOn(ev, '2026-11-20'));
});

test('primeiro dia útil a cada 6 meses (semestre)', () => {
  const ev = rep({ freq: 'monthly', interval: 6, mode: 'nth-bday', n: 1 }, { date: '2026-07-01' });
  assert.ok(R.occursOn(ev, '2026-07-01'));
  assert.ok(R.occursOn(ev, '2027-01-04'), '01/01/2027 é feriado e 02 e 03 são fim de semana');
  assert.ok(!R.occursOn(ev, '2026-08-03'));
  assert.ok(R.occursOn(ev, '2027-07-01'));
});

test('último dia útil do mês', () => {
  const ev = rep({ freq: 'monthly', interval: 1, mode: 'last-bday' });
  assert.ok(R.occursOn(ev, '2026-11-30'));
  assert.ok(R.occursOn(ev, '2026-12-31'));
  assert.ok(R.occursOn(ev, '2027-01-29'), '30 e 31/01/2027 são sábado e domingo');
});

test('pular feriados e exceções avulsas', () => {
  const ev = rep({ freq: 'daily', interval: 1, skipHolidays: true }, { skip: ['2026-11-17'] });
  assert.ok(R.occursOn(ev, '2026-11-16'));
  assert.ok(!R.occursOn(ev, '2026-11-17'), 'dia removido');
  assert.ok(!R.occursOn(ev, '2026-11-20'), 'feriado pulado');
});

test('repetição anual e término', () => {
  const ev = rep({ freq: 'yearly', interval: 1, until: '2028-12-31' }, { date: '2026-03-10' });
  assert.ok(R.occursOn(ev, '2027-03-10'));
  assert.ok(!R.occursOn(ev, '2029-03-10'));
  const bissexto = rep({ freq: 'yearly', interval: 1 }, { date: '2028-02-29' });
  assert.ok(R.occursOn(bissexto, '2029-02-28'));
});

test('descrição legível', () => {
  assert.equal(R.describe({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }), 'Dias úteis, de segunda a sexta');
  assert.equal(R.describe({ freq: 'monthly', interval: 1, mode: 'nth-bday', n: 5 }), 'No 5º dia útil de cada mês');
  assert.equal(R.describe({ freq: 'none' }), 'Não se repete');
});

/* ---------- Pular fins de semana, pular feriados, dias escolhidos ---------- */

test('todo dia pulando só os fins de semana', () => {
  const ev = rep({ freq: 'daily', interval: 1, skipWeekends: true });
  assert.ok(R.occursOn(ev, '2026-11-19'), 'quinta');
  assert.ok(R.occursOn(ev, '2026-11-20'), 'sexta, feriado, mas só pulou fim de semana');
  assert.ok(!R.occursOn(ev, '2026-11-21'), 'sábado');
  assert.ok(!R.occursOn(ev, '2026-11-22'), 'domingo');
  assert.ok(R.occursOn(ev, '2026-11-23'), 'segunda');
});

test('todo dia pulando fins de semana e feriados', () => {
  const ev = rep({ freq: 'daily', interval: 1, skipWeekends: true, skipHolidays: true });
  assert.ok(R.occursOn(ev, '2026-11-19'));
  assert.ok(!R.occursOn(ev, '2026-11-20'), 'feriado nacional');
  assert.ok(!R.occursOn(ev, '2026-11-21'), 'sábado');
  assert.ok(R.occursOn(ev, '2026-11-23'));
});

test('a cada 2 dias, pulando fim de semana, mantém a contagem por dias corridos', () => {
  const ev = rep({ freq: 'daily', interval: 2, skipWeekends: true }, { date: '2026-11-16' });
  assert.ok(R.occursOn(ev, '2026-11-16'));
  assert.ok(!R.occursOn(ev, '2026-11-17'));
  assert.ok(R.occursOn(ev, '2026-11-18'));
  assert.ok(R.occursOn(ev, '2026-11-20'));
  assert.ok(!R.occursOn(ev, '2026-11-22'), 'domingo cairia na contagem, mas foi pulado');
});

test('segunda e quinta', () => {
  const ev = rep({ freq: 'weekly', interval: 1, weekdays: [1, 4] }, { date: '2026-11-16' });
  assert.ok(R.occursOn(ev, '2026-11-16'), 'segunda');
  assert.ok(!R.occursOn(ev, '2026-11-17'), 'terça');
  assert.ok(R.occursOn(ev, '2026-11-19'), 'quinta');
  assert.ok(!R.occursOn(ev, '2026-11-20'), 'sexta');
  assert.ok(R.occursOn(ev, '2026-11-23'), 'segunda da semana seguinte');
});

test('terça, quarta e sexta pulando feriados', () => {
  const ev = rep({ freq: 'weekly', interval: 1, weekdays: [2, 3, 5], skipHolidays: true }, { date: '2026-11-16' });
  assert.ok(R.occursOn(ev, '2026-11-17'));
  assert.ok(R.occursOn(ev, '2026-11-18'));
  assert.ok(!R.occursOn(ev, '2026-11-20'), 'sexta 20/11 é feriado');
  assert.ok(R.occursOn(ev, '2026-11-27'), 'sexta seguinte');
  assert.ok(!R.occursOn(ev, '2026-11-19'), 'quinta não está na lista');
});

test('feriado local marcado pelo usuário: pula, não é dia útil e repete todo ano', () => {
  H.setExtra([{ date: '2026-12-08', name: 'Padroeira do município', yearly: true }]);
  try {
    assert.equal(H.of('2026-12-08').kind, 'feriado');
    assert.equal(H.of('2026-12-08').name, 'Padroeira do município');
    assert.ok(!H.isBusinessDay('2026-12-08'));
    assert.ok(H.isBusinessDay('2026-12-09'));
    assert.equal(H.of('2027-12-08').kind, 'feriado', 'repete no ano seguinte');
    assert.equal(H.of('2025-12-08'), null, 'não vale antes da data marcada');
    assert.ok(H.list(2027).some(([date, h]) => date === '2027-12-08' && h.name === 'Padroeira do município'));
    const ev = rep({ freq: 'daily', interval: 1, skipHolidays: true });
    assert.ok(!R.occursOn(ev, '2026-12-08'));
    const mensal = rep({ freq: 'monthly', interval: 1, mode: 'day', day: 8, shift: 'next' });
    assert.ok(R.occursOn(mensal, '2026-12-09'), 'adiar usa o feriado local');
  } finally {
    H.setExtra([]);
  }
  const ev = rep({ freq: 'daily', interval: 1, skipHolidays: true });
  assert.ok(R.occursOn(ev, '2026-12-08'), 'sem a marca, volta a ocorrer');
  assert.equal(H.of('2026-12-08'), null);
});

test('feriado local sem repetição anual vale só naquele ano', () => {
  H.setExtra([{ date: '2026-12-08', name: 'Ponto local', yearly: false }]);
  try {
    assert.equal(H.of('2026-12-08').kind, 'feriado');
    assert.equal(H.of('2027-12-08'), null);
  } finally {
    H.setExtra([]);
  }
});

test('feriado local no mesmo dia de um nacional junta os nomes', () => {
  H.setExtra([{ date: '2026-09-07', name: 'Aniversário da cidade', yearly: true }]);
  try {
    assert.match(H.of('2026-09-07').name, /Independência/);
    assert.match(H.of('2026-09-07').name, /Aniversário da cidade/);
  } finally {
    H.setExtra([]);
  }
});

test('descrição fala dos fins de semana, dos feriados e dos dias escolhidos', () => {
  assert.equal(R.describe({ freq: 'daily', interval: 1, skipWeekends: true, skipHolidays: true }), 'Todos os dias, pulando fins de semana e feriados');
  assert.equal(R.describe({ freq: 'daily', interval: 1, skipWeekends: true }), 'Todos os dias, pulando fins de semana');
  assert.equal(R.describe({ freq: 'weekly', interval: 1, weekdays: [1, 4] }), 'Toda semana: seg, qui');
  assert.equal(R.describe({ freq: 'weekly', interval: 1, weekdays: [2, 3, 5], skipHolidays: true }), 'Toda semana: ter, qua, sex, pulando feriados');
  assert.equal(R.describe({ freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5], skipHolidays: true }), 'Dias úteis, de segunda a sexta, pulando feriados');
});

test('distância de uma data em palavras: hoje, amanhã, dias, semanas, meses e anos', () => {
  const a = D.fmt.away;
  assert.equal(a(0), 'hoje');
  assert.equal(a(1), 'amanhã');
  assert.equal(a(-1), 'ontem');
  assert.equal(a(3), 'em 3 dias');
  assert.equal(a(-6), 'há 6 dias');
  assert.equal(a(13), 'em 13 dias');
  assert.equal(a(14), 'em 2 semanas');
  assert.equal(a(-21), 'há 3 semanas');
  assert.equal(a(45), 'em 6 semanas');
  assert.equal(a(60), 'em 2 meses');
  assert.equal(a(-90), 'há 3 meses');
  assert.equal(a(200), 'em 7 meses');
  assert.equal(a(366), 'em 1 ano', '17/11/2027 visto de 16/11/2026');
  assert.equal(a(-366), 'há 1 ano');
  assert.equal(a(-800), 'há 2 anos');
  assert.equal(a(1000), 'em 3 anos');
});
