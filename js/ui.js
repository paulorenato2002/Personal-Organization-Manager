/* Peças de interface. Todo texto do usuário entra por textContent, nunca por innerHTML. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});
  const D = Plan.dates;

  const PROPS = new Set(['checked', 'selected', 'disabled', 'indeterminate', 'open', 'hidden']);

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; }
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') value = v;
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = (kid) => {
      if (kid === null || kid === undefined || kid === false) return;
      if (Array.isArray(kid)) kid.forEach(add);
      else el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    };
    kids.forEach(add);
    if (value !== undefined) el.value = value;
    return el;
  }

  const $ = (sel, scope = document) => scope.querySelector(sel);

  /* ---------- Etiquetas, caixas de marcar, segmentados ---------- */
  function tagChip(tagId) {
    const t = Plan.store.tag(tagId);
    if (!t) return null;
    return h('span', { class: 'tag', style: { '--tag-h': t.hue, '--tag-c': t.chroma } }, h('i', { class: 'tag-dot', 'aria-hidden': 'true' }), t.name);
  }

  function check({ checked, label, key, onChange, className = '' }) {
    const input = h('input', {
      type: 'checkbox', class: 'ck', checked: !!checked, 'aria-label': label, 'data-key': key,
      onChange: (e) => onChange(e.target.checked),
    });
    return h('label', { class: `ck-wrap ${className}`.trim() }, input, h('span', { class: 'ck-box', 'aria-hidden': 'true' }));
  }

  // Engrenagem desenhada à mão (8 dentes e um furo): ícone de função, só para a folha e os ajustes.
  const GEAR = 'M10.07 4.24L10.62 1.69A10.4 10.4 0 0 1 13.38 1.69L13.93 4.24A8 8 0 0 1 16.13 5.15L18.31 3.73A10.4 10.4 0 0 1 20.27 5.69L18.85 7.87A8 8 0 0 1 19.76 10.07L22.31 10.62A10.4 10.4 0 0 1 22.31 13.38L19.76 13.93A8 8 0 0 1 18.85 16.13L20.27 18.31A10.4 10.4 0 0 1 18.31 20.27L16.13 18.85A8 8 0 0 1 13.93 19.76L13.38 22.31A10.4 10.4 0 0 1 10.62 22.31L10.07 19.76A8 8 0 0 1 7.87 18.85L5.69 20.27A10.4 10.4 0 0 1 3.73 18.31L5.15 16.13A8 8 0 0 1 4.24 13.93L1.69 13.38A10.4 10.4 0 0 1 1.69 10.62L4.24 10.07A8 8 0 0 1 5.15 7.87L3.73 5.69A10.4 10.4 0 0 1 5.69 3.73L7.87 5.15A8 8 0 0 1 10.07 4.24ZM15.4 12A3.4 3.4 0 1 0 8.6 12A3.4 3.4 0 1 0 15.4 12Z';
  function gearIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('width', '20');
    el.setAttribute('height', '20');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', GEAR);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    el.append(path);
    return el;
  }

  // key deixa o nome do grupo e os data-key estáveis entre redesenhos (o foco volta ao mesmo botão).
  let segCount = 0;
  function seg({ label, options, value, onChange, key, className = '' }) {
    segCount += 1;
    const name = key || `seg-${segCount}`;
    return h('fieldset', { class: `seg ${className}`.trim() },
      h('legend', {}, label),
      h('div', { class: 'seg-row' }, options.map(([val, text]) => h('label', { class: 'seg-opt' },
        h('input', { type: 'radio', name, checked: val === value, 'data-key': `${name}-${val}`, onChange: () => onChange(val) }),
        h('span', {}, text)))));
  }

  const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);

  const blankLines = (n) => (n > 0
    ? h('div', { class: 'blank-lines', 'aria-hidden': 'true' }, Array.from({ length: n }, () => h('div', { class: 'blank' }, h('span', { class: 'blank-box' }))))
    : null);

  function addForm({ placeholder, label, key, onAdd }) {
    const input = h('input', { type: 'text', name: 'text', class: 'add-input', placeholder, 'aria-label': label, 'data-key': key, autocomplete: 'off' });
    return h('form', {
      class: 'add-row no-print',
      onSubmit: (e) => { e.preventDefault(); const text = input.value; if (text.trim()) { input.value = ''; onAdd(text); } },
    }, input);
  }

  const progressBar = (pct, label) => h('span', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': label }, h('i', { style: { width: `${pct}%` } }));

  const empty = (text) => h('p', { class: 'empty' }, text);

  function navButton(label, glyph, onClick, disabled) {
    return h('button', { type: 'button', class: 'btn icon', 'aria-label': label, title: label, disabled: !!disabled, onClick }, glyph);
  }

  /* Onde estou: Ano › Mês › Semana › Dia. Cada parte leva para aquele nível. */
  function crumbs(items) {
    return h('nav', { class: 'crumbs no-print', 'aria-label': 'Você está em' },
      h('ol', {}, items.map((it) => h('li', {}, it.href
        ? h('a', { href: it.href }, it.label)
        : h('span', { 'aria-current': 'page' }, it.label)))));
  }

  /* Filtro por categoria da Semana e do Mês. Cada botão liga ou desliga uma categoria.
     items: [{ id, name, hue, chroma }]; on(id) diz se a categoria está visível. */
  function chipFilter({ label, items, on, onToggle, onAll, keyPrefix = 'flt', countOff }) {
    const off = countOff ? countOff() : items.filter((it) => !on(it.id)).length;
    return h('div', { class: 'filter-bar no-print', role: 'group', 'aria-label': label },
      h('span', { class: 'filter-label' }, label),
      h('div', { class: 'chips' }, items.map((it) => h('button', {
        type: 'button', class: `chip${on(it.id) ? ' is-on' : ''}`, 'aria-pressed': String(on(it.id)), 'data-key': `${keyPrefix}-${it.id}`,
        style: it.hue === undefined ? null : { '--tag-h': it.hue, '--tag-c': it.chroma }, onClick: () => onToggle(it.id),
      }, h('i', { class: `tag-dot${it.hue === undefined ? ' plain' : ''}`, 'aria-hidden': 'true' }), it.name))),
      h('button', { type: 'button', class: 'btn small ghost', 'data-key': `${keyPrefix}-all`, disabled: off === 0, onClick: onAll }, 'Mostrar todas'));
  }

  /* Caixa "foco" (semana, mês, semestre): lista curta com marcar e adicionar. */
  function focusBox(title, key, hint) {
    const S = Plan.store;
    const list = S.focusList(key);
    return h('section', { class: 'box' },
      h('h2', {}, title),
      hint ? h('p', { class: 'hint' }, hint) : null,
      list.length
        ? h('ul', { class: 'subs' }, list.map((f) => h('li', { class: `sub${f.done ? ' is-done' : ''}` },
          check({ checked: f.done, label: `Concluir: ${f.text}`, key: `fk-${key}-${f.id}`, onChange: (v) => S.setFocus(key, f.id, { done: v }) }),
          h('span', { class: 'sub-text' }, f.text),
          h('button', { type: 'button', class: 'x no-print', 'aria-label': `Remover: ${f.text}`, onClick: () => S.removeFocus(key, f.id) }, '×'))))
        : empty('Nada definido ainda.'),
      addForm({ placeholder: 'Adicionar item', label: `Adicionar em ${title}`, key: `fa-${key}`, onAdd: (text) => S.addFocus(key, text) }),
      blankLines(2));
  }

  /* ---------- Janelas ---------- */
  const modal = {
    open(content, { variant = 'md', label = '' } = {}) {
      const el = document.getElementById('modal');
      el.className = `modal ${variant}`;
      el.setAttribute('aria-label', label);
      el.replaceChildren(content);
      if (!el.open) el.showModal();
      return el;
    },
    close() { const el = document.getElementById('modal'); if (el.open) el.close(); },
    isOpen() { return document.getElementById('modal').open || document.getElementById('confirm').open; },
  };

  // Segunda janela, empilhada sobre a primeira (ex.: marcar uma data a partir dos Ajustes).
  const second = {
    open(content, { variant = 'md', label = '' } = {}) {
      const el = document.getElementById('confirm');
      el.className = `modal ${variant}`;
      el.setAttribute('aria-label', label);
      el.replaceChildren(content);
      if (!el.open) el.showModal();
    },
    close() { const el = document.getElementById('confirm'); if (el.open) el.close(); },
  };

  function dialogShell(title, body, actions, { close } = {}) {
    return h('div', { class: 'modal-body' },
      h('header', { class: 'modal-head' },
        h('h2', {}, title),
        h('button', { type: 'button', class: 'btn icon', 'aria-label': 'Fechar', onClick: () => (close || modal.close)() }, '×')),
      body,
      actions ? h('footer', { class: 'modal-actions' }, actions) : null);
  }

  function confirmBox(message, { title = 'Confirmar', action = 'Confirmar', danger = false } = {}) {
    return new Promise((resolve) => {
      const el = document.getElementById('confirm');
      el.className = 'modal sm';
      const finish = (v) => { if (el.open) el.close(); resolve(v); };
      el.replaceChildren(h('div', { class: 'modal-body' },
        h('h2', {}, title),
        h('p', { class: 'confirm-text' }, message),
        h('div', { class: 'modal-actions' },
          h('button', { type: 'button', class: 'btn', onClick: () => finish(false) }, 'Cancelar'),
          h('button', { type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => finish(true) }, action))));
      el.addEventListener('close', () => resolve(false), { once: true });
      el.showModal();
    });
  }

  function choiceBox(message, choices, { title = 'Escolha' } = {}) {
    return new Promise((resolve) => {
      const el = document.getElementById('confirm');
      el.className = 'modal sm';
      const finish = (v) => { if (el.open) el.close(); resolve(v); };
      el.replaceChildren(h('div', { class: 'modal-body' },
        h('h2', {}, title),
        h('p', { class: 'confirm-text' }, message),
        h('div', { class: 'modal-actions stack' }, choices.map(([value, text, kind]) => h('button', { type: 'button', class: `btn ${kind || ''}`, onClick: () => finish(value) }, text)),
          h('button', { type: 'button', class: 'btn ghost', onClick: () => finish(null) }, 'Cancelar'))));
      el.addEventListener('close', () => resolve(null), { once: true });
      el.showModal();
    });
  }

  function promptBox({ title, label, value = '', action = 'Salvar', placeholder = '' }) {
    return new Promise((resolve) => {
      const el = document.getElementById('confirm');
      el.className = 'modal sm';
      const input = h('input', { type: 'text', class: 'input', value, placeholder, autocomplete: 'off', 'aria-label': label });
      const finish = (v) => { if (el.open) el.close(); resolve(v); };
      el.replaceChildren(h('form', {
        class: 'modal-body',
        onSubmit: (e) => { e.preventDefault(); const t = input.value.trim(); if (t) finish(t); else input.focus(); },
      },
      h('h2', {}, title),
      field(label, input),
      h('div', { class: 'modal-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => finish(null) }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn primary' }, action))));
      el.addEventListener('close', () => resolve(null), { once: true });
      el.showModal();
      input.focus();
      input.select();
    });
  }

  function toast(message, { action, onAction } = {}) {
    const box = document.getElementById('toasts');
    const node = h('div', { class: 'toast' }, h('span', {}, message), action ? h('button', { type: 'button', class: 'link', onClick: () => { onAction(); node.remove(); } }, action) : null);
    box.append(node);
    setTimeout(() => node.remove(), 6000);
  }

  /* Refaz a tela mantendo foco, seleção e rolagem. Os campos precisam de data-key estável. */
  function keepFocus(fn) {
    const a = document.activeElement;
    const key = a && a.dataset ? a.dataset.key : null;
    const sel = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
    const y = window.scrollY;
    fn();
    if (key) {
      const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel && typeof el.setSelectionRange === 'function') { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* tipo sem seleção */ } }
      }
    }
    window.scrollTo(0, y);
  }

  const download = (name, text, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = h('a', { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  Plan.ui = {
    h, $, tagChip, check, seg, field, blankLines, addForm, progressBar, empty, navButton, focusBox, gearIcon, crumbs, chipFilter,
    modal, second, dialogShell, confirmBox, choiceBox, promptBox, toast, keepFocus, download, D,
  };
})(globalThis);
