/* Quadro de constância: um quadradinho por dia, no estilo do gráfico de contribuições do GitHub.
   Cada hábito cumprido acende o dia. Cinza é previsto e não feito; vazio é nada previsto.
   Usado no Ano (o ano da tela), nos Objetivos (as últimas 52 semanas, sem ano para trocar) e em miniatura dentro de cada objetivo. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, empty, confirmBox, keepFocus } = Plan.ui;
  const D = Plan.dates;
  const S = Plan.store;
  const R = Plan.recur;
  const HB = Plan.habits;
  const WEEKS = 52;

  // O recorte escolhido fica aqui para sobreviver a cada redesenho da tela.
  let scope = 'all'; // 'all', 'none' ou `${goalId}|${objId}`

  const keyOf = (goalId, objId) => `${goalId}|${objId}`;
  const domKey = (sc) => (sc === 'all' || sc === 'none' ? sc : sc.replace('|', '-'));
  const pctText = (p) => (p === null ? 'sem dados' : `${p}%`);
  const last30Text = (p) => (p === null ? 'sem dados em 30 dias' : `${p}% em 30 dias`);

  function eventsIn(sc) {
    const all = S.habits();
    if (sc === 'all') return all;
    if (sc === 'none') return all.filter((e) => !e.track.objId);
    const [goalId, objId] = sc.split('|');
    return all.filter((e) => e.track.goalId === goalId && e.track.objId === objId);
  }

  // O que o quadradinho diz ao passar o mouse: o dia e o que foi feito de cada hábito.
  function cellTitle(c) {
    const day = `${D.cap(D.fmt.weekdayShort(c.date))}, ${D.fmt.dm(c.date)}`;
    if (!c.detail.length) return `${day}: nada previsto`;
    const parts = c.detail.map((d) => {
      let what;
      if (d.value === 0 && c.future) what = 'previsto';
      else if (d.value === 0 && c.today) what = 'ainda em aberto';
      else if (d.target > 1) what = `${d.value} de ${d.target}${d.unit ? ` ${d.unit}` : ''}`;
      else what = d.value >= 1 ? 'feito' : 'não feito';
      return `${d.title}: ${what}${d.expected ? '' : ' (fora do combinado)'}`;
    });
    return `${day}: ${parts.join('; ')}`;
  }

  // A grade em si. Os quadradinhos são decorativos (aria-hidden); quem usa leitor de tela lê o resumo em texto ao lado.
  function heatmap({ cells, weeks, compact = false, label }) {
    const byDate = new Map(cells.map((c) => [c.date, c]));
    const order = Plan.cal.weekdayOrder(S.get().settings.weekStart);
    const marks = HB.monthStarts(weeks);
    const cellEl = (date) => {
      if (!date) return h('span', { class: 'hm-cell pad', 'aria-hidden': 'true' });
      const c = byDate.get(date) || { date, level: null, detail: [] };
      const cls = ['hm-cell', typeof c.level === 'number' ? `l${c.level}` : '', c.today ? 'is-today' : '', c.pending ? 'is-pending' : '', c.extra ? 'is-extra' : ''].filter(Boolean).join(' ');
      return h('a', { class: cls, href: `#/dia/${date}`, tabindex: '-1', 'aria-hidden': 'true', title: cellTitle(c) });
    };
    const scroller = h('div', { class: 'hm-scroll', role: 'region', tabindex: '0', 'aria-label': label },
      h('div', { class: `hm${compact ? ' is-compact' : ''}`, style: { '--weeks': String(weeks.length) } },
        h('div', { class: 'hm-months', 'aria-hidden': 'true' },
          marks.map((m) => h('span', { class: 'hm-month', style: { gridColumn: String(m.week + 1) } }, D.MONTHS[m.month - 1].slice(0, 3)))),
        h('div', { class: 'hm-days', 'aria-hidden': 'true' },
          [0, 2, 4].map((i) => h('span', { class: 'hm-weekday', style: { gridRow: String(i + 1) } }, D.WD_SHORT[order[i]]))),
        h('div', { class: 'hm-grid' }, weeks.flat().map(cellEl))));
    // Em tela estreita o ano não cabe: abre rolado até a semana de hoje, que é onde está o que importa.
    requestAnimationFrame(() => {
      const today = scroller.querySelector('.is-today');
      if (!today || scroller.scrollWidth <= scroller.clientWidth) return;
      scroller.scrollLeft += today.getBoundingClientRect().left - scroller.getBoundingClientRect().left - scroller.clientWidth * 0.75;
    });
    return scroller;
  }

  const legend = () => h('ul', { class: 'hm-legend', 'aria-label': 'Legenda do quadro' },
    h('li', {}, h('i', { class: 'hm-cell l0' }), 'não cumpriu'),
    h('li', {}, h('i', { class: 'hm-cell l1' }), h('i', { class: 'hm-cell l2' }), h('i', { class: 'hm-cell l3' }), 'em parte'),
    h('li', {}, h('i', { class: 'hm-cell l4' }), 'cumpriu'),
    h('li', {}, h('i', { class: 'hm-cell' }), 'nada previsto'));

  const stat = (value, text, title) => h('li', { class: 'cn-stat', title: title || null }, h('b', {}, String(value)), h('span', {}, text));

  const monthsLine = (sum, period) => (sum.byMonth.length
    ? `Por mês: ${sum.byMonth.map((m) => `${D.MONTHS[Number(m.month.slice(5)) - 1].slice(0, 3)} ${pctText(m.pct)}`).join(' · ')}.`
    : `Ainda não há dias previstos ${period}.`);

  /* Recortes: Tudo, cada objetivo que tem hábito (no Ano, também os objetivos das bolhas do ano) e os hábitos sem objetivo. */
  function scopeRows(fixedYear) {
    const all = S.habits();
    const by = new Map();
    all.forEach((e) => { const k = e.track.objId ? keyOf(e.track.goalId, e.track.objId) : 'none'; by.set(k, [...(by.get(k) || []), e]); });
    const rows = [{ key: 'all', name: 'Tudo', events: all, obj: null }];
    S.get().goals.forEach((g) => [...g.objectives].sort((a, b) => a.slot - b.slot).forEach((o) => {
      const events = by.get(keyOf(g.id, o.id)) || [];
      if (events.length || (fixedYear && g.year === fixedYear)) rows.push({ key: keyOf(g.id, o.id), name: o.title, events, obj: o });
    }));
    if (by.has('none')) rows.push({ key: 'none', name: 'Sem objetivo', events: by.get('none'), obj: null });
    return rows;
  }

  // Com year, o quadro é daquele ano. Sem year, são as últimas 52 semanas até hoje: não tem ano para trocar nem futuro vazio.
  function board({ year: fixedYear = null } = {}) {
    const section = h('section', { class: 'constancia no-print', 'aria-labelledby': 'cn-title' });
    const draw = () => section.replaceChildren(...build());

    // Hábito novo é um lembrete fixo: sem hora, ao lado da folha. Tarefa com hora entra pelo editor ("Acompanhar na constância").
    function addReminder(today) {
      const [goalId, objId] = scope.includes('|') ? scope.split('|') : [null, null];
      Plan.dialogs.reminder({ date: D.clamp(today), objective: goalId ? { goalId, objId } : null });
    }

    async function stop(ev) {
      const ok = await confirmBox(`"${ev.title}" continua na folha, mas deixa de contar no quadro. O que já foi marcado não é apagado.`, { title: 'Parar de acompanhar', action: 'Parar', danger: true });
      if (ok) S.stopTracking(ev.id);
    }

    function build() {
      const st = S.get();
      const today = D.today();
      const ws = st.settings.weekStart;
      const rolling = !fixedYear;
      const range = rolling ? HB.rollingRange(today, WEEKS, ws) : { from: `${fixedYear}-01-01`, to: `${fixedYear}-12-31` };
      const rows = scopeRows(fixedYear);
      if (!rows.some((r) => r.key === scope)) scope = 'all';
      const events = eventsIn(scope);
      const days = st.days;

      const head = h('header', { class: 'cn-head' }, h('h2', { id: 'cn-title' }, rolling ? 'Constância' : `Constância de ${fixedYear}`));
      const hint = h('p', { class: 'hint' }, `${rolling ? `Últimas ${WEEKS} semanas, até hoje. ` : ''}Cada quadrado é um dia. Verde cheio: cumpriu tudo o que tinha para o dia. Cinza: não cumpriu. Vazio: nada previsto. Clique num dia para abrir a folha dele.`);

      const list = h('div', { class: 'cn-scope', role: 'group', 'aria-label': 'Recorte do quadro' }, rows.map((r) => {
        const on = scope === r.key;
        const hist = r.events.length ? HB.history({ events: r.events, days, today }) : null;
        const l30 = r.events.length ? HB.last30({ events: r.events, days, today }) : null;
        const p = r.obj ? S.progress(r.obj) : null;
        const meta = [
          p && p.total ? `${p.done} de ${p.total} ações` : null,
          r.events.length ? `${HB.streakText(hist.current, r.events.length > 1)} · ${last30Text(l30.pct)}` : 'sem hábito',
        ].filter(Boolean).join(' · ');
        return h('button', {
          type: 'button', class: `cn-row${on ? ' is-on' : ''}`, 'aria-pressed': String(on), 'data-key': `cn-scope-${domKey(r.key)}`,
          onClick: () => { scope = r.key; keepFocus(draw); },
        },
        h('span', { class: 'cn-row-name' }, r.name),
        p && p.total ? h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: { width: `${p.pct}%` } })) : null,
        h('span', { class: 'cn-row-meta' }, meta));
      }));

      const add = h('button', { type: 'button', class: 'btn small', 'data-key': 'cn-add', onClick: () => addReminder(today) }, '+ Lembrete fixo');
      let main;
      if (!events.length) {
        main = h('div', { class: 'cn-main' },
          empty('Nenhum hábito neste recorte. Crie um lembrete fixo (água, louça, remédio) e marque na folha do dia: cada dia cumprido vira um quadradinho aqui.'), add);
      } else {
        const cells = HB.series({ events, days, from: range.from, to: range.to, today });
        const sum = HB.summary(cells, today);
        const hist = HB.history({ events, days, today });
        const l30 = HB.last30({ events, days, today });
        main = h('div', { class: 'cn-main' },
          h('ul', { class: 'cn-stats' },
            stat(hist.current, 'sequência atual', events.length > 1 ? 'Dias previstos seguidos em que todos os hábitos foram cumpridos por inteiro' : 'Dias previstos seguidos em que o hábito foi cumprido'),
            stat(hist.longest, 'maior sequência'),
            stat(pctText(l30.pct), 'últimos 30 dias'), stat(`${sum.done} de ${sum.total}`, rolling ? `dias cumpridos nas ${WEEKS} semanas` : 'dias cumpridos no ano')),
          heatmap({ cells, weeks: HB.weeksBetween(range.from, range.to, ws), label: rolling ? `Quadro de constância das últimas ${WEEKS} semanas, com rolagem` : `Quadro de constância de ${fixedYear}, com rolagem` }),
          legend(),
          h('p', { class: 'hm-summary' }, monthsLine(sum, rolling ? 'neste período' : 'neste ano')),
          h('ul', { class: 'cn-habits' }, events.map((ev) => {
            const hs = HB.history({ events: [ev], days, today });
            const l = HB.last30({ events: [ev], days, today });
            return h('li', { class: 'cn-habit' },
              h('button', {
                type: 'button', class: 'cn-habit-title', 'data-key': `cn-habit-${ev.id}`,
                onClick: () => (ev.kind === 'lembrete' ? Plan.dialogs.reminder({ id: ev.id, date: D.clamp(today) }) : Plan.dialogs.event({ id: ev.id, date: D.clamp(today) })),
              }, ev.title),
              h('span', { class: 'cn-habit-meta' }, `${R.describe(ev.repeat)} · ${HB.whenText(ev)} · ${HB.goalText(ev)}`),
              h('span', { class: 'cn-habit-stats' }, `${HB.streakText(hs.current, false)} · ${pctText(l.pct)}`),
              // Lembrete fixo não "para de acompanhar": ele se edita ou se exclui na própria janela.
              ev.kind === 'lembrete' ? null : h('button', { type: 'button', class: 'btn small ghost', 'data-key': `cn-stop-${ev.id}`, 'aria-label': `Parar de acompanhar ${ev.title}`, onClick: () => stop(ev) }, 'Parar de acompanhar'));
          })),
          add);
      }
      return [head, hint, h('div', { class: 'cn-body' }, list, main)];
    }

    draw();
    return section;
  }

  /* Miniatura das últimas semanas dos hábitos de um objetivo, para a janela do objetivo. */
  function mini({ events, weeks = 26 }) {
    const st = S.get();
    const today = D.today();
    const ws = st.settings.weekStart;
    const { from, to } = HB.rollingRange(today, weeks, ws);
    const cells = HB.series({ events, days: st.days, from, to, today });
    const hist = HB.history({ events, days: st.days, today });
    const l30 = HB.last30({ events, days: st.days, today });
    return h('div', { class: 'cn-mini' },
      h('p', { class: 'cn-mini-stats' }, `${HB.streakText(hist.current, events.length > 1)} · maior sequência ${hist.longest} · ${last30Text(l30.pct)}`),
      heatmap({ cells, weeks: HB.weeksBetween(from, to, ws), compact: true, label: `Últimas ${weeks} semanas, com rolagem` }),
      legend());
  }

  Plan.constancia = { board, mini };
})(globalThis);
