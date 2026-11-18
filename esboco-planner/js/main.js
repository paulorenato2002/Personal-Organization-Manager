/* Rotas por hash, tema, avisos, atalhos e inicialização. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const { h, keepFocus } = Plan.ui;
  const D = Plan.dates;
  const S = Plan.store;
  const Y_MIN = Number(D.MIN.slice(0, 4));
  const Y_MAX = Number(D.MAX.slice(0, 4));
  let cursor = D.clamp(D.today());
  let dismissedCorrupt = false;

  const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parse() {
    const [view, a, b] = location.hash.replace(/^#\/?/, '').split('/');
    const today = D.clamp(D.today());
    if (view === 'dia' || view === 'semana') return { view, date: D.isDate(a) ? D.clamp(a) : today };
    if (view === 'mes') {
      const ok = /^\d{4}-\d{2}$/.test(a || '') && D.isDate(`${a}-01`);
      const key = ok ? D.monthKey(D.clamp(`${a}-01`)) : D.monthKey(today);
      return { view, key: key > D.MAX.slice(0, 7) ? D.MAX.slice(0, 7) : key };
    }
    if (view === 'ano') {
      const y = Number(a);
      return { view, year: y >= Y_MIN && y <= Y_MAX ? y : Number(today.slice(0, 4)), sem: b === '1' ? 1 : b === '2' ? 2 : 0 };
    }
    if (view === 'objetivos') return { view };
    return null;
  }

  function nextCursor(route) {
    const today = D.today();
    if (route.view === 'dia' || route.view === 'semana') return route.date;
    if (route.view === 'mes') return today.startsWith(route.key) ? today : `${route.key}-01`;
    if (route.view === 'ano') {
      if (cursor.startsWith(String(route.year))) return cursor;
      if (today.startsWith(String(route.year))) return today;
      const guess = `${route.year}-${cursor.slice(5)}`;
      return D.isDate(guess) ? guess : `${route.year}-01-01`;
    }
    return cursor;
  }

  const router = {
    cursor: () => cursor,
    go(view, a, b) {
      let target;
      if (view === 'dia' || view === 'semana') target = `#/${view}/${D.clamp(a)}`;
      else if (view === 'mes') {
        const key = String(a).slice(0, 7);
        target = `#/mes/${key < D.MIN.slice(0, 7) ? D.MIN.slice(0, 7) : key > D.MAX.slice(0, 7) ? D.MAX.slice(0, 7) : key}`;
      } else if (view === 'ano') target = `#/ano/${Math.min(Y_MAX, Math.max(Y_MIN, Number(a)))}${b ? `/${b}` : ''}`;
      else target = '#/objetivos';
      if (location.hash === target) render({ transition: false });
      else location.hash = target;
    },
    step(direction) {
      const route = parse() || { view: 'dia', date: cursor };
      if (route.view === 'dia') router.go('dia', D.addDays(route.date, direction));
      else if (route.view === 'semana') router.go('semana', D.addDays(route.date, 7 * direction));
      else if (route.view === 'mes') { const [y, m] = D.parts(`${route.key}-01`); const [ny, nm] = D.addMonthsYM(y, m, direction); router.go('mes', `${ny}-${D.pad(nm)}`); }
      else if (route.view === 'ano') router.go('ano', route.year + direction, route.sem);
    },
  };
  Plan.router = router;

  function titleOf(route) {
    const ws = S.get().settings.weekStart;
    if (route.view === 'dia') return D.fmt.long(route.date);
    if (route.view === 'semana') return `Semana ${D.weekNumber(route.date, ws)}, ${D.fmt.range(D.startOfWeek(route.date, ws), D.addDays(D.startOfWeek(route.date, ws), 6))}`;
    if (route.view === 'mes') return D.cap(D.fmt.monthYear(`${route.key}-01`));
    if (route.view === 'ano') return `Ano ${route.year}`;
    return 'Objetivos';
  }

  function updateTabs(route) {
    const hrefs = {
      dia: `#/dia/${cursor}`, semana: `#/semana/${cursor}`, mes: `#/mes/${cursor.slice(0, 7)}`, ano: `#/ano/${cursor.slice(0, 4)}`, objetivos: '#/objetivos',
    };
    document.querySelectorAll('#tabs a[data-view]').forEach((a) => {
      a.setAttribute('href', hrefs[a.dataset.view]);
      if (a.dataset.view === route.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function draw(route) {
    const main = document.getElementById('main');
    cursor = nextCursor(route);
    main.replaceChildren(Plan.views[route.view].render(route));
    document.body.dataset.view = route.view;
    updateTabs(route);
    document.title = `${titleOf(route)} · Caderno`;
  }

  function render({ transition = false } = {}) {
    let route = parse();
    if (!route) {
      const today = D.clamp(D.today());
      history.replaceState(null, '', `#/dia/${today}`);
      route = { view: 'dia', date: today };
    }
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
    if (transition && document.startViewTransition && !reduced()) {
      window.scrollTo(0, 0);
      document.startViewTransition(() => draw(route));
    } else draw(route);
  }

  // Rodapé: onde ficam os dados e quando foi a última cópia, com atalho para baixar.
  function renderFooter() {
    const note = document.getElementById('footer-note');
    if (!note) return;
    note.replaceChildren(
      'Seus dados ficam só neste navegador. ', S.backupLabel(), ' ',
      h('button', { type: 'button', class: 'link-btn', 'data-key': 'footer-backup', onClick: () => { Plan.ui.download(`caderno-${D.today()}.json`, S.backupJSON()); Plan.ui.toast('Cópia baixada.'); } }, 'Baixar uma cópia'));
  }

  function renderBanner() {
    const box = document.getElementById('banner');
    const status = S.status();
    if (status === 'ok' || (status === 'corrupt' && dismissedCorrupt)) { box.replaceChildren(); return; }
    if (status === 'memory') {
      box.replaceChildren(h('div', { class: 'banner', role: 'alert' },
        h('p', {}, 'Este navegador não deixou salvar. O que você fizer vale só até fechar a aba.'),
        h('button', { type: 'button', class: 'btn small', onClick: () => Plan.ui.download(`caderno-${D.today()}.json`, S.backupJSON()) }, 'Baixar uma cópia')));
      return;
    }
    box.replaceChildren(h('div', { class: 'banner', role: 'alert' },
      h('p', {}, 'Os dados salvos estavam ilegíveis, então abri o exemplo. O arquivo ilegível ficou guardado.'),
      h('div', { class: 'btn-row' },
        S.rawBad() ? h('button', { type: 'button', class: 'btn small', onClick: () => Plan.ui.download('caderno-ilegivel.txt', S.rawBad(), 'text/plain') }, 'Baixar o arquivo ilegível') : null,
        h('button', { type: 'button', class: 'btn small', onClick: () => { dismissedCorrupt = true; renderBanner(); } }, 'Entendi'))));
  }

  function setupDialogs() {
    ['modal', 'confirm'].forEach((id) => {
      const el = document.getElementById(id);
      let down = null;
      el.addEventListener('pointerdown', (e) => { down = e.target; });
      el.addEventListener('click', (e) => { if (down === el && e.target === el) el.close(); });
      el.addEventListener('close', () => el.replaceChildren());
    });
  }

  function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
      if (Plan.ui.modal.isOpen()) return;
      if (t && t.closest && t.closest('table.mini, table.month') && e.key.startsWith('Arrow')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); router.step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); router.step(1); }
      else if (e.key === 't' || e.key === 'T') { const route = parse() || { view: 'dia' }; router.go(route.view === 'objetivos' ? 'dia' : route.view, route.view === 'ano' ? Number(D.today().slice(0, 4)) : D.today()); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); Plan.dialogs.event({ date: cursor }); }
      else if (e.key === 'p' || e.key === 'P') { window.print(); }
    });
  }

  function boot() {
    S.load();
    Plan.theme.apply(S.get().settings);
    setupDialogs();
    setupShortcuts();
    document.getElementById('open-settings').addEventListener('click', () => Plan.dialogs.settings());
    root.addEventListener('hashchange', () => render({ transition: true }));
    S.subscribe((info) => {
      Plan.theme.apply(S.get().settings);
      renderBanner();
      renderFooter();
      if (!info.statusOnly) keepFocus(() => render({ transition: false }));
    });
    if (root.matchMedia) root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.get().settings.theme === 'auto') Plan.theme.apply(S.get().settings); });
    renderBanner();
    renderFooter();
    render();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(globalThis);
