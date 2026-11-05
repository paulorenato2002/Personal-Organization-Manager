(function (root) {
  const { h, persist } = root.App;
  const views = {};
  const TABS = [['quadro', 'Quadro'], ['hoje', 'Hoje'], ['agenda', 'Agenda'], ['metas', 'Metas'], ['clientes', 'Clientes']];
  const FONTS = {
    Manrope: "'Manrope', 'Segoe UI', sans-serif",
    'Instrument Sans': "'Instrument Sans', 'Segoe UI', sans-serif",
    Fraunces: "'Fraunces', Georgia, serif",
    'Segoe UI': "'Segoe UI', system-ui, sans-serif",
  };

  let store = null;
  let current = 'quadro';
  let sessionId = null;
  let lastDay = null;
  const el = {};

  function onAccent(hex) {
    const value = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#1a1206' : '#ffffff';
  }

  function applySettings(settings) {
    const rootEl = document.documentElement;
    rootEl.dataset.theme = settings.theme;
    rootEl.style.setProperty('--accent', settings.accent);
    rootEl.style.setProperty('--on-accent', onAccent(settings.accent));
    rootEl.style.setProperty('--font', FONTS[settings.font] || FONTS.Manrope);
    rootEl.style.setProperty('--font-scale', `${settings.fontSize}%`);
    if (el.bg && el.bg.dataset.src !== (settings.wallpaper || '')) {
      el.bg.dataset.src = settings.wallpaper || '';
      el.bg.style.backgroundImage = settings.wallpaper ? `url("${settings.wallpaper}")` : '';
    }
    document.body.classList.toggle('has-wallpaper', Boolean(settings.wallpaper));
  }

  function sessions() {
    return [...store.getState().sessions].sort((a, b) => a.order - b.order);
  }

  function currentSession() {
    const list = sessions();
    if (!list.some((s) => s.id === sessionId)) sessionId = list.length ? list[0].id : null;
    return sessionId;
  }

  function setSession(id) {
    sessionId = id;
    try { localStorage.setItem('org-session', id); } catch (error) { /* só preferência */ }
    render();
  }

  // Foto com o símbolo de selo. Sem foto, o símbolo ocupa o lugar dela.
  function avatarContent(profile) {
    if (profile.photo) {
      return [
        h('img', { src: profile.photo, alt: '' }),
        profile.symbol ? h('span', { class: 'avatar-badge' }, profile.symbol) : null,
      ];
    }
    return profile.symbol || ([...(profile.name || '').trim()][0] || '🙂').toUpperCase();
  }

  function closeMenus() {
    document.querySelectorAll('.menu[data-floating]').forEach((m) => m.remove());
  }

  function openMenu(anchor, entries) {
    closeMenus();
    const menu = h('div', { class: 'menu', 'data-floating': '1' },
      entries.map(([label, fn, cls]) => h('button', { class: cls, onClick: () => { closeMenus(); fn(); } }, label)));
    anchor.append(menu);
    setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
  }

  function renderTopbar() {
    el.tabs.replaceChildren(...TABS.map(([name, label]) => h('button', {
      class: `tab${current === name || (current === 'cliente' && name === 'clientes') ? ' on' : ''}`,
      onClick: () => navigate(name),
    }, label)));
    const select = h('select', {
      class: 'session-select',
      'aria-label': 'Sessão',
      onChange: (event) => {
        setSession(event.target.value);
        if (current !== 'quadro') navigate('quadro');
      },
    }, sessions().map((s) => h('option', { value: s.id, selected: s.id === currentSession() }, `${s.icon || ''} ${s.name}`.trim())));
    el.session.replaceChildren(select);
    const { profile } = store.getState();
    const wrap = h('div', { class: 'menu-wrap' });
    const avatar = h('button', {
      class: 'avatar',
      'aria-label': 'Perfil e ajustes',
      onClick: (event) => {
        event.stopPropagation();
        openMenu(wrap, [['Perfil', () => navigate('perfil')], ['Ajustes', () => navigate('ajustes')]]);
      },
    }, avatarContent(profile));
    wrap.append(avatar);
    el.avatar.replaceChildren(wrap);
  }

  function renderStatus(status) {
    if (!el.status) return;
    const cls = status.state === 'error' ? 'error' : status.state === 'saving' ? 'saving' : '';
    const label = status.state === 'error' ? status.message : status.state === 'saving' ? 'Salvando' : 'Salvo';
    const children = [h('span', { class: 'dot' }), label];
    if (status.file === 'needs-permission') {
      children.push(h('button', { class: 'link-btn', onClick: () => persist.reconnectFolder() }, 'Liberar pasta'));
    }
    el.status.className = `status ${cls}`;
    el.status.replaceChildren(...children);
  }

  // Redesenhar no meio de um clique apagaria o botão antes de o clique terminar.
  let pointerDown = false;
  const afterPointer = [];
  function whenPointerUp(fn) {
    if (!pointerDown) { fn(); return; }
    if (!afterPointer.includes(fn)) afterPointer.push(fn);
  }
  document.addEventListener('mousedown', () => { pointerDown = true; }, true);
  document.addEventListener('mouseup', () => {
    pointerDown = false;
    setTimeout(() => {
      if (pointerDown) return;
      afterPointer.splice(0).forEach((fn) => fn());
    }, 0);
  }, true);

  function render() {
    whenPointerUp(renderNow);
  }

  function renderNow() {
    if (!store) return;
    applySettings(store.getState().settings);
    renderTopbar();
    const active = document.activeElement;
    const key = active && active.dataset ? active.dataset.key : null;
    const start = key && 'selectionStart' in active ? active.selectionStart : null;
    const value = key ? active.value : null;
    const y = window.scrollY;
    const view = views[current];
    el.main.replaceChildren();
    if (view) view.render(el.main, store);
    window.scrollTo(0, y);
    if (key) {
      const again = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (again) {
        if (value !== null && again.value !== undefined && again.dataset.keepValue !== undefined) again.value = value;
        again.focus();
        if (start !== null && typeof again.setSelectionRange === 'function') {
          try { again.setSelectionRange(start, start); } catch (error) { /* tipos sem seleção */ }
        }
      }
    }
  }

  function register(name, view) {
    views[name] = view;
  }

  function navigate(name) {
    current = name;
    if (name !== 'busca' && el.search) el.search.value = '';
    window.scrollTo(0, 0);
    render();
  }

  function toast(message, { undo } = {}) {
    const node = h('div', { class: 'toast', role: 'status' }, message);
    const timer = setTimeout(() => node.remove(), undo ? 6000 : 3500);
    if (undo) {
      node.append(h('button', {
        class: 'link-btn',
        onClick: () => {
          clearTimeout(timer);
          node.remove();
          if (undo() === false) toast('Não dá mais para desfazer: houve outra mudança depois.');
        },
      }, 'Desfazer'));
    }
    el.toasts.append(node);
  }

  function checkDay() {
    if (!store) return;
    const day = store.today();
    if (day !== lastDay) {
      lastDay = day;
      render();
    }
  }

  function start(storeInstance) {
    store = storeInstance;
    lastDay = store.today();
    try { sessionId = localStorage.getItem('org-session'); } catch (error) { sessionId = null; }
    el.tabs = h('div', { style: { display: 'contents' } });
    el.session = h('div', { style: { display: 'contents' } });
    el.search = h('input', {
      class: 'search', type: 'search', placeholder: 'Buscar demanda ou cliente', 'aria-label': 'Buscar',
      onInput: (event) => root.App.search.setQuery(event.target.value),
    });
    el.status = h('div', { class: 'status' });
    el.avatar = h('div', { style: { display: 'contents' } });
    el.main = h('main', {});
    el.toasts = h('div', { class: 'toast-host' });
    const app = document.getElementById('app');
    app.replaceChildren(
      h('div', { class: 'page' },
        h('header', { class: 'topbar' }, el.tabs, el.session, h('div', { class: 'spacer' }), el.search, el.status, el.avatar),
        el.main),
      el.toasts
    );
    store.subscribe(render);
    persist.onStatus(renderStatus);
    window.addEventListener('focus', checkDay);
    document.addEventListener('visibilitychange', checkDay);
    setInterval(checkDay, 60000);
    render();
  }

  function initBackground() {
    el.bg = h('div', { class: 'bg' });
    document.body.prepend(el.bg, h('div', { class: 'scrim' }));
  }

  root.App.shell = {
    register, navigate, currentSession, setSession, toast, applySettings, start, render, initBackground,
    openMenu, current: () => current, checkDay, whenPointerUp, avatarContent,
  };
})(globalThis);
