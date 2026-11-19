/* Peças de calendário compartilhadas: matriz do mês, mini calendário e navegação por setas. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const D = Plan.dates;
  const H = Plan.holidays;
  const { h } = Plan.ui;

  const weekdayOrder = (ws) => Array.from({ length: 7 }, (_, i) => (ws + i) % 7);

  function matrix(y, m, ws) {
    const first = `${y}-${D.pad(m)}-01`;
    const last = `${y}-${D.pad(m)}-${D.pad(D.daysIn(y, m))}`;
    const start = D.startOfWeek(first, ws);
    const end = D.addDays(D.startOfWeek(last, ws), 6);
    const weeks = [];
    for (let d = start; d <= end; d = D.addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => D.addDays(d, i)));
    return weeks;
  }

  // Nomes do dia: feriado nacional e datas marcadas pelo usuário.
  function names(date) {
    const S = Plan.store;
    const out = [];
    const hol = H.of(date);
    if (hol) out.push(hol.name);
    S.marksOn(date).forEach((m) => out.push(m.name));
    return out;
  }

  // Compromissos de destaque do dia (as rotinas de fundo ficam de fora).
  const highlights = (date) => Plan.recur.eventsOn(Plan.store.get().events, date).filter((e) => e.kind === 'compromisso');

  function dayClasses(date, today) {
    const hol = H.of(date);
    const wd = D.weekday(date);
    return [
      date === today ? 'is-today' : '',
      hol && hol.kind === 'feriado' ? 'is-holiday' : '',
      hol && hol.kind === 'facultativo' ? 'is-optional' : '',
      hol && hol.kind === 'data' ? 'is-date' : '',
      Plan.store.marksOn(date).length ? 'is-mark' : '',
      wd === 0 || wd === 6 ? 'is-weekend' : '',
    ].filter(Boolean).join(' ');
  }

  // Setas movem entre os dias; só um dia do calendário fica na ordem do Tab.
  function attachGridNav(table, selector) {
    table.addEventListener('keydown', (e) => {
      const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      const buttons = [...table.querySelectorAll(selector)];
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      let next = null;
      if (steps[e.key] !== undefined) next = buttons[i + steps[e.key]];
      else if (e.key === 'Home') next = buttons[0];
      else if (e.key === 'End') next = buttons[buttons.length - 1];
      else return;
      e.preventDefault();
      if (!next) return;
      buttons.forEach((b) => b.setAttribute('tabindex', '-1'));
      next.setAttribute('tabindex', '0');
      next.focus();
    });
  }

  function dayLabel(date, extra) {
    const n = names(date);
    return [`${D.cap(D.fmt.weekday(date))}, ${D.fmt.long(date)}`, ...n, extra].filter(Boolean).join('. ');
  }

  function mini(y, m, { onPick, active, withNames = false } = {}) {
    const S = Plan.store;
    const ws = S.get().settings.weekStart;
    const today = D.today();
    const prefix = `${y}-${D.pad(m)}`;
    const focusDate = active && active.startsWith(prefix) ? active : `${prefix}-01`;
    const table = h('table', { class: 'mini' },
      h('caption', { class: 'sr-only' }, `${D.cap(D.MONTHS[m - 1])} de ${y}`),
      h('thead', {}, h('tr', {}, weekdayOrder(ws).map((wd) => h('th', { scope: 'col', abbr: D.WEEKDAYS[wd] }, D.WD_LETTER[wd])))),
      h('tbody', {}, matrix(y, m, ws).map((week) => h('tr', {}, week.map((date) => {
        if (!date.startsWith(prefix)) return h('td', { class: 'out' });
        const count = highlights(date).length;
        const label = names(date).join(', ');
        return h('td', {}, h('button', {
          type: 'button',
          class: `mini-day ${dayClasses(date, today)}${count ? ' has-ev' : ''}${date === active ? ' is-active' : ''}`,
          'aria-label': dayLabel(date, count ? `${count} ${count === 1 ? 'compromisso' : 'compromissos'}` : ''),
          'aria-current': date === today ? 'date' : null,
          title: label || null,
          tabindex: date === focusDate ? '0' : '-1',
          onClick: () => onPick(date),
        }, String(Number(date.slice(8)))));
      })))));
    attachGridNav(table, '.mini-day');

    const monthHolidays = H.list(y).filter(([date]) => date.startsWith(prefix));
    return h('section', { class: 'mini-month' },
      h('h3', { class: 'mini-title' }, h('a', { href: `#/mes/${prefix}` }, D.cap(D.MONTHS[m - 1]))),
      table,
      withNames
        ? h('ul', { class: 'mini-names' }, monthHolidays.map(([date, hol]) => h('li', { class: hol.kind }, h('b', {}, D.fmt.short(date).slice(0, 2)), ` ${hol.name}`)))
        : null);
  }

  // Lista de ações das metas que têm data dentro de um período (semana ou mês).
  function actionBox(title, from, to) {
    const S = Plan.store;
    const list = S.actionsBetween(from, to);
    return h('section', { class: 'box' },
      h('h2', {}, title),
      list.length
        ? h('ul', { class: 'subs' }, list.map(({ goal, obj, action }) => h('li', { class: `sub${action.done ? ' is-done' : ''}` },
          Plan.ui.check({ checked: action.done, label: `Concluir: ${action.text}`, key: `ck-a-${obj.id}-${action.id}`, onChange: (v) => S.setAction(goal.id, obj.id, action.id, { done: v }) }),
          h('span', { class: 'sub-text' }, action.text),
          h('a', { class: 'when', href: `#/dia/${action.date}`, title: `Abrir ${D.fmt.long(action.date)}` }, D.fmt.short(action.date)),
          h('a', { class: 'goal-link', href: '#/objetivos', title: `Meta: ${obj.title}` }, obj.title))))
        : Plan.ui.empty('Nenhuma ação das metas com data neste período. Dê uma data a uma ação na aba Objetivos.'));
  }

  Plan.cal = { weekdayOrder, matrix, names, highlights, dayClasses, attachGridNav, dayLabel, mini, actionBox };
})(globalThis);
