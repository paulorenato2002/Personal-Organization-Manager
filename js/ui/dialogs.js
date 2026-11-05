(function (root) {
  const { h } = root.App;

  function open(build) {
    return new Promise((resolve) => {
      const previous = document.activeElement;
      let wrap;
      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        wrap.remove();
        if (previous && previous.isConnected) previous.focus();
        resolve(result);
      }
      function onKey(event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close(null);
        }
      }
      wrap = h('div', {
        class: 'dialog-wrap',
        onMousedown: (event) => { if (event.target === wrap) close(null); },
      }, h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, build(close)));
      document.addEventListener('keydown', onKey, true);
      document.body.append(wrap);
      const first = wrap.querySelector('input:not([type=hidden]), select, textarea, button.primary');
      if (first) first.focus();
    });
  }

  function confirm(message, { title = 'Confirmar', action = 'Confirmar', danger = false } = {}) {
    return open((close) => [
      h('h2', {}, title),
      h('p', {}, message),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onClick: () => close(false) }, 'Cancelar'),
        h('button', { class: `btn primary${danger ? ' danger-solid' : ''}`, onClick: () => close(true) }, action)),
    ]).then(Boolean);
  }

  // fields: [{ name, label, type: 'text'|'number'|'select'|'textarea', value, options: [[valor, rótulo]], visibleIf(values), min, max, placeholder }]
  function form({ title, fields, submit = 'Salvar', extra }) {
    return open((close) => {
      const controls = {};
      const values = () => Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, c.control.value]));
      function refresh() {
        const current = values();
        fields.forEach((f) => {
          if (f.visibleIf) controls[f.name].wrap.hidden = !f.visibleIf(current);
        });
      }
      const nodes = fields.map((f) => {
        let control;
        if (f.type === 'select') {
          control = h('select', { onChange: refresh }, f.options.map(([v, label]) => h('option', { value: v, selected: String(f.value) === String(v) }, label)));
        } else if (f.type === 'textarea') {
          control = h('textarea', { placeholder: f.placeholder }, f.value || '');
        } else {
          control = h('input', { type: f.type || 'text', value: f.value === undefined ? '' : f.value, min: f.min, max: f.max, placeholder: f.placeholder });
        }
        const wrap = h('label', { class: 'field' }, h('span', {}, f.label), control);
        controls[f.name] = { control, wrap };
        return wrap;
      });
      refresh();
      return h('form', {
        onSubmit: (event) => {
          event.preventDefault();
          close(values());
        },
      },
      h('h2', {}, title),
      nodes,
      h('div', { class: 'actions' },
        extra ? extra(close) : null,
        h('button', { type: 'button', class: 'btn', onClick: () => close(null) }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary' }, submit)));
    });
  }

  function prompt(title, value = '', { label = 'Nome', submit = 'Salvar' } = {}) {
    return form({ title, submit, fields: [{ name: 'v', label, value }] }).then((r) => {
      if (!r) return null;
      const clean = r.v.trim();
      return clean || null;
    });
  }

  // Pasta escolhida já tem dados: usar os dela ou gravar os atuais por cima.
  function folderChoice(existing) {
    const when = existing.savedAt ? new Date(existing.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
    return open((close) => [
      h('h2', {}, 'Essa pasta já tem dados'),
      h('p', {}, when ? `Encontrei dados salvos em ${when}. O que você quer fazer?` : 'Encontrei dados salvos nessa pasta. O que você quer fazer?'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onClick: () => close(null) }, 'Cancelar'),
        h('button', { class: 'btn danger', 'data-action': 'substituir', onClick: () => close('replace') }, 'Substituir pelos atuais'),
        h('button', { class: 'btn primary', 'data-action': 'carregar', onClick: () => close('load') }, 'Usar os dados da pasta')),
    ]);
  }

  root.App.ui.dialog = { open, confirm, form, prompt, folderChoice };
})(globalThis);
