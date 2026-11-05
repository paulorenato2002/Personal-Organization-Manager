(function (root) {
  const dates = root.App && root.App.dates ? root.App.dates : require('../logic/dates.js');
  const CURRENT_VERSION = 2;
  const uid = () => globalThis.crypto.randomUUID();
  const todayIso = () => dates.toISO(new Date());

  const EXAMPLE_SECTORS = [
    [['Financeiro', '💰'], ['Comercial', '🤝'], ['Operações', '⚙️']],
    [['Casa', '🏠'], ['Saúde', '🍎']],
    [['Ideias', '💡']],
  ];
  const EMPTY_SECTORS = [[['Geral', '📌']], [['Geral', '📌']], [['Geral', '📌']]];

  function buildSessions() {
    return [
      ['Trabalho', '💼'],
      ['Pessoal', '🌿'],
      ['Projetos', '🚀'],
    ].map(([label, icon], order) => ({ id: uid(), name: label, icon, cover: null, order }));
  }

  function buildSectors(sessions, definitions) {
    return sessions.flatMap((session, index) => definitions[index].map(([name, icon], order) => ({
      id: uid(), sessionId: session.id, name, icon, cover: null, order,
    })));
  }

  function exampleContent(sectors, today) {
    const at = (name) => sectors.find((s) => s.name === name).id;
    const clients = [
      { id: uid(), name: 'ACME', color: '#f2b872' },
      { id: uid(), name: 'BETA', color: '#70d8cd' },
    ];
    const base = (kind, sector, title, clientId) => {
      const item = {
        id: uid(),
        kind,
        sectorId: at(sector),
        title,
        notes: '',
        subtasks: [],
        createdAt: `${today}T08:00:00`,
        log: [{ at: `${today}T08:00:00`, day: today, action: 'created' }],
      };
      if (clientId) item.clientId = clientId;
      return item;
    };
    const rotina = (sector, title, freq) => ({
      ...base('rotina', sector, title), freq, startDate: today, doneThrough: null, completions: [],
    });
    const pontual = (sector, title, clientId) => ({ ...base('pontual', sector, title, clientId), dueDate: today });
    const [acme, beta] = clients;
    const items = [
      rotina('Financeiro', 'Conferir o caixa', { type: 'daily' }),
      rotina('Financeiro', 'Fechar o relatório do mês', { type: 'monthly', day: 5 }),
      pontual('Financeiro', 'Revisar contrato', beta.id),
      pontual('Comercial', 'Enviar proposta', acme.id),
      { ...base('compromisso', 'Comercial', 'Reunião de alinhamento', beta.id), start: `${today}T15:00`, durationMin: 60 },
      rotina('Operações', 'Conferir pedidos', { type: 'weekly', weekday: 1 }),
      pontual('Operações', 'Atualizar planilha', acme.id),
      pontual('Casa', 'Pagar contas'),
      pontual('Ideias', 'Rascunhar o próximo projeto'),
    ];

    const saude = { id: uid(), name: 'Saúde', order: 0 };
    const evolucao = { id: uid(), name: 'Evolução', order: 1 };
    const habit = (group, order, fields) => ({ id: uid(), groupId: group.id, order, startDate: today, ...fields });
    const habits = [
      habit(saude, 0, { name: 'Água', type: 'counter', goal: 3000, step: 500, unit: 'ml' }),
      habit(saude, 1, { name: 'Exercício', type: 'check' }),
      habit(saude, 2, { name: 'Refeições', type: 'list', listItems: ['Café', 'Almoço', 'Jantar'] }),
      habit(evolucao, 0, { name: 'Leitura', type: 'counter', goal: 10, step: 5, unit: 'páginas' }),
      habit(evolucao, 1, { name: 'Projetos pessoais', type: 'counter', goal: 120, step: 30, unit: 'min' }),
    ];
    return { clients, items, habitGroups: [saude, evolucao], habits };
  }

  function initialState({ start = 'exemplo', name = '', today = todayIso() } = {}) {
    const sessions = buildSessions();
    const sectors = buildSectors(sessions, start === 'exemplo' ? EXAMPLE_SECTORS : EMPTY_SECTORS);
    const content = start === 'exemplo'
      ? exampleContent(sectors, today)
      : { clients: [], items: [], habitGroups: [], habits: [] };
    return {
      version: CURRENT_VERSION,
      savedAt: null,
      profile: { name, photo: null, email: '', phone: '', links: ['', '', ''], symbol: '' },
      settings: { theme: 'dark', accent: '#f2b872', font: 'Manrope', fontSize: 100, wallpaper: null },
      sessions,
      sectors,
      ...content,
      habitLog: {},
    };
  }

  function migrate(state, today = todayIso()) {
    if (state.version >= CURRENT_VERSION) return state;
    const firstRecord = (habitId) => Object.keys(state.habitLog || {}).filter((day) => state.habitLog[day][habitId] !== undefined).sort()[0];
    return {
      ...state,
      version: CURRENT_VERSION,
      habits: state.habits.map((habit) => {
        const next = { ...habit, startDate: habit.startDate || firstRecord(habit.id) || today };
        if (habit.type === 'counter') {
          next.step = habit.step || 1;
          next.unit = habit.unit || '';
        }
        return next;
      }),
    };
  }

  const api = { initialState, migrate, CURRENT_VERSION };
  root.App = root.App || {};
  root.App.seed = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
