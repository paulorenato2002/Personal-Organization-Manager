/* Dia: a folha. O que aparece aqui é o que sai no papel. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, check, tagChip, blankLines, addForm, progressBar, empty, navButton, gearIcon, crumbs } = Plan.ui;
  const D = Plan.dates;
  const S = Plan.store;
  const R = Plan.recur;
  const HB = Plan.habits;
  const go = (date) => Plan.router.go('dia', date);
  // Data distante: avisa e dá um caminho de volta, porque é aqui que um dia anotado na data errada costuma nascer.
  const awayOf = (date) => D.diffDays(D.today(), date);
  const isFar = (date) => Math.abs(awayOf(date)) > D.FAR_DAYS;
  const farNote = (date) => { if (isFar(date)) Plan.ui.toast(`Anotado em ${D.fmt.long(date)}, ${D.fmt.away(awayOf(date))}.`); };
  // O link do objetivo abre a janela dele por cima da folha, sem trocar de tela.
  const openObjective = (goalId, objId) => (e) => { e.preventDefault(); Plan.dialogs.objective(goalId, objId); };

  // A engrenagem fica aberta mesmo quando a folha é redesenhada (cada ajuste redesenha a tela).
  let optionsOpen = false;
  // O que a pessoa usou por último na linha "Adicionar na agenda" continua preenchido para a próxima.
  const lastAgenda = { time: null, tag: null, repeat: 'none' };
  let wired = false;

  function setOptions(open, { focusGear = false } = {}) {
    optionsOpen = open;
    const gear = document.querySelector('[data-key="sheet-gear"]');
    const panel = document.getElementById('sheet-options');
    if (!gear || !panel) return;
    panel.hidden = !open;
    gear.setAttribute('aria-expanded', String(open));
    if (!open && focusGear) gear.focus();
  }

  function wire() {
    if (wired) return;
    wired = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && optionsOpen && !Plan.ui.modal.isOpen()) setOptions(false, { focusGear: true });
    });
    document.addEventListener('pointerdown', (e) => {
      if (optionsOpen && !e.target.closest('.sheet-options-wrap')) setOptions(false);
    });
  }

  // hideTag: dentro de um bloco, a etiqueta só aparece quando difere da do bloco (evita repetir "Trabalho" em cada linha).
  function subRow({ text, tag, done, key, onToggle, onRemove, hideTag }) {
    return h('li', { class: `sub${done ? ' is-done' : ''}` },
      check({ checked: done, label: `Concluir: ${text}`, key, onChange: onToggle }),
      h('span', { class: 'sub-text' }, text),
      tag !== hideTag ? tagChip(tag) : null,
      onRemove ? h('button', { type: 'button', class: 'x no-print', 'aria-label': `Remover: ${text}`, onClick: onRemove }, '×') : null);
  }

  function blockBody(date, slot, extra) {
    const { ev } = slot;
    const rows = [
      ...slot.items.map((i) => subRow({
        text: i.text, tag: i.tag, hideTag: ev.tag, done: i.done, key: `ck-${ev.id}-${i.id}`, onToggle: (v) => S.setDone(date, `i:${ev.id}:${i.id}`, v),
      })),
      ...slot.tasks.map((t) => subRow({
        text: t.text, tag: t.tag, hideTag: ev.tag, done: t.done, key: `ck-${t.id}`, onToggle: (v) => S.setTask(date, t.id, { done: v }), onRemove: () => S.removeTask(date, t.id),
      })),
    ];
    return h('div', { class: 'block-body' },
      rows.length ? h('ul', { class: 'subs' }, rows) : null,
      addForm({ placeholder: '+ afazer neste horário', label: `Adicionar afazer em ${ev.title}`, key: `add-${ev.id}`, onAdd: (text) => { S.addTask(date, { text, blockId: ev.id, tag: ev.tag }); farNote(date); } }),
      blankLines(extra));
  }

  /* Hábito (tarefa acompanhada na constância): sequência de dias seguidos e o objetivo a que serve. Só na tela. */
  function habitMeta(ev, date) {
    const asOf = date <= D.today() ? date : null;
    const n = asOf ? HB.history({ events: [ev], days: S.get().days, today: asOf }).current : 0;
    const obj = ev.track.objId ? S.objective(ev.track.goalId, ev.track.objId) : null;
    return [
      n >= 2 ? h('span', { class: 'streak no-print', title: `Sequência atual: ${n} dias` }, `${n} seguidos`) : null,
      obj ? h('a', { class: 'goal-link no-print', href: '#/objetivos', title: `Objetivo: ${obj.title}`, onClick: openObjective(ev.track.goalId, ev.track.objId) }, obj.title) : null,
    ];
  }

  // Ao cumprir um hábito, diz há quantos dias ele vem seguido.
  function celebrate(ev, date) {
    if (!ev.track) return;
    const n = HB.history({ events: [ev], days: S.get().days, today: date }).current;
    if (n >= 2) Plan.ui.toast(`${ev.title}: ${n} dias seguidos.`);
  }

  /* Hábito de contar (8 copos, 4 refeições): quadradinhos para marcar na tela e riscar no papel.
     Clicar no último marcado tira um. Metas grandes viram um contador com mais e menos. */
  function counter(date, slot) {
    const { ev, count, target } = slot;
    const unit = ev.track.unit ? ` ${ev.track.unit}` : '';
    const text = `${count} de ${target}${unit}`;
    const set = (n) => { S.setProgress(date, ev.id, n); if (n >= target) celebrate(ev, date); };
    // Com nomes (ao acordar, 10h), cada quadradinho marca só ele mesmo e leva o nome ao lado; o nome também sai no papel.
    if (slot.ticked) {
      const toggle = (i) => { const wasOn = slot.ticked[i]; S.toggleTick(date, ev.id, i); if (!wasOn && count + 1 >= target) celebrate(ev, date); };
      // De 7 passos em diante (rotina da manhã, da noite) é uma lista numerada, um passo por linha.
      return h('div', { class: `counter is-labeled${slot.list ? ' is-list' : ''}`, role: 'group', 'aria-label': `${ev.title}: ${text}` },
        slot.ticked.map((on, i) => {
          const name = slot.labels[i] || '';
          return h('button', {
            type: 'button', class: `cbox labeled${on ? ' on' : ''}`, 'aria-pressed': String(on), 'data-key': `cb-${ev.id}-${i + 1}`,
            'aria-label': name ? `${ev.title}: ${name}` : `${ev.title}: marcar ${i + 1} de ${target}`, onClick: () => toggle(i),
          }, slot.list ? h('i', { class: 'cb-n', 'aria-hidden': 'true' }, String(i + 1)) : null,
          h('i', { class: 'cb-sq', 'aria-hidden': 'true' }), name ? h('span', { class: 'cb-text' }, name) : null);
        }),
        h('span', { class: 'counter-text no-print' }, text));
    }
    if (target > 12) {
      return h('div', { class: 'counter is-stepper', role: 'group', 'aria-label': `${ev.title}: ${text}` },
        h('button', { type: 'button', class: 'btn small icon', 'aria-label': `${ev.title}: menos um`, 'data-key': `cm-${ev.id}`, disabled: count <= 0, onClick: () => set(count - 1) }, '−'),
        h('span', { class: 'counter-text' }, text),
        h('button', { type: 'button', class: 'btn small icon', 'aria-label': `${ev.title}: mais um`, 'data-key': `cp-${ev.id}`, onClick: () => set(count + 1) }, '+'));
    }
    return h('div', { class: 'counter', role: 'group', 'aria-label': `${ev.title}: ${text}` },
      Array.from({ length: target }, (_, i) => h('button', {
        type: 'button', class: `cbox${i < count ? ' on' : ''}`, 'aria-pressed': String(i < count), 'aria-label': `${ev.title}: marcar ${i + 1} de ${target}`,
        'data-key': `cb-${ev.id}-${i + 1}`, onClick: () => set(count === i + 1 ? i : i + 1),
      })),
      h('span', { class: 'counter-text no-print' }, text));
  }

  /* Lembrete fixo: sem hora, ao lado da folha. Uma caixa de marcar, ou quadradinhos de contar (8 copos).
     Na tela marca com o clique; no papel, com a caneta. Conta no quadro de constância, mas não no "feitos de total" do dia. */
  function reminderRow(date, entry) {
    const { reminder: r, ev, target, done } = entry;
    const tag = S.tag(r.tag);
    const single = target <= 1;
    return h('li', {
      class: `rem${done ? ' is-done' : ''}${single ? ' is-single' : ''}`, 'data-rem': r.id, style: tag ? { '--tag-h': tag.hue, '--tag-c': tag.chroma } : null,
    },
    single ? check({ checked: done, label: `Concluir: ${r.title}`, key: `ck-${r.id}`, onChange: (v) => { S.setDone(date, r.id, v); if (v) celebrate(ev, date); } }) : null,
    h('div', { class: 'rem-main' },
      h('div', { class: 'rem-line' },
        tag ? h('i', { class: 'tag-dot', 'aria-hidden': 'true', title: tag.name }) : null,
        h('button', { type: 'button', class: 'rem-title', 'data-key': `rem-${r.id}`, title: 'Editar este lembrete', onClick: () => Plan.dialogs.reminder({ id: r.id, date }) },
          r.icon ? h('span', { class: 'rem-icon', 'aria-hidden': 'true' }, r.icon) : null,
          h('span', { class: 'rem-name' }, r.title)),
        habitMeta(ev, date)[0]),
      single ? null : counter(date, entry)));
  }

  function remindersBox(date, model) {
    const list = model.reminders;
    const any = S.reminders().length > 0;
    return h('section', { class: `box reminders${list.length ? '' : ' no-print'}`, 'aria-labelledby': 'rem-title' },
      h('div', { class: 'rem-head' },
        h('h2', { id: 'rem-title' }, 'Lembretes fixos'),
        h('button', { type: 'button', class: 'btn small ghost no-print', 'data-key': 'rem-add', onClick: () => Plan.dialogs.reminder({ date }) }, '+ Lembrete')),
      list.length
        ? h('ul', { class: 'rem-list' }, list.map((e) => reminderRow(date, e)))
        : empty(any ? 'Nenhum lembrete para este dia.' : 'Água, louça, remédio: o que você marca todo dia com a caneta. Crie um lembrete e ele aparece aqui nos dias em que valer.'));
  }

  function slotRow(date, slot, extra) {
    const { ev } = slot;
    const isBlock = !!ev.end || slot.items.length > 0 || slot.tasks.length > 0;
    const cls = ['slot', slot.done ? 'is-done' : '', isBlock ? 'is-block' : '', ev.kind === 'rotina' ? 'is-routine' : '', ev.track ? 'is-habit' : ''].filter(Boolean).join(' ');
    return h('li', { class: cls, 'data-ev': ev.id },
      check({ checked: slot.done, label: `Concluir: ${ev.title}`, key: `ck-${ev.id}`, onChange: (v) => { S.setDone(date, ev.id, v); if (v) celebrate(ev, date); } }),
      h('div', { class: 'slot-time' },
        ev.time ? h('span', {}, ev.time) : h('span', { class: 'allday' }, 'dia todo'),
        ev.end ? h('span', { class: 'slot-end' }, `até ${ev.end}`) : null),
      h('div', { class: 'slot-main' },
        h('div', { class: 'slot-line' },
          h('button', { type: 'button', class: 'slot-title', 'data-key': `ev-${ev.id}`, title: 'Editar', onClick: () => Plan.dialogs.event({ id: ev.id, date }) }, ev.title),
          tagChip(ev.tag)),
        // Hábito: numa segunda linha ficam os quadradinhos de contar, a sequência e o objetivo.
        ev.track ? h('div', { class: 'habit-line' }, slot.target > 1 ? counter(date, slot) : null, ...habitMeta(ev, date)) : null,
        isBlock ? blockBody(date, slot, extra) : null));
  }

  /* Linha "Adicionar na agenda": hora, nome, categoria e repetição de uma vez. Aparece na lista com a hora certa. */
  function agendaAdd(date) {
    const s = S.get().settings;
    const tags = S.get().tags;
    const time = h('input', { type: 'time', class: 'input ag-time', value: lastAgenda.time || s.defaultTime, 'aria-label': 'Horário da nova tarefa', 'data-key': 'ag-time', onChange: (e) => { lastAgenda.time = e.target.value; } });
    const title = h('input', { type: 'text', class: 'input ag-title', placeholder: '+ nova tarefa com horário', 'aria-label': 'Nome da nova tarefa com horário', autocomplete: 'off', 'data-key': 'ag-title' });
    const tag = h('select', {
      class: 'input ag-tag', 'aria-label': 'Categoria da nova tarefa', 'data-key': 'ag-tag', value: lastAgenda.tag && S.tag(lastAgenda.tag) ? lastAgenda.tag : s.defaultTag,
      onChange: (e) => { lastAgenda.tag = e.target.value; },
    }, tags.map((t) => h('option', { value: t.id }, t.name)));
    const repeat = h('select', {
      class: 'input ag-repeat', 'aria-label': 'Repetição da nova tarefa', 'data-key': 'ag-repeat', value: lastAgenda.repeat,
      onChange: (e) => { lastAgenda.repeat = e.target.value; },
    },
    h('option', { value: 'none' }, 'Não repete'),
    h('option', { value: 'daily' }, 'Todo dia'),
    h('option', { value: 'weekdays' }, 'Dias úteis'),
    h('option', { value: 'custom' }, 'Escolher os dias…'));
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });

    function submit(e) {
      e.preventDefault();
      const name = title.value.trim();
      if (!name) { error.textContent = 'Dê um nome à tarefa.'; error.hidden = false; title.focus(); return; }
      if (!time.value) { error.textContent = 'Escolha o horário.'; error.hidden = false; time.focus(); return; }
      error.hidden = true;
      lastAgenda.time = time.value;
      lastAgenda.tag = tag.value;
      if (repeat.value === 'custom') {
        Plan.dialogs.event({ date, time: time.value, title: name, tag: tag.value, repeat: { freq: 'weekly', interval: 1, weekdays: [D.weekday(date)] } });
        return;
      }
      const ev = S.newEvent({ date, time: time.value, title: name, tag: tag.value });
      if (repeat.value === 'daily') ev.repeat = { freq: 'daily', interval: 1, skipWeekends: false, skipHolidays: false };
      else if (repeat.value === 'weekdays') ev.repeat = { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5], skipHolidays: true };
      title.focus(); // depois de salvar a tela se refaz e o foco volta para o nome, pronto para a próxima tarefa
      S.saveEvent(ev);
      Plan.ui.toast(`Adicionada às ${ev.time}. ${R.describe(ev.repeat)}.${isFar(date) ? ` Dia ${D.fmt.long(date)}, ${D.fmt.away(awayOf(date))}.` : ''}`);
    }

    return h('form', { class: 'agenda-add no-print', onSubmit: submit, noValidate: true, 'aria-label': 'Adicionar na agenda' },
      h('div', { class: 'ag-row' }, time, title, tag, repeat, h('button', { type: 'submit', class: 'btn', 'data-key': 'ag-submit', 'aria-label': 'Adicionar na agenda' }, 'Adicionar')),
      error);
  }

  function actionRow(date, { goal, obj, action }) {
    return h('li', { class: `sub${action.done ? ' is-done' : ''}` },
      check({ checked: action.done, label: `Concluir: ${action.text}`, key: `ck-a-${obj.id}-${action.id}`, onChange: (v) => S.setAction(goal.id, obj.id, action.id, { done: v }) }),
      h('span', { class: 'sub-text' }, action.text),
      h('a', { class: 'goal-link', href: '#/objetivos', title: `Meta: ${obj.title}`, onClick: openObjective(goal.id, obj.id) }, obj.title));
  }

  function looseBox(date, model, extra) {
    return h('section', { class: 'box' },
      h('h2', {}, 'Novas tarefas'),
      model.loose.length
        ? h('ul', { class: 'subs' }, model.loose.map((t) => subRow({
          text: t.text, tag: t.tag, done: t.done, key: `ck-${t.id}`, onToggle: (v) => S.setTask(date, t.id, { done: v }), onRemove: () => S.removeTask(date, t.id),
        })))
        : null,
      addForm({ placeholder: '+ tarefa sem horário', label: 'Adicionar tarefa sem horário', key: 'add-loose', onAdd: (text) => { S.addTask(date, { text, tag: S.get().settings.defaultTag }); farNote(date); } }),
      blankLines(Math.max(2, extra + 1)));
  }

  function goalsBox(date, model) {
    if (!model.actions.length) return null;
    return h('section', { class: 'box' },
      h('h2', {}, 'Ações das metas'),
      h('ul', { class: 'subs' }, model.actions.map((a) => actionRow(date, a))));
  }

  // No papel, as linhas de pauta das anotações são elementos de verdade (borda), não gradiente:
  // gradiente fino sai borrado ou some quando o navegador imprime sem "Gráficos de segundo plano".
  function notesBox(date, model) {
    const text = h('div', { class: 'notes-text' }, model.note);
    const printCopy = h('div', { class: 'notes-print', 'aria-hidden': 'true' },
      h('div', { class: 'notes-rules' }, Array.from({ length: 16 }, () => h('i', {}))), text);
    const area = h('textarea', {
      class: 'notes-area', rows: 7, placeholder: 'Anote aqui o que surgir durante o dia', 'aria-label': 'Anotações do dia', 'data-key': 'note',
      onInput: (e) => { S.setNote(date, e.target.value); text.textContent = e.target.value; },
    }, model.note);
    return h('section', { class: 'box notes' }, h('h2', {}, 'Anotações'), area, printCopy);
  }

  /* Aviso de data distante: diz a data por extenso e quanto falta, e oferece o caminho de volta com um clique.
     Se há um dia parecido (o mesmo dia e mês deste ano) por perto, é o primeiro botão: é quase sempre o erro de ano. */
  function farBanner(date, away) {
    if (Math.abs(away) <= D.FAR_DAYS) return null;
    const today = D.today();
    const sameDay = `${today.slice(0, 4)}${date.slice(4)}`;
    const near = D.isDate(sameDay) && sameDay !== date && Math.abs(D.diffDays(today, sameDay)) <= D.FAR_DAYS;
    return h('div', { class: 'date-alert no-print', role: 'status', 'data-key': 'date-alert' },
      h('p', {}, h('b', {}, `Esta folha é de ${D.fmt.long(date)}`), `, ${D.fmt.away(away)}. Era mesmo esse dia?`),
      h('div', { class: 'btn-row' },
        near ? h('button', { type: 'button', class: 'btn small primary', 'data-key': 'alert-same', onClick: () => go(sameDay) }, `Ir para ${D.fmt.short(sameDay)}/${sameDay.slice(0, 4)}`) : null,
        h('button', { type: 'button', class: 'btn small', 'data-key': 'alert-today', onClick: () => go(today) }, 'Voltar para hoje'),
        S.movable(date) ? h('button', { type: 'button', class: 'btn small', 'data-key': 'alert-move', onClick: () => Plan.dialogs.moveDay({ date, suggest: near ? sameDay : today }) }, 'Mover o que está aqui…') : null));
  }

  function sheetOptions(p) {
    const panel = h('div', { class: 'sheet-options', id: 'sheet-options', hidden: !optionsOpen, role: 'group', 'aria-label': 'Ajustes da folha' },
      h('h2', {}, 'Folha impressa'),
      h('p', { class: 'hint' }, 'O que você ajusta aparece na folha ao lado e sai igual no papel.'),
      ...Plan.sheetOptions.controls('pop'),
      h('div', { class: 'btn-row so-foot' },
        h('button', { type: 'button', class: 'btn small', 'data-key': 'so-more', onClick: () => { setOptions(false); Plan.dialogs.settings({ tab: 'dia' }); } }, 'Mais ajustes do dia'),
        h('button', { type: 'button', class: 'btn small primary', 'data-key': 'so-close', onClick: () => setOptions(false, { focusGear: true }) }, 'Pronto')));
    return panel;
  }

  function render(route) {
    wire();
    const date = D.clamp(route.date);
    const st = S.get();
    const p = st.settings.print;
    const model = S.dayModel(date);
    const today = D.today();
    const [year, month] = D.parts(date);
    const week = D.weekNumber(date, st.settings.weekStart);
    const wStart = D.startOfWeek(date, st.settings.weekStart);
    const pct = model.total ? Math.round((model.done / model.total) * 100) : 0;
    const flag = [model.holiday ? `${model.holiday.kind === 'feriado' ? 'Feriado' : model.holiday.kind === 'facultativo' ? 'Ponto facultativo' : 'Data'}: ${model.holiday.name}` : null, ...model.marks.map((m) => m.name)].filter(Boolean);
    const weekend = [0, 6].includes(D.weekday(date));
    // Só na tela: quanto falta ou quanto passou. No papel a data já diz tudo e a folha pode ser lida depois.
    const away = D.diffDays(today, date);
    const relative = away === 0 ? null : D.fmt.away(away);

    const gear = h('button', {
      type: 'button', class: 'btn icon gear', 'data-key': 'sheet-gear', 'aria-label': 'Ajustes da folha', title: 'Ajustes da folha', 'aria-expanded': String(optionsOpen), 'aria-controls': 'sheet-options',
      onClick: () => setOptions(!optionsOpen),
    }, gearIcon());

    const ctx = h('div', { class: 'ctx no-print' },
      h('div', { class: 'ctx-nav' },
        navButton('Dia anterior', '‹', () => go(D.addDays(date, -1)), date <= D.MIN),
        h('button', { type: 'button', class: 'btn', disabled: date === today, onClick: () => go(today) }, 'Hoje'),
        navButton('Próximo dia', '›', () => go(D.addDays(date, 1)), date >= D.MAX),
        h('input', {
          type: 'date', class: 'input date', min: D.MIN, max: D.MAX, value: date, 'aria-label': 'Ir para uma data',
          onChange: (e) => { if (D.isDate(e.target.value)) go(D.clamp(e.target.value)); },
        })),
      h('div', { class: 'ctx-actions' },
        h('div', { class: 'sheet-options-wrap' }, gear, sheetOptions(p)),
        h('button', { type: 'button', class: 'btn', 'data-key': 'new-task', title: 'Nova tarefa (tecla N)', onClick: () => Plan.dialogs.event({ date }) }, 'Nova tarefa'),
        h('button', { type: 'button', class: 'btn primary', 'data-key': 'print', title: 'Imprimir (tecla P)', onClick: () => window.print() }, 'Imprimir esta folha')));

    const timeline = model.slots.length
      ? h('ol', { class: 'timeline' }, model.slots.map((slot) => slotRow(date, slot, p.extra)))
      : empty('Nada planejado neste dia. Use "Adicionar na agenda" abaixo ou anote uma tarefa ao lado.');

    const side = h('aside', { class: 'side', 'aria-label': 'Lembretes, tarefas e anotações' },
      remindersBox(date, model), looseBox(date, model, p.extra), goalsBox(date, model), p.notes === 'none' ? null : notesBox(date, model),
      S.movable(date) ? h('p', { class: 'move-link no-print' },
        h('button', { type: 'button', class: 'link-btn', 'data-key': 'move-day', onClick: () => Plan.dialogs.moveDay({ date }) }, 'Anotou no dia errado? Mover este dia…')) : null);

    const sheet = h('article', {
      class: 'sheet', 'aria-labelledby': 'view-title', 'data-ruling': p.ruling, 'data-spacing': p.spacing, 'data-notes': p.notes, 'data-size': p.size, 'data-mono': String(p.mono),
    },
    date === today ? h('span', { class: 'ribbon' }, 'Hoje') : null,
    h('header', { class: 'sheet-head' },
      h('div', {},
        h('p', { class: `sheet-weekday${weekend ? ' is-weekend' : ''}` }, D.cap(D.fmt.weekday(date))),
        h('h1', { id: 'view-title' }, D.fmt.dm(date)),
        h('p', { class: 'sheet-sub' }, `${year} · semana ${week}`, relative ? h('span', { class: 'no-print' }, ' · ', h('b', { class: 'rel' }, relative)) : null)),
      h('div', { class: 'sheet-meta' },
        flag.map((f) => h('p', { class: 'sheet-flag' }, f)),
        model.total ? h('div', { class: 'sheet-progress no-print' }, h('span', {}, `${model.done} de ${model.total} feitos`), progressBar(pct, 'Progresso do dia')) : null)),
    h('div', { class: 'sheet-body' }, h('div', { class: 'main-col' }, agendaAdd(date), timeline), side));

    const trail = crumbs([
      { label: String(year), href: `#/ano/${year}` },
      { label: D.cap(D.MONTHS[month - 1]), href: `#/mes/${year}-${D.pad(month)}` },
      { label: `Semana ${week}`, href: `#/semana/${wStart}` },
      { label: `${D.cap(D.fmt.weekdayShort(date))}, ${D.fmt.short(date)}` },
    ]);

    const tools = h('aside', { class: 'tools no-print', 'aria-label': 'Calendário do mês' },
      h('section', { class: 'tools-box', 'aria-label': 'Calendário do mês' },
        Plan.cal.mini(year, month, { onPick: go, active: date })));

    return h('div', { class: 'view-day' }, trail, ctx, farBanner(date, away), h('div', { class: 'day-layout' }, sheet, tools));
  }

  Plan.views = Plan.views || {};
  Plan.views.dia = { render, title: (date) => `${D.fmt.long(date)}` };
})(globalThis);
