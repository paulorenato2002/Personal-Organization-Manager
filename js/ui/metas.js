(function (root) {
  const { h, fmt, shell, ui, habits, dates } = root.App;
  const GRID_DAYS = 30;
  const TYPES = [['check', 'Sim ou não'], ['counter', 'Quantidade'], ['list', 'Lista do dia']];
  const UNITS = [['ml', 'ml (vira L)'], ['min', 'minutos (vira h)'], ['páginas', 'páginas'], ['vezes', 'vezes'], ['km', 'km'], ['', 'sem unidade']];
  const LEVEL_TEXT = { full: 'cumprida', partial: 'parcial', none: 'não feita', pending: 'sem registro', blank: 'fora do período' };
  let day = null;

  const parseList = (text) => text.split(',').map((x) => x.trim()).filter(Boolean);

  async function editHabit(store, groupId, habit) {
    const { dialog } = ui;
    let removed = false;
    const groups = [...store.getState().habitGroups].sort((a, b) => a.order - b.order);
    const isCounter = (v) => v.type === 'counter';
    const result = await dialog.form({
      title: habit ? 'Editar meta' : 'Nova meta',
      fields: [
        { name: 'name', label: 'Nome', value: habit ? habit.name : '', placeholder: 'Beber água' },
        { name: 'groupId', label: 'Grupo', type: 'select', value: groupId, options: groups.map((g) => [g.id, g.name]) },
        { name: 'type', label: 'Como marcar', type: 'select', value: habit ? habit.type : 'check', options: TYPES },
        { name: 'unit', label: 'Unidade', type: 'select', value: habit && habit.unit !== undefined ? habit.unit : 'ml', options: UNITS, visibleIf: isCounter },
        { name: 'goal', label: 'Meta por dia', type: 'number', min: '1', value: habit && habit.goal ? habit.goal : 3000, visibleIf: isCounter },
        { name: 'step', label: 'Quanto soma a cada clique', type: 'number', min: '1', value: habit && habit.step ? habit.step : 500, visibleIf: isCounter },
        {
          name: 'list',
          label: 'Itens, separados por vírgula',
          value: habit && habit.listItems ? habit.listItems.join(', ') : '',
          placeholder: '07:00 Café, 12:00 Almoço, 19:00 Jantar',
          visibleIf: (v) => v.type === 'list',
        },
      ],
      extra: habit ? (close) => h('button', {
        type: 'button',
        class: 'btn danger',
        style: { 'margin-right': 'auto' },
        onClick: () => { removed = true; close(null); },
      }, 'Excluir') : null,
    });
    if (removed) {
      const ok = await dialog.confirm(`Excluir a meta "${habit.name}" e o registro dela?`, { title: 'Excluir meta', action: 'Excluir', danger: true });
      if (ok) store.deleteHabit(habit.id);
      return;
    }
    if (!result || !result.name.trim()) return;
    const fields = { name: result.name.trim(), groupId: result.groupId, type: result.type };
    if (result.type === 'counter') {
      fields.goal = Math.max(1, Number(result.goal) || 1);
      fields.step = Math.max(1, Number(result.step) || 1);
      fields.unit = result.unit;
    }
    if (result.type === 'list') {
      fields.listItems = parseList(result.list);
      if (!fields.listItems.length) { shell.toast('Informe ao menos um item da lista.'); return; }
    }
    if (habit) store.updateHabit(habit.id, fields);
    else store.addHabit(result.groupId, fields);
  }

  function control(habit, value, store) {
    if (habit.type === 'check') {
      const on = value === true;
      return h('button', {
        class: `pill${on ? ' on' : ''}`,
        role: 'checkbox',
        'aria-checked': String(on),
        'data-control': 'check',
        onClick: () => store.setHabitValue(habit.id, day, !on),
      }, on ? 'Feito' : 'Marcar');
    }
    if (habit.type === 'counter') {
      const count = typeof value === 'number' ? value : 0;
      return h('div', { class: 'counter' },
        h('button', {
          class: 'round',
          'aria-label': `Tirar de ${habit.name}`,
          'data-control': 'minus',
          disabled: count === 0,
          onClick: () => store.setHabitValue(habit.id, day, Math.max(0, count - habit.step)),
        }, '−'),
        h('b', { 'data-control': 'value' }, `${habits.formatAmount(habit, count)} / ${habits.formatAmount(habit, habit.goal)}`),
        h('button', {
          class: 'btn small primary',
          'data-control': 'plus',
          onClick: () => store.setHabitValue(habit.id, day, count + habit.step),
        }, habits.stepLabel(habit)));
    }
    const marked = Array.isArray(value) ? value : [];
    return h('div', { class: 'list-checks' }, habit.listItems.map((entry) => {
      const on = marked.includes(entry);
      return h('button', {
        class: `pill${on ? ' on' : ''}`,
        role: 'checkbox',
        'aria-checked': String(on),
        'data-control': 'item',
        onClick: () => store.setHabitValue(habit.id, day, on ? marked.filter((x) => x !== entry) : [...marked, entry]),
      }, entry);
    }));
  }

  function habitRow(habit, store) {
    const { habitLog } = store.getState();
    const value = habitLog[day] && habitLog[day][habit.id];
    const level = habits.gridCell(habit, habitLog, day, store.today());
    return h('div', { class: 'habit', 'data-habit': habit.name },
      h('button', { class: 'habit-name', title: 'Editar meta', onClick: () => editHabit(store, habit.groupId, habit) }, habit.name),
      control(habit, value, store),
      h('span', { class: `cell static ${level}`, title: `Hoje: ${LEVEL_TEXT[level]}`, 'data-level': level }));
  }

  async function editGroup(store, group) {
    const { dialog } = ui;
    let removed = false;
    const result = await dialog.form({
      title: 'Editar grupo',
      fields: [{ name: 'name', label: 'Nome', value: group.name }],
      extra: (close) => h('button', {
        type: 'button',
        class: 'btn danger',
        style: { 'margin-right': 'auto' },
        onClick: () => { removed = true; close(null); },
      }, 'Excluir'),
    });
    if (removed) {
      const ok = await dialog.confirm(`Excluir o grupo "${group.name}" e as metas dele?`, { title: 'Excluir grupo', action: 'Excluir', danger: true });
      if (ok) store.deleteHabitGroup(group.id);
      return;
    }
    if (result && result.name.trim()) store.updateHabitGroup(group.id, { name: result.name.trim() });
  }

  function legend() {
    return h('div', { class: 'legend' }, [
      ['full', 'Cumpriu'],
      ['partial', 'Parcial'],
      ['none', 'Não fez'],
      ['pending', 'Hoje, sem registro'],
    ].map(([level, label]) => h('span', {}, h('i', { class: `cell static ${level}` }), label)));
  }

  function performanceGrid(store, ordered) {
    const today = store.today();
    const { habitLog } = store.getState();
    const days = Array.from({ length: GRID_DAYS }, (_, i) => dates.addDays(today, i - GRID_DAYS + 1));
    const scroller = h('div', {
      class: 'grid-scroll',
      'data-grid': '1',
    }, h('div', { class: 'perf', style: { 'grid-template-columns': `minmax(150px, max-content) repeat(${GRID_DAYS}, 42px)` } },
      h('div', { class: 'perf-name head-cell' }, 'Meta'),
      days.map((d) => h('div', { class: `perf-day${d === today ? ' today' : ''}${d === day ? ' selected' : ''}` }, fmt.short(d))),
      ordered.map((habit) => [
        h('div', { class: 'perf-name', title: habit.name }, habit.name),
        days.map((d) => {
          const level = habits.gridCell(habit, habitLog, d, today);
          return h('div', { class: `perf-cell${d === day ? ' selected' : ''}` }, h('button', {
            class: `cell ${level}`,
            'data-cell': `${habit.name}|${d}`,
            'data-level': level,
            title: `${habit.name}, ${fmt.short(d)}: ${LEVEL_TEXT[level]}`,
            'aria-label': `${habit.name}, ${fmt.short(d)}: ${LEVEL_TEXT[level]}. Abrir esse dia`,
            onClick: () => { day = d; shell.render(); },
          }));
        }),
      ])));
    // Deixa o dia selecionado à vista, na ponta direita da grade.
    queueMicrotask(() => {
      const selected = scroller.querySelector('.perf-day.selected');
      if (!selected) return;
      const box = scroller.getBoundingClientRect();
      scroller.scrollLeft += selected.getBoundingClientRect().right - box.right;
    });
    return h('section', { class: 'box perf-box' },
      h('div', { class: 'box-head' }, h('span', {}, 'Desempenho'), h('span', { class: 'count' }, `últimos ${GRID_DAYS} dias`)),
      scroller,
      legend());
  }

  function render(container, store) {
    const today = store.today();
    if (!day || day > today) day = today;
    const state = store.getState();
    const groups = [...state.habitGroups].sort((a, b) => a.order - b.order);
    const inGroup = (group) => state.habits.filter((x) => x.groupId === group.id).sort((a, b) => a.order - b.order);
    const ordered = groups.flatMap(inGroup);
    const score = habits.dayScore(state.habits, state.habitLog, day);
    const dayLabel = day === today ? `Hoje, ${fmt.long(day)}` : fmt.cap(fmt.long(day));
    container.append(
      h('div', { class: 'head compact' }, h('h1', {}, 'Metas')),
      h('div', { class: 'progress' },
        h('div', { class: 'bar' }, h('i', { style: { width: `${score.total ? (score.done / score.total) * 100 : 0}%` } })),
        score.total ? `${score.done} de ${score.total} metas concluídas` : 'Sem metas neste dia'),
      h('div', { class: 'date-nav' },
        h('button', { class: 'round', 'aria-label': 'Dia anterior', 'data-action': 'dia-anterior', onClick: () => { day = dates.addDays(day, -1); shell.render(); } }, '‹'),
        h('b', {}, dayLabel),
        h('button', {
          class: 'round',
          'aria-label': 'Próximo dia',
          disabled: day >= today,
          'data-action': 'dia-seguinte',
          onClick: () => { day = dates.addDays(day, 1); shell.render(); },
        }, '›'),
        day !== today ? h('button', { class: 'btn small', onClick: () => { day = today; shell.render(); } }, 'Voltar para hoje') : null),
      h('div', { class: 'metas-layout' },
        h('div', { class: 'metas-groups' },
          groups.map((group) => h('section', { class: 'box', 'data-group': group.name },
            h('div', { class: 'box-head' },
              h('span', {}, group.name),
              h('button', { class: 'icon-btn', style: { 'margin-left': 'auto' }, 'aria-label': `Editar grupo ${group.name}`, onClick: () => editGroup(store, group) }, '⋯')),
            inGroup(group).map((habit) => habitRow(habit, store)),
            h('button', {
              class: 'qa',
              style: { 'text-align': 'left', color: 'var(--muted)' },
              'data-action': 'nova-meta',
              onClick: () => editHabit(store, group.id, null),
            }, '+ Nova meta'))),
          h('button', {
            class: 'tile-add',
            'data-action': 'novo-grupo',
            onClick: async () => {
              const name = await ui.dialog.prompt('Novo grupo de metas', '');
              if (name) store.addHabitGroup(name);
            },
          }, '+ Novo grupo')),
        ordered.length ? performanceGrid(store, ordered) : null)
    );
  }

  shell.register('metas', { render });
})(globalThis);
