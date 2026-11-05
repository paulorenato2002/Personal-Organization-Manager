(function (root) {
  const { h, shell, ui, images } = root.App;

  function text(label, key, value, onChange, type = 'text', placeholder = '') {
    return h('label', { class: 'field' }, h('span', {}, label), h('input', {
      type,
      placeholder,
      'data-key': key,
      value: value || '',
      onChange: (e) => onChange(e.target.value.trim()),
    }));
  }

  function render(container, store) {
    const { profile } = store.getState();
    const links = [0, 1, 2].map((i) => profile.links[i] || '');
    container.append(
      h('div', { class: 'head' }, h('h1', {}, 'Perfil')),
      h('div', { class: 'box form-card' },
        h('div', { class: 'profile-top' },
          h('div', { class: 'avatar big' }, shell.avatarContent(profile)),
          h('div', {},
            h('label', { class: 'btn file-btn' }, 'Trocar foto', h('input', {
              type: 'file',
              accept: 'image/*',
              'data-action': 'foto',
              onChange: async (e) => {
                const [file] = e.target.files;
                if (!file) return;
                try {
                  store.setProfile({ photo: await images.resize(file, images.SIZES.avatar) });
                } catch (error) {
                  shell.toast(error.message);
                }
              },
            })),
            ' ',
            profile.photo ? h('button', { class: 'btn', onClick: () => store.setProfile({ photo: null }) }, 'Remover') : null)),
        text('Nome', 'pf-name', profile.name, (name) => store.setProfile({ name })),
        h('div', { class: 'row' },
          text('E-mail', 'pf-email', profile.email, (email) => store.setProfile({ email }), 'email'),
          text('Telefone', 'pf-phone', profile.phone, (phone) => store.setProfile({ phone }), 'tel')),
        links.map((link, index) => text(`Link ${index + 1}`, `pf-link-${index}`, link, (value) => {
          const next = [...links];
          next[index] = value;
          store.setProfile({ links: next });
        }, 'url', 'https://')),
        h('div', { class: 'field' },
          h('span', {}, 'Símbolo pessoal: sua marca, que aparece no canto da foto'),
          ui.emojiPicker({ value: profile.symbol, allowClear: true, onPick: (symbol) => store.setProfile({ symbol }) })))
    );
  }

  shell.register('perfil', { render });
})(globalThis);
