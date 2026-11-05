(function (root) {
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'class') el.className = value;
      else if (key === 'style' && typeof value === 'object') Object.entries(value).forEach(([p, v]) => el.style.setProperty(p, v));
      else if (key === 'value') el.value = value;
      else if (key === 'checked' || key === 'selected' || key === 'disabled') el[key] = Boolean(value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  // Formatos de data em pt-BR. Sempre a partir do dia local.
  const { fromISO, addDays } = root.App.dates;
  const intl = (opts) => new Intl.DateTimeFormat('pt-BR', opts);
  const fmtLong = intl({ weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = intl({ day: '2-digit', month: '2-digit' });
  const fmtDow = intl({ weekday: 'short' });
  const fmtMonth = intl({ month: 'long', year: 'numeric' });
  const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  const fmt = {
    long: (iso) => fmtLong.format(fromISO(iso)),
    short: (iso) => fmtShort.format(fromISO(iso)),
    dow: (iso) => fmtDow.format(fromISO(iso)).replace('.', ''),
    month: (iso) => fmtMonth.format(fromISO(iso)),
    cap: (text) => text.charAt(0).toUpperCase() + text.slice(1),
    WEEKDAYS,
    WEEKDAYS_SHORT,
    relative(iso, today) {
      if (iso === today) return 'hoje';
      if (iso === addDays(today, 1)) return 'amanhã';
      if (iso === addDays(today, -1)) return 'ontem';
      return fmt.short(iso);
    },
    freq(freq) {
      if (freq.type === 'daily') return 'diária';
      if (freq.type === 'weekly') return `toda ${WEEKDAYS_SHORT[freq.weekday]}`;
      return `todo dia ${freq.day}`;
    },
  };

  root.App.h = h;
  root.App.fmt = fmt;
  root.App.ui = root.App.ui || {};
})(globalThis);
