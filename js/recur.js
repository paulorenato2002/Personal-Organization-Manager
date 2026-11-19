/* Recorrência no estilo de calendário, com extras para rotina de escritório:
   dia útil do mês, último dia útil, antecipar/adiar quando cair em dia não útil e pular feriados. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const D = Plan.dates;
  const H = Plan.holidays;

  const isHoliday = (date) => { const h = H.of(date); return !!h && h.kind === 'feriado'; };

  function nthBusinessDay(y, m, n) {
    let count = 0;
    for (let d = 1; d <= D.daysIn(y, m); d += 1) {
      const date = `${y}-${D.pad(m)}-${D.pad(d)}`;
      if (H.isBusinessDay(date)) { count += 1; if (count === n) return date; }
    }
    return null;
  }

  function lastBusinessDay(y, m) {
    for (let d = D.daysIn(y, m); d >= 1; d -= 1) {
      const date = `${y}-${D.pad(m)}-${D.pad(d)}`;
      if (H.isBusinessDay(date)) return date;
    }
    return null;
  }

  function shift(date, mode) {
    if (mode !== 'prev' && mode !== 'next') return date;
    let out = date;
    for (let i = 0; i < 10 && !H.isBusinessDay(out); i += 1) out = D.addDays(out, mode === 'prev' ? -1 : 1);
    return out;
  }

  function monthlyTarget(r, y, m) {
    const mode = r.mode || 'day';
    if (mode === 'nth-bday') return nthBusinessDay(y, m, r.n || 1);
    if (mode === 'last-bday') return lastBusinessDay(y, m);
    const day = Math.min(r.day || 1, D.daysIn(y, m));
    return shift(`${y}-${D.pad(m)}-${D.pad(day)}`, r.shift);
  }

  function occursOn(ev, date) {
    if (date < ev.date) return false;
    if (ev.skip && ev.skip.includes(date)) return false;
    const r = ev.repeat || { freq: 'none' };
    if (r.freq === 'none') return date === ev.date;
    if (r.until && date > r.until) return false;
    const interval = Math.max(1, r.interval || 1);
    const [y, m] = D.parts(date);
    switch (r.freq) {
      case 'daily':
        if (r.skipWeekends && [0, 6].includes(D.weekday(date))) return false;
        if (r.skipHolidays && isHoliday(date)) return false;
        return D.diffDays(ev.date, date) % interval === 0;
      case 'weekly': {
        if (!(r.weekdays || []).includes(D.weekday(date))) return false;
        if (r.skipHolidays && isHoliday(date)) return false;
        const weeks = D.diffDays(D.startOfWeek(ev.date, 1), D.startOfWeek(date, 1)) / 7;
        return weeks % interval === 0;
      }
      case 'monthly': {
        const [y0, m0] = D.parts(ev.date);
        // O alvo de um mês pode escorregar para o mês vizinho ao antecipar/adiar, então olha os três meses.
        for (const off of [-1, 0, 1]) {
          const [yy, mm] = D.addMonthsYM(y, m, off);
          const gap = (yy * 12 + mm) - (y0 * 12 + m0);
          if (gap < 0 || gap % interval) continue;
          if (monthlyTarget(r, yy, mm) === date) return true;
        }
        return false;
      }
      case 'yearly': {
        const [y0, m0, d0] = D.parts(ev.date);
        if ((y - y0) % interval) return false;
        const [, , d] = D.parts(date);
        if (m !== m0) return false;
        if (d === d0) return true;
        return m0 === 2 && d0 === 29 && d === 28 && D.daysIn(y, 2) === 28;
      }
      default:
        return false;
    }
  }

  const byTime = (a, b) => (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : a.title.localeCompare(b.title, 'pt-BR');
  const eventsOn = (events, date) => events.filter((ev) => occursOn(ev, date)).sort(byTime);

  function describe(r) {
    if (!r || r.freq === 'none') return 'Não se repete';
    const n = Math.max(1, r.interval || 1);
    let s;
    if (r.freq === 'daily') s = n === 1 ? 'Todos os dias' : `A cada ${n} dias`;
    else if (r.freq === 'weekly') {
      const set = [...(r.weekdays || [])].sort((a, b) => a - b);
      const uteis = set.join() === '1,2,3,4,5';
      if (uteis) s = n === 1 ? 'Dias úteis, de segunda a sexta' : `A cada ${n} semanas, de segunda a sexta`;
      else s = `${n === 1 ? 'Toda semana' : `A cada ${n} semanas`}: ${set.map((d) => D.WD_SHORT[d]).join(', ')}`;
    } else if (r.freq === 'monthly') {
      const every = n === 1 ? 'de cada mês' : `a cada ${n} meses`;
      if (r.mode === 'nth-bday') s = `No ${r.n || 1}º dia útil ${every}`;
      else if (r.mode === 'last-bday') s = `No último dia útil ${every}`;
      else {
        s = `No dia ${r.day || 1} ${every}`;
        if (r.shift === 'prev') s += ', antecipando se não for dia útil';
        if (r.shift === 'next') s += ', adiando se não for dia útil';
      }
    } else if (r.freq === 'yearly') s = n === 1 ? 'Todo ano' : `A cada ${n} anos`;
    else s = 'Repetição personalizada';
    const skips = [r.freq === 'daily' && r.skipWeekends ? 'fins de semana' : null, ['daily', 'weekly'].includes(r.freq) && r.skipHolidays ? 'feriados' : null].filter(Boolean);
    if (skips.length) s += `, pulando ${skips.join(' e ')}`;
    if (r.until) s += `, até ${D.fmt.long(r.until)}`;
    return s;
  }

  const api = { occursOn, eventsOn, describe, nthBusinessDay, lastBusinessDay };
  Plan.recur = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
