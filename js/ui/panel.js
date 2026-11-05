(function (root) {
  const { h, fmt, shell, ui } = root.App;
  let openId = null;
  let nodes = null;
  let unsubscribe = null;
  let previousFocus = null;

  const KINDS = [['pontual', 'Pontual'], ['rotina', 'Rotina'], ['compromisso', 'Compromisso']];
  const FREQS = [['daily', 'Diária'], ['weekly', 'Semanal'], ['monthly', 'Mensal']];
  const ACTIONS = { created: 'Criada', done: 'Concluída', moved: 'Data alterada', deleted: 'Excluída' };

  const store = () => root.App.store;

  function field(label, control) {
    return h('label', { class: 'field' }, h('span', {}, label), control);
  }

  function select(key, options, value, onChange) {
    return h('select', { 'data-key': key, onChange: (e) => onChange(e.target.value) },
      options.map(([v, label]) => h('option', { value: v, selected: String(value) === String(v) }, label)));
  }

  function freqFields(item) {
    const { freq } = item;
    const setFreq = (next) => store().updateItem(item.id, { freq: next });
    const nodesList = [field('Frequência', select('p-freq', FREQS, freq.type, (type) => {
      if (type === 'daily') setFreq({ type });
      if (type === 'weekly') setFreq({ type, weekday: 1 });
      if (type === 'monthly') setFreq({ type, day: 1 });
    }))];
    if (freq.type === 'weekly') {
      nodesList.push(field('Dia da semana', select('p-weekday', fmt.WEEKDAYS.map((d, i) => [i, d]), freq.weekday, (v) => setFreq({ type: 'weekly', weekday: Number(v) }))));
    }
    if (freq.type === 'monthly') {
      const days = Array.from({ length: 31 }, (_, i) => [i + 1, `Dia ${i + 1}`]);
      nodesList.push(field('Dia do mês', select('p-day', days, freq.day, (v) => setFreq({ type: 'monthly', day: Number(v) }))));
    }
    return nodesList;
  }

  function pontualFields(item) {
    return h('div', { class: 'row' },
      field('Data de entrega', h('input', {
        type: 'date',
        'data-key': 'p-date',
        value: item.dueDate || '',
        // Ao digitar, o navegador avisa com o ano incompleto.
        onChange: (e) => { if (!e.target.value || e.target.value >= '2000') store().movePontual(item.id, e.target.value || null); },
      })),
      h('div', { style: { flex: '0 0 auto', 'margin-bottom': '12px' } },
        h('button', { class: 'btn', disabled: !item.dueDate, onClick: () => store().movePontual(item.id, null) }, 'Sem data')));
  }

  function compromissoFields(item) {
    return h('div', { class: 'row' },
      field('Data e hora', h('input', {
        type: 'datetime-local',
        'data-key': 'p-start',
        value: item.start,
        onChange: (e) => { if (e.target.value) store().updateItem(item.id, { start: e.target.value }); },
      })),
      field('Duração (min)', h('input', {
        type: 'number',
        min: '5',
        step: '5',
        'data-key': 'p-dur',
        value: item.durationMin,
        onChange: (e) => { const n = Number(e.target.value); if (n > 0) store().updateItem(item.id, { durationMin: n }); },
      })));
  }

  function subtasks(item) {
    const save = (list) => store().updateItem(item.id, { subtasks: list });
    return [
      h('div', { class: 'section-title' }, 'Subtarefas'),
      item.subtasks.map((sub, index) => h('div', { class: `sub-row${sub.done ? ' done' : ''}` },
        h('input', {
          type: 'checkbox',
          checked: sub.done,
          'aria-label': sub.title,
          onChange: () => save(item.subtasks.map((s, i) => (i === index ? { ...s, done: !s.done } : s))),
        }),
        h('span', { class: 'grow' }, sub.title),
        h('button', { class: 'icon-btn', 'aria-label': `Remover ${sub.title}`, onClick: () => save(item.subtasks.filter((_, i) => i !== index)) }, '×'))),
      h('input', {
        class: 'input',
        placeholder: '+ Subtarefa',
        'data-key': 'p-sub',
        onKeydown: (e) => {
          if (e.key !== 'Enter') return;
          const title = e.target.value.trim();
          if (title) save([...item.subtasks, { title, done: false }]);
        },
      }),
    ];
  }

  function historyLines(item) {
    const fromLog = (item.log || []).map((e) => {
      let text = ACTIONS[e.action] || e.action;
      if (e.action === 'moved') text = `Data: ${e.from ? fmt.short(e.from) : 'sem data'} → ${e.to ? fmt.short(e.to) : 'sem data'}`;
      return [e.at || e.day, `${fmt.short(e.day)} · ${text}`];
    });
    return fromLog.sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, text]) => h('li', {}, text));
  }

  function clientValue(item) {
    const client = store().getState().clients.find((c) => c.id === item.clientId);
    return client ? client.name : '';
  }

  function build(item) {
    const s = store();
    return [
      h('div', { class: 'panel-top' },
        h('input', {
          class: 'panel-title',
          'aria-label': 'Título',
          'data-key': 'p-title',
          value: item.title,
          onChange: (e) => { const title = e.target.value.trim(); if (title) s.updateItem(item.id, { title }); },
        }),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onClick: close }, '×')),
      h('div', { class: 'row' },
        field('Tipo', select('p-kind', KINDS, item.kind, (kind) => s.changeKind(item.id, kind))),
        field('Setor', select('p-sector', ui.sectorOptions(s), item.sectorId, (sectorId) => s.updateItem(item.id, { sectorId })))),
      field('Cliente', h('input', {
        'data-key': 'p-client',
        list: 'client-list',
        placeholder: 'Sem cliente',
        value: clientValue(item),
        onChange: (e) => s.setItemClient(item.id, e.target.value),
      })),
      h('datalist', { id: 'client-list' }, s.getState().clients.map((c) => h('option', { value: c.name }))),
      item.kind === 'rotina' ? freqFields(item) : null,
      item.kind === 'pontual' ? pontualFields(item) : null,
      item.kind === 'compromisso' ? compromissoFields(item) : null,
      field('Notas', h('textarea', {
        'data-key': 'p-notes',
        onChange: (e) => s.updateItem(item.id, { notes: e.target.value }),
      }, item.notes || '')),
      subtasks(item),
      h('div', { class: 'section-title' }, 'Histórico'),
      h('ul', { class: 'history' }, historyLines(item)),
      h('div', { class: 'actions' },
        h('button', {
          class: 'btn danger',
          'data-action': 'excluir',
          onClick: () => {
            s.deleteItem(item.id);
            close();
            shell.toast('Demanda excluída', { undo: () => s.undo() });
          },
        }, 'Excluir')),
    ];
  }

  function render() {
    shell.whenPointerUp(renderNow);
  }

  function renderNow() {
    if (!openId || !nodes) return;
    const item = store().getState().items.find((i) => i.id === openId);
    if (!item || item.deletedAt) { close(); return; }
    const active = document.activeElement;
    const key = active && nodes.panel.contains(active) ? active.dataset.key : null;
    const top = nodes.panel.scrollTop;
    nodes.panel.replaceChildren(...build(item).flat(Infinity).filter(Boolean));
    nodes.panel.scrollTop = top;
    if (key) {
      const again = nodes.panel.querySelector(`[data-key="${key}"]`);
      if (again) again.focus();
    }
  }

  function onKey(event) {
    if (event.key === 'Escape' && !document.querySelector('.dialog-wrap')) close();
  }

  function open(id) {
    close();
    openId = id;
    previousFocus = document.activeElement;
    nodes = {
      backdrop: h('div', { class: 'backdrop', onMousedown: close }),
      panel: h('aside', { class: 'panel', role: 'dialog', 'aria-label': 'Detalhes da demanda' }),
    };
    document.body.append(nodes.backdrop, nodes.panel);
    document.addEventListener('keydown', onKey);
    unsubscribe = store().subscribe(render);
    render();
  }

  function close() {
    if (!nodes) return;
    nodes.backdrop.remove();
    nodes.panel.remove();
    nodes = null;
    openId = null;
    document.removeEventListener('keydown', onKey);
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  root.App.panel = { open, close };
})(globalThis);
