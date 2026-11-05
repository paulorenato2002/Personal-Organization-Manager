(function (root) {
  const { h, fmt, shell, ui, images, persist } = root.App;
  const ACCENTS = ['#f2b872', '#70d8cd', '#a0b4ff', '#f28b82', '#c3e88d', '#e6a4e8'];
  const FONTS = ['Manrope', 'Instrument Sans', 'Fraunces', 'Segoe UI'];
  const PAGE = 30;
  const ACTIONS = { created: 'Criada', done: 'Concluída', moved: 'Data alterada', deleted: 'Excluída' };
  let fileStatus = 'off';
  let folderName = null;
  let logLimit = PAGE;

  function imagePicker(label, maxPx, onPick) {
    return h('label', { class: 'btn small file-btn' }, label, h('input', {
      type: 'file',
      accept: 'image/*',
      onChange: async (e) => {
        const [file] = e.target.files;
        if (!file) return;
        try {
          onPick(await images.resize(file, maxPx));
        } catch (error) {
          shell.toast(error.message);
        }
      },
    }));
  }

  function appearance(store) {
    const { settings } = store.getState();
    const preview = (e) => document.documentElement.style.setProperty('--font-scale', `${e.target.value}%`);
    return h('section', { class: 'box', 'data-section': 'aparencia' },
      h('div', { class: 'box-head' }, 'Aparência'),
      h('div', { class: 'field' },
        h('span', {}, 'Tema'),
        h('div', { class: 'seg', style: { 'margin-bottom': '0' } }, [['dark', 'Escuro'], ['light', 'Claro']].map(([value, label]) => h('button', {
          class: settings.theme === value ? 'on' : '',
          'data-theme-btn': value,
          onClick: () => store.setSettings({ theme: value }),
        }, label)))),
      h('div', { class: 'field' },
        h('span', {}, 'Cor de destaque'),
        h('div', { class: 'swatches' },
          ACCENTS.map((color) => h('button', {
            class: `swatch${settings.accent === color ? ' on' : ''}`,
            style: { background: color },
            'aria-label': `Cor ${color}`,
            onClick: () => store.setSettings({ accent: color }),
          })),
          h('input', {
            type: 'color',
            'aria-label': 'Outra cor',
            'data-key': 's-accent',
            value: settings.accent,
            onChange: (e) => store.setSettings({ accent: e.target.value }),
          }))),
      h('div', { class: 'row' },
        h('label', { class: 'field' }, h('span', {}, 'Letra'), h('select', {
          'data-key': 's-font',
          onChange: (e) => store.setSettings({ font: e.target.value }),
        }, FONTS.map((f) => h('option', { value: f, selected: settings.font === f }, f)))),
        h('label', { class: 'field' }, h('span', {}, `Tamanho da letra: ${settings.fontSize}%`), h('input', {
          type: 'range',
          min: '85',
          max: '130',
          step: '5',
          'data-key': 's-size',
          value: settings.fontSize,
          style: { width: '100%' },
          onInput: preview,
          onChange: (e) => store.setSettings({ fontSize: Number(e.target.value) }),
        }))),
      h('div', { class: 'field' },
        h('span', {}, 'Papel de parede'),
        h('div', { class: 'swatches' },
          settings.wallpaper ? h('div', { class: 'thumb', style: { 'background-image': `url("${settings.wallpaper}")` } }) : null,
          imagePicker('Escolher imagem', images.SIZES.wallpaper, (wallpaper) => store.setSettings({ wallpaper })),
          settings.wallpaper ? h('button', { class: 'btn small', onClick: () => store.setSettings({ wallpaper: null }) }, 'Remover') : null)));
  }

  function iconButton(entity, update) {
    return h('button', {
      class: 'icon-btn',
      style: { opacity: '1', 'font-size': '1.1rem' },
      'aria-label': `Trocar ícone de ${entity.name}`,
      onClick: async () => {
        const icon = await ui.pickEmoji(entity.icon);
        if (icon) update({ icon });
      },
    }, entity.icon || '📌');
  }

  function entityRow(entity, { update, remove, moveUp, moveDown, kind }) {
    return h('div', { class: 'settings-row', 'data-entity': entity.name },
      iconButton(entity, update),
      h('div', { class: 'grow' }, h('input', {
        type: 'text',
        'aria-label': `Nome de ${entity.name}`,
        'data-key': `s-name-${entity.id}`,
        value: entity.name,
        onChange: (e) => { const name = e.target.value.trim(); if (name) update({ name }); },
      })),
      entity.cover ? h('div', { class: 'thumb', style: { 'background-image': `url("${entity.cover}")` } }) : null,
      imagePicker(entity.cover ? 'Trocar foto' : 'Foto', images.SIZES.cover, (cover) => update({ cover })),
      entity.cover ? h('button', { class: 'btn small', onClick: () => update({ cover: null }) }, 'Tirar') : null,
      moveUp ? h('button', { class: 'icon-btn', 'aria-label': 'Mover para cima', onClick: moveUp }, '↑') : null,
      moveDown ? h('button', { class: 'icon-btn', 'aria-label': 'Mover para baixo', onClick: moveDown }, '↓') : null,
      h('button', { class: 'btn small danger', 'data-act': `excluir-${kind}`, onClick: remove }, 'Excluir'));
  }

  function sessionsAndSectors(store) {
    const state = store.getState();
    const sessions = [...state.sessions].sort((a, b) => a.order - b.order);
    return h('section', { class: 'box', 'data-section': 'sessoes' },
      h('div', { class: 'box-head' }, 'Sessões e setores'),
      sessions.map((session, sIndex) => {
        const sectors = state.sectors.filter((s) => s.sessionId === session.id).sort((a, b) => a.order - b.order);
        return h('div', { style: { 'margin-bottom': '14px' } },
          entityRow(session, {
            kind: 'sessao',
            update: (patch) => store.updateSession(session.id, patch),
            moveUp: sIndex > 0 ? () => store.reorder('sessions', session.id, sIndex - 1) : null,
            moveDown: sIndex < sessions.length - 1 ? () => store.reorder('sessions', session.id, sIndex + 1) : null,
            remove: async () => {
              if (sessions.length === 1) { shell.toast('O app precisa de ao menos uma sessão.'); return; }
              const ok = await ui.dialog.confirm(
                `Excluir a sessão "${session.name}" e os setores dela? Rotinas e compromissos saem, e as pontuais ficam só no Histórico.`,
                { title: 'Excluir sessão', action: 'Excluir', danger: true }
              );
              if (!ok) return;
              store.deleteSession(session.id);
              shell.toast(`Sessão "${session.name}" excluída`, { undo: () => store.undo() });
            },
          }),
          h('div', { style: { 'padding-left': '26px' } },
            sectors.map((sector, index) => entityRow(sector, {
              kind: 'setor',
              update: (patch) => store.updateSector(sector.id, patch),
              moveUp: index > 0 ? () => store.reorder('sectors', sector.id, index - 1) : null,
              moveDown: index < sectors.length - 1 ? () => store.reorder('sectors', sector.id, index + 1) : null,
              remove: async () => {
                const count = state.items.filter((i) => i.sectorId === sector.id && !i.deletedAt && !i.doneAt).length;
                if (count) {
                  const ok = await ui.dialog.confirm(
                    `O setor "${sector.name}" tem ${count} ${count === 1 ? 'demanda' : 'demandas'}. Rotinas e compromissos saem, e as pontuais ficam só no Histórico.`,
                    { title: 'Excluir setor', action: 'Excluir', danger: true }
                  );
                  if (!ok) return;
                }
                store.deleteSector(sector.id);
                shell.toast(`Setor "${sector.name}" excluído`, { undo: () => store.undo() });
              },
            })),
            h('button', {
              class: 'btn small',
              style: { 'margin-top': '6px' },
              onClick: async () => {
                const name = await ui.dialog.prompt('Novo setor', '');
                if (name) store.addSector(session.id, name);
              },
            }, '+ Setor')));
      }),
      h('button', {
        class: 'btn',
        'data-action': 'nova-sessao',
        onClick: async () => {
          const name = await ui.dialog.prompt('Nova sessão', '');
          if (name) store.addSession(name);
        },
      }, '+ Nova sessão'));
  }

  function clients(store) {
    const { items } = store.getState();
    const list = [...store.getState().clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return h('section', { class: 'box', 'data-section': 'clientes' },
      h('div', { class: 'box-head' },
        h('span', {}, 'Clientes'),
        h('button', {
          class: 'btn small',
          style: { 'margin-left': 'auto' },
          'data-action': 'novo-cliente',
          onClick: async () => {
            const name = await ui.dialog.prompt('Novo cliente', '');
            if (name && !store.addClient(name)) shell.toast('Já existe um cliente com esse nome.');
          },
        }, '+ Cliente')),
      list.length ? list.map((client) => h('div', { class: 'settings-row' },
        h('input', {
          type: 'color',
          'aria-label': `Cor de ${client.name}`,
          'data-key': `s-color-${client.id}`,
          value: client.color,
          onChange: (e) => store.updateClient(client.id, { color: e.target.value }),
        }),
        h('div', { class: 'grow' }, h('input', {
          type: 'text',
          'aria-label': `Nome de ${client.name}`,
          'data-key': `s-client-${client.id}`,
          value: client.name,
          onChange: (e) => {
            if (!store.updateClient(client.id, { name: e.target.value })) {
              shell.toast('Já existe um cliente com esse nome.');
              shell.render();
            }
          },
        })),
        h('button', { class: 'btn small', 'data-act': 'abrir-cliente', onClick: () => root.App.clients.open(client.id) }, 'Abrir'),
        h('button', {
          class: 'btn small danger',
          'data-act': 'excluir-cliente',
          onClick: async () => {
            const count = items.filter((i) => i.clientId === client.id && !i.deletedAt).length;
            const message = count
              ? `Excluir "${client.name}"? ${count} ${count === 1 ? 'demanda fica' : 'demandas ficam'} sem cliente, sem perder nada.`
              : `Excluir "${client.name}"?`;
            const ok = await ui.dialog.confirm(message, { title: 'Excluir cliente', action: 'Excluir', danger: true });
            if (ok) store.deleteClient(client.id);
          },
        }, 'Excluir'))) : h('p', { class: 'hint' }, 'Adicione aqui, ou escreva "CLIENTE - demanda" no Quadro que o cliente é criado sozinho.'));
  }

  function dataSection(store) {
    const fileLabel = {
      on: `Salvando em: ${folderName}`,
      'needs-permission': `Pasta ${folderName}: precisa de um clique para liberar.`,
      off: 'Nenhuma pasta escolhida.',
    }[fileStatus];
    const chooseFolder = async () => {
      const result = await persist.chooseFolder({ onExisting: ui.dialog.folderChoice });
      if (result.loaded) {
        store.replaceState(root.App.seed.migrate(result.loaded));
        shell.toast('Dados da pasta carregados.');
      }
    };
    return h('section', { class: 'box', 'data-section': 'dados' },
      h('div', { class: 'box-head' }, 'Dados'),
      persist.isFileSyncAvailable()
        ? h('div', { class: 'settings-row', style: { 'border-top': '0' } },
          h('div', { class: 'grow' },
            h('b', {}, 'Pasta dos seus dados'),
            h('div', { class: 'hint' }, 'Guarda uma cópia de tudo no arquivo organizador-dados.json, na pasta que você escolher. Atualiza sozinha a cada mudança, serve de backup e leva seus dados para outro computador.'),
            h('div', { class: 'folder-now', 'data-file-status': fileStatus }, fileLabel)),
          fileStatus === 'needs-permission' ? h('button', { class: 'btn small primary', onClick: () => persist.reconnectFolder() }, 'Liberar pasta') : null,
          h('button', { class: `btn small${fileStatus === 'off' ? ' primary' : ''}`, 'data-action': 'pasta', onClick: chooseFolder }, fileStatus === 'off' ? 'Escolher pasta' : 'Trocar pasta'))
        : h('p', { class: 'hint' }, 'A pasta dos seus dados funciona no Chrome e no Edge. Neste navegador, use exportar.'),
      h('div', { class: 'settings-row' },
        h('div', { class: 'grow' }, h('b', {}, 'Backup'), h('div', { class: 'hint' }, 'Um arquivo com tudo, inclusive fotos.')),
        h('button', { class: 'btn small', 'data-action': 'exportar', onClick: () => persist.exportFile(store.getState()) }, 'Exportar'),
        h('label', { class: 'btn small file-btn' }, 'Importar', h('input', {
          type: 'file',
          accept: 'application/json,.json',
          'data-action': 'importar',
          onChange: async (e) => {
            const [file] = e.target.files;
            e.target.value = '';
            if (!file) return;
            const ok = await ui.dialog.confirm('Importar substitui todos os dados atuais. Antes disso, um backup deles será baixado.', { title: 'Importar backup', action: 'Importar', danger: true });
            if (!ok) return;
            try {
              store.replaceState(root.App.seed.migrate(await persist.importFile(file)));
              shell.toast('Backup importado.');
            } catch (error) {
              shell.toast(error.message);
            }
          },
        }))));
  }

  function activity(store) {
    const log = root.App.pending.activityLog(store.getState().items);
    const lineText = (entry) => {
      if (entry.action === 'moved') {
        const to = entry.to ? fmt.short(entry.to) : 'sem data';
        return `Data alterada para ${to} · ${entry.title}`;
      }
      return `${ACTIONS[entry.action] || entry.action} · ${entry.title}`;
    };
    return h('section', { class: 'box', 'data-section': 'atividade' },
      h('div', { class: 'box-head' },
        h('span', {}, 'Atividade'),
        h('button', {
          class: 'btn small danger',
          style: { 'margin-left': 'auto' },
          'data-action': 'limpar',
          onClick: async () => {
            const ok = await ui.dialog.confirm('Isso apaga o histórico de vez, inclusive as pontuais concluídas e excluídas, e não pode ser desfeito.', { title: 'Limpar histórico', action: 'Limpar', danger: true });
            if (!ok) return;
            store.clearHistory();
            shell.toast('Histórico limpo.');
          },
        }, 'Limpar histórico')),
      log.length
        ? h('ul', { class: 'history' }, log.slice(0, logLimit).map((entry) => h('li', { 'data-log': entry.action }, h('b', {}, fmt.short(entry.day)), ` · ${lineText(entry)}`)))
        : h('p', { class: 'hint' }, 'O que você criar, concluir, adiar ou excluir aparece aqui.'),
      log.length > logLimit ? h('button', {
        class: 'btn small',
        style: { 'margin-top': '8px' },
        'data-action': 'ver-mais',
        onClick: () => { logLimit += PAGE; shell.render(); },
      }, 'Ver mais') : null);
  }

  function render(container, store) {
    container.append(
      h('div', { class: 'head' }, h('h1', {}, 'Ajustes')),
      h('div', { class: 'stack' }, appearance(store), sessionsAndSectors(store), clients(store), dataSection(store), activity(store))
    );
  }

  persist.onStatus((status) => {
    const changed = status.file !== fileStatus || status.folder !== folderName;
    fileStatus = status.file;
    folderName = status.folder;
    if (changed && shell.current() === 'ajustes') shell.render();
  });

  shell.register('ajustes', { render });
})(globalThis);
