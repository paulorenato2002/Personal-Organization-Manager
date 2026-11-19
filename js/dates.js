/* Datas locais no formato AAAA-MM-DD. Nunca usa new Date('AAAA-MM-DD') nem toISOString para um dia. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});

  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const WD_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const MIN = '2026-01-01';
  const MAX = '2040-12-31';
  // Mais longe que isto (6 semanas e meia) a folha avisa a data por extenso: é onde nasce o dia anotado na data errada.
  const FAR_DAYS = 45;

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parts = (s) => s.split('-').map(Number);
  const parse = (s) => { const [y, m, d] = parts(s); return new Date(y, m - 1, d); };
  const utcDay = (s) => { const [y, m, d] = parts(s); return Date.UTC(y, m - 1, d) / 86400000; };
  const diffDays = (a, b) => utcDay(b) - utcDay(a);
  const addDays = (s, n) => { const [y, m, d] = parts(s); return iso(new Date(y, m - 1, d + n)); };
  const weekday = (s) => parse(s).getDay();
  const today = () => iso(new Date());
  const daysIn = (y, m) => new Date(y, m, 0).getDate();
  const startOfWeek = (s, ws) => addDays(s, -((weekday(s) - ws + 7) % 7));
  const addMonthsYM = (y, m, n) => { const t = y * 12 + (m - 1) + n; return [Math.floor(t / 12), (t % 12) + 1]; };
  const monthKey = (s) => s.slice(0, 7);
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parse(s)) === s;
  const clamp = (s) => (s < MIN ? MIN : s > MAX ? MAX : s);
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  // Semana ISO (a semana de quinta-feira decide o ano).
  function isoWeek(s) {
    const n = utcDay(s);
    const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7;
    const thursday = n - dow + 3;
    const year = new Date(thursday * 86400000).getUTCFullYear();
    const jan4 = Date.UTC(year, 0, 4) / 86400000;
    const jan4dow = (new Date(jan4 * 86400000).getUTCDay() + 6) % 7;
    return 1 + Math.floor((thursday - (jan4 - jan4dow)) / 7);
  }
  // Número da semana de uma semana que começa em ws (usa o meio da semana).
  const weekNumber = (s, ws) => isoWeek(addDays(startOfWeek(s, ws), 3));

  const fmt = {
    long: (s) => { const [y, m, d] = parts(s); return `${d} de ${MONTHS[m - 1]} de ${y}`; },
    dm: (s) => { const [, m, d] = parts(s); return `${d} de ${MONTHS[m - 1]}`; },
    short: (s) => { const [, m, d] = parts(s); return `${pad(d)}/${pad(m)}`; },
    weekday: (s) => WEEKDAYS[weekday(s)],
    weekdayShort: (s) => WD_SHORT[weekday(s)],
    monthYear: (s) => { const [y, m] = parts(s); return `${MONTHS[m - 1]} de ${y}`; },
    // Quanto falta ou quanto passou, em palavras: "amanhã", "há 6 dias", "em 2 semanas", "em 1 ano".
    away(n) {
      if (n === 0) return 'hoje';
      if (n === 1) return 'amanhã';
      if (n === -1) return 'ontem';
      const abs = Math.abs(n);
      const unit = (count, one, many) => `${count} ${count === 1 ? one : many}`;
      let text;
      if (abs < 14) text = unit(abs, 'dia', 'dias');
      else if (abs < 60) text = unit(Math.round(abs / 7), 'semana', 'semanas');
      else {
        const months = Math.round(abs / 30.44);
        text = months < 12 ? unit(months, 'mês', 'meses') : unit(Math.max(1, Math.round(abs / 365.25)), 'ano', 'anos');
      }
      return n > 0 ? `em ${text}` : `há ${text}`;
    },
    range(a, b) {
      const [ya, ma, da] = parts(a);
      const [yb, mb, db] = parts(b);
      if (ya === yb && ma === mb) return `${da} a ${db} de ${MONTHS[mb - 1]} de ${yb}`;
      if (ya === yb) return `${da} de ${MONTHS[ma - 1]} a ${db} de ${MONTHS[mb - 1]} de ${yb}`;
      return `${fmt.long(a)} a ${fmt.long(b)}`;
    },
  };

  const api = {
    MONTHS, WEEKDAYS, WD_SHORT, WD_LETTER, MIN, MAX, FAR_DAYS, pad, iso, parse, parts, diffDays, addDays, weekday, today, daysIn,
    startOfWeek, addMonthsYM, monthKey, isDate, clamp, cap, isoWeek, weekNumber, fmt,
  };
  Plan.dates = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
