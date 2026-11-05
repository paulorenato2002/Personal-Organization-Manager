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
    return h('div', { class: 'stack', 'data-tab': 'hoje' },
      h('h2', { class: 'col-heading' }, 'Para hoje'),
      list.length
        ? bySector(list).map(([sectorId, items]) => h('section', { class: 'box' },
          h('div', { class: 'result-group' }, ui.sectorName(store, sectorId)),
          items.map((item) => ui.itemRow(item, store))))
        : h('div', { class: 'empty' }, 'Nada para hoje. Aproveita.'));
  }

  function renderPending(store) {
    const groups = ui.pendingGroups(store, { boxed: true });
    return h('div', { class: 'stack', 'data-tab': 'pendencias' },
      h('h2', { class: 'col-heading' }, 'Vencidas'),
      groups.length ? groups : h('div', { class: 'empty' }, 'Nada vencido. Tudo em dia.'));
  }

  function renderDay(store) {
    return h('div', { class: 'day-columns' }, renderToday(store), renderPending(store));
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
    const tabs = [['hoje', 'Hoje e vencidas'], ['historico', 'Histórico']];
    const content = { hoje: renderDay, historico: renderHistory }[tab](store);
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
      }, label))),
      content
    );
  }

  shell.register('hoje', { render });
})(globalThis);
