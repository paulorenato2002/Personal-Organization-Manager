(function (root) {
  const { h, shell, ui } = root.App;
  const query = { text: '' };

  function matches(item, clients) {
    if (item.deletedAt || item.doneAt) return false;
    const needle = query.text.toLowerCase();
    const client = clients.find((c) => c.id === item.clientId);
    return [item.title, item.notes, client && client.name].some((t) => t && t.toLowerCase().includes(needle));
  }

  function setQuery(text) {
    query.text = text.trim();
    if (query.text) shell.navigate('busca');
    else if (shell.current() === 'busca') shell.navigate('quadro');
  }

  const openClient = (clientId) => root.App.clients.open(clientId);

  function render(container, store) {
    const { items, clients, sectors, sessions } = store.getState();
    const found = items.filter((i) => matches(i, clients));
    const title = `Busca: ${query.text}`;
    const groups = new Map();
    found.forEach((item) => {
      if (!groups.has(item.sectorId)) groups.set(item.sectorId, []);
      groups.get(item.sectorId).push(item);
    });
    const label = (sectorId) => {
      const sector = sectors.find((s) => s.id === sectorId);
      const session = sector && sessions.find((s) => s.id === sector.sessionId);
      return sector ? `${session ? `${session.name} · ` : ''}${sector.name}` : 'Sem setor';
    };
    container.append(
      h('div', { class: 'head' },
        h('h1', {}, title),
        h('div', { class: 'sub' }, `${found.length} ${found.length === 1 ? 'demanda' : 'demandas'}`)),
      found.length
        ? h('div', { class: 'stack', 'data-results': '1' }, [...groups.entries()].map(([sectorId, list]) => h('section', { class: 'box' },
          h('div', { class: 'result-group' }, label(sectorId)),
          list.map((item) => ui.itemRow(item, store)))))
        : h('div', { class: 'empty' }, 'Nada encontrado.')
    );
  }

  shell.register('busca', { render });
  root.App.search = { setQuery, openClient };
})(globalThis);
