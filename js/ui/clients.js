(function (root) {
  const { h, shell, ui } = root.App;
  let clientId = null;
  let sectorId = null;

  function open(id) {
    clientId = id;
    shell.navigate('cliente');
  }

  async function createClient(store) {
    const name = await ui.dialog.prompt('Novo cliente', '');
    if (!name) return;
    const client = store.addClient(name);
    if (client) open(client.id);
    else shell.toast('Já existe um cliente com esse nome.');
  }

  const activeItems = (store, id) => store.getState().items.filter((i) => i.clientId === id && !i.deletedAt && !i.doneAt);

  function plural(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function clientCard(store, client) {
    const items = activeItems(store, client.id);
    const rotinas = items.filter((i) => i.kind === 'rotina').length;
    return h('button', {
      class: 'box client-card',
      'data-client-card': client.name,
      onClick: () => open(client.id),
    },
    h('span', { class: 'tag', style: { '--tag': client.color } }, client.name),
    h('small', {}, `${plural(rotinas, 'rotina', 'rotinas')} · ${plural(items.length - rotinas, 'demanda', 'demandas')}`));
  }

  function renderList(container, store) {
    const clients = [...store.getState().clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    container.append(
      h('div', { class: 'head' }, h('h1', {}, 'Clientes')),
      h('div', { class: 'client-grid' },
        clients.map((client) => clientCard(store, client)),
        h('button', {
          class: 'tile-add',
          'data-action': 'novo-cliente-lista',
          onClick: () => createClient(store),
        }, '+ Novo cliente'))
    );
  }

  function groupedRows(store, items) {
    const groups = new Map();
    items.forEach((item) => {
      if (!groups.has(item.sectorId)) groups.set(item.sectorId, []);
      groups.get(item.sectorId).push(item);
    });
    return [...groups.entries()].map(([id, list]) => [
      h('div', { class: 'result-group small' }, ui.sectorName(store, id)),
      list.map((item) => ui.itemRow(item, store)),
    ]);
  }

  function column(store, client, kind, title, items, placeholder) {
    const name = kind === 'rotina' ? 'rotinas' : 'demandas';
    const field = ui.quickField(store, {
      kind,
      placeholder,
      key: `cliente-${client.id}-${kind}`,
      clientId: client.id,
      getSector: () => sectorId,
    });
    return h('section', { class: 'box', 'data-client-col': name },
      h('div', { class: 'box-head plain' }, h('span', {}, title), h('span', { class: 'count' }, items.length)),
      groupedRows(store, items),
      sectorId ? field : null);
  }

  function renderClient(container, store) {
    const state = store.getState();
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) {
      renderList(container, store);
      return;
    }
    const options = ui.sectorOptions(store);
    if (!options.some(([id]) => id === sectorId)) {
      const first = state.sectors.filter((s) => s.sessionId === shell.currentSession()).sort((a, b) => a.order - b.order)[0];
      sectorId = first ? first.id : (options[0] && options[0][0]);
    }
    const items = activeItems(store, client.id);
    container.append(
      h('div', { class: 'head client-head', 'data-client-page': client.name },
        h('button', { class: 'round', 'aria-label': 'Voltar para clientes', onClick: () => shell.navigate('clientes') }, '‹'),
        h('h1', {}, client.name),
        options.length ? h('label', { class: 'client-sector' }, 'Adicionar em', h('select', {
          class: 'session-select',
          'data-key': 'cliente-setor',
          'aria-label': 'Setor das novas tarefas',
          onChange: (event) => { sectorId = event.target.value; },
        }, options.map(([id, label]) => h('option', { value: id, selected: id === sectorId }, label))))
          : h('span', { class: 'hint' }, 'Crie um setor para adicionar tarefas.')),
      h('div', { class: 'day-columns', 'data-results': '1' },
        column(store, client, 'rotina', 'Rotinas', items.filter((i) => i.kind === 'rotina'), '+ Rotina'),
        column(store, client, 'pontual', 'Demandas', items.filter((i) => i.kind !== 'rotina'), '+ Demanda'))
    );
  }

  shell.register('clientes', { render: renderList });
  shell.register('cliente', { render: renderClient });
  root.App.clients = { open };
})(globalThis);
