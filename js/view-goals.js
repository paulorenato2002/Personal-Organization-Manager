/* Objetivos: bolhas em cruz (até 4 objetivos) ou pilares. A barra de cada um vem do checklist de ações. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, empty } = Plan.ui;
  const S = Plan.store;
  const D = Plan.dates;
  const HB = Plan.habits;
  const MAX_PILLARS = 6;

  // Resumo da constância de um objetivo: sequência e porcentagem dos últimos 30 dias. Vazio quando não há hábito.
  function habitText(g, obj) {
    const events = S.habitsOf(g.id, obj.id);
    if (!events.length) return null;
    const days = S.get().days;
    const today = D.today();
    const hs = HB.history({ events, days, today });
    const l = HB.last30({ events, days, today });
    return `${HB.streakText(hs.current, events.length > 1)} · ${l.pct === null ? 'sem dados em 30 dias' : `${l.pct}% em 30 dias`}`;
  }

  const bar = (pct) => h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${pct}%` } }));

  async function addObjective(g, slot) {
    const title = await Plan.ui.promptBox({
      title: g.kind === 'pillars' ? 'Novo pilar' : 'Novo objetivo',
      label: 'Nome',
      placeholder: g.kind === 'pillars' ? 'Ex.: Saúde mental' : 'Ex.: Corrida de 10 km',
      action: 'Criar',
    });
    if (!title) return;
    const created = S.addObjective(g.id, title, slot);
    if (created) Plan.dialogs.objective(g.id, created.id);
  }

  function quad(g, obj) {
    const p = S.progress(obj);
    const next = S.nextAction(obj);
    const habit = habitText(g, obj);
    return h('button', {
      type: 'button', class: 'quad', 'data-key': `quad-${g.id}-${obj.id}`,
      'aria-label': `${obj.title}: ${p.done} de ${p.total} ações, ${p.pct}%.${habit ? ` Constância: ${habit}.` : ''} Abrir`,
      onClick: () => Plan.dialogs.objective(g.id, obj.id),
    },
    h('span', { class: 'quad-title' }, obj.title),
    bar(p.pct),
    h('span', { class: 'quad-meta' }, p.total ? `${p.done} de ${p.total} ações` : 'Sem ações ainda'),
    next ? h('span', { class: 'quad-next' }, `Próxima: ${next.text}`) : (p.total ? h('span', { class: 'quad-next' }, 'Todas as ações concluídas') : null),
    habit ? h('span', { class: 'quad-habit' }, habit) : null);
  }

  const emptyQuad = (g, slot) => h('button', { type: 'button', class: 'quad is-empty', 'data-key': `quad-new-${g.id}-${slot}`, onClick: () => addObjective(g, slot) }, '+ Objetivo');

  function head(g) {
    return h('header', { class: 'bubble-head' },
      h('h2', { id: `gt-${g.id}` }, g.title),
      h('div', { class: 'bubble-actions' },
        g.year ? h('span', { class: 'bubble-year' }, String(g.year)) : null,
        h('button', { type: 'button', class: 'btn small', 'data-key': `edit-${g.id}`, onClick: () => Plan.dialogs.bubble(g.id) }, 'Editar')));
  }

  function cross(g) {
    const prog = S.goalProgress(g);
    const slots = [0, 1, 2, 3].map((slot) => g.objectives.find((o) => o.slot === slot) || null);
    return h('article', { class: 'bubble cross', 'aria-labelledby': `gt-${g.id}` },
      head(g),
      h('div', { class: 'cross-grid' },
        slots.map((obj, i) => (obj ? quad(g, obj) : emptyQuad(g, i))),
        prog.total ? h('div', { class: 'hub', style: { '--p': prog.pct }, role: 'img', 'aria-label': `Progresso geral de ${g.title}: ${prog.pct}%` }, h('span', {}, `${prog.pct}%`)) : null));
  }

  function pillar(g, obj) {
    const p = S.progress(obj);
    const habit = habitText(g, obj);
    return h('button', {
      type: 'button', class: 'pillar', style: { '--p': p.pct }, 'data-key': `pillar-${g.id}-${obj.id}`,
      'aria-label': `${obj.title}: ${p.done} de ${p.total} ações, ${p.pct}%.${habit ? ` Constância: ${habit}.` : ''} Abrir`,
      onClick: () => Plan.dialogs.objective(g.id, obj.id),
    },
    h('span', { class: 'pillar-fill', 'aria-hidden': 'true' }),
    h('span', { class: 'pillar-name' }, obj.title),
    h('span', { class: 'pillar-pct' }, p.total ? `${p.pct}%` : 'sem ações'),
    habit ? h('span', { class: 'pillar-habit' }, habit) : null);
  }

  function pillars(g) {
    const list = [...g.objectives].sort((a, b) => a.slot - b.slot);
    return h('article', { class: 'bubble temple', 'aria-labelledby': `gt-${g.id}` },
      head(g),
      h('div', { class: 'pillars' },
        list.map((o) => pillar(g, o)),
        list.length < MAX_PILLARS ? h('button', { type: 'button', class: 'pillar is-empty', 'data-key': `pillar-new-${g.id}`, onClick: () => addObjective(g) }, '+ Pilar') : null),
      h('div', { class: 'base', 'aria-hidden': 'true' }));
  }

  function render() {
    const goals = S.get().goals;
    const pillarZone = goals.filter((g) => g.kind === 'pillars');
    const crossZone = goals.filter((g) => g.kind !== 'pillars');
    const ctx = h('div', { class: 'ctx no-print' },
      h('div', { class: 'ctx-nav' }),
      h('div', { class: 'ctx-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => Plan.dialogs.bubble() }, 'Nova bolha'),
        h('button', { type: 'button', class: 'btn primary', title: 'Imprimir (tecla P)', onClick: () => window.print() }, 'Imprimir objetivos')));
    return h('div', { class: 'view-goals' }, ctx,
      h('header', { class: 'page-head' },
        h('h1', { id: 'view-title' }, 'Objetivos'),
        h('p', { class: 'page-sub' }, 'Cada bolha reúne objetivos. A barra de cada um vem do checklist de ações, e uma ação com data aparece na folha do dia.')),
      goals.length
        ? [
          // Os pilares são o indicador de tudo: ficam sempre no topo. As bolhas em cruz vêm abaixo, de duas em duas.
          pillarZone.length ? h('div', { class: 'pillar-zone' }, pillarZone.map(pillars)) : null,
          Plan.constancia.board(),
          crossZone.length ? h('div', { class: 'bubbles' }, crossZone.map(cross)) : null,
        ]
        : [Plan.constancia.board(), h('div', { class: 'paper' }, empty('Nenhuma bolha ainda. Crie a primeira com "Nova bolha": em cruz, para até 4 objetivos, ou em pilares, para o que sustenta o resto.'))]);
  }

  Plan.views = Plan.views || {};
  Plan.views.objetivos = { render };
})(globalThis);
