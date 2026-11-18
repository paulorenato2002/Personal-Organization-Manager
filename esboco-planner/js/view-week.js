/* Semana: sete colunas para planejar no domingo e mexer em qualquer coisa. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, tagChip, navButton, focusBox, empty, crumbs, chipFilter } = Plan.ui;
  const D = Plan.dates;
  const S = Plan.store;
  const go = (date) => Plan.router.go('semana', date);

  // Categorias que a pessoa pode ligar e desligar: as tags e as ações das metas.
  const filterItems = () => [...S.get().tags.map((t) => ({ id: t.id, name: t.name, hue: t.hue, chroma: t.chroma })), { id: 'metas', name: 'Metas' }];

  function slotItem(date, slot) {
    const { ev } = slot;
    const tag = S.tag(ev.tag);
    const extra = slot.items.length + slot.tasks.length;
    const counter = !!ev.track && slot.target > 1;
    return h('li', {
      class: `wk-ev${ev.kind === 'rotina' ? ' is-routine' : ''}${slot.done ? ' is-done' : ''}${tag ? ' is-tagged' : ''}`,
      style: tag ? { '--tag-h': tag.hue, '--tag-c': tag.chroma } : null,
    },
    h('button', {
      type: 'button', class: 'wk-ev-btn', 'data-key': `wk-${ev.id}-${date}`, title: counter ? `${slot.count} de ${slot.target}${ev.track.unit ? ` ${ev.track.unit}` : ''}` : null,
      onClick: () => Plan.dialogs.event({ id: ev.id, date }),
    },
    // Contador de dia todo mostra o andamento (3/8) onde ficaria o horário; com horário, o andamento vai embaixo do nome.
    h('span', { class: `wk-time${ev.time ? '' : ' allday'}${!ev.time && counter ? ' is-count' : ''}` }, ev.time || (counter ? `${slot.count}/${slot.target}` : 'dia todo')),
    h('span', { class: 'wk-title' }, ev.title),
    extra ? h('span', { class: 'wk-count' }, `${extra} ${extra === 1 ? 'afazer' : 'afazeres'}`) : null,
    !extra && counter && ev.time ? h('span', { class: 'wk-count is-counter' }, `${slot.count}/${slot.target}${ev.track.unit ? ` ${ev.track.unit}` : ''}`) : null),
    ev.kind === 'compromisso' ? tagChip(ev.tag) : null);
  }

  function dayColumn(date, showMetas) {
    const model = S.dayModel(date);
    const today = D.today();
    const slots = model.slots.filter((s) => !S.isHidden(s.ev.tag));
    const actions = showMetas ? model.actions : [];
    const hidden = model.slots.length - slots.length + (showMetas ? 0 : model.actions.length);
    const names = Plan.cal.names(date);
    const cls = Plan.cal.dayClasses(date, today);
    return h('section', { class: `wk-day ${cls}`, 'aria-label': Plan.cal.dayLabel(date) },
      h('header', { class: 'wk-head' },
        h('a', { class: 'wk-link', href: `#/dia/${date}`, title: 'Abrir a folha deste dia' },
          h('span', { class: 'wk-wd' }, D.cap(D.fmt.weekdayShort(date))),
          h('span', { class: 'wk-num' }, String(Number(date.slice(8))))),
        date === today ? h('span', { class: 'ribbon small' }, 'Hoje') : null),
      names.length ? h('p', { class: 'wk-flag' }, names.join(' · ')) : null,
      slots.length ? h('ul', { class: 'wk-list' }, slots.map((s) => slotItem(date, s))) : empty('Livre'),
      actions.length ? h('ul', { class: 'wk-list wk-goals' }, actions.map(({ obj, action }) => h('li', { class: `wk-ev is-goal${action.done ? ' is-done' : ''}` },
        h('a', { class: 'wk-ev-btn', href: '#/objetivos', title: `Meta: ${obj.title}` }, h('span', { class: 'wk-time' }, 'meta'), h('span', { class: 'wk-title' }, action.text))))) : null,
      hidden ? h('p', { class: 'wk-hidden no-print' }, `${hidden} ${hidden === 1 ? 'item fora do filtro' : 'itens fora do filtro'}`) : null,
      h('div', { class: 'wk-write', 'aria-hidden': 'true' }, Array.from({ length: 14 }, () => h('i', {}))),
      h('button', { type: 'button', class: 'wk-add no-print', onClick: () => Plan.dialogs.event({ date }) }, '+ tarefa'));
  }

  function render(route) {
    const st = S.get();
    const ws = st.settings.weekStart;
    const date = D.clamp(route.date);
    const start = D.startOfWeek(date, ws);
    const end = D.addDays(start, 6);
    const days = Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
    const today = D.today();
    const inWeek = today >= start && today <= end;
    const showMetas = !S.isHidden('metas');
    const [year, month] = D.parts(date);
    const week = D.weekNumber(date, ws);
    const off = filterItems().filter((it) => S.isHidden(it.id));
    // Quanto mais cheio o dia mais cheio da semana, menor a letra no papel (ver print.css), para caber numa folha.
    // Linhas que o dia ocupa na coluna do papel (cerca de 17 letras por linha), com a etiqueta dos compromissos e o "N afazeres".
    const lines = (text) => Math.max(1, Math.ceil(text.length / 17));
    const load = (m, chips) => m.slots.filter((s) => !S.isHidden(s.ev.tag)).reduce((n, s) => n
      + lines(s.ev.title) + (chips && s.ev.kind === 'compromisso' && S.tag(s.ev.tag) ? 1 : 0) + (s.items.length + s.tasks.length ? 1 : 0) + 0.4, 0)
      + (showMetas ? m.actions.reduce((n, a) => n + lines(a.action.text) + 0.9, 0) : 0);
    const models = days.map((d) => S.dayModel(d));
    const density = Math.max(...models.map((m) => load(m, true))) <= 31 ? 'normal' : Math.max(...models.map((m) => load(m, false))) <= 36 ? 'compact' : 'tight';

    const ctx = h('div', { class: 'ctx no-print' },
      h('div', { class: 'ctx-nav' },
        navButton('Semana anterior', '‹', () => go(D.addDays(start, -7)), start <= D.MIN),
        h('button', { type: 'button', class: 'btn', disabled: inWeek, onClick: () => go(today) }, 'Esta semana'),
        navButton('Próxima semana', '›', () => go(D.addDays(start, 7)), end >= D.MAX)),
      h('div', { class: 'ctx-actions' },
        h('button', { type: 'button', class: 'btn', 'data-key': 'new-task', title: 'Nova tarefa (tecla N)', onClick: () => Plan.dialogs.event({ date }) }, 'Nova tarefa'),
        h('button', { type: 'button', class: 'btn primary', title: 'Imprimir (tecla P)', onClick: () => window.print() }, 'Imprimir a semana')));

    const trail = crumbs([
      { label: String(year), href: `#/ano/${year}` },
      { label: D.cap(D.MONTHS[month - 1]), href: `#/mes/${year}-${D.pad(month)}` },
      { label: `Semana ${week}` },
    ]);

    const filter = chipFilter({
      label: 'Categorias', items: filterItems(), on: (id) => !S.isHidden(id), onToggle: (id) => S.toggleHidden(id), onAll: () => S.showAllTags(),
    });

    return h('div', { class: 'view-week' }, trail, ctx,
      h('header', { class: 'page-head' },
        h('h1', { id: 'view-title' }, `Semana ${week}`),
        h('p', { class: 'page-sub' }, D.fmt.range(start, end)),
        h('p', { class: 'page-hint' }, 'Planeje no domingo: o foco, as ações das metas e o que entra em cada dia.')),
      filter,
      off.length ? h('p', { class: 'filter-note' }, `Categorias fora desta folha: ${off.map((o) => o.name).join(', ')}.`) : null,
      h('div', { class: 'above-grid' },
        focusBox('Foco da semana', `w:${start}`, 'O que precisa estar pronto até o domingo.'),
        showMetas ? Plan.cal.actionBox('Ações das metas na semana', start, end) : null),
      h('div', { class: 'week-grid', 'data-density': density }, days.map((d) => dayColumn(d, showMetas))));
  }

  Plan.views = Plan.views || {};
  Plan.views.semana = { render };
})(globalThis);
