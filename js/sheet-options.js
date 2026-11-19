/* Controles da folha impressa. Os mesmos aparecem na engrenagem do Dia e na aba "Dia e folha" dos Ajustes,
   e os dois gravam no mesmo lugar (settings.print). O scope mantém os data-key distintos quando os dois estão na tela. */
(function (root) {
  'use strict';
  const Plan = (root.Plan = root.Plan || {});

  function controls(scope) {
    const { h, seg, field } = Plan.ui;
    const S = Plan.store;
    const p = S.get().settings.print;
    const set = (patch) => S.setPrint(patch);
    return [
      seg({ label: 'Papel', key: `${scope}-ruling`, value: p.ruling, options: [['lines', 'Pautado'], ['dots', 'Pontilhado'], ['blank', 'Branco']], onChange: (v) => set({ ruling: v }) }),
      seg({ label: 'Espaço entre linhas', key: `${scope}-spacing`, value: p.spacing, options: [['compact', 'Curto'], ['normal', 'Médio'], ['wide', 'Largo']], onChange: (v) => set({ spacing: v }) }),
      seg({ label: 'Anotações', key: `${scope}-notes`, value: p.notes, options: [['side', 'Ao lado'], ['below', 'Embaixo'], ['none', 'Sem']], onChange: (v) => set({ notes: v }) }),
      seg({ label: 'Tamanho da letra', key: `${scope}-size`, value: p.size, options: [['s', 'Pequena'], ['m', 'Média'], ['l', 'Grande']], onChange: (v) => set({ size: v }) }),
      field('Linhas em branco por bloco', h('input', {
        type: 'number', class: 'input narrow', min: 0, max: 6, value: p.extra, 'data-key': `${scope}-extra`,
        onChange: (e) => set({ extra: Math.max(0, Math.min(6, Number(e.target.value) || 0)) }),
      })),
      h('label', { class: 'switch' },
        h('input', { type: 'checkbox', checked: p.mono, 'data-key': `${scope}-mono`, onChange: (e) => set({ mono: e.target.checked }) }),
        h('span', {}, 'Imprimir em preto e branco')),
    ];
  }

  Plan.sheetOptions = { controls };
})(globalThis);
