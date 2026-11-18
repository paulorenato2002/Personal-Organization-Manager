/* Feriados nacionais do Brasil, calculados por ano. Feriados estaduais e municipais entram como "datas marcadas". */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const D = Plan.dates;
  const cache = new Map();
  const RANK = { feriado: 3, facultativo: 2, data: 1 };
  // Feriados do estado ou da cidade, marcados pelo usuário. Entram junto com os nacionais:
  // viram dia sem expediente, são pulados nas repetições e aparecem no ano e no mês.
  let extra = [];

  // Domingo de Páscoa (algoritmo gregoriano anônimo).
  function easter(y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return `${y}-${D.pad(month)}-${D.pad(day)}`;
  }

  function forYear(y) {
    if (cache.has(y)) return cache.get(y);
    const map = new Map();
    const put = (date, name, kind = 'feriado') => {
      const old = map.get(date);
      if (!old) { map.set(date, { name, kind }); return; }
      map.set(date, { name: `${old.name} e ${name}`, kind: RANK[kind] > RANK[old.kind] ? kind : old.kind });
    };
    const pascoa = easter(y);
    put(`${y}-01-01`, 'Confraternização Universal');
    put(D.addDays(pascoa, -48), 'Carnaval', 'facultativo');
    put(D.addDays(pascoa, -47), 'Carnaval', 'facultativo');
    put(D.addDays(pascoa, -46), 'Quarta-feira de Cinzas', 'facultativo');
    put(D.addDays(pascoa, -2), 'Sexta-feira Santa');
    put(pascoa, 'Páscoa', 'data');
    put(`${y}-04-21`, 'Tiradentes');
    put(`${y}-05-01`, 'Dia do Trabalho');
    put(D.addDays(pascoa, 60), 'Corpus Christi', 'facultativo');
    put(`${y}-09-07`, 'Independência do Brasil');
    put(`${y}-10-12`, 'Nossa Senhora Aparecida');
    put(`${y}-11-02`, 'Finados');
    put(`${y}-11-15`, 'Proclamação da República');
    if (y >= 2024) put(`${y}-11-20`, 'Dia da Consciência Negra');
    put(`${y}-12-25`, 'Natal');
    extra.forEach((mark) => {
      const startYear = Number(mark.date.slice(0, 4));
      if (mark.yearly && y >= startYear) {
        const md = mark.date.slice(5);
        const date = md === '02-29' && D.daysIn(y, 2) === 28 ? `${y}-02-28` : `${y}-${md}`;
        put(date, mark.name);
      } else if (!mark.yearly && y === startYear) put(mark.date, mark.name);
    });
    cache.set(y, map);
    return map;
  }

  // Troca a lista de feriados locais (cada item: { date, name, yearly }).
  function setExtra(marks) {
    extra = (Array.isArray(marks) ? marks : []).filter((m) => m && D.isDate(m.date) && typeof m.name === 'string' && m.name.trim());
    cache.clear();
  }

  const of = (date) => forYear(Number(date.slice(0, 4))).get(date) || null;
  const list = (y) => [...forYear(y).entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  // Dia útil: segunda a sexta que não seja feriado. Ponto facultativo conta como dia útil.
  const isBusinessDay = (date) => { const w = D.weekday(date); const h = of(date); return w > 0 && w < 6 && !(h && h.kind === 'feriado'); };

  const api = { easter, of, list, isBusinessDay, setExtra };
  Plan.holidays = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
