(function (root) {
  const { h, persist } = root.App;

  // Resolve com { start, name }, ou com { loaded } se a pessoa escolher uma pasta que já tem dados.
  function show(container) {
    return new Promise((resolve) => {
      let start = 'exemplo';
      const nameInput = h('input', { type: 'text', placeholder: 'Como quer ser chamado?', 'aria-label': 'Nome' });
      const choices = [
        ['exemplo', 'Com o modelo pronto', 'Setores, tarefas e metas de exemplo para você adaptar ou apagar.'],
        ['vazio', 'Vazio', 'Cada sessão começa só com um setor Geral. Você cria o resto.'],
      ];
      const buttons = choices.map(([value, title, text]) => h('button', {
        type: 'button',
        class: `choice${value === start ? ' on' : ''}`,
        'data-start': value,
        onClick: () => {
          start = value;
          buttons.forEach((b) => b.classList.toggle('on', b.dataset.start === value));
        },
      }, h('b', {}, title), h('small', {}, text)));

      const folderNote = h('p', { class: 'hint' }, 'Escolha onde guardar uma cópia de tudo, em um arquivo no seu computador. Serve de backup e para levar seus dados a outro PC.');
      const folder = persist.isFileSyncAvailable() ? h('div', { class: 'field' },
        h('span', {}, 'Pasta dos seus dados'),
        h('button', {
          type: 'button',
          class: 'btn',
          onClick: async () => {
            const result = await persist.chooseFolder({ onExisting: root.App.ui.dialog.folderChoice });
            if (result.loaded) { resolve({ loaded: result.loaded }); return; }
            if (result.ok) folderNote.textContent = 'Pasta escolhida. Seus dados vão ser copiados para ela.';
          },
        }, 'Escolher pasta'),
        ' ',
        folderNote) : null;

      container.replaceChildren(h('div', { class: 'welcome' }, h('div', { class: 'box welcome-card' },
        h('h1', {}, 'Bem-vindo'),
        h('p', {}, 'Seus dados ficam só neste computador. Dá para mudar tudo depois.'),
        h('label', { class: 'field' }, h('span', {}, 'Nome (opcional)'), nameInput),
        h('div', { class: 'field' }, h('span', {}, 'Como começar'), buttons),
        folder,
        h('div', { class: 'actions' }, h('button', {
          class: 'btn primary',
          'data-action': 'comecar',
          onClick: () => resolve({ start, name: nameInput.value.trim() }),
        }, 'Começar')))));
    });
  }

  root.App.onboarding = { show };
})(globalThis);
