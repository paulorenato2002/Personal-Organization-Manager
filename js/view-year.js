/* Ano: 2026 a 2040, com feriados marcados. Dá para olhar o ano todo ou só o semestre. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, navButton, focusBox } = Plan.ui;
  const D = Plan.dates;
  const H = Plan.holidays;
  const S = Plan.store;
  const Y_MIN = Number(D.MIN.slice(0, 4));
  const Y_MAX = Number(D.MAX.slice(0, 4));
  const href = (year, sem) => `#/ano/${year}${sem ? `/${sem}` : ''}`;

  function holidayTable(year) {
    const rows = H.list(year);
    const label = { feriado: 'Feriado', facultativo: 'Ponto facultativo', data: 'Data' };
    return h('section', { class: 'box holiday-box' },
      h('h2', {}, `Feriados e pontos facultativos de ${year}`),
      h('p', { class: 'hint' }, 'Feriados nacionais e os locais que você marcou. Para incluir o do seu estado ou cidade, use "Marcar uma data".'),
      h('ul', { class: 'date-list cols' }, rows.map(([date, hol]) => h('li', { class: hol.kind },
        h('b', {}, D.fmt.short(date)), ` ${D.fmt.weekdayShort(date)} `, hol.name, h('small', {}, ` ${label[hol.kind]}`)))),
      h('button', { type: 'button', class: 'btn small no-print', onClick: () => Plan.dialogs.mark({ date: `${year}-01-01` }) }, 'Marcar uma data'));
  }

  function legend() {
    return h('ul', { class: 'legend no-print', 'aria-label': 'Legenda' },
      h('li', {}, h('i', { class: 'key-dot key-holiday' }), 'Feriado'),
      h('li', {}, h('i', { class: 'key-dot key-optional' }), 'Ponto facultativo'),
      h('li', {}, h('i', { class: 'key-dot key-today' }), 'Hoje'),
      h('li', {}, h('i', { class: 'key-dot key-ev' }), 'Tem compromisso'),
      h('li', {}, h('i', { class: 'key-dot key-mark' }), 'Marcada por você'));
  }

  function render(route) {
    const { year, sem } = route;
    const today = D.today();
    const cursor = Plan.router.cursor();
    const months = sem === 1 ? [1, 2, 3, 4, 5, 6] : sem === 2 ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const thisYear = Number(today.slice(0, 4));

    const ctx = h('div', { class: 'ctx no-print' },
      h('div', { class: 'ctx-nav' },
        navButton('Ano anterior', '‹', () => Plan.router.go('ano', year - 1, sem), year <= Y_MIN),
        h('button', { type: 'button', class: 'btn', disabled: year === thisYear, onClick: () => Plan.router.go('ano', thisYear, sem) }, 'Este ano'),
        navButton('Próximo ano', '›', () => Plan.router.go('ano', year + 1, sem), year >= Y_MAX)),
      h('div', { class: 'ctx-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => Plan.dialogs.mark({ date: `${year}-01-01` }) }, 'Marcar uma data'),
        h('button', { type: 'button', class: 'btn primary', title: 'Imprimir (tecla P)', onClick: () => window.print() }, sem ? 'Imprimir o semestre' : 'Imprimir o ano')));

    const strip = h('nav', { class: 'year-strip no-print', 'aria-label': `Anos de ${Y_MIN} a ${Y_MAX}` },
      Array.from({ length: Y_MAX - Y_MIN + 1 }, (_, i) => Y_MIN + i).map((y) => h('a', { href: href(y, sem), 'aria-current': y === year ? 'page' : null }, String(y))));

    const semNav = h('nav', { class: 'sem-nav no-print', 'aria-label': 'Período do ano' },
      [[0, 'Ano inteiro'], [1, '1º semestre'], [2, '2º semestre']].map(([value, text]) => h('a', { href: href(year, value), 'aria-current': value === sem ? 'page' : null }, text)));

    const focus = sem
      ? [focusBox(`Foco do ${sem}º semestre`, `s:${year}-${sem}`, 'Planejado no começo do semestre.')]
      : [focusBox('Foco do 1º semestre', `s:${year}-1`), focusBox('Foco do 2º semestre', `s:${year}-2`)];

    return h('div', { class: 'view-year' }, ctx,
      h('header', { class: 'page-head' },
        h('h1', { id: 'view-title' }, String(year)),
        h('p', { class: 'page-sub' }, sem === 1 ? '1º semestre, de janeiro a junho' : sem === 2 ? '2º semestre, de julho a dezembro' : 'Ano inteiro')),
      strip, semNav,
      // Os cards vêm antes do calendário do ano. No papel a ordem se inverte (o calendário primeiro), ver print.css.
      h('div', { class: 'above-grid' }, ...focus),
      sem ? null : holidayTable(year),
      Plan.constancia.board({ year }),
      h('div', { class: `paper year-paper${sem ? ' is-semester' : ''}` },
        h('h2', { class: 'sr-only' }, sem ? `Meses do ${sem}º semestre de ${year}` : `Meses de ${year}`),
        h('div', { class: 'mini-grid' }, months.map((m) => Plan.cal.mini(year, m, { onPick: (d) => Plan.router.go('dia', d), active: cursor, withNames: !!sem }))),
        legend()));
  }

  Plan.views = Plan.views || {};
  Plan.views.ano = { render };
})(globalThis);
