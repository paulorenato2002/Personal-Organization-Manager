(function (root) {
  const { h, shell, ui } = root.App;
  const { dialog } = ui;

  function greeting(now = new Date()) {
    const hour = now.getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function compromissoActive(item) {
    const [day, time] = item.start.split('T');
    const [y, m, d] = day.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm + (item.durationMin || 0)).getTime() > Date.now();
  }

  function sectorLists(items, sectorId) {
    const own = items.filter((i) => i.sectorId === sectorId && !i.deletedAt);
    return {
      rotinas: own.filter((i) => i.kind === 'rotina'),
      pontuais: own.filter((i) => (i.kind === 'pontual' && !i.doneAt) || (i.kind === 'compromisso' && !i.doneAt && compromissoActive(i))),
    };
  }

  function quickInput(store, sectorId, kind, placeholder) {
    return h('input', {
      class: 'qa',
      placeholder,
      'aria-label': placeholder,
      'data-key': `qa-${sectorId}-${kind}`,
      'data-keep-value': '',
      onKeydown: (event) => {
        if (event.key !== 'Enter') return;
        const text = event.target.value;
        event.target.value = '';
        store.quickAdd({ kind, sectorId, text });
      },
    });
  }

  async function renameSector(store, sector) {
    const name = await dialog.prompt('Renomear setor', sector.name);
    if (name) store.updateSector(sector.id, { name });
  }

  async function removeSector(store, sector, openCount) {
    if (openCount > 0) {
      const ok = await dialog.confirm(
        `O setor "${sector.name}" tem ${openCount} ${openCount === 1 ? 'demanda' : 'demandas'}. Rotinas e compromissos serão removidos, e as pontuais ficam só no Histórico.`,
        { title: 'Excluir setor', action: 'Excluir', danger: true }
      );
      if (!ok) return;
    }
    store.deleteSector(sector.id);
    shell.toast(`Setor "${sector.name}" excluído`, { undo: () => store.undo() });
  }

  function sectorCard(store, sector, siblings) {
    const { rotinas, pontuais } = sectorLists(store.getState().items, sector.id);
    const count = rotinas.length + pontuais.length;
    const index = siblings.indexOf(sector);
    const menuWrap = h('div', { class: 'menu-wrap' });
    menuWrap.append(h('button', {
      class: 'icon-btn',
      'aria-label': `Opções de ${sector.name}`,
      onClick: (event) => {
        event.stopPropagation();
        const entries = [['Renomear', () => renameSector(store, sector)]];
        if (index > 0) entries.push(['Mover para antes', () => store.reorder('sectors', sector.id, index - 1)]);
        if (index < siblings.length - 1) entries.push(['Mover para depois', () => store.reorder('sectors', sector.id, index + 1)]);
        entries.push(['Excluir', () => removeSector(store, sector, count), 'danger']);
        shell.openMenu(menuWrap, entries);
      },
    }, '⋯'));
    return h('section', { class: 'box', 'data-sector': sector.id },
      h('div', {
        class: `box-head${sector.cover ? ' with-cover' : ''}`,
        style: sector.cover ? { 'background-image': `url("${sector.cover}")` } : null,
      },
      h('span', {}, sector.icon || ''),
      h('span', {}, sector.name),
      h('span', { class: 'count' }, count),
      menuWrap),
      h('div', { class: 'columns' },
        h('div', { 'data-col': 'rotinas' },
          h('div', { class: 'col-title' }, 'Rotinas'),
          rotinas.map((item) => ui.itemRow(item, store)),
          quickInput(store, sector.id, 'rotina', '+ Rotina')),
        h('div', { 'data-col': 'pontuais' },
          h('div', { class: 'col-title' }, 'Pontuais'),
          pontuais.map((item) => ui.itemRow(item, store)),
          quickInput(store, sector.id, 'pontual', '+ Cliente - demanda'))));
  }

  let todaySector = null;

  function donut(done, total) {
    const percent = total ? Math.round((done / total) * 100) : 0;
    return h('div', { class: 'donut-wrap', role: 'img', 'aria-label': `${percent}% das tarefas de hoje concluídas` },
      h('div', { class: 'donut', style: { '--p': `${percent}%` } }),
      h('div', { class: 'donut-label' }, h('b', { 'data-donut': String(percent) }, `${percent}%`), h('small', {}, 'concluído')));
  }

  function metric(label, value, key) {
    return h('div', { class: 'metric' }, h('b', { 'data-metric': key }, value), h('small', {}, label));
  }

  function todayCard(store) {
    const { pending, habits } = root.App;
    const state = store.getState();
    const today = store.today();
    const list = pending.todayList(state.items, today);
    const { done, total } = pending.dayProgress(state.items, today);
    const late = pending.pendingByDay(state.items, today).reduce((n, g) => n + g.items.length, 0);
    const goals = habits.dayScore(state.habits, state.habitLog, today);
    const options = ui.sectorOptions(store);
    if (!options.some(([id]) => id === todaySector)) {
      const first = state.sectors.filter((s) => s.sessionId === shell.currentSession()).sort((a, b) => a.order - b.order)[0];
      todaySector = first ? first.id : (options[0] && options[0][0]);
    }
    const sorted = [...list].sort((a, b) => Number(pending.isDone(a, today)) - Number(pending.isDone(b, today)));
    return h('section', { class: 'box today-card', 'data-today-card': '1' },
      h('div', { class: 'today-stats' },
        donut(done, total),
        h('div', { class: 'metrics' },
          metric('tarefas hoje', total, 'total'),
          metric('feitas', done, 'feitas'),
          metric('faltam', total - done, 'faltam'),
          metric('pendências', late, 'pendencias'),
          metric('metas', `${goals.done}/${goals.total}`, 'metas'))),
      h('div', { class: 'today-list' },
        h('div', { class: 'box-head plain' }, 'Para hoje'),
        h('div', { class: 'today-scroll' },
          sorted.length ? sorted.map((item) => ui.itemRow(item, store)) : h('p', { class: 'hint' }, 'Nada para hoje. Adicione abaixo.')),
        options.length ? h('div', { class: 'today-add' },
          h('input', {
            class: 'qa',
            placeholder: '+ Tarefa para hoje (Cliente - tarefa)',
            'aria-label': 'Adicionar tarefa para hoje',
            'data-key': 'qa-hoje',
            'data-keep-value': '',
            onKeydown: (event) => {
              if (event.key !== 'Enter') return;
              const text = event.target.value;
              event.target.value = '';
              store.quickAdd({ kind: 'pontual', sectorId: todaySector, text });
            },
          }),
          h('select', {
            class: 'session-select',
            'aria-label': 'Setor da tarefa',
            'data-key': 'qa-hoje-setor',
            onChange: (event) => { todaySector = event.target.value; },
          }, options.map(([id, label]) => h('option', { value: id, selected: id === todaySector }, label)))) : null),
      h('div', { class: 'today-pending', 'data-pend-col': '1' },
        h('div', { class: 'box-head plain' }, `Vencidas${late ? ` (${late})` : ''}`),
        h('div', { class: 'today-scroll' },
          late ? ui.pendingGroups(store) : h('p', { class: 'hint' }, 'Nada vencido. Tudo em dia.'))));
  }

  function render(container, store) {
    const { profile, sectors } = store.getState();
    const sessionId = shell.currentSession();
    const siblings = sectors.filter((s) => s.sessionId === sessionId).sort((a, b) => a.order - b.order);
    const title = `${greeting()}${profile.name ? `, ${profile.name}` : ''}`;
    container.append(
      h('div', { class: 'head compact' }, h('h1', {}, title)),
      ui.progressBar(store),
      todayCard(store),
      h('div', { class: 'board' },
        siblings.map((sector) => sectorCard(store, sector, siblings)),
        h('button', {
          class: 'tile-add',
          'data-action': 'novo-setor',
          onClick: async () => {
            const name = await dialog.prompt('Novo setor', '');
            if (name) store.addSector(sessionId, name);
          },
        }, '+ Novo setor'))
    );
  }

  shell.register('quadro', { render });
  root.App.ui.greeting = greeting;
})(globalThis);
