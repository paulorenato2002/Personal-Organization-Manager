/* Tema: claro, escuro ou automático, cor de destaque, fonte e tamanho. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});

  const FONT_STACKS = {
    Manrope: "'Manrope', 'Segoe UI', system-ui, sans-serif",
    'Instrument Sans': "'Instrument Sans', 'Segoe UI', system-ui, sans-serif",
    Fraunces: "'Fraunces', Georgia, serif",
    Georgia: "Georgia, 'Times New Roman', serif",
    Sistema: "system-ui, 'Segoe UI', sans-serif",
  };
  const ACCENTS = [
    ['#c93a16', 'Vermelho tinta'], ['#1d6b86', 'Azul petróleo'], ['#2f7a4a', 'Verde pinheiro'],
    ['#a35c00', 'Âmbar queimado'], ['#8a3a7a', 'Ameixa'], ['#33363d', 'Grafite'],
  ];

  const toRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const lum = (hex) => {
    const [r, g, b] = toRgb(hex).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const mix = (hex, target, t) => { const a = toRgb(hex); const b = toRgb(target); return toHex(a.map((v, i) => v + (b[i] - v) * t)); };

  // Aproxima a cor de preto (tema claro) ou de branco (tema escuro) até o texto ficar legível em todos os fundos.
  function readableText(color, backgrounds, min, towards) {
    let out = color;
    for (let t = 0; t <= 1.0001 && !backgrounds.every((bg) => contrast(out, bg) >= min); t += 0.05) out = mix(color, towards, t);
    return out;
  }

  const prefersDark = () => root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches;

  function apply(settings) {
    const el = document.documentElement;
    const dark = settings.theme === 'dark' || (settings.theme === 'auto' && prefersDark());
    el.dataset.theme = dark ? 'dark' : 'light';
    el.style.setProperty('--font', FONT_STACKS[settings.font] || FONT_STACKS.Manrope);
    // Direto no <html>: trocar só uma variável CSS deixava o tamanho calculado da raiz defasado.
    el.style.fontSize = `${settings.size}%`;
    const accent = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : '#c93a16';
    const css = getComputedStyle(el);
    const paper = css.getPropertyValue('--paper').trim();
    const desk = css.getPropertyValue('--desk').trim();
    el.style.setProperty('--accent', accent);
    el.style.setProperty('--on-accent', contrast(accent, '#ffffff') >= contrast(accent, '#111111') ? '#ffffff' : '#111111');
    el.style.setProperty('--accent-text', readableText(accent, [paper, desk], 5.4, dark ? '#ffffff' : '#000000'));
  }

  Plan.theme = { FONT_STACKS, ACCENTS, apply, contrast };
})(globalThis);
