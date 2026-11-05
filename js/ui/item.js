(function (root) {
  const { h, fmt, recurrence, pending } = root.App;

  // Texto curto do prazo. late indica atraso.
  function dueLabel(item, today) {
    if (item.kind === 'rotina') {
      const { state, date } = recurrence.rotinaStatus(item, today);
      if (state === 'overdue') return { text: `atrasada · ${fmt.short(date)}`, late: true };
      if (item.freq.type !== 'daily' && (state === 'done' || state === 'upcoming')) return { text: `próx. ${fmt.short(date)}` };
      return { text: fmt.freq(item.freq) };
    }
    if (item.kind === 'compromisso') {
      const day = item.start.slice(0, 10);
      return { text: `${fmt.relative(day, today)} ${item.start.slice(11, 16)}` };
    }
    if (!item.dueDate) return { text: '' };
    if (!item.doneAt && item.dueDate < today) return { text: `atrasada · ${fmt.short(item.dueDate)}`, late: true };
    return { text: fmt.relative(item.dueDate, today) };
  }

  function clientTag(item, store) {
    if (!item.clientId) return null;
    const client = store.getState().clients.find((c) => c.id === item.clientId);
    if (!client) return null;
    return h('button', {
      class: 'tag',
      style: { '--tag': client.color },
      title: `Ver tudo de ${client.name}`,
      onClick: () => root.App.search.openClient(client.id),
    }, client.name);
  }

  function itemRow(item, store) {
    const today = store.today();
    const done = pending.isDone(item, today);
    const due = dueLabel(item, today);
    return h('div', { class: `it${done ? ' dn' : ''}`, 'data-item': item.id },
      h('button', {
        class: `ck${done ? ' on' : ''}`,
        role: 'checkbox',
        'aria-checked': String(done),
        'aria-label': `Concluir ${item.title}`,
        onClick: () => store.toggleItem(item.id),
      }, '✓'),
      clientTag(item, store),
      h('button', { class: 'tx', title: item.title, onClick: () => root.App.panel.open(item.id) }, item.title),
      due.text ? h('span', { class: `due${due.late ? ' late' : ''}` }, due.text) : null);
  }

  function sectorName(store, sectorId) {
    const sector = store.getState().sectors.find((s) => s.id === sectorId);
    return sector ? `${sector.icon || ''} ${sector.name}`.trim() : 'Sem setor';
  }

  function sectorOptions(store) {
    const { sessions, sectors } = store.getState();
    const options = [];
    [...sessions].sort((a, b) => a.order - b.order).forEach((session) => {
      sectors.filter((s) => s.sessionId === session.id).sort((a, b) => a.order - b.order)
        .forEach((sector) => options.push([sector.id, `${session.name} · ${sector.name}`]));
    });
    return options;
  }

  function progressBar(store) {
    const { done, total } = pending.dayProgress(store.getState().items, store.today());
    return h('div', { class: 'progress' },
      h('div', { class: 'bar' }, h('i', { style: { width: `${total ? (done / total) * 100 : 0}%` } })),
      total ? `${done} de ${total} feitas hoje` : 'Nada para hoje');
  }

  Object.assign(root.App.ui, { itemRow, dueLabel, sectorName, sectorOptions, progressBar });
})(globalThis);
