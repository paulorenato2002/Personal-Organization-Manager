/* Constância: quanto cada dia cumpriu do que estava previsto. Lógica pura, sem tela e sem armazenamento.
   Um hábito é uma tarefa que se repete e tem `track`: { goalId, objId, target, unit, since }.
   target 1 é "marcar feito"; target maior é "contar" (8 copos, 4 refeições). O quadradinho do dia é a média do cumprimento
   dos hábitos previstos naquele dia. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const D = Plan.dates;
  const R = Plan.recur;

  const targetOf = (ev) => {
    const t = Math.round(Number(ev && ev.track && ev.track.target));
    return Number.isFinite(t) && t >= 1 ? Math.min(t, 99) : 1;
  };

  // Quanto foi feito no dia. A contagem manda; sem contagem, "feito" vale a meta inteira.
  function valueOf(ev, day) {
    if (!day) return 0;
    const c = day.counts && day.counts[ev.id];
    if (typeof c === 'number' && Number.isFinite(c)) return Math.max(0, c);
    return day.done && day.done[ev.id] ? targetOf(ev) : 0;
  }
  const fractionOf = (ev, day) => Math.min(1, valueOf(ev, day) / targetOf(ev));

  // 0 cinza (previsto e não feito), 1 a 3 em parte, 4 cumprido.
  function levelOf(frac) {
    if (frac >= 1) return 4;
    if (frac >= 0.67) return 3;
    if (frac >= 0.34) return 2;
    if (frac > 0) return 1;
    return 0;
  }

  // O dia só é "previsto" depois da data em que a pessoa começou a contar e quando a repetição cai nele.
  const expectedOn = (ev, date) => !!(ev && ev.track) && date >= (ev.track.since || ev.date) && R.occursOn(ev, date);

  function cellOn(events, days, date, today) {
    const day = days && days[date];
    const detail = [];
    let expected = 0;
    let sum = 0;
    let extraN = 0;
    let extraSum = 0;
    events.forEach((ev) => {
      if (!ev.track) return;
      const target = targetOf(ev);
      const value = valueOf(ev, day);
      const exp = expectedOn(ev, date);
      const info = { id: ev.id, title: ev.title, value, target, unit: ev.track.unit || '', expected: exp };
      if (exp) { expected += 1; sum += Math.min(1, value / target); detail.push(info); }
      else if (value > 0) { extraN += 1; extraSum += Math.min(1, value / target); detail.push(info); }
    });
    const cell = { date, expected, frac: null, level: null, today: date === today, future: date > today, pending: false, extra: false, detail };
    if (expected > 0) {
      cell.frac = sum / expected;
      if (cell.frac > 0) cell.level = levelOf(cell.frac);
      else if (date < today) cell.level = 0;
      else cell.pending = date === today; // hoje ainda pode ser feito, então não é falha; o futuro é só futuro
    } else if (extraN > 0) {
      // Fez fora do combinado (por exemplo, academia num sábado): o quadradinho acende, mas não entra nas contas.
      cell.frac = extraSum / extraN;
      cell.level = levelOf(cell.frac);
      cell.extra = true;
    }
    return cell;
  }

  function series({ events, days, from, to, today }) {
    const cells = [];
    for (let d = from; d <= to; d = D.addDays(d, 1)) cells.push(cellOn(events, days, d, today));
    return cells;
  }

  const pctOf = (done, total) => (total ? Math.round((done / total) * 100) : null);

  // Conta só dias previstos que já acabaram; hoje só entra se já foi cumprido (não castiga o dia que ainda está aberto).
  // done = dias cumpridos por inteiro. pct = média do cumprimento: dia pela metade vale metade (com hábito de marcar, é done/total).
  function summary(cells, today) {
    let done = 0;
    let total = 0;
    let sum = 0;
    const months = new Map();
    cells.forEach((c) => {
      if (!(c.expected > 0) || c.date > today) return;
      if (c.date === today && !(c.frac >= 1)) return;
      const key = c.date.slice(0, 7);
      const m = months.get(key) || { month: key, done: 0, total: 0, sum: 0 };
      m.total += 1;
      m.sum += c.frac;
      total += 1;
      sum += c.frac;
      if (c.frac >= 1) { m.done += 1; done += 1; }
      months.set(key, m);
    });
    return { done, total, pct: pctOf(sum, total), byMonth: [...months.values()].map((m) => ({ month: m.month, done: m.done, total: m.total, pct: pctOf(m.sum, m.total) })) };
  }

  // Sequência: dias previstos seguidos, todos cumpridos por inteiro. Dia sem nada previsto não quebra nem soma.
  function history({ events, days, today }) {
    const tracked = events.filter((e) => e.track);
    if (!tracked.length) return { current: 0, longest: 0, since: null };
    const since = tracked.map((e) => e.track.since || e.date).sort()[0];
    let run = 0;
    let longest = 0;
    for (let d = since < D.MIN ? D.MIN : since; d <= today; d = D.addDays(d, 1)) {
      const c = cellOn(tracked, days, d, today);
      if (!(c.expected > 0)) continue;
      if (d === today && !(c.frac >= 1)) continue; // hoje em aberto não quebra a sequência
      if (c.frac >= 1) { run += 1; if (run > longest) longest = run; } else run = 0;
    }
    return { current: run, longest, since };
  }

  function last30({ events, days, today }) {
    const from = D.addDays(today, -29);
    const cells = series({ events, days, from: from < D.MIN ? D.MIN : from, to: today, today });
    const s = summary(cells, today);
    return { done: s.done, total: s.total, pct: s.pct };
  }

  // Sequência em palavras: 1 seguido, 10 seguidos; com vários hábitos, o dia só conta quando todos foram cumpridos.
  const streakText = (n, many) => (many
    ? `${n} ${n === 1 ? 'dia completo seguido' : 'dias completos seguidos'}`
    : `${n} ${n === 1 ? 'seguido' : 'seguidos'}`);

  const goalText = (ev) => {
    const t = targetOf(ev);
    if (t <= 1) return 'marcar feito';
    return ev.track.unit ? `${t} ${ev.track.unit}` : `meta de ${t}`;
  };

  // Quando o hábito acontece, em palavras: lembrete fixo (sem hora, ao lado da folha), hora marcada ou dia todo.
  const whenText = (ev) => (ev.kind === 'lembrete' ? 'lembrete fixo' : (ev.time || 'dia todo'));

  // Janela das últimas N semanas até hoje: começa numa semana inteira, termina no fim da semana de hoje,
  // e nunca sai do que o caderno cobre.
  function rollingRange(today, weeks, ws) {
    const thisWeek = D.startOfWeek(today, ws);
    const from = D.addDays(thisWeek, -7 * (weeks - 1));
    const to = D.addDays(thisWeek, 6);
    return { from: from < D.MIN ? D.MIN : from, to: to > D.MAX ? D.MAX : to };
  }

  // Grade no estilo "contribuições": uma coluna por semana, sete linhas por dia da semana. Fora do período fica null.
  function weeksBetween(from, to, ws) {
    const start = D.startOfWeek(from, ws);
    const end = D.addDays(D.startOfWeek(to, ws), 6);
    const weeks = [];
    for (let d = start; d <= end; d = D.addDays(d, 7)) {
      weeks.push(Array.from({ length: 7 }, (_, i) => { const x = D.addDays(d, i); return x >= from && x <= to ? x : null; }));
    }
    return weeks;
  }
  const weeksOf = (year, ws) => weeksBetween(`${year}-01-01`, `${year}-12-31`, ws);

  // Em que coluna cada mês começa (onde vai o nome do mês no topo da grade).
  function monthStarts(weeks) {
    const out = [];
    weeks.forEach((week, i) => {
      const first = week.find((d) => d && d.endsWith('-01'));
      if (first) out.push({ week: i, month: Number(first.slice(5, 7)) });
    });
    return out;
  }

  const api = { targetOf, valueOf, fractionOf, levelOf, expectedOn, cellOn, series, summary, history, last30, goalText, whenText, streakText, rollingRange, weeksOf, weeksBetween, monthStarts };
  Plan.habits = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
