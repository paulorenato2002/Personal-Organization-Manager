/* Mês: o planejamento do começo do mês, com os dias, os feriados e o foco. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, navButton, focusBox, empty, crumbs, chipFilter } = Plan.ui;
  const D = Plan.dates;
  const H = Plan.holidays;
  const S = Plan.store;
  const go = (key) => Plan.router.go('mes', key);
  const MAX_CHIPS = 3;
  const ROUTINES = 'rotinas-de-fundo';

  function cell(date, prefix, today, showRoutines) {
    const inMonth = date.startsWith(prefix);
    const model = S.dayModel(date);
    const chosen = model.slots.filter((s) => (showRoutines || s.ev.kind === 'compromisso') && !S.isHidden(s.ev.tag));
    const names = Plan.cal.names(date);
    const chips = chosen.slice(0, MAX_CHIPS);
    const more = chosen.length - chips.length;
    const count = chosen.length;
    return h('td', {},
      h('button', {
        type: 'button',
        class: `cal-cell ${Plan.cal.dayClasses(date, today)}${inMonth ? '' : ' is-out'}`,
        'aria-label': Plan.cal.dayLabel(date, count ? `${count} ${count === 1 ? 'item' : 'itens'}` : ''),
        'aria-current': date === today ? 'date' : null,
        tabindex: '-1',
        'data-date': date,
        onClick: () => Plan.router.go('dia', date),
      },
      h('span', { class: 'cal-top' },
        h('span', { class: 'cal-num' }, String(Number(date.slice(8)))),
        date === today ? h('span', { class: 'ribbon small' }, 'Hoje') : null),
      names.length ? h('span', { class: 'cal-flag' }, names.join(' · ')) : null,
      chips.length
        ? h('span', { class: 'cal-evs' }, chips.map((s) => {
          const tag = S.tag(s.ev.tag);
          return h('span', { class: `cal-ev${s.done ? ' is-done' : ''}`, style: tag ? { '--tag-h': tag.hue, '--tag-c': tag.chroma } : null },
            h('i', { class: 'tag-dot', 'aria-hidden': 'true' }),
            h('span', { class: 'cal-ev-text' }, `${s.ev.time ? `${s.ev.time} ` : ''}${s.ev.title}`));
        }))
        : null,
      more > 0 ? h('span', { class: 'cal-more' }, `+${more}`) : null));
  }

  function monthList(y, m) {
    const prefix = `${y}-${D.pad(m)}`;
    const rows = H.list(y).filter(([date]) => date.startsWith(prefix)).map(([date, hol]) => ({ date, name: hol.name, kind: hol.kind }));
    S.get().marks.forEach((mk) => {
      for (let d = 1; d <= D.daysIn(y, m); d += 1) {
        const date = `${prefix}-${D.pad(d)}`;
        if (S.marksOn(date).some((x) => x.id === mk.id)) rows.push({ date, name: mk.name, kind: 'marca' });
      }
    });
    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    const label = { feriado: 'Feriado', facultativo: 'Ponto facultativo', data: 'Data', marca: 'Marcada por você' };
    return h('section', { class: 'box' },
      h('h2', {}, 'Datas do mês'),
      rows.length
        ? h('ul', { class: 'date-list' }, rows.map((r) => h('li', { class: r.kind }, h('b', {}, D.fmt.short(r.date)), ` ${D.fmt.weekdayShort(r.date)} `, r.name, h('small', {}, ` ${label[r.kind]}`))))
        : empty('Nenhum feriado neste mês.'),
      h('button', { type: 'button', class: 'btn small no-print', onClick: () => Plan.dialogs.mark({ date: `${prefix}-01` }) }, 'Marcar uma data'));
  }

  function render(route) {
    const st = S.get();
    const ws = st.settings.weekStart;
    const [y, m] = D.parts(`${route.key}-01`);
    const prefix = route.key;
    const today = D.today();
    const showRoutines = !st.settings.hideRoutinesMonth;
    const [py, pm] = D.addMonthsYM(y, m, -1);
    const [ny, nm] = D.addMonthsYM(y, m, 1);
    const prevKey = `${py}-${D.pad(pm)}`;
    const nextKey = `${ny}-${D.pad(nm)}`;
    const here = today.startsWith(prefix);
    const first = `${prefix}-01`;
    const last = `${prefix}-${D.pad(D.daysIn(y, m))}`;

    const ctx = h('div', { class: 'ctx no-print' },
      h('div', { class: 'ctx-nav' },
        navButton('Mês anterior', '‹', () => go(prevKey), prevKey < D.MIN.slice(0, 7)),
        h('button', { type: 'button', class: 'btn', disabled: here, onClick: () => go(today) }, 'Este mês'),
        navButton('Próximo mês', '›', () => go(nextKey), nextKey > D.MAX.slice(0, 7))),
      h('div', { class: 'ctx-actions' },
        h('button', { type: 'button', class: 'btn', 'data-key': 'new-task', title: 'Nova tarefa (tecla N)', onClick: () => Plan.dialogs.event({ date: here ? today : first }) }, 'Nova tarefa'),
        h('button', { type: 'button', class: 'btn primary', title: 'Imprimir (tecla P)', onClick: () => window.print() }, 'Imprimir o mês')));

    // As mesmas categorias da Semana, mais as rotinas de fundo, que o mês deixa de fora até a pessoa pedir.
    const filter = chipFilter({
      label: 'Categorias',
      items: [...st.tags.map((t) => ({ id: t.id, name: t.name, hue: t.hue, chroma: t.chroma })), { id: ROUTINES, name: 'Rotinas de fundo' }],
      on: (id) => (id === ROUTINES ? showRoutines : !S.isHidden(id)),
      onToggle: (id) => (id === ROUTINES ? S.setSettings({ hideRoutinesMonth: showRoutines }) : S.toggleHidden(id)),
      // "Mostrar todas" só religa categorias; as rotinas de fundo são um modo à parte e continuam como estão.
      onAll: () => S.showAllTags(),
      countOff: () => st.settings.hiddenTags.length,
      keyPrefix: 'mflt',
    });
    const trail = crumbs([{ label: String(y), href: `#/ano/${y}` }, { label: D.cap(D.MONTHS[m - 1]) }]);

    const table = h('table', { class: 'month' },
      h('caption', { class: 'sr-only' }, `${D.cap(D.fmt.monthYear(first))}`),
      h('thead', {}, h('tr', {}, Plan.cal.weekdayOrder(ws).map((wd) => h('th', { scope: 'col', abbr: D.WEEKDAYS[wd] }, D.cap(D.WD_SHORT[wd]))))),
      h('tbody', {}, Plan.cal.matrix(y, m, ws).map((week) => h('tr', {}, week.map((date) => cell(date, prefix, today, showRoutines))))));
    Plan.cal.attachGridNav(table, '.cal-cell');
    const focusable = table.querySelector(`.cal-cell[data-date="${here ? today : first}"]`) || table.querySelector('.cal-cell');
    if (focusable) focusable.setAttribute('tabindex', '0');

    return h('div', { class: 'view-month' }, trail, ctx,
      h('header', { class: 'page-head' },
        h('h1', { id: 'view-title' }, D.cap(D.fmt.monthYear(first))),
        h('p', { class: 'page-sub' }, `${D.daysIn(y, m)} dias, ${Array.from({ length: D.daysIn(y, m) }, (_, i) => `${prefix}-${D.pad(i + 1)}`).filter((d) => H.isBusinessDay(d)).length} dias úteis`),
        h('p', { class: 'page-hint' }, 'Planeje no começo do mês: o foco, as datas e as ações das metas. Clique em um dia para abrir a folha dele.')),
      filter,
      h('div', { class: 'month-layout' },
        h('div', { class: 'paper month-paper' }, table),
        h('div', { class: 'month-side' },
          focusBox('Foco do mês', `m:${prefix}`, 'As poucas coisas que fazem este mês valer.'),
          monthList(y, m),
          Plan.cal.actionBox('Ações das metas no mês', first, last))));
  }

  Plan.views = Plan.views || {};
  Plan.views.mes = { render };
})(globalThis);
