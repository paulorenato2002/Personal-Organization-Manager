/* Estado, dados de exemplo e salvamento. Tudo fica no localStorage do navegador. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const D = Plan.dates;
  const H = Plan.holidays;
  const R = Plan.recur;
  const HB = Plan.habits;
  const KEY = 'caderno-esboco:v1';
  const KEY_BAD = 'caderno-esboco:ilegivel';
  const uid = (p = 'x') => `${p}${Math.random().toString(36).slice(2, 9)}`;
  const TAG_HUES = [255, 195, 140, 80, 45, 20, 350, 305];

  const defaultTags = () => [
    { id: 'rotina', name: 'Rotina', hue: 250, chroma: 0 },
    { id: 'trabalho', name: 'Trabalho', hue: 255, chroma: 0.13 },
    { id: 'projetos', name: 'Projetos', hue: 195, chroma: 0.11 },
    { id: 'reunioes', name: 'Reuniões', hue: 305, chroma: 0.13 },
    { id: 'estudo', name: 'Estudo', hue: 140, chroma: 0.12 },
    { id: 'saude', name: 'Saúde', hue: 20, chroma: 0.14 },
    { id: 'financas', name: 'Finanças', hue: 350, chroma: 0.12 },
    { id: 'pessoal', name: 'Pessoal', hue: 80, chroma: 0.12 },
  ];

  // hiddenTags: categorias que ficam fora da Semana e do Mês ('metas' é a das ações das metas).
  const defaultSettings = () => ({
    theme: 'auto',
    accent: '#c93a16',
    font: 'Manrope',
    size: 100,
    weekStart: 1,
    hideRoutinesMonth: true,
    hiddenTags: [],
    defaultTime: '09:00',
    defaultTag: 'trabalho',
    lastBackup: null,
    print: { ruling: 'lines', spacing: 'normal', notes: 'side', extra: 2, size: 'm', mono: false },
  });

  /* Lembrete fixo: o que a pessoa marca todo dia (ou em certos dias da semana) sem hora marcada, ao lado da folha.
     Para o quadro de constância ele é um hábito como os outros: aqui ele ganha o formato que o quadro conhece. */
  const asHabit = (r) => ({
    id: r.id, title: r.title, icon: r.icon, tag: r.tag, kind: 'lembrete', time: '', end: '', date: r.since,
    repeat: r.repeat, skip: [], items: [], notes: '',
    track: { goalId: r.goalId, objId: r.objId, target: r.target, unit: r.unit, since: r.since },
  });

  /* Histórico de exemplo dos hábitos (de 24/08 a 15/11), sempre o mesmo: o sorteio é fixo, e alguns dias seguidos são forçados
     para o quadro de constância mostrar sequências. */
  function sampleHistory(habits) {
    const out = {};
    const day = (d) => (out[d] = out[d] || { tasks: [], done: {}, counts: {}, note: '' });
    const rng = (seed) => { let t = seed; return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };
    const rate = { 'e-estudo-ingles': 0.82, 'e-academia': 0.78, 'e-leitura': 0.66 };
    const last = '2026-11-15';
    const range = (a, b) => { const list = []; for (let d = a; d <= b; d = D.addDays(d, 1)) list.push(d); return list; };
    habits.filter((e) => e.track).forEach((ev) => {
      const next = rng([...ev.id].reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
      const target = HB.targetOf(ev);
      range(ev.track.since, last).forEach((d) => {
        if (!R.occursOn(ev, d)) return;
        const r = next();
        if (target === 1) { if (r < (rate[ev.id] || 0.7)) day(d).done[ev.id] = true; return; }
        const n = r < 0.12 ? Math.floor(next() * 3) : Math.min(target, Math.round(target * (0.6 + next() * 0.5)));
        if (n > 0) day(d).counts[ev.id] = n;
        if (n >= target) day(d).done[ev.id] = true;
      });
    });
    const force = (id, dates, n) => dates.forEach((d) => { day(d).done[id] = true; if (n) day(d).counts[id] = n; });
    force('e-estudo-ingles', range('2026-11-07', last));
    force('e-academia', [...range('2026-11-02', '2026-11-06'), ...range('2026-11-09', '2026-11-13')]);
    force('r-agua', range('2026-11-11', last), 8);
    return out;
  }

  /* ---------- Dados de exemplo (o dia 16/11/2026 vem do pedido; o resto é ilustração) ---------- */
  function sample() {
    const daily = { freq: 'daily', interval: 1 };
    const weekly = (weekdays, interval = 1) => ({ freq: 'weekly', interval, weekdays });
    const util = weekly([1, 2, 3, 4, 5]);
    const ev = (id, title, time, extra) => ({
      id, title, time, end: '', date: '2026-01-01', tag: 'rotina', kind: 'rotina', repeat: { freq: 'none' }, skip: [], items: [], notes: '', ...extra,
    });
    const it = (id, text, tag) => ({ id, text, tag });
    // Hábitos acompanhados no quadro de constância: contam a partir de START, ligados a um objetivo ou pilar.
    const START = '2026-08-24';
    const track = (goalId, objId, target = 1, unit = '') => ({ goalId, objId, target, unit, since: START });
    const events = [
      ev('e-acordar', 'Acordar', '05:00', { repeat: daily }),
      ev('e-desjejum', 'Desjejum + café', '05:20', { repeat: daily }),
      ev('e-academia', 'Ir para a academia', '05:45', { repeat: util, tag: 'saude', track: track('g-pilares', 'p-fisica') }),
      ev('e-mochila', 'Vitamina, mochila, ir para o trabalho', '07:00', { repeat: util }),
      ev('e-cafe', 'Café da manhã', '08:30', { repeat: util }),
      ev('e-trab-manha', 'Trabalho', '09:00', {
        end: '12:00', repeat: util, tag: 'trabalho',
        items: [it('i1', 'Olhar os grupos do WhatsApp', 'trabalho'), it('i2', 'Responder as solicitações abertas', 'trabalho')],
      }),
      ev('e-almoco', 'Almoço', '12:30', { repeat: util }),
      ev('e-trab-tarde', 'Volta ao trabalho', '13:30', {
        end: '18:00', repeat: util, tag: 'trabalho',
        items: [it('i1', 'Seguir o projeto principal', 'projetos'), it('i2', 'Revisar as pendências do dia', 'trabalho')],
      }),
      ev('e-pessoais', 'Trabalhos pessoais', '18:00', { end: '20:00', repeat: util, tag: 'pessoal' }),
      ev('e-casa', 'Ir para casa', '20:00', { repeat: util }),
      ev('e-noturna', 'Realizar a rotina noturna', '21:30', { repeat: daily }),
      ev('e-dormir', 'Dormir', '22:00', { repeat: daily }),
      ev('e-reuniao', 'Reunião de alinhamento', '15:00', { end: '15:30', date: '2026-11-17', kind: 'compromisso', tag: 'reunioes' }),
      ev('e-dentista', 'Consulta de rotina', '08:00', { date: '2026-11-19', kind: 'compromisso', tag: 'saude' }),
      ev('e-ingles', 'Aula de inglês', '20:30', { end: '21:30', kind: 'compromisso', tag: 'estudo', repeat: weekly([2, 4]) }),
      ev('e-estudo-ingles', 'Estudar inglês', '19:30', { date: START, tag: 'estudo', repeat: daily, track: track('g-2027', 'o-ingles') }),
      ev('e-leitura', 'Ler 10 páginas', '21:15', { date: START, tag: 'estudo', repeat: daily, track: track('g-pilares', 'p-estudo') }),
      ev('e-guia', 'Enviar a guia do imposto mensal', '09:00', {
        kind: 'compromisso', tag: 'financas', repeat: { freq: 'monthly', interval: 1, mode: 'day', day: 20, shift: 'next' },
      }),
      ev('e-fechar', 'Fechar o mês', '17:00', { kind: 'compromisso', tag: 'trabalho', repeat: { freq: 'monthly', interval: 1, mode: 'last-bday' } }),
      ev('e-plan-semana', 'Planejar a semana', '19:00', { kind: 'compromisso', tag: 'pessoal', repeat: weekly([0]) }),
      ev('e-plan-mes', 'Planejar o mês', '08:00', { kind: 'compromisso', tag: 'pessoal', repeat: { freq: 'monthly', interval: 1, mode: 'nth-bday', n: 1 } }),
      ev('e-plan-semestre', 'Planejar o semestre', '08:00', {
        date: '2026-07-01', kind: 'compromisso', tag: 'pessoal', repeat: { freq: 'monthly', interval: 6, mode: 'nth-bday', n: 1 },
      }),
    ];

    // Lembretes fixos: sem hora, ao lado da folha, para marcar com a caneta. Contam no quadro de constância.
    const rem = (id, title, icon, tagId, extra) => ({
      id, title, icon, tag: tagId, since: START, repeat: { ...daily }, target: 1, unit: '', labels: [], goalId: null, objId: null, ...extra,
    });
    const reminders = [
      rem('r-agua', 'Beber água', '💧', 'saude', { target: 8, unit: 'copos', goalId: 'g-pilares', objId: 'p-fisica' }),
      rem('r-refeicoes', 'Alimentação no plano', '🍱', 'saude', { target: 4, unit: 'refeições', labels: ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'], goalId: 'g-pilares', objId: 'p-fisica' }),
      rem('r-louca', 'Lavar a louça', '🍽️', 'pessoal'),
      rem('r-varrer', 'Varrer o chão', '🧹', 'pessoal', { repeat: weekly([1, 3, 5]) }),
    ];

    const act = (id, text, done = false, date = null) => ({ id, text, done, date });
    const goals = [
      {
        id: 'g-2027', title: 'Objetivos 2027', kind: 'cross', year: 2027,
        objectives: [
          {
            id: 'o-corrida', slot: 0, title: 'Corrida',
            actions: [
              act('a1', 'Escolher a prova e a data', true),
              act('a2', 'Comprar um tênis de corrida', true),
              act('a3', 'Separar os horários de treino', false, '2026-11-16'),
              act('a4', 'Correr 5 km sem parar'),
              act('a5', 'Correr 8 km sem parar'),
              act('a6', 'Fazer a inscrição'),
              act('a7', 'Completar os 10 km'),
            ],
          },
          {
            id: 'o-ingles', slot: 1, title: 'Inglês fluente',
            actions: [
              act('a1', 'Fazer o teste de nível', true),
              act('a2', 'Reunir o material de estudo', false, '2026-11-18'),
              act('a3', 'Pagar a matrícula do curso'),
              act('a4', 'Marcar as aulas na semana'),
              act('a5', 'Concluir o módulo intermediário'),
            ],
          },
          {
            id: 'o-renda', slot: 2, title: 'Renda extra todo mês',
            actions: [
              act('a1', 'Listar as fontes atuais', true),
              act('a2', 'Escolher o que oferecer'),
              act('a3', 'Definir o preço de cada oferta'),
              act('a4', 'Fechar o primeiro cliente'),
              act('a5', 'Fechar o segundo cliente'),
              act('a6', 'Manter por três meses'),
            ],
          },
          {
            id: 'o-reserva', slot: 3, title: 'Reserva de emergência',
            actions: [
              act('a1', 'Definir o aporte mensal', true),
              act('a2', 'Abrir uma conta separada para a reserva', true),
              act('a3', 'Automatizar o aporte'),
              act('a4', 'Revisar o valor a cada trimestre'),
            ],
          },
        ],
      },
      {
        id: 'g-fin', title: 'Saúde financeira', kind: 'cross', year: 2027,
        objectives: [
          { id: 'o-caixa', slot: 0, title: 'Fluxo de caixa pessoal em dia', actions: [act('a1', 'Escolher onde registrar', true), act('a2', 'Conciliar toda semana'), act('a3', 'Fechar o mês até o dia 5')] },
          { id: 'o-dividas', slot: 1, title: 'Dívidas zeradas', actions: [act('a1', 'Listar todas as dívidas'), act('a2', 'Negociar as de juros altos'), act('a3', 'Quitar na ordem de custo')] },
          { id: 'o-seguros', slot: 3, title: 'Seguros e previdência revisados', actions: [act('a1', 'Reunir as apólices'), act('a2', 'Comparar coberturas')] },
        ],
      },
      {
        id: 'g-pilares', title: 'Pilares que sustentam 2027', kind: 'pillars', year: 2027,
        objectives: [
          { id: 'p-mental', slot: 0, title: 'Saúde mental', actions: [act('a1', 'Terapia toda semana', true), act('a2', 'Dormir 7h por noite'), act('a3', 'Um dia de descanso por semana')] },
          { id: 'p-fiscal', slot: 1, title: 'Saúde fiscal', actions: [act('a1', 'Obrigações fiscais em dia', true), act('a2', 'Guardar comprovantes todo mês', true), act('a3', 'Revisar o regime tributário')] },
          { id: 'p-fisica', slot: 2, title: 'Saúde física', actions: [act('a1', 'Treinar 4 vezes por semana', true), act('a2', 'Exames anuais'), act('a3', 'Beber 3L de água por dia')] },
          { id: 'p-estudo', slot: 3, title: 'Estudo', actions: [act('a1', 'Ler 10 páginas por dia'), act('a2', 'Uma hora de estudo técnico por dia')] },
        ],
      },
    ];

    return {
      v: 1,
      settings: defaultSettings(),
      tags: defaultTags(),
      events,
      reminders,
      days: {
        ...sampleHistory([...events, ...reminders.map(asHabit)]),
        '2026-11-16': {
          tasks: [
            { id: 't1', text: 'Gerar o relatório semanal e enviar pela manhã', tag: 'trabalho', blockId: 'e-trab-manha', done: false },
            { id: 't2', text: 'Follow-up da documentação para abertura de conta', tag: 'trabalho', blockId: 'e-trab-manha', done: false },
            { id: 't3', text: 'Fazer o backup do banco de dados', tag: 'projetos', blockId: 'e-trab-tarde', done: false },
            { id: 't4', text: 'Revisar o sistema de relatórios', tag: 'projetos', blockId: 'e-trab-tarde', done: false },
            { id: 't5', text: 'Comprar café', tag: 'pessoal', blockId: null, done: false },
          ],
          done: { 'e-acordar': true, 'e-desjejum': true, 'e-academia': true, 'e-mochila': true },
          counts: { 'r-agua': 3, 'r-refeicoes': 1 },
          note: '',
        },
      },
      focus: {
        'w:2026-11-16': [
          { id: 'f1', text: 'Fechar os relatórios do mês', done: false },
          { id: 'f2', text: 'Avançar no banco de dados novo', done: false },
        ],
        'm:2026-11': [
          { id: 'f1', text: 'Concluir o projeto principal', done: false },
          { id: 'f2', text: 'Organizar o material de inglês', done: false },
        ],
        's:2026-2': [
          { id: 'f1', text: 'Definir as ofertas de renda extra', done: false },
          { id: 'f2', text: 'Começar o plano de treino', done: false },
        ],
      },
      goals,
      marks: [],
    };
  }

  /* ---------- Estado e persistência ---------- */
  let state = null;
  let status = 'ok'; // ok | memory (não consegue salvar) | corrupt (dados ilegíveis, abriu o exemplo)
  let saveTimer = null;
  const listeners = new Set();

  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

  const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  // Acompanhamento de uma tarefa na constância; null quando a tarefa não é acompanhada.
  const cleanTrack = (t, ev) => {
    if (!isObj(t)) return null;
    const target = Math.round(Number(t.target));
    return {
      goalId: typeof t.goalId === 'string' ? t.goalId : null,
      objId: typeof t.objId === 'string' ? t.objId : null,
      target: Number.isFinite(target) && target >= 1 ? Math.min(target, 99) : 1,
      unit: typeof t.unit === 'string' ? t.unit.slice(0, 24) : '',
      since: D.isDate(t.since) ? t.since : ev.date,
    };
  };
  function cleanDays(raw) {
    const out = {};
    if (!isObj(raw)) return out;
    Object.entries(raw).forEach(([date, d]) => {
      if (!D.isDate(date) || !isObj(d)) return;
      const rec = { ...d, tasks: Array.isArray(d.tasks) ? d.tasks : [], done: isObj(d.done) ? d.done : {}, counts: isObj(d.counts) ? d.counts : {}, note: typeof d.note === 'string' ? d.note : '' };
      if (!isObj(d.ticks)) delete rec.ticks;
      out[date] = rec;
    });
    return out;
  }

  // Lembrete fixo: só repete todo dia, dia sim e dia não, ou em dias da semana (os jeitos que a janela oferece); o resto vira todo dia.
  function cleanRepeat(r) {
    const everyDay = { freq: 'daily', interval: 1 };
    if (!isObj(r)) return everyDay;
    if (r.freq === 'daily') return { freq: 'daily', interval: Math.round(Number(r.interval)) === 2 ? 2 : 1 };
    if (r.freq === 'weekly') {
      const days = [...new Set((Array.isArray(r.weekdays) ? r.weekdays : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
      return days.length ? { freq: 'weekly', interval: 1, weekdays: days } : everyDay;
    }
    return everyDay;
  }
  // Nome de cada quadradinho (ao acordar, 10h): só de 2 a 12 vezes por dia (acima disso vira contador de mais e menos);
  // até a meta, 24 letras cada; vazio no meio fica no lugar e vazio no fim sai.
  function cleanLabels(raw, target) {
    if (target < 2 || target > 12 || !Array.isArray(raw)) return [];
    // Array.from visita todos os índices (map pularia os buracos que a janela deixa quando um campo nunca foi tocado).
    const labels = Array.from({ length: Math.min(raw.length, target) }, (_, i) => (typeof raw[i] === 'string' ? Array.from(raw[i].trim()).slice(0, 24).join('') : ''));
    while (labels.length && !labels[labels.length - 1]) labels.pop();
    return labels;
  }
  function cleanReminder(r) {
    if (!isObj(r) || typeof r.id !== 'string' || !r.id || typeof r.title !== 'string' || !r.title.trim()) return null;
    const n = Math.round(Number(r.target));
    const target = Number.isFinite(n) && n >= 1 ? Math.min(n, 99) : 1;
    return {
      id: r.id,
      title: r.title.trim().slice(0, 80),
      icon: typeof r.icon === 'string' ? Array.from(r.icon.trim()).slice(0, 8).join('') : '',
      tag: typeof r.tag === 'string' ? r.tag : '',
      since: D.isDate(r.since) ? r.since : D.clamp(D.today()),
      repeat: cleanRepeat(r.repeat),
      target,
      unit: typeof r.unit === 'string' ? r.unit.slice(0, 24) : '',
      labels: cleanLabels(r.labels, target),
      goalId: typeof r.goalId === 'string' ? r.goalId : null,
      objId: typeof r.objId === 'string' ? r.objId : null,
    };
  }
  function cleanReminders(raw) {
    const seen = new Set();
    return (Array.isArray(raw) ? raw : []).map(cleanReminder).filter((r) => {
      if (!r || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  function normalize(raw) {
    const base = sample();
    if (!isObj(raw) || !Array.isArray(raw.events) || !Array.isArray(raw.goals)) throw new Error('Arquivo sem eventos ou metas.');
    const settings = { ...base.settings, ...(isObj(raw.settings) ? raw.settings : {}) };
    settings.print = { ...base.settings.print, ...(isObj(raw.settings && raw.settings.print) ? raw.settings.print : {}) };
    settings.hiddenTags = Array.isArray(settings.hiddenTags) ? settings.hiddenTags.filter((t) => typeof t === 'string') : [];
    if (!isTime(settings.defaultTime)) settings.defaultTime = base.settings.defaultTime;
    if (typeof settings.defaultTag !== 'string') settings.defaultTag = base.settings.defaultTag;
    if (!D.isDate(settings.lastBackup)) settings.lastBackup = null;
    delete settings.hideRoutinesWeek;
    const events = raw.events
      .filter((e) => isObj(e) && typeof e.id === 'string' && typeof e.title === 'string' && D.isDate(e.date))
      .map((e) => ({ end: '', time: '', tag: 'rotina', kind: 'compromisso', notes: '', ...e, repeat: isObj(e.repeat) ? e.repeat : { freq: 'none' }, skip: Array.isArray(e.skip) ? e.skip : [], items: Array.isArray(e.items) ? e.items : [], track: cleanTrack(e.track, e) }));
    const goals = raw.goals
      .filter((g) => isObj(g) && typeof g.id === 'string' && typeof g.title === 'string')
      .map((g) => ({ kind: 'cross', year: null, ...g, objectives: (Array.isArray(g.objectives) ? g.objectives : []).filter(isObj).map((o, i) => ({ slot: i, ...o, actions: Array.isArray(o.actions) ? o.actions : [] })) }));
    return {
      v: 1,
      settings,
      tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags : base.tags,
      events,
      reminders: cleanReminders(raw.reminders),
      days: cleanDays(raw.days),
      focus: isObj(raw.focus) ? raw.focus : {},
      goals,
      marks: Array.isArray(raw.marks) ? raw.marks.filter((m) => isObj(m) && D.isDate(m.date) && typeof m.name === 'string').map((m) => ({ ...m, holiday: !!m.holiday })) : [],
    };
  }

  // Feriados locais (marcas com holiday) entram no calendário de feriados: dia sem expediente e pulado nas repetições.
  const syncHolidays = () => H.setExtra(state ? state.marks.filter((m) => m.holiday) : []);

  function load() {
    let text = null;
    try {
      text = localStorage.getItem(KEY);
    } catch (error) {
      status = 'memory';
    }
    if (text) {
      try {
        state = normalize(JSON.parse(text));
        syncHolidays();
        return;
      } catch (error) {
        status = 'corrupt';
        try { localStorage.setItem(KEY_BAD, text); } catch (e) { /* sem espaço: o aviso ainda aparece */ }
      }
    }
    state = sample();
    syncHolidays();
    save();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      if (status === 'memory') status = 'ok';
    } catch (error) {
      status = 'memory';
    }
  }
  const saveLater = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { save(); emitStatus(); }, 250); };
  const emitStatus = () => listeners.forEach((fn) => fn({ statusOnly: true }));

  function commit(fn, { silent = false } = {}) {
    fn(state);
    syncHolidays();
    if (silent) { saveLater(); return; }
    save();
    listeners.forEach((l) => l({}));
  }
  const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  /* ---------- Configurações e tags ---------- */
  const setSettings = (patch) => commit((s) => { Object.assign(s.settings, patch); });
  const setPrint = (patch) => commit((s) => { Object.assign(s.settings.print, patch); });
  const tag = (id) => state.tags.find((t) => t.id === id) || null;

  // Filtro de categorias da Semana e do Mês. 'metas' é a categoria das ações das metas.
  const isHidden = (id) => state.settings.hiddenTags.includes(id);
  const toggleHidden = (id) => commit((s) => {
    const set = new Set(s.settings.hiddenTags);
    if (set.has(id)) set.delete(id); else set.add(id);
    s.settings.hiddenTags = [...set];
  });
  const showAllTags = () => commit((s) => { s.settings.hiddenTags = []; });

  // Cópia de segurança: guarda o dia em que foi baixada e avisa quem escuta (rodapé e Ajustes).
  function backupJSON() {
    state.settings.lastBackup = D.today();
    save();
    listeners.forEach((l) => l({ statusOnly: true }));
    return JSON.stringify(state, null, 2);
  }
  function backupLabel() {
    const last = state.settings.lastBackup;
    if (!last) return 'Ainda não baixou nenhuma cópia.';
    const days = D.diffDays(last, D.today());
    return `Última cópia: ${days <= 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`} (${D.fmt.short(last)}).`;
  }
  function addTag(name, hue) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const created = { id: uid('tag-'), name: clean, hue, chroma: 0.12 };
    commit((s) => { s.tags.push(created); });
    return created;
  }
  const setTag = (id, patch) => commit((s) => { const t = s.tags.find((x) => x.id === id); if (t) Object.assign(t, patch); });
  const removeTag = (id) => commit((s) => {
    s.tags = s.tags.filter((t) => t.id !== id);
    s.settings.hiddenTags = s.settings.hiddenTags.filter((t) => t !== id);
  });

  /* ---------- Eventos e dia ---------- */
  const event = (id) => state.events.find((e) => e.id === id) || null;
  // Tarefa nova já com o horário e a categoria que a pessoa escolheu como padrão.
  function newEvent({ date, time, title = '', tag: tagId } = {}) {
    const s = state.settings;
    return {
      id: uid('e-'), title, time: time !== undefined ? time : s.defaultTime, end: '', date,
      tag: tagId && tag(tagId) ? tagId : (tag(s.defaultTag) ? s.defaultTag : (state.tags[0] ? state.tags[0].id : 'trabalho')),
      kind: 'compromisso', repeat: { freq: 'none' }, skip: [], items: [], notes: '',
    };
  }
  function saveEvent(ev) {
    commit((s) => {
      const i = s.events.findIndex((e) => e.id === ev.id);
      if (i >= 0) s.events[i] = ev; else s.events.push(ev);
    });
  }
  const deleteEvent = (id) => commit((s) => { s.events = s.events.filter((e) => e.id !== id); });
  // Hábitos: tarefas acompanhadas na constância e lembretes fixos (que contam do mesmo jeito, só que sem hora).
  const habits = () => [...state.events.filter((e) => e.track), ...state.reminders.map(asHabit)];
  const habitsOf = (goalId, objId) => habits().filter((e) => e.track.goalId === goalId && e.track.objId === objId);
  const habitById = (id) => {
    const ev = state.events.find((e) => e.id === id);
    if (ev) return ev;
    const r = state.reminders.find((x) => x.id === id);
    return r ? asHabit(r) : null;
  };
  const stopTracking = (id) => commit((s) => { const e = s.events.find((x) => x.id === id); if (e) e.track = null; });
  const skipOccurrence = (id, date) => commit((s) => { const e = s.events.find((x) => x.id === id); if (e) e.skip = [...(e.skip || []), date]; });

  /* ---------- Lembretes fixos ---------- */
  const reminders = () => state.reminders;
  const reminder = (id) => state.reminders.find((r) => r.id === id) || null;
  // Lembrete novo: todo dia, uma vez por dia, começando na data escolhida.
  function newReminder({ since, title = '', tag: tagId } = {}) {
    const fallback = tag('pessoal') ? 'pessoal' : (state.tags[0] ? state.tags[0].id : '');
    return {
      id: uid('r-'), title, icon: '', tag: tagId && tag(tagId) ? tagId : fallback, since: D.clamp(D.isDate(since) ? since : D.today()),
      repeat: { freq: 'daily', interval: 1 }, target: 1, unit: '', labels: [], goalId: null, objId: null,
    };
  }
  function saveReminder(input) {
    const clean = cleanReminder(input);
    if (!clean) return null;
    commit((s) => {
      const i = s.reminders.findIndex((x) => x.id === clean.id);
      if (i >= 0) s.reminders[i] = clean; else s.reminders.push(clean);
    });
    return clean;
  }
  const deleteReminder = (id) => commit((s) => { s.reminders = s.reminders.filter((r) => r.id !== id); });
  // Com nomes, cada quadradinho marca só ele mesmo. Quais estão marcados: as marcas guardadas, se batem com a contagem
  // (mesma quantidade, todas dentro da meta, sem repetir); senão, os primeiros da contagem.
  function tickedOf(r, day) {
    const count = Math.min(r.target, HB.valueOf(asHabit(r), day));
    const saved = day && day.ticks ? day.ticks[r.id] : null;
    const ok = Array.isArray(saved) && saved.length === count && new Set(saved).size === count && saved.every((i) => Number.isInteger(i) && i >= 0 && i < r.target);
    const set = new Set(ok ? saved : Array.from({ length: count }, (_, i) => i));
    return Array.from({ length: r.target }, (_, i) => set.has(i));
  }
  // Grava as marcas e mantém a contagem e o "feito" (o quadro de constância lê a contagem).
  function writeTicks(day, r, list) {
    if (list.length) {
      day.ticks = day.ticks || {};
      day.ticks[r.id] = list;
      day.counts[r.id] = list.length;
    } else {
      if (day.ticks) delete day.ticks[r.id];
      delete day.counts[r.id];
    }
    if (day.ticks && !Object.keys(day.ticks).length) delete day.ticks;
    if (list.length >= r.target) day.done[r.id] = true; else delete day.done[r.id];
  }
  function toggleTick(date, id, index) {
    const r = state.reminders.find((x) => x.id === id);
    const i = Number(index);
    if (!r || !r.labels.length || !Number.isInteger(i) || i < 0 || i >= r.target) return;
    commit(() => {
      const day = ensureDay(date);
      const set = new Set(tickedOf(r, day).flatMap((on, k) => (on ? [k] : [])));
      if (set.has(i)) set.delete(i); else set.add(i);
      writeTicks(day, r, [...set].sort((a, b) => a - b));
    });
  }
  // De 7 quadradinhos com nome em diante o lembrete vira uma lista numerada, um passo por linha (rotina da manhã, da noite).
  const LIST_FROM = 7;
  // Os do dia, por categoria (na ordem das categorias) e, dentro dela, na ordem em que foram criados.
  function remindersOn(date) {
    const day = state.days[date];
    const order = state.tags.map((t) => t.id);
    const rank = (r) => { const i = order.indexOf(r.tag); return i < 0 ? order.length : i; };
    return state.reminders
      .map((r, index) => ({ r, index, ev: asHabit(r) }))
      .filter(({ ev }) => R.occursOn(ev, date))
      .sort((a, b) => rank(a.r) - rank(b.r) || a.index - b.index)
      .map(({ r, ev }) => {
        const entry = { reminder: r, ev, count: HB.valueOf(ev, day), target: r.target, labels: r.labels, list: false };
        if (r.labels.length) {
          entry.ticked = tickedOf(r, day);
          entry.count = entry.ticked.filter(Boolean).length;
          entry.list = r.target >= LIST_FROM;
        }
        entry.done = entry.count >= r.target;
        return entry;
      });
  }

  const ensureDay = (date) => {
    const d = (state.days[date] = state.days[date] || { tasks: [], done: {}, counts: {}, note: '' });
    if (!d.counts) d.counts = {};
    return d;
  };
  // Quanto foi feito de um hábito no dia (0 a 99). Chegar na meta marca como feito; abaixo dela, desmarca.
  function setProgress(date, evId, value) {
    commit(() => {
      const ev = habitById(evId);
      const target = ev && ev.track ? HB.targetOf(ev) : 1;
      const day = ensureDay(date);
      const n = Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
      const named = state.reminders.find((x) => x.id === evId && x.labels.length);
      if (named) { writeTicks(day, named, Array.from({ length: Math.min(n, named.target) }, (_, i) => i)); return; }
      if (day.ticks) { delete day.ticks[evId]; if (!Object.keys(day.ticks).length) delete day.ticks; }
      if (n > 0 && target > 1) day.counts[evId] = n; else delete day.counts[evId];
      if (n >= target) day.done[evId] = true; else delete day.done[evId];
    });
  }
  const setDone = (date, key, value) => {
    const ev = habitById(key);
    // Hábito de contar: a caixa de marcar liga e desliga o dia inteiro (meta cheia ou zero).
    if (ev && ev.track && HB.targetOf(ev) > 1) { setProgress(date, key, value ? HB.targetOf(ev) : 0); return; }
    commit(() => {
      const day = ensureDay(date);
      if (value) day.done[key] = true; else delete day.done[key];
    });
  };
  const addTask = (date, { text, blockId = null, tag: tagId = 'trabalho' }) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    commit(() => { ensureDay(date).tasks.push({ id: uid('t'), text: clean, tag: tagId, blockId, done: false }); });
  };
  const setTask = (date, id, patch) => commit(() => { const t = ensureDay(date).tasks.find((x) => x.id === id); if (t) Object.assign(t, patch); });
  const removeTask = (date, id) => commit(() => { const day = ensureDay(date); day.tasks = day.tasks.filter((t) => t.id !== id); });
  const setNote = (date, text) => commit(() => { ensureDay(date).note = text; }, { silent: true });

  /* ---------- Mover o dia ---------- */
  // Corrige de vez um dia anotado na data errada (por exemplo, no ano errado). Leva os afazeres, a anotação, as marcas
  // e as tarefas com horário que não se repetem. Uma série não é "de um dia só": fica onde está.
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const oneOffOn = (date) => state.events.filter((e) => (!e.repeat || e.repeat.freq === 'none') && e.date === date);
  function movable(date) {
    const d = state.days[date];
    const info = {
      tasks: d ? d.tasks.length : 0,
      note: !!(d && d.note),
      marks: d ? Object.keys(d.done || {}).length + Object.keys(d.counts || {}).length : 0,
      events: oneOffOn(date).length,
    };
    return info.tasks || info.note || info.marks || info.events ? info : null;
  }
  function moveDay(from, to) {
    if (!D.isDate(to) || to < D.MIN || to > D.MAX) return { ok: false, error: 'Escolha uma data válida.' };
    if (from === to) return { ok: false, error: 'Escolha um dia diferente.' };
    const info = movable(from);
    if (!info) return { ok: false, error: 'Não há nada neste dia para mover.' };
    const movedIds = oneOffOn(from).map((e) => e.id);
    const before = { from: state.days[from] ? clone(state.days[from]) : null, to: state.days[to] ? clone(state.days[to]) : null };
    // Retrato do que a mudança tocou: o dia de destino e as tarefas com horário movidas.
    const picture = () => JSON.stringify({ day: state.days[to] || null, events: state.events.filter((e) => movedIds.includes(e.id)) });
    let after = null;
    commit((st) => {
      const src = st.days[from];
      if (src) {
        const dst = ensureDay(to);
        dst.tasks = [...dst.tasks, ...src.tasks];
        dst.note = [dst.note, src.note].filter(Boolean).join('\n');
        dst.done = { ...src.done, ...dst.done }; // o que já estava marcado no destino vale
        dst.counts = { ...src.counts, ...dst.counts };
        if (src.ticks || dst.ticks) dst.ticks = { ...src.ticks, ...dst.ticks };
        delete st.days[from];
      }
      st.events.forEach((e) => { if (movedIds.includes(e.id)) e.date = to; });
      after = picture();
    });
    // Desfazer só vale enquanto tudo está como a mudança deixou: se a pessoa mexeu depois, nada é sobrescrito.
    const undo = () => {
      if (picture() !== after) return { ok: false, error: 'O dia foi alterado depois de mover. Mova de volta pela folha.' };
      commit((st) => {
        if (before.from) st.days[from] = clone(before.from);
        if (before.to) st.days[to] = clone(before.to); else delete st.days[to];
        st.events.forEach((e) => { if (movedIds.includes(e.id)) e.date = from; });
      });
      return { ok: true };
    };
    return { ok: true, from, to, ...info, undo };
  }

  /* ---------- Listas de foco (semana, mês, semestre) ---------- */
  const focusList = (key) => state.focus[key] || [];
  const addFocus = (key, text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    commit((s) => { (s.focus[key] = s.focus[key] || []).push({ id: uid('f'), text: clean, done: false }); });
  };
  const setFocus = (key, id, patch) => commit((s) => { const f = (s.focus[key] || []).find((x) => x.id === id); if (f) Object.assign(f, patch); });
  const removeFocus = (key, id) => commit((s) => { s.focus[key] = (s.focus[key] || []).filter((f) => f.id !== id); });

  /* ---------- Datas marcadas ---------- */
  // Datas importantes do dia. Feriados locais não entram aqui: já aparecem como feriado (holidays.js).
  const marksOn = (date) => state.marks.filter((m) => !m.holiday && (m.yearly ? m.date.slice(5) === date.slice(5) && date >= m.date : m.date === date));
  const addMark = ({ date, name, yearly, holiday }) => {
    const clean = String(name || '').trim();
    if (!clean || !D.isDate(date)) return;
    commit((s) => { s.marks.push({ id: uid('m'), date, name: clean, yearly: !!yearly, holiday: !!holiday }); });
  };
  const removeMark = (id) => commit((s) => { s.marks = s.marks.filter((m) => m.id !== id); });

  /* ---------- Metas ---------- */
  const goal = (id) => state.goals.find((g) => g.id === id) || null;
  const objective = (gid, oid) => { const g = goal(gid); return g ? g.objectives.find((o) => o.id === oid) || null : null; };
  const progress = (obj) => {
    const total = obj.actions.length;
    const done = obj.actions.filter((a) => a.done).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  };
  function goalProgress(g) {
    const all = g.objectives.flatMap((o) => o.actions);
    const done = all.filter((a) => a.done).length;
    return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  }
  const nextAction = (obj) => obj.actions.find((a) => !a.done) || null;
  function addGoal({ title, kind, year }) {
    const clean = String(title || '').trim();
    if (!clean) return null;
    const created = { id: uid('g-'), title: clean, kind: kind === 'pillars' ? 'pillars' : 'cross', year: year || null, objectives: [] };
    commit((s) => { s.goals.push(created); });
    return created;
  }
  const updateGoal = (id, patch) => commit(() => { const g = goal(id); if (g) Object.assign(g, patch); });
  // Hábitos ligados a um objetivo apagado continuam existindo, só sem objetivo.
  const unlinkHabits = (match) => {
    state.events.forEach((e) => { if (e.track && match(e.track)) { e.track.goalId = null; e.track.objId = null; } });
    state.reminders.forEach((r) => { if (match(r)) { r.goalId = null; r.objId = null; } });
  };
  const deleteGoal = (id) => commit((s) => { s.goals = s.goals.filter((g) => g.id !== id); unlinkHabits((t) => t.goalId === id); });
  function addObjective(gid, title, slot) {
    const clean = String(title || '').trim();
    const g = goal(gid);
    if (!clean || !g) return null;
    const used = new Set(g.objectives.map((o) => o.slot));
    let target = slot;
    if (target === undefined || used.has(target)) { target = 0; while (used.has(target)) target += 1; }
    const created = { id: uid('o-'), slot: target, title: clean, actions: [] };
    commit(() => { g.objectives.push(created); });
    return created;
  }
  const updateObjective = (gid, oid, patch) => commit(() => { const o = objective(gid, oid); if (o) Object.assign(o, patch); });
  const deleteObjective = (gid, oid) => commit(() => { const g = goal(gid); if (g) g.objectives = g.objectives.filter((o) => o.id !== oid); unlinkHabits((t) => t.objId === oid); });
  const addAction = (gid, oid, text) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    commit(() => { const o = objective(gid, oid); if (o) o.actions.push({ id: uid('a'), text: clean, done: false, date: null }); });
  };
  const setAction = (gid, oid, aid, patch) => commit(() => {
    const o = objective(gid, oid);
    const a = o && o.actions.find((x) => x.id === aid);
    if (a) Object.assign(a, patch);
  });
  const removeAction = (gid, oid, aid) => commit(() => { const o = objective(gid, oid); if (o) o.actions = o.actions.filter((a) => a.id !== aid); });

  function actionsBetween(from, to) {
    const out = [];
    state.goals.forEach((g) => g.objectives.forEach((o) => o.actions.forEach((a) => {
      if (a.date && a.date >= from && a.date <= to) out.push({ goal: g, obj: o, action: a });
    })));
    return out.sort((x, y) => (x.action.date < y.action.date ? -1 : x.action.date > y.action.date ? 1 : 0));
  }
  const actionsOn = (date) => actionsBetween(date, date);

  /* ---------- Modelo do dia ---------- */
  function dayModel(date) {
    const day = state.days[date] || { tasks: [], done: {}, counts: {}, note: '' };
    const occ = R.eventsOn(state.events, date);
    const ids = new Set(occ.map((e) => e.id));
    const slots = occ.map((ev) => ({
      ev,
      done: !!day.done[ev.id],
      count: ev.track ? HB.valueOf(ev, day) : 0,
      target: ev.track ? HB.targetOf(ev) : 1,
      items: (ev.items || []).map((i) => ({ ...i, done: !!day.done[`i:${ev.id}:${i.id}`] })),
      tasks: day.tasks.filter((t) => t.blockId === ev.id),
    }));
    const loose = day.tasks.filter((t) => !t.blockId || !ids.has(t.blockId));
    const actions = actionsOn(date);
    let total = slots.length + loose.length + actions.length;
    let done = slots.filter((s) => s.done).length + loose.filter((t) => t.done).length + actions.filter((a) => a.action.done).length;
    slots.forEach((s) => {
      total += s.items.length + s.tasks.length;
      done += s.items.filter((i) => i.done).length + s.tasks.filter((t) => t.done).length;
    });
    // Os lembretes fixos ficam de fora do "feitos de total": são um registro à parte, que sai ao lado da folha.
    return { date, holiday: H.of(date), marks: marksOn(date), slots, loose, actions, reminders: remindersOn(date), note: day.note || '', total, done };
  }

  /* ---------- Exportar, importar, restaurar ---------- */
  const exportJSON = () => JSON.stringify(state, null, 2);
  function importJSON(text) {
    let next;
    try {
      next = normalize(JSON.parse(text));
    } catch (error) {
      return { ok: false, error: 'Esse arquivo não parece uma cópia do caderno.' };
    }
    state = next;
    syncHolidays();
    status = 'ok';
    save();
    listeners.forEach((l) => l({}));
    return { ok: true };
  }
  function resetSample() {
    state = sample();
    syncHolidays();
    status = 'ok';
    save();
    listeners.forEach((l) => l({}));
  }

  const api = {
    uid, TAG_HUES, load, subscribe, get: () => state, status: () => status, rawBad: () => { try { return localStorage.getItem(KEY_BAD); } catch (e) { return null; } },
    setSettings, setPrint, tag, addTag, setTag, removeTag, isHidden, toggleHidden, showAllTags,
    event, newEvent, saveEvent, deleteEvent, skipOccurrence, habits, habitsOf, stopTracking, dayModel, setDone, setProgress, addTask, setTask, removeTask, setNote,
    reminders, reminder, newReminder, saveReminder, deleteReminder, remindersOn, toggleTick, LIST_FROM, movable, moveDay,
    focusList, addFocus, setFocus, removeFocus, marksOn, addMark, removeMark,
    goal, objective, progress, goalProgress, nextAction, addGoal, updateGoal, deleteGoal, addObjective, updateObjective, deleteObjective,
    addAction, setAction, removeAction, actionsBetween, actionsOn, exportJSON, backupJSON, backupLabel, importJSON, resetSample, sample,
  };
  Plan.store = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
