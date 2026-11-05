(function (root) {
  const { h, fmt, shell, ui, agenda, dates, pending } = root.App;
  const FIRST_HOUR = 6;
  const LAST_HOUR = 23;
  const HOUR_PX = 44;
  let mode = 'mes';
  let anchor = null;

  function itemDone(item, day, today) {
    if (item.kind === 'rotina') return Boolean(item.doneThrough && item.doneThrough >= day);
    return pending.isDone(item, today);
  }

  function chip(item, day, store) {
    const time = item.kind === 'compromisso' ? `${item.start.slice(11, 16)} ` : '';
    return h('button', {
      class: `chip${item.kind === 'compromisso' ? ' comp' : ''}${itemDone(item, day, store.today()) ? ' dn' : ''}`,
      title: item.title,
      onClick: (event) => {
        event.stopPropagation();
        root.App.panel.open(item.id);
      },
    }, `${time}${item.title}`);
  }

  async function createAt(store, day, hour) {
    const hh = String(hour).padStart(2, '0');
    const options = ui.sectorOptions(store);
    if (!options.length) { shell.toast('Crie um setor antes de adicionar um compromisso.'); return; }
    const sessionSector = store.getState().sectors.find((s) => s.sessionId === shell.currentSession());
    const result = await ui.dialog.form({
      title: `Compromisso · ${fmt.short(day)} às ${hh}:00`,
      submit: 'Criar',
      fields: [
        { name: 'title', label: 'Título' },
        { name: 'sectorId', label: 'Setor', type: 'select', options, value: sessionSector ? sessionSector.id : options[0][0] },
      ],
    });
    if (!result || !result.title.trim()) return;
    store.addCompromisso({ sectorId: result.sectorId, title: result.title.trim(), start: `${day}T${hh}:00` });
  }

  // Rotina diária repetida em todo dia só polui mês e semana; ela aparece na visão do dia.
  function withoutDaily(events) {
    const isDaily = (i) => i.kind === 'rotina' && i.freq.type === 'daily';
    return Object.fromEntries(Object.entries(events).map(([day, list]) => [day, list.filter((i) => !isDaily(i))]));
  }

  function monthView(store) {
    const today = store.today();
    const [year, month] = anchor.split('-').map(Number);
    const grid = agenda.monthGrid(year, month);
    const events = withoutDaily(agenda.eventsBetween(store.getState().items, grid[0], grid[grid.length - 1]));
    return h('div', { class: 'month', 'data-mode': 'mes' },
      fmt.WEEKDAYS_SHORT.map((d) => h('div', { class: 'dow' }, d)),
      grid.map((day) => {
        const list = events[day] || [];
        const inMonth = Number(day.split('-')[1]) === month;
        return h('div', {
          class: `mday${inMonth ? '' : ' other'}${day === today ? ' today' : ''}`,
          'data-day': day,
          onClick: () => { anchor = day; mode = 'dia'; shell.render(); },
        },
        h('div', { class: 'num' }, Number(day.split('-')[2])),
        list.slice(0, 3).map((item) => chip(item, day, store)),
        list.length > 3 ? h('div', { class: 'more' }, `+${list.length - 3}`) : null);
      }));
  }

  function hoursColumn(day, list, store) {
    const inGrid = list.filter((i) => {
      if (i.kind !== 'compromisso') return false;
      const hour = Number(i.start.slice(11, 13));
      return hour >= FIRST_HOUR && hour <= LAST_HOUR;
    });
    const slots = [];
    for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
      slots.push(h('button', {
        class: 'slot',
        'aria-label': `Criar compromisso às ${hour}h`,
        'data-slot': `${day}-${hour}`,
        onClick: () => createAt(store, day, hour),
      }));
    }
    const events = agenda.layoutDay(inGrid).map(({ item, start, end, lane, lanes }) => h('button', {
      class: `ev${itemDone(item, day, store.today()) ? ' dn' : ''}`,
      title: item.title,
      style: {
        top: `${((start / 60) - FIRST_HOUR) * HOUR_PX}px`,
        height: `${Math.max(22, ((end - start) / 60) * HOUR_PX - 2)}px`,
        left: `calc(${(lane / lanes) * 100}% + 3px)`,
        right: `calc(${100 - ((lane + 1) / lanes) * 100}% + 3px)`,
      },
      onClick: () => root.App.panel.open(item.id),
    }, `${item.start.slice(11, 16)} ${item.title}`));
    return h('div', { class: 'hours' }, slots, events);
  }

  function timeGrid(store, days) {
    const today = store.today();
    const all = agenda.eventsBetween(store.getState().items, days[0], days[days.length - 1]);
    const events = days.length > 1 ? withoutDaily(all) : all;
    const columns = `56px repeat(${days.length}, minmax(0, 1fr))`;
    const untimed = (day) => (events[day] || []).filter((i) => {
      if (i.kind !== 'compromisso') return true;
      const hour = Number(i.start.slice(11, 13));
      return hour < FIRST_HOUR || hour > LAST_HOUR;
    });
    const labels = [];
    for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) labels.push(h('div', { class: 'hour-label' }, `${hour}h`));
    return h('div', { class: 'tgrid', style: { 'grid-template-columns': columns }, 'data-mode': days.length === 1 ? 'dia' : 'semana' },
      h('div', {}),
      days.map((day) => h('div', {
        class: `thead${day === today ? ' today' : ''}`,
        onClick: () => { anchor = day; mode = 'dia'; shell.render(); },
      }, `${fmt.dow(day)} ${fmt.short(day)}`)),
      h('div', { style: { 'border-bottom': '1px solid var(--line)' } }),
      days.map((day) => h('div', { class: 'allday' }, untimed(day).map((item) => chip(item, day, store)))),
      h('div', {}, labels),
      days.map((day) => hoursColumn(day, events[day] || [], store)));
  }

  function shift(direction) {
    if (mode === 'dia') anchor = dates.addDays(anchor, direction);
    else if (mode === 'semana') anchor = dates.addDays(anchor, 7 * direction);
    else {
      let [year, month] = anchor.split('-').map(Number);
      month += direction;
      if (month < 1) { month = 12; year -= 1; }
      if (month > 12) { month = 1; year += 1; }
      anchor = `${year}-${String(month).padStart(2, '0')}-01`;
    }
    shell.render();
  }

  function title() {
    if (mode === 'mes') return fmt.cap(fmt.month(anchor));
    if (mode === 'dia') return fmt.cap(fmt.long(anchor));
    const days = agenda.weekDays(anchor);
    return `${fmt.short(days[0])} a ${fmt.short(days[6])}`;
  }

  function render(container, store) {
    if (!anchor) anchor = store.today();
    const view = mode === 'mes'
      ? monthView(store)
      : timeGrid(store, mode === 'semana' ? agenda.weekDays(anchor) : [anchor]);
    container.append(
      h('div', { class: 'agenda-bar' },
        h('h1', {}, title()),
        h('button', { class: 'btn', onClick: () => { anchor = store.today(); shell.render(); } }, 'Hoje'),
        h('button', { class: 'round', 'aria-label': 'Anterior', onClick: () => shift(-1) }, '‹'),
        h('button', { class: 'round', 'aria-label': 'Próximo', onClick: () => shift(1) }, '›'),
        h('div', { class: 'seg' }, [['mes', 'Mês'], ['semana', 'Semana'], ['dia', 'Dia']].map(([name, label]) => h('button', {
          class: mode === name ? 'on' : '',
          'data-agenda-mode': name,
          onClick: () => { mode = name; shell.render(); },
        }, label)))),
      view
    );
  }

  shell.register('agenda', { render });
})(globalThis);
