/* Janelas: tarefa, objetivo, bolha, data marcada e ajustes. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, field, seg, modal, dialogShell, confirmBox, choiceBox, promptBox, keepFocus, check, progressBar, toast, download } = Plan.ui;
  const D = Plan.dates;
  const S = Plan.store;
  const R = Plan.recur;
  const HB = Plan.habits;
  const clampInt = (v, lo, hi, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const HUE_NAMES = { 255: 'Azul', 195: 'Turquesa', 140: 'Verde', 80: 'Ocre', 45: 'Laranja', 20: 'Coral', 350: 'Rosa', 305: 'Violeta' };
  const UNITS = { daily: ['dia', 'dias'], weekly: ['semana', 'semanas'], monthly: ['mês', 'meses'], yearly: ['ano', 'anos'] };
  const PRESETS = [['Seg e qui', [1, 4]], ['Ter, qua e sex', [2, 3, 5]], ['Seg a sex', [1, 2, 3, 4, 5]], ['Fim de semana', [0, 6]]];

  // Qual botão da repetição representa o que está salvo.
  function modeOf(r) {
    if (!r || r.freq === 'none') return 'none';
    if (r.freq === 'weekly') {
      const set = [...(r.weekdays || [])].sort((a, b) => a - b).join();
      return set === '1,2,3,4,5' && (r.interval || 1) === 1 ? 'weekdays' : 'weekly';
    }
    return r.freq;
  }

  /* ---------------------------------------------------------------- Tarefa */
  // returnTo: abre de novo a janela de onde veio (o objetivo), quando a pessoa termina ou cancela aqui.
  function eventDialog({ id, date, time, title: presetTitle, tag: presetTag, repeat: presetRepeat, track: presetTrack, returnTo } = {}) {
    const existing = id ? S.event(id) : null;
    const draft = existing ? clone(existing) : S.newEvent({ date: date || Plan.router.cursor(), time, title: presetTitle || '', tag: presetTag });
    if (!existing && presetRepeat) draft.repeat = presetRepeat;
    // Hábito novo é rotina de fundo: aparece no dia e na semana e não lota o mês nem o calendário pequeno.
    if (!existing && presetTrack) { draft.track = presetTrack; draft.kind = 'rotina'; }
    // Fechar dispara o evento "close" depois (e a tela limpa a janela nele), então o retorno espera esse evento
    // em vez de reabrir na hora, senão a janela de origem abriria e seria esvaziada em seguida.
    const done = () => {
      if (returnTo) document.getElementById('modal').addEventListener('close', () => returnTo(), { once: true });
      modal.close();
    };
    const occurrence = date || draft.date;
    const r = draft.repeat || { freq: 'none' };
    const ws = S.get().settings.weekStart;
    const tagOptions = () => S.get().tags.map((t) => h('option', { value: t.id }, t.name));
    const heading = existing ? 'Editar tarefa' : 'Nova tarefa';

    // Tudo o que a repetição guarda fica aqui; a tela só reflete e o buildRepeat() monta o que vai salvar.
    const rp = {
      mode: modeOf(r),
      interval: Math.max(1, r.interval || 1),
      weekdays: new Set(r.weekdays && r.weekdays.length ? r.weekdays : [D.weekday(draft.date)]),
      skipWeekends: !!r.skipWeekends,
      skipHolidays: !!r.skipHolidays,
      until: r.until || '',
      month: { mode: r.mode || 'day', day: r.day || Number(draft.date.slice(8)), n: r.n || 1, shift: r.shift || 'none' },
    };

    const title = h('input', { type: 'text', class: 'input', value: draft.title, placeholder: 'Ex.: Reunião de alinhamento', autocomplete: 'off', 'data-key': 'ev-title' });
    const tagSel = h('select', { class: 'input', value: draft.tag, 'data-key': 'ev-tag' }, tagOptions());
    const dateIn = h('input', { type: 'date', class: 'input', value: draft.date, min: D.MIN, max: D.MAX, 'data-key': 'ev-date', onChange: () => { if (!existing && !tk.touched && D.isDate(dateIn.value)) tkSince.value = dateIn.value; } });
    const allDay = h('input', { type: 'checkbox', checked: !draft.time, 'data-key': 'ev-allday', onChange: sync });
    const timeIn = h('input', { type: 'time', class: 'input', value: draft.time || S.get().settings.defaultTime, 'data-key': 'ev-time' });
    const endIn = h('input', { type: 'time', class: 'input', value: draft.end || '', 'data-key': 'ev-end' });
    const bgChk = h('input', { type: 'checkbox', checked: draft.kind === 'rotina', 'data-key': 'ev-bg' });

    /* ----- Repetição: todas as opções à vista, sem abrir menu ----- */
    const modeSeg = seg({
      label: 'Repete', key: 'rp-mode', value: rp.mode, className: 'grid3x2',
      options: [['none', 'Não repete'], ['daily', 'Todo dia'], ['weekdays', 'Dias úteis'], ['weekly', 'Dias da semana'], ['monthly', 'Todo mês'], ['yearly', 'Todo ano']],
      onChange: (v) => chooseMode(v),
    });
    // Dias úteis já nasce pulando feriados. Também é o que os modelos de hábito usam para escolher a repetição.
    function chooseMode(v) {
      const radio = modeSeg.querySelector(`[data-key="rp-mode-${v}"]`);
      if (radio) radio.checked = true;
      if (v === 'weekdays' && rp.mode !== 'weekdays') { rp.skipHolidays = true; skipHol.checked = true; }
      rp.mode = v;
      sync();
    }
    const intervalIn = h('input', {
      type: 'number', class: 'input narrow', min: 1, max: 99, value: rp.interval, 'aria-label': 'Repetir a cada quantos períodos', 'data-key': 'rp-interval',
      onInput: (e) => { rp.interval = clampInt(e.target.value, 1, 99, 1); sync(); },
    });
    const unit = h('span', {});
    const gInterval = h('div', { class: 'row' }, h('span', {}, 'A cada'), intervalIn, unit);

    const dayChecks = Plan.cal.weekdayOrder(ws).map((wd) => h('input', {
      type: 'checkbox', value: String(wd), checked: rp.weekdays.has(wd), 'data-key': `rp-day-${wd}`,
      onChange: (e) => { if (e.target.checked) rp.weekdays.add(wd); else rp.weekdays.delete(wd); sync(); },
    }));
    const gWeek = h('div', { class: 'stackf' },
      h('div', { class: 'row wrap day-toggles', role: 'group', 'aria-label': 'Dias da semana' },
        Plan.cal.weekdayOrder(ws).map((wd, i) => h('label', { class: 'day-toggle' }, dayChecks[i], h('span', { title: D.WEEKDAYS[wd] }, D.WD_SHORT[wd])))),
      h('div', { class: 'row wrap presets' }, h('span', { class: 'hint' }, 'Atalhos:'),
        PRESETS.map(([name, list], i) => h('button', {
          type: 'button', class: 'btn small ghost', 'data-key': `rp-preset-${i}`,
          onClick: () => { rp.weekdays = new Set(list); dayChecks.forEach((c) => { c.checked = rp.weekdays.has(Number(c.value)); }); sync(); },
        }, name))));

    const skipWeek = h('input', { type: 'checkbox', checked: rp.skipWeekends, 'data-key': 'rp-skip-weekend', onChange: (e) => { rp.skipWeekends = e.target.checked; sync(); } });
    const skipHol = h('input', { type: 'checkbox', checked: rp.skipHolidays, 'data-key': 'rp-skip-holidays', onChange: (e) => { rp.skipHolidays = e.target.checked; sync(); } });
    const skipWeekWrap = h('label', { class: 'switch' }, skipWeek, h('span', {}, 'Pular fins de semana'));
    const skipHolWrap = h('label', { class: 'switch' }, skipHol, h('span', {}, 'Pular feriados'));
    const gSkip = h('div', { class: 'skips' }, skipWeekWrap, skipHolWrap);

    const modeSel = h('select', { class: 'input', value: rp.month.mode, 'data-key': 'rp-month-mode', onChange: (e) => { rp.month.mode = e.target.value; sync(); } },
      h('option', { value: 'day' }, 'Em um dia do mês'),
      h('option', { value: 'nth-bday' }, 'No enésimo dia útil'),
      h('option', { value: 'last-bday' }, 'No último dia útil'));
    const dayIn = h('input', { type: 'number', class: 'input narrow', min: 1, max: 31, value: rp.month.day, 'aria-label': 'Dia do mês', onInput: (e) => { rp.month.day = clampInt(e.target.value, 1, 31, 1); sync(); } });
    const nIn = h('input', { type: 'number', class: 'input narrow', min: 1, max: 23, value: rp.month.n, 'aria-label': 'Qual dia útil', onInput: (e) => { rp.month.n = clampInt(e.target.value, 1, 23, 1); sync(); } });
    const shiftSel = h('select', { class: 'input', value: rp.month.shift, onChange: (e) => { rp.month.shift = e.target.value; sync(); } },
      h('option', { value: 'none' }, 'Manter o dia'),
      h('option', { value: 'prev' }, 'Antecipar para o dia útil anterior'),
      h('option', { value: 'next' }, 'Adiar para o próximo dia útil'));
    const dayWrap = h('div', { class: 'row' }, h('span', {}, 'Dia'), dayIn);
    const nWrap = h('div', { class: 'row' }, h('span', {}, 'Dia útil número'), nIn);
    const shiftWrap = h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Se cair em dia sem expediente'), shiftSel);
    const gMonth = h('div', { class: 'stackf' }, field('Como contar', modeSel), dayWrap, nWrap, shiftWrap);

    const untilIn = h('input', { type: 'date', class: 'input', value: rp.until, min: D.MIN, max: D.MAX, 'data-key': 'rp-until', onChange: (e) => { rp.until = e.target.value; sync(); } });
    const gUntil = field('Termina em (opcional)', untilIn);
    const summary = h('p', { class: 'repeat-summary', 'aria-live': 'polite', 'data-key': 'rp-summary' });

    /* ----- Constância: acompanhar a tarefa no quadro de quadradinhos ----- */
    const t0 = draft.track;
    const tk = {
      on: !!t0,
      kind: t0 && t0.target > 1 ? 'count' : 'check',
      target: t0 && t0.target > 1 ? t0.target : 5,
      unit: t0 ? t0.unit : '',
      obj: t0 && t0.objId ? `${t0.goalId}|${t0.objId}` : '',
      // Tarefa que já existia começa a contar hoje (não faz o ano inteiro virar "falhou"); tarefa nova, na data dela.
      since: t0 ? t0.since : (existing ? (D.today() > draft.date ? D.today() : draft.date) : draft.date),
      touched: false,
    };
    const MODELS = [
      { name: 'Estudo diário', title: 'Estudar', time: '19:30', mode: 'daily', kind: 'check' },
      { name: 'Academia', title: 'Academia', time: '05:45', mode: 'weekdays', kind: 'check' },
    ];
    const tkOn = h('input', { type: 'checkbox', checked: tk.on, 'data-key': 'tk-on', onChange: (e) => { tk.on = e.target.checked; sync(); } });
    const tkKind = seg({ label: 'Como registrar', key: 'tk-kind', value: tk.kind, options: [['check', 'Marcar feito'], ['count', 'Contar']], onChange: (v) => { tk.kind = v; sync(); } });
    const tkTarget = h('input', {
      type: 'number', class: 'input narrow', min: 2, max: 99, value: tk.target, 'aria-label': 'Meta por dia', 'data-key': 'tk-target',
      onInput: (e) => { tk.target = clampInt(e.target.value, 2, 99, 5); },
      onChange: (e) => { e.target.value = tk.target; },
    });
    const tkUnit = h('input', { type: 'text', class: 'input', value: tk.unit, maxlength: 24, placeholder: 'copos, refeições, páginas', 'aria-label': 'Unidade', autocomplete: 'off', 'data-key': 'tk-unit', onInput: (e) => { tk.unit = e.target.value; } });
    const tkObj = h('select', { class: 'input', value: tk.obj, 'data-key': 'tk-obj', onChange: (e) => { tk.obj = e.target.value; } },
      h('option', { value: '' }, 'Sem objetivo'),
      S.get().goals.filter((g) => g.objectives.length).map((g) => h('optgroup', { label: g.title }, g.objectives.map((o) => h('option', { value: `${g.id}|${o.id}` }, o.title)))));
    const tkSince = h('input', { type: 'date', class: 'input', value: tk.since, min: D.MIN, max: D.MAX, 'data-key': 'tk-since', onChange: (e) => { tk.since = e.target.value; tk.touched = true; } });
    const tkHint = h('p', { class: 'hint' }, 'Sem repetição, só conta um dia. Escolha Todo dia, Dias úteis ou Dias da semana para acompanhar de verdade.');
    const countRow = h('div', { class: 'row wrap' },
      h('label', { class: 'row' }, h('span', {}, 'Meta por dia'), tkTarget),
      h('label', { class: 'row grow' }, h('span', {}, 'Unidade'), tkUnit));
    const gTrack = h('div', { class: 'stackf' }, tkKind, countRow,
      field('Objetivo', tkObj, 'Os dias cumpridos aparecem no quadro de constância desse objetivo.'),
      field('Contar a partir de', tkSince), tkHint);
    function applyModel(m) {
      if (!title.value.trim()) title.value = m.title;
      bgChk.checked = true;
      allDay.checked = !m.time;
      if (m.time) timeIn.value = m.time;
      chooseMode(m.mode);
      tk.on = true;
      tkOn.checked = true;
      tk.kind = m.kind;
      tkKind.querySelector(`[data-key="tk-kind-${m.kind}"]`).checked = true;
      if (m.kind === 'count') { tk.target = m.target; tkTarget.value = m.target; tk.unit = m.unit; tkUnit.value = m.unit; }
      sync();
    }
    const modelsRow = existing ? null : h('div', { class: 'row wrap presets' }, h('span', { class: 'hint' }, 'Modelos:'),
      MODELS.map((m, i) => h('button', { type: 'button', class: 'btn small', 'data-key': `tk-model-${i}`, onClick: () => applyModel(m) }, m.name)));

    let items = (draft.items || []).map((i) => ({ ...i }));
    const itemsBox = h('div', { class: 'items-edit' });
    function drawItems() {
      itemsBox.replaceChildren(
        ...items.map((it, idx) => h('div', { class: 'item-row' },
          h('input', { type: 'text', class: 'input', value: it.text, placeholder: 'O que fazer neste horário', 'aria-label': `Afazer ${idx + 1}`, onInput: (e) => { it.text = e.target.value; } }),
          h('select', { class: 'input small', 'aria-label': `Categoria do afazer ${idx + 1}`, value: it.tag, onChange: (e) => { it.tag = e.target.value; } }, tagOptions()),
          h('button', { type: 'button', class: 'btn icon', 'aria-label': `Remover o afazer ${idx + 1}`, onClick: () => { items.splice(idx, 1); drawItems(); } }, '×'))),
        h('button', {
          type: 'button', class: 'btn small', 'data-key': 'ev-add-item',
          onClick: () => { items.push({ id: S.uid('i'), text: '', tag: tagSel.value }); drawItems(); const rows = itemsBox.querySelectorAll('.item-row input[type="text"]'); rows[rows.length - 1].focus(); },
        }, '+ Afazer'));
    }

    const notes = h('textarea', { class: 'input', rows: 3, placeholder: 'Detalhes, link, local', 'aria-label': 'Detalhes' }, draft.notes || '');
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });

    function buildRepeat() {
      const base = { interval: rp.interval };
      if (rp.until) base.until = rp.until;
      switch (rp.mode) {
        case 'daily': return { freq: 'daily', ...base, skipWeekends: rp.skipWeekends, skipHolidays: rp.skipHolidays };
        case 'weekdays': return { freq: 'weekly', ...base, interval: 1, weekdays: [1, 2, 3, 4, 5], skipHolidays: rp.skipHolidays };
        case 'weekly': return { freq: 'weekly', ...base, weekdays: [...rp.weekdays].sort((a, b) => a - b), skipHolidays: rp.skipHolidays };
        case 'monthly': return { freq: 'monthly', ...base, mode: rp.month.mode, day: rp.month.day, n: rp.month.n, shift: rp.month.shift };
        case 'yearly': return { freq: 'yearly', ...base };
        default: return { freq: 'none' };
      }
    }

    function sync() {
      const m = rp.mode;
      timeIn.disabled = allDay.checked;
      endIn.disabled = allDay.checked;
      const [one, many] = UNITS[m === 'weekdays' ? 'weekly' : m] || ['', ''];
      unit.textContent = rp.interval === 1 ? one : many;
      gInterval.hidden = m === 'none' || m === 'weekdays';
      gWeek.hidden = m !== 'weekly';
      gMonth.hidden = m !== 'monthly';
      dayWrap.hidden = rp.month.mode !== 'day';
      shiftWrap.hidden = rp.month.mode !== 'day';
      nWrap.hidden = rp.month.mode !== 'nth-bday';
      skipWeekWrap.hidden = m !== 'daily';
      skipHolWrap.hidden = !['daily', 'weekdays', 'weekly'].includes(m);
      gSkip.hidden = skipWeekWrap.hidden && skipHolWrap.hidden;
      gUntil.hidden = m === 'none';
      summary.hidden = m === 'none';
      summary.textContent = R.describe(buildRepeat());
      gTrack.hidden = !tk.on;
      countRow.hidden = tk.kind !== 'count';
      tkHint.hidden = m !== 'none';
    }

    function problem(n) {
      if (!n.title) return ['Dê um nome à tarefa.', title];
      if (!D.isDate(n.date)) return ['Escolha a data.', dateIn];
      if (!allDay.checked && !n.time) return ['Escolha o horário ou marque "Dia todo".', timeIn];
      if (n.end && n.time && n.end <= n.time) return ['O fim precisa ser depois do início.', endIn];
      if (n.repeat.freq === 'weekly' && !n.repeat.weekdays.length) return ['Escolha ao menos um dia da semana.', dayChecks[0]];
      if (n.repeat.until && n.repeat.until < n.date) return ['O fim da repetição precisa ser depois da data inicial.', untilIn];
      return null;
    }

    function save(e) {
      e.preventDefault();
      const next = {
        ...draft,
        title: title.value.trim(),
        date: dateIn.value,
        time: allDay.checked ? '' : timeIn.value,
        end: allDay.checked ? '' : endIn.value,
        tag: tagSel.value,
        kind: bgChk.checked ? 'rotina' : 'compromisso',
        repeat: buildRepeat(),
        items: items.filter((i) => i.text.trim()).map((i) => ({ ...i, text: i.text.trim() })),
        notes: notes.value.trim(),
        track: tk.on ? {
          goalId: tk.obj ? tk.obj.split('|')[0] : null,
          objId: tk.obj ? tk.obj.split('|')[1] : null,
          target: tk.kind === 'count' ? clampInt(tk.target, 2, 99, 5) : 1,
          unit: tk.kind === 'count' ? tk.unit.trim().slice(0, 24) : '',
          since: !existing && !tk.touched ? dateIn.value : (D.isDate(tk.since) ? tk.since : dateIn.value),
        } : null,
      };
      const found = problem(next);
      if (found) { error.textContent = found[0]; error.hidden = false; found[1].focus(); return; }
      S.saveEvent(next);
      done();
      const gap = D.diffDays(D.today(), next.date);
      const far = Math.abs(gap) > D.FAR_DAYS ? ` Primeiro dia: ${D.fmt.long(next.date)}, ${D.fmt.away(gap)}.` : '';
      toast(existing ? `Tarefa atualizada.${far}` : `Tarefa criada${next.time ? ` às ${next.time}` : ''}. ${R.describe(next.repeat)}.${far}`);
    }

    async function remove() {
      if (existing.repeat.freq === 'none') {
        if (await confirmBox(`Excluir "${existing.title}"?`, { title: 'Excluir tarefa', action: 'Excluir', danger: true })) {
          S.deleteEvent(existing.id);
          done();
        }
        return;
      }
      const choice = await choiceBox(`"${existing.title}" se repete. O que excluir?`, [
        ['one', `Só o dia ${D.fmt.short(occurrence)}`],
        ['all', 'Todos os dias da série', 'danger'],
      ], { title: 'Excluir tarefa' });
      if (choice === 'one') S.skipOccurrence(existing.id, occurrence);
      else if (choice === 'all') S.deleteEvent(existing.id);
      else return;
      done();
    }

    const form = h('form', { class: 'ev-form', onSubmit: save, noValidate: true },
      field('Nome', title),
      h('div', { class: 'grid2' }, field('Categoria', tagSel), field('Data', dateIn, existing && existing.repeat.freq !== 'none' ? 'Primeiro dia da série.' : null)),
      h('div', { class: 'grid2' }, field('Início', timeIn), field('Fim (opcional)', endIn)),
      h('label', { class: 'switch' }, allDay, h('span', {}, 'Dia todo, sem horário')),
      h('fieldset', { class: 'group' },
        h('legend', {}, 'Repetição'),
        modeSeg, gInterval, gWeek, gMonth, gSkip, gUntil, summary),
      h('label', { class: 'switch' }, bgChk, h('span', {}, 'Rotina de fundo: aparece no dia e na semana, não no mês')),
      h('fieldset', { class: 'group' },
        h('legend', {}, 'Constância'),
        h('p', { class: 'hint' }, 'Cada dia cumprido vira um quadradinho verde no quadro de constância. Funciona com tarefas que se repetem. Para o que não tem hora (água, louça, remédio), use um lembrete fixo: fica ao lado da folha do dia.'),
        modelsRow,
        h('label', { class: 'switch' }, tkOn, h('span', {}, 'Acompanhar esta tarefa na constância')),
        gTrack),
      h('fieldset', { class: 'group' },
        h('legend', {}, 'Lista de afazeres neste horário'),
        h('p', { class: 'hint' }, 'Vira um checklist dentro da tarefa, na folha do dia, e repete junto com ela.'),
        itemsBox),
      field('Detalhes', notes),
      error,
      h('div', { class: 'modal-actions' },
        existing ? h('button', { type: 'button', class: 'btn danger left', onClick: remove }, 'Excluir') : null,
        h('button', { type: 'button', class: 'btn', onClick: done }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary' }, 'Salvar')));

    drawItems();
    sync();
    modal.open(dialogShell(heading, form, null), { variant: 'lg', label: heading });
    title.focus();
  }

  /* ---------------------------------------------------------------- Mover o dia */
  // Leva tudo o que está em um dia (tarefas, anotação e marcas) para outra data. Serve para corrigir um dia anotado na data errada.
  function moveDayDialog({ date, suggest } = {}) {
    const info = S.movable(date);
    if (!info) { toast('Não há nada neste dia para mover.'); return; }
    const today = D.clamp(D.today());
    const first = suggest && D.isDate(suggest) && suggest !== date ? suggest : (date === today ? D.addDays(today, 1) : today);
    // Para quem anota, tudo é "tarefa": os afazeres do dia e as tarefas com horário (que não se repetem) contam juntos.
    const count = info.tasks + info.events;
    const what = [
      count ? `${count} ${count === 1 ? 'tarefa' : 'tarefas'}` : null,
      info.note ? 'a anotação' : null,
      info.marks ? `${info.marks} ${info.marks === 1 ? 'marca' : 'marcas'} de feito` : null,
    ].filter(Boolean);
    const target = h('input', { type: 'date', class: 'input', value: first, min: D.MIN, max: D.MAX, 'data-key': 'mv-date', onInput: () => sync(), onChange: () => sync() });
    const hint = h('p', { class: 'hint', 'data-key': 'mv-hint', 'aria-live': 'polite' });
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    function sync() {
      hint.textContent = D.isDate(target.value) ? `${D.cap(D.fmt.weekday(target.value))}, ${D.fmt.long(target.value)} (${D.fmt.away(D.diffDays(D.today(), target.value))}).` : '';
    }
    function submit(e) {
      e.preventDefault();
      const r = S.moveDay(date, target.value);
      if (!r.ok) { error.textContent = r.error; error.hidden = false; target.focus(); return; }
      modal.close();
      Plan.router.go('dia', r.to);
      toast(`Movido para ${D.fmt.long(r.to)}: ${what.join(', ')}.`, {
        action: 'Desfazer',
        onAction: () => { const u = r.undo(); if (u.ok) Plan.router.go('dia', r.from); else toast(u.error); },
      });
    }
    sync();
    modal.open(dialogShell('Mover este dia', h('form', { onSubmit: submit, noValidate: true },
      h('p', {}, `Leva ${what.join(', ')} de ${D.fmt.long(date)} para outra data. O que já estiver lá fica, e este dia fica vazio.`),
      field('Mover para', target), hint, error,
      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => modal.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary', 'data-key': 'mv-go' }, 'Mover'))), null), { variant: 'md', label: 'Mover este dia' });
    target.focus();
  }

  /* ---------------------------------------------------------------- Lembrete fixo */
  // Modelos para começar: preenchem o que dá, e a pessoa ajusta.
  const REM_MODELS = [
    { name: 'Água', title: 'Beber água', icon: '💧', tag: 'saude', target: 8, unit: 'copos' },
    { name: 'Remédio ou vitamina', title: 'Tomar o remédio', icon: '💊', tag: 'saude', target: 1, unit: '' },
    { name: 'Refeições', title: 'Alimentação no plano', icon: '🍱', tag: 'saude', target: 4, unit: 'refeições', labels: ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'] },
    { name: 'Lavar a louça', title: 'Lavar a louça', icon: '🍽️', tag: 'pessoal', target: 1, unit: '' },
  ];
  const REM_ICONS = ['💧', '🍽️', '🧹', '🗑️', '🧺', '💊', '🏋️', '🐱', '📖', '🛏️'];
  // Qual botão de "Quando" representa o que está salvo (o lembrete só guarda estes quatro jeitos).
  function remModeOf(r) {
    if (r.freq === 'weekly') return [...(r.weekdays || [])].sort((a, b) => a - b).join() === '1,2,3,4,5' ? 'weekdays' : 'weekly';
    return r.freq === 'daily' && (r.interval || 1) === 2 ? 'alternate' : 'daily';
  }

  // returnTo: abre de novo a janela de onde veio (o objetivo), quando a pessoa termina ou cancela aqui.
  function reminderDialog({ id, date, objective, returnTo } = {}) {
    const existing = id ? S.reminder(id) : null;
    const draft = existing ? clone(existing) : S.newReminder({ since: date || Plan.router.cursor() });
    if (!existing && objective) { draft.goalId = objective.goalId; draft.objId = objective.objId; }
    const done = () => {
      if (returnTo) document.getElementById('modal').addEventListener('close', () => returnTo(), { once: true });
      modal.close();
    };
    const ws = S.get().settings.weekStart;
    const heading = existing ? 'Editar lembrete fixo' : 'Novo lembrete fixo';
    const st = {
      mode: remModeOf(draft.repeat),
      weekdays: new Set(draft.repeat.weekdays && draft.repeat.weekdays.length ? draft.repeat.weekdays : [D.weekday(draft.since)]),
      target: draft.target,
      labels: [...(draft.labels || [])],
    };

    const title = h('input', { type: 'text', class: 'input', value: draft.title, placeholder: 'Ex.: Beber água', maxlength: 80, autocomplete: 'off', 'data-key': 'rm-title' });
    const icon = h('input', { type: 'text', class: 'input narrow', id: 'rm-icon-input', value: draft.icon, placeholder: '💧', autocomplete: 'off', 'data-key': 'rm-icon' });
    const picks = h('div', { class: 'row wrap presets icon-picks', role: 'group', 'aria-label': 'Ícones sugeridos' },
      REM_ICONS.map((ic, i) => h('button', { type: 'button', class: 'btn small icon-pick', 'aria-label': `Usar o ícone ${ic}`, 'data-key': `rm-pick-${i}`, onClick: () => { icon.value = ic; } }, ic)));
    const tagSel = h('select', { class: 'input', value: draft.tag, 'data-key': 'rm-tag' }, S.get().tags.map((t) => h('option', { value: t.id }, t.name)));
    const target = h('input', {
      type: 'number', class: 'input narrow', min: 1, max: 99, value: st.target, 'aria-label': 'Quantas vezes por dia', 'data-key': 'rm-target',
      onInput: (e) => { st.target = clampInt(e.target.value, 1, 99, 1); sync(); },
      onChange: (e) => { e.target.value = st.target; },
    });
    const unit = h('input', { type: 'text', class: 'input', value: draft.unit, maxlength: 24, placeholder: 'copos, refeições, páginas', autocomplete: 'off', 'data-key': 'rm-unit' });
    const unitField = field('Unidade (opcional)', unit);
    // Nome de cada quadradinho: um campo por quadradinho, de 2 a 12 vezes por dia (acima disso vira contador de mais e menos).
    const labelsGrid = h('div', { class: 'labels-grid' });
    const labelsGroup = h('fieldset', { class: 'group labels-group' },
      h('legend', {}, 'Nome de cada quadradinho (opcional)'),
      // 17 letras é o que cabe numa linha da lista no papel (coluna do lado de 76 mm, duas colunas de passos).
      h('p', { class: 'hint' }, `Ex.: Ao acordar, 10h, Pós almoço. Com nomes, cada quadradinho marca só ele mesmo; sem nomes, marcar o quinto marca até o quinto. A partir de ${S.LIST_FROM} vira uma lista numerada, boa para rotina: no papel, nomes de até 17 letras cabem numa linha.`),
      labelsGrid);
    let labelsFor = 0;
    function drawLabels() {
      const n = st.target >= 2 && st.target <= 12 ? st.target : 0;
      labelsGroup.hidden = n === 0;
      if (n === labelsFor) return;
      labelsFor = n;
      labelsGrid.replaceChildren(...Array.from({ length: n }, (_, i) => h('label', { class: 'label-row' },
        h('span', { class: 'label-n', 'aria-hidden': 'true' }, String(i + 1)),
        h('input', {
          type: 'text', class: 'input', maxlength: 24, value: st.labels[i] || '', placeholder: i === 0 ? 'Ex.: Ao acordar' : '', autocomplete: 'off',
          'aria-label': `Nome do quadradinho ${i + 1}`, 'data-key': `rm-label-${i + 1}`, onInput: (e) => { st.labels[i] = e.target.value; },
        }))));
    }

    const whenSeg = seg({
      label: 'Quando', key: 'rm-when', value: st.mode, className: 'grid2x2',
      options: [['daily', 'Todo dia'], ['weekdays', 'Dias úteis'], ['weekly', 'Escolher os dias'], ['alternate', 'Dia sim, dia não']],
      onChange: (v) => { st.mode = v; sync(); },
    });
    const order = Plan.cal.weekdayOrder(ws);
    const dayChecks = order.map((wd) => h('input', {
      type: 'checkbox', value: String(wd), checked: st.weekdays.has(wd), 'data-key': `rm-day-${wd}`,
      onChange: (e) => { if (e.target.checked) st.weekdays.add(wd); else st.weekdays.delete(wd); sync(); },
    }));
    const days = h('div', { class: 'stackf' },
      h('div', { class: 'row wrap day-toggles', role: 'group', 'aria-label': 'Dias da semana' },
        order.map((wd, i) => h('label', { class: 'day-toggle' }, dayChecks[i], h('span', { title: D.WEEKDAYS[wd] }, D.WD_SHORT[wd])))),
      h('div', { class: 'row wrap presets' }, h('span', { class: 'hint' }, 'Atalhos:'),
        PRESETS.map(([name, list], i) => h('button', {
          type: 'button', class: 'btn small ghost', 'data-key': `rm-preset-${i}`,
          onClick: () => { st.weekdays = new Set(list); dayChecks.forEach((c) => { c.checked = st.weekdays.has(Number(c.value)); }); sync(); },
        }, name))));
    const summary = h('p', { class: 'repeat-summary', 'aria-live': 'polite', 'data-key': 'rm-summary' });

    const since = h('input', { type: 'date', class: 'input', value: draft.since, min: D.MIN, max: D.MAX, 'data-key': 'rm-since', onChange: () => sync() });
    const obj = h('select', { class: 'input', value: draft.goalId && draft.objId ? `${draft.goalId}|${draft.objId}` : '', 'data-key': 'rm-obj' },
      h('option', { value: '' }, 'Sem objetivo'),
      S.get().goals.filter((g) => g.objectives.length).map((g) => h('optgroup', { label: g.title }, g.objectives.map((o) => h('option', { value: `${g.id}|${o.id}` }, o.title)))));
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });

    const repeat = () => {
      if (st.mode === 'weekdays') return { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] };
      if (st.mode === 'weekly') return { freq: 'weekly', interval: 1, weekdays: [...st.weekdays].sort((a, b) => a - b) };
      return { freq: 'daily', interval: st.mode === 'alternate' ? 2 : 1 };
    };
    function sync() {
      days.hidden = st.mode !== 'weekly';
      unitField.hidden = st.target < 2;
      drawLabels();
      if (st.mode === 'weekly' && !st.weekdays.size) summary.textContent = 'Escolha ao menos um dia.';
      else summary.textContent = `${R.describe(repeat())}${st.mode === 'alternate' && D.isDate(since.value) ? `, a partir de ${D.fmt.long(since.value)}` : ''}.`;
    }

    function applyModel(m) {
      if (!title.value.trim()) title.value = m.title;
      icon.value = m.icon;
      if (S.tag(m.tag)) tagSel.value = m.tag;
      st.target = m.target;
      target.value = m.target;
      unit.value = m.unit;
      st.labels = [...(m.labels || [])];
      labelsFor = -1;
      sync();
    }
    const models = existing ? null : h('div', { class: 'row wrap presets' }, h('span', { class: 'hint' }, 'Modelos:'),
      REM_MODELS.map((m, i) => h('button', { type: 'button', class: 'btn small', 'data-key': `rm-model-${i}`, onClick: () => applyModel(m) }, m.name)));

    function save(e) {
      e.preventDefault();
      const name = title.value.trim();
      const fail = (text, el) => { error.textContent = text; error.hidden = false; el.focus(); };
      if (!name) { fail('Dê um nome ao lembrete.', title); return; }
      if (st.mode === 'weekly' && !st.weekdays.size) { fail('Escolha ao menos um dia da semana.', dayChecks[0]); return; }
      if (!D.isDate(since.value)) { fail('Escolha a data.', since); return; }
      const [goalId, objId] = obj.value ? obj.value.split('|') : [null, null];
      const saved = S.saveReminder({
        ...draft, title: name, icon: icon.value, tag: tagSel.value, since: D.clamp(since.value), repeat: repeat(),
        target: st.target, unit: st.target > 1 ? unit.value : '', labels: st.labels.slice(0, st.target), goalId, objId,
      });
      done();
      toast(existing ? 'Lembrete atualizado.' : `Lembrete criado. ${R.describe(saved.repeat)}.`);
    }

    async function remove() {
      const ok = await confirmBox(`Excluir "${existing.title}"? O que já foi marcado continua guardado, mas o lembrete sai da folha e do quadro.`, { title: 'Excluir lembrete', action: 'Excluir', danger: true });
      if (!ok) return;
      S.deleteReminder(existing.id);
      done();
    }

    const form = h('form', { class: 'ev-form', onSubmit: save, noValidate: true },
      models,
      field('Nome', title),
      h('div', { class: 'field' }, h('label', { class: 'field-label', for: 'rm-icon-input' }, 'Ícone (opcional)'), icon, picks),
      h('div', { class: 'grid2' },
        field('Categoria', tagSel),
        field('Quantas vezes por dia', target, '1 é só marcar. Mais de 1 vira quadradinhos, como 8 copos.')),
      unitField, labelsGroup,
      whenSeg, days, summary,
      field('Objetivo (opcional)', obj, 'Os dias cumpridos aparecem no quadro de constância desse objetivo.'),
      field('Contar a partir de', since, 'Antes dessa data o lembrete não aparece. No "dia sim, dia não", a conta começa aqui.'),
      error,
      h('div', { class: 'modal-actions' },
        existing ? h('button', { type: 'button', class: 'btn danger left', 'data-key': 'rm-delete', onClick: remove }, 'Excluir') : null,
        h('button', { type: 'button', class: 'btn', onClick: done }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary', 'data-key': 'rm-save' }, 'Salvar')));

    sync();
    modal.open(dialogShell(heading, form, null), { variant: 'md', label: heading });
    title.focus();
  }

  /* ---------------------------------------------------------------- Objetivo */
  function objectiveDialog(gid, oid) {
    let off = () => {};
    const draw = () => {
      const g = S.goal(gid);
      const o = S.objective(gid, oid);
      if (!o) { off(); modal.close(); return; }
      const p = S.progress(o);
      // Hábitos diários: tarefas que se repetem e contam no quadro de constância deste objetivo.
      const habitsSection = () => {
        const habits = S.habitsOf(gid, oid);
        const today = D.clamp(D.today());
        const back = () => objectiveDialog(gid, oid);
        return h('section', { class: 'obj-habits' },
          h('h3', {}, 'Hábitos diários'),
          h('p', { class: 'hint' }, 'Lembretes fixos e tarefas que contam no quadro de constância. Marque na folha do dia e o quadradinho daquele dia fica verde.'),
          habits.length
            ? h('ul', { class: 'cn-habits' }, habits.map((ev) => {
              const hs = HB.history({ events: [ev], days: S.get().days, today: D.today() });
              const reminder = ev.kind === 'lembrete';
              return h('li', { class: 'cn-habit' },
                h('button', {
                  type: 'button', class: 'cn-habit-title', 'data-key': `ob-habit-${ev.id}`,
                  onClick: () => (reminder ? reminderDialog({ id: ev.id, date: today, returnTo: back }) : eventDialog({ id: ev.id, date: today, returnTo: back })),
                }, ev.title),
                h('span', { class: 'cn-habit-meta' }, `${R.describe(ev.repeat)} · ${HB.whenText(ev)} · ${HB.goalText(ev)}`),
                h('span', { class: 'cn-habit-stats' }, HB.streakText(hs.current, false)),
                reminder ? null : h('button', {
                  type: 'button', class: 'btn small ghost', 'data-key': `ob-stop-${ev.id}`, 'aria-label': `Parar de acompanhar ${ev.title}`,
                  onClick: async () => {
                    if (await confirmBox(`"${ev.title}" continua na folha, mas deixa de contar no quadro. O que já foi marcado não é apagado.`, { title: 'Parar de acompanhar', action: 'Parar', danger: true })) S.stopTracking(ev.id);
                  },
                }, 'Parar de acompanhar'));
            }))
            : Plan.ui.empty('Nenhum hábito diário ainda. Crie um lembrete fixo para acompanhar este objetivo dia a dia, como estudar um pouco por dia ou beber água.'),
          habits.length ? Plan.constancia.mini({ events: habits }) : null,
          h('button', {
            type: 'button', class: 'btn small', 'data-key': 'ob-add-habit',
            onClick: () => reminderDialog({ date: today, objective: { goalId: gid, objId: oid }, returnTo: back }),
          }, '+ Lembrete fixo'));
      };
      const rows = o.actions.map((a) => h('li', { class: `act-row${a.done ? ' is-done' : ''}` },
        check({ checked: a.done, label: `Concluir: ${a.text}`, key: `ob-ck-${a.id}`, onChange: (v) => S.setAction(gid, oid, a.id, { done: v }) }),
        h('textarea', {
          class: 'input bare', rows: 1, 'aria-label': 'Texto da ação', 'data-key': `ob-tx-${a.id}`,
          onKeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.blur(); } },
          onChange: (e) => { const t = e.target.value.trim(); if (t) S.setAction(gid, oid, a.id, { text: t }); else e.target.value = a.text; },
        }, a.text),
        h('input', {
          type: 'date', class: 'input date', value: a.date || '', min: D.MIN, max: D.MAX, title: 'Agendar para um dia', 'aria-label': `Agendar: ${a.text}`, 'data-key': `ob-dt-${a.id}`,
          onChange: (e) => S.setAction(gid, oid, a.id, { date: D.isDate(e.target.value) ? e.target.value : null }),
        }),
        h('button', { type: 'button', class: 'x', 'aria-label': `Remover: ${a.text}`, onClick: () => S.removeAction(gid, oid, a.id) }, '×')));
      const body = h('div', { class: 'obj-body' },
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, g.kind === 'pillars' ? 'Nome do pilar' : 'Nome do objetivo'), h('input', {
          type: 'text', class: 'input', value: o.title, 'data-key': 'ob-title',
          onChange: (e) => { const t = e.target.value.trim(); if (t) S.updateObjective(gid, oid, { title: t }); else e.target.value = o.title; },
        })),
        h('div', { class: 'obj-progress' }, progressBar(p.pct, `Progresso de ${o.title}`), h('span', {}, p.total ? `${p.done} de ${p.total} ações, ${p.pct}%` : 'Sem ações ainda')),
        h('h3', {}, 'Ações'),
        rows.length ? h('ul', { class: 'act-list' }, rows) : Plan.ui.empty('Liste os passos que levam a este objetivo. A barra anda conforme você marca.'),
        Plan.ui.addForm({ placeholder: '+ ação', label: 'Adicionar ação', key: 'ob-add', onAdd: (t) => S.addAction(gid, oid, t) }),
        h('p', { class: 'hint' }, 'Dê uma data a uma ação e ela aparece na folha desse dia, na semana e no mês.'),
        habitsSection());
      const actions = h('div', { class: 'modal-actions' },
        h('button', {
          type: 'button', class: 'btn danger left',
          onClick: async () => {
            if (await confirmBox(`Excluir "${o.title}" e as ${p.total} ações dele?`, { title: 'Excluir', action: 'Excluir', danger: true })) { S.deleteObjective(gid, oid); }
          },
        }, 'Excluir'),
        h('button', { type: 'button', class: 'btn primary', onClick: () => modal.close() }, 'Pronto'));
      keepFocus(() => modal.open(dialogShell(o.title, body, actions), { variant: 'drawer', label: `Objetivo: ${o.title}` }));
    };
    off = S.subscribe(() => draw());
    document.getElementById('modal').addEventListener('close', () => off(), { once: true });
    draw();
  }

  /* ---------------------------------------------------------------- Bolha */
  function bubbleDialog(gid) {
    const g = gid ? S.goal(gid) : null;
    const title = h('input', { type: 'text', class: 'input', value: g ? g.title : '', placeholder: 'Ex.: Objetivos 2028', autocomplete: 'off', 'data-key': 'b-title' });
    const kind = g ? null : h('select', { class: 'input', value: 'cross' },
      h('option', { value: 'cross' }, 'Em cruz: até 4 objetivos'),
      h('option', { value: 'pillars' }, 'Pilares: o que sustenta o resto'));
    const year = h('input', { type: 'number', class: 'input narrow', min: 2026, max: 2040, value: g && g.year ? g.year : '', placeholder: 'Opcional' });
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const save = (e) => {
      e.preventDefault();
      const name = title.value.trim();
      if (!name) { error.textContent = 'Dê um título à bolha.'; error.hidden = false; title.focus(); return; }
      const y = year.value ? clampInt(year.value, 2026, 2040, null) : null;
      if (g) S.updateGoal(g.id, { title: name, year: y });
      else S.addGoal({ title: name, kind: kind.value, year: y });
      modal.close();
    };
    const form = h('form', { onSubmit: save, noValidate: true },
      field('Título', title),
      kind ? field('Formato', kind) : null,
      field('Ano', year),
      error,
      h('div', { class: 'modal-actions' },
        g ? h('button', {
          type: 'button', class: 'btn danger left',
          onClick: async () => { if (await confirmBox(`Excluir a bolha "${g.title}" com todos os objetivos?`, { title: 'Excluir bolha', action: 'Excluir', danger: true })) { S.deleteGoal(g.id); modal.close(); } },
        }, 'Excluir') : null,
        h('button', { type: 'button', class: 'btn', onClick: () => modal.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary' }, g ? 'Salvar' : 'Criar bolha')));
    modal.open(dialogShell(g ? 'Editar bolha' : 'Nova bolha', form, null), { variant: 'md', label: g ? 'Editar bolha' : 'Nova bolha' });
    title.focus();
  }

  /* ---------------------------------------------------------------- Feriado local ou data importante */
  function markDialog({ date, holiday = true } = {}) {
    let isHoliday = !!holiday;
    const name = h('input', { type: 'text', class: 'input', placeholder: 'Ex.: Aniversário da cidade, prazo do contrato', autocomplete: 'off', 'data-key': 'mk-name' });
    const dateIn = h('input', { type: 'date', class: 'input', value: date || D.today(), min: D.MIN, max: D.MAX, 'data-key': 'mk-date' });
    const yearly = h('input', { type: 'checkbox', checked: true, 'data-key': 'mk-yearly' });
    const hint = h('p', { class: 'hint' });
    const showHint = () => { hint.textContent = isHoliday ? 'Conta como dia sem expediente. As tarefas que pulam feriados não caem nele.' : 'Só marca o dia no calendário. Não muda os dias úteis.'; };
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    // Dentro dos Ajustes, abre por cima em vez de trocar a janela.
    const stacked = document.getElementById('modal').open;
    const win = stacked ? Plan.ui.second : modal;
    const save = (e) => {
      e.preventDefault();
      if (!name.value.trim()) { error.textContent = 'Dê um nome à data.'; error.hidden = false; name.focus(); return; }
      if (!D.isDate(dateIn.value)) { error.textContent = 'Escolha a data.'; error.hidden = false; dateIn.focus(); return; }
      win.close();
      S.addMark({ date: dateIn.value, name: name.value, yearly: yearly.checked, holiday: isHoliday });
      toast(isHoliday ? 'Feriado local marcado.' : 'Data marcada.');
    };
    showHint();
    win.open(dialogShell('Marcar uma data', h('form', { onSubmit: save, noValidate: true },
      seg({ label: 'Tipo', key: 'mk-kind', value: isHoliday ? 'holiday' : 'date', options: [['holiday', 'Feriado local'], ['date', 'Data importante']], onChange: (v) => { isHoliday = v === 'holiday'; showHint(); } }),
      hint,
      field('Nome', name), field('Data', dateIn),
      h('label', { class: 'switch' }, yearly, h('span', {}, 'Repetir todo ano')),
      error,
      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => win.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary' }, 'Marcar'))), null, { close: () => win.close() }), { variant: 'md', label: 'Marcar uma data' });
    name.focus();
  }

  /* ---------------------------------------------------------------- Ajustes */
  const SET_TABS = [['aparencia', 'Aparência'], ['dia', 'Dia e folha'], ['categorias', 'Categorias'], ['datas', 'Feriados e datas'], ['dados', 'Seus dados'], ['atalhos', 'Atalhos']];
  let settingsTab = 'aparencia';

  function settingsDialog({ tab } = {}) {
    if (tab && SET_TABS.some(([id]) => id === tab)) settingsTab = tab;
    let off = () => {};

    const panels = (st) => {
      const s = st.settings;
      const sizeLabel = h('span', {}, `${s.size}%`);
      const tagSelect = (extra) => h('select', { class: 'input', ...extra }, st.tags.map((t) => h('option', { value: t.id }, t.name)));

      const aparencia = h('div', {},
        Plan.ui.seg({ label: 'Tema', key: 'st-theme', value: s.theme, options: [['light', 'Claro'], ['dark', 'Escuro'], ['auto', 'Automático']], onChange: (v) => S.setSettings({ theme: v }) }),
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Cor de destaque'),
          h('div', { class: 'swatches' },
            Plan.theme.ACCENTS.map(([hex, name]) => h('button', {
              type: 'button', class: `swatch${s.accent.toLowerCase() === hex ? ' on' : ''}`, style: { '--sw': hex }, 'aria-label': name, 'aria-pressed': String(s.accent.toLowerCase() === hex), title: name,
              'data-key': `sw-${hex}`, onClick: () => S.setSettings({ accent: hex }),
            })),
            h('label', { class: 'swatch-custom' }, h('span', { class: 'sr-only' }, 'Outra cor'),
              h('input', { type: 'color', value: s.accent, 'data-key': 'sw-custom', onChange: (e) => S.setSettings({ accent: e.target.value }) })))),
        field('Fonte', h('select', { class: 'input', value: s.font, 'data-key': 's-font', onChange: (e) => S.setSettings({ font: e.target.value }) }, Object.keys(Plan.theme.FONT_STACKS).map((f) => h('option', { value: f }, f)))),
        h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Tamanho da letra ', sizeLabel),
          h('input', {
            type: 'range', min: 85, max: 130, step: 5, value: s.size, 'data-key': 's-size',
            onInput: (e) => { document.documentElement.style.fontSize = `${e.target.value}%`; sizeLabel.textContent = `${e.target.value}%`; },
            onChange: (e) => S.setSettings({ size: Number(e.target.value) }),
          })));

      const dia = h('div', {},
        h('h4', {}, 'Folha impressa'),
        h('p', { class: 'hint' }, 'Vale para todos os dias. Na folha do dia, a engrenagem ajusta as mesmas opções.'),
        ...Plan.sheetOptions.controls('set'),
        h('h4', { class: 'sub-h' }, 'Ao planejar o dia'),
        Plan.ui.seg({ label: 'A semana começa na', key: 'st-weekstart', value: String(s.weekStart), options: [['1', 'Segunda'], ['0', 'Domingo']], onChange: (v) => S.setSettings({ weekStart: Number(v) }) }),
        field('Horário de uma tarefa nova', h('input', {
          type: 'time', class: 'input narrow wide-time', value: s.defaultTime, 'data-key': 'st-deftime',
          onChange: (e) => { if (e.target.value) S.setSettings({ defaultTime: e.target.value }); else e.target.value = s.defaultTime; },
        }), 'Já vem preenchido ao criar uma tarefa.'),
        field('Categoria de uma tarefa nova', tagSelect({ value: s.defaultTag, 'data-key': 'st-deftag', onChange: (e) => S.setSettings({ defaultTag: e.target.value }) })));

      const categorias = h('div', {},
        h('p', { class: 'hint' }, 'Cada categoria tem nome e cor. A cor marca a tarefa na tela; no papel, o nome faz o mesmo trabalho. Na Semana e no Mês, você escolhe quais categorias aparecem.'),
        h('ul', { class: 'tag-rows' }, st.tags.map((t) => h('li', { class: 'tag-row', style: { '--tag-h': t.hue, '--tag-c': t.chroma } },
          h('i', { class: 'tag-dot big', 'aria-hidden': 'true' }),
          h('input', { type: 'text', class: 'input', value: t.name, 'aria-label': `Nome da categoria ${t.name}`, 'data-key': `tg-${t.id}`, onChange: (e) => { const n = e.target.value.trim(); if (n) S.setTag(t.id, { name: n }); else e.target.value = t.name; } }),
          h('div', { class: 'hues', role: 'group', 'aria-label': `Cor da categoria ${t.name}` }, S.TAG_HUES.map((hue) => h('button', {
            type: 'button', class: `hue${t.hue === hue && t.chroma > 0 ? ' on' : ''}`, style: { '--tag-h': hue }, 'aria-label': HUE_NAMES[hue], 'aria-pressed': String(t.hue === hue && t.chroma > 0), title: HUE_NAMES[hue],
            'data-key': `hue-${t.id}-${hue}`, onClick: () => S.setTag(t.id, { hue, chroma: 0.12 }),
          }))),
          h('button', { type: 'button', class: 'x', 'aria-label': `Remover a categoria ${t.name}`, onClick: () => S.removeTag(t.id) }, '×')))),
        h('form', {
          class: 'add-tag',
          onSubmit: (e) => { e.preventDefault(); const input = e.target.elements.name; if (input.value.trim()) { S.addTag(input.value, S.TAG_HUES[st.tags.length % S.TAG_HUES.length]); } },
        }, h('input', { type: 'text', name: 'name', class: 'input', placeholder: 'Nova categoria', 'aria-label': 'Nome da nova categoria', autocomplete: 'off', 'data-key': 'tag-new' }),
        h('button', { type: 'submit', class: 'btn' }, 'Criar categoria')));

      const markList = (list, emptyText) => (list.length
        ? h('ul', { class: 'mark-rows' }, list.map((m) => h('li', {}, h('span', {}, `${D.fmt.short(m.date)}${m.yearly ? '' : `/${m.date.slice(0, 4)}`} ${m.name}${m.yearly ? ' (todo ano)' : ''}`),
          h('button', { type: 'button', class: 'x', 'aria-label': `Remover a data ${m.name}`, onClick: () => S.removeMark(m.id) }, '×'))))
        : Plan.ui.empty(emptyText));
      const datas = h('div', {},
        h('h4', {}, 'Feriados locais'),
        h('p', { class: 'hint' }, 'Os do seu estado ou cidade. Contam como dia sem expediente, e as tarefas que pulam feriados não caem neles.'),
        markList(st.marks.filter((m) => m.holiday), 'Nenhum ainda.'),
        h('button', { type: 'button', class: 'btn small', 'data-key': 'mk-add-holiday', onClick: () => markDialog({ holiday: true }) }, '+ Feriado local'),
        h('h4', { class: 'sub-h' }, 'Datas importantes'),
        h('p', { class: 'hint' }, 'Aniversários, prazos, o que importa para você. Aparecem no calendário e não mudam os dias úteis.'),
        markList(st.marks.filter((m) => !m.holiday), 'Nenhuma ainda.'),
        h('button', { type: 'button', class: 'btn small', 'data-key': 'mk-add-date', onClick: () => markDialog({ holiday: false }) }, '+ Data importante'));

      const fileIn = h('input', {
        type: 'file', accept: 'application/json,.json', class: 'sr-only', tabindex: '-1', 'aria-hidden': 'true',
        onChange: async (e) => {
          const [file] = e.target.files;
          if (!file) return;
          const result = S.importJSON(await file.text());
          toast(result.ok ? 'Cópia carregada.' : result.error);
          e.target.value = '';
        },
      });
      const dados = h('div', {},
        h('h4', {}, 'Onde ficam'),
        h('p', {}, 'Tudo fica salvo neste navegador, neste computador (armazenamento local do Chrome ou do Edge). Não vai para a internet, e não há planilha nem banco de dados para instalar.'),
        h('p', {}, 'Se você limpar os dados do navegador, trocar de navegador ou de computador, o caderno some. Por isso, baixe uma cópia de vez em quando e guarde o arquivo.'),
        h('p', { class: 'backup-line', 'data-key': 'backup-line' }, S.backupLabel()),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn primary', 'data-key': 'dl-backup', onClick: () => { download(`caderno-${D.today()}.json`, S.backupJSON()); toast('Cópia baixada.'); } }, 'Baixar uma cópia'),
          h('button', { type: 'button', class: 'btn', onClick: () => fileIn.click() }, 'Carregar uma cópia'),
          h('button', {
            type: 'button', class: 'btn danger',
            onClick: async () => { if (await confirmBox('Isso apaga o que está no caderno e volta ao exemplo.', { title: 'Voltar ao exemplo', action: 'Voltar ao exemplo', danger: true })) { S.resetSample(); toast('Exemplo restaurado.'); } },
          }, 'Voltar ao exemplo')),
        fileIn);

      const atalhos = h('dl', { class: 'keys' },
        [['← →', 'dia, semana, mês ou ano anterior e seguinte'], ['T', 'ir para hoje'], ['N', 'nova tarefa'], ['P', 'imprimir'], ['Esc', 'fechar janelas e a engrenagem']].map(([k, t]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, t)]));

      return { aparencia, dia, categorias, datas, dados, atalhos };
    };

    const onTabKey = (e) => {
      const ids = SET_TABS.map(([id]) => id);
      const i = ids.indexOf(settingsTab);
      let next = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
      else if (e.key === 'Home') next = ids[0];
      else if (e.key === 'End') next = ids[ids.length - 1];
      if (!next) return;
      e.preventDefault();
      settingsTab = next;
      draw();
      const tab = document.querySelector(`[data-key="st-tab-${next}"]`);
      if (tab) tab.focus();
    };

    function draw() {
      const st = S.get();
      const built = panels(st);
      const nav = h('div', { class: 'set-nav', role: 'tablist', 'aria-label': 'Seções dos ajustes', 'aria-orientation': 'vertical', onKeydown: onTabKey },
        SET_TABS.map(([id, name]) => h('button', {
          type: 'button', role: 'tab', id: `st-tab-${id}`, class: 'set-tab', 'aria-selected': String(id === settingsTab), 'aria-controls': `st-panel-${id}`,
          tabindex: id === settingsTab ? '0' : '-1', 'data-key': `st-tab-${id}`, onClick: () => { settingsTab = id; draw(); },
        }, name)));
      const [, current] = SET_TABS.find(([id]) => id === settingsTab);
      const panel = h('section', { class: 'set-panel', role: 'tabpanel', id: `st-panel-${settingsTab}`, 'aria-labelledby': `st-tab-${settingsTab}`, tabindex: '0' },
        h('h3', { class: 'set-title' }, current), built[settingsTab]);
      keepFocus(() => modal.open(dialogShell('Ajustes', h('div', { class: 'settings-layout' }, nav, panel), null), { variant: 'xl', label: 'Ajustes' }));
    }

    off = S.subscribe((info) => { if (!info.statusOnly || settingsTab === 'dados') draw(); });
    document.getElementById('modal').addEventListener('close', () => off(), { once: true });
    draw();
  }

  Plan.dialogs = { event: eventDialog, reminder: reminderDialog, moveDay: moveDayDialog, objective: objectiveDialog, bubble: bubbleDialog, mark: markDialog, settings: settingsDialog };
})(globalThis);
