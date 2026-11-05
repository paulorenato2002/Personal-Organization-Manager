(function (root) {
  const { h, fmt, shell, ui, pending } = root.App;
  let tab = 'hoje';

  function bySector(items) {
    const groups = new Map();
    items.forEach((item) => {
      if (!groups.has(item.sectorId)) groups.set(item.sectorId, []);
      groups.get(item.sectorId).push(item);
    });
    return [...groups.entries()];
  }

  function renderToday(store) {
    const today = store.today();
    const list = pending.todayList(store.getState().items, today);
    if (!list.length) return h('div', { class: 'empty' }, 'Nada para hoje. Aproveita.');
    return h('div', { class: 'stack', 'data-tab': 'hoje' }, bySector(list).map(([sectorId, items]) => h('section', { class: 'box' },
      h('div', { class: 'result-group' }, ui.sectorName(store, sectorId)),
      items.map((item) => ui.itemRow(item, store)))));
  }

  function pendRow(item, store) {
    const today = store.today();
    const moved = () => shell.toast(`"${item.title}" movida`, { undo: () => store.undo() });
    const { clients } = store.getState();
    const client = clients.find((c) => c.id === item.clientId);
    return h('div', { class: 'pend-row', 'data-pend': item.id },
      client ? h('button', {
        class: 'tag',
        style: { '--tag': client.color },
        onClick: () => root.App.search.openClient(client.id),
      }, client.name) : null,
      h('button', { class: 'tx', title: item.title, onClick: () => root.App.panel.open(item.id) }, item.title),
      h('div', { class: 'pend-actions' },
        h('button', { class: 'btn small primary', 'data-act': 'hoje', onClick: () => { store.movePontual(item.id, today); moved(); } }, 'Para hoje'),
        h('input', {
          type: 'date',
          min: today,
          'aria-label': `Outra data para ${item.title}`,
          'data-act': 'data',
          onChange: (e) => { if (e.target.value) { store.movePontual(item.id, e.target.value); moved(); } },
        }),
        h('button', { class: 'btn small', 'data-act': 'semdata', onClick: () => { store.movePontual(item.id, null); moved(); } }, 'Sem data'),
        h('button', {
          class: 'btn small danger',
          'data-act': 'excluir',
          onClick: () => {
            store.deleteItem(item.id);
            shell.toast(`"${item.title}" excluída`, { undo: () => store.undo() });
          },
        }, 'Excluir')));
  }

  function renderPending(store) {
    const today = store.today();
    const groups = pending.pendingByDay(store.getState().items, today);
    if (!groups.length) return h('div', { class: 'empty' }, 'Nenhuma pendência de dias anteriores.');
    return h('div', { class: 'stack', 'data-tab': 'pendencias' }, groups.map(({ date, items }) => h('section', { class: 'box', 'data-day': date },
      h('div', { class: 'day-head' },
        h('span', {}, `${fmt.relative(date, today) === fmt.short(date) ? fmt.cap(fmt.long(date)) : `${fmt.cap(fmt.relative(date, today))}, ${fmt.long(date)}`} (${items.length})`),
        h('div', { class: 'btns' },
          h('button', {
            class: 'btn small',
            'data-act': 'mover-tudo',
            onClick: () => {
              store.moveDay(date, today);
              shell.toast('Tudo movido para hoje', { undo: () => store.undo() });
            },
          }, 'Mover tudo para hoje'),
          h('button', {
            class: 'btn small danger',
            'data-act': 'excluir-tudo',
            onClick: () => {
              store.deleteDay(date);
              shell.toast('Dia excluído', { undo: () => store.undo() });
            },
          }, 'Excluir tudo'))),
      items.map((item) => pendRow(item, store)))));
  }

  function renderHistory(store) {
    const days = pending.historyByDay(store.getState().items);
    if (!days.length) return h('div', { class: 'empty' }, 'O histórico aparece aqui, dia a dia.');
    return h('div', { class: 'stack', 'data-tab': 'historico' }, days.map(({ date, done, moved, deleted }) => h('section', { class: 'box', 'data-day': date },
      h('div', { class: 'day-head' }, h('span', {}, fmt.cap(fmt.long(date)))),
      done.length ? [
        h('div', { class: 'hist-kind' }, 'Concluídas'),
        done.map((item) => h('div', { class: 'hist-line', 'data-kind': 'done' },
          h('button', {
            class: 'ck on',
            role: 'checkbox',
            'aria-checked': 'true',
            'aria-label': `Desmarcar ${item.title}`,
            onClick: () => store.toggleItem(item.id),
          }, '✓'),
          item.title)),
      ] : null,
      moved.length ? [
        h('div', { class: 'hist-kind' }, 'Adiadas'),
        moved.map((item) => h('div', { class: 'hist-line', 'data-kind': 'moved' },
          `${item.title} → ${item.entry.to ? fmt.short(item.entry.to) : 'sem data'}`)),
      ] : null,
      deleted.length ? [
        h('div', { class: 'hist-kind' }, 'Excluídas'),
        deleted.map((item) => h('div', { class: 'hist-line', 'data-kind': 'deleted' }, item.title)),
      ] : null)));
  }

  function render(container, store) {
    const today = store.today();
    const count = pending.pendingByDay(store.getState().items, today).reduce((n, g) => n + g.items.length, 0);
    const tabs = [['hoje', 'Hoje'], ['pendencias', 'Pendências'], ['historico', 'Histórico']];
    const content = { hoje: renderToday, pendencias: renderPending, historico: renderHistory }[tab](store);
    container.append(
      h('div', { class: 'head compact' },
        h('h1', {}, fmt.cap(fmt.long(today)))),
      ui.progressBar(store),
      h('div', { class: 'seg', role: 'tablist' }, tabs.map(([name, label]) => h('button', {
        class: tab === name ? 'on' : '',
        role: 'tab',
        'aria-selected': String(tab === name),
        'data-today-tab': name,
        onClick: () => { tab = name; shell.render(); },
      }, label, name === 'pendencias' && count ? h('span', { class: 'badge' }, count) : null))),
      content
    );
  }

  shell.register('hoje', { render });
})(globalThis);
