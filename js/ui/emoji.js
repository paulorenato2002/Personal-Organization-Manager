(function (root) {
  const { h } = root.App;
  const EMOJIS = [
    '🔥', '⚡', '⭐', '🌟', '✨', '💎', '👑', '🎯', '🚀', '🛸', '🌈', '🌊', '🌙', '☀️', '🌻', '🌿', '🍀', '🌵', '🌲', '🍁',
    '🦁', '🐺', '🦊', '🐯', '🐻', '🐼', '🐨', '🦉', '🦅', '🐉', '🦈', '🐙', '🦋', '🐝', '🐢', '🐱', '🐶', '🦄', '🐸', '🐧',
    '💼', '📊', '📈', '🧾', '💰', '💳', '🏦', '🧮', '📁', '📌', '📎', '📝', '📚', '📅', '⏰', '🔔', '💡', '🔧', '⚙️', '🧩',
    '💻', '🖥️', '📱', '🎧', '📷', '🎮', '🕹️', '🤖', '🧠', '🔬', '🧪', '🔭', '🛠️', '🏗️', '🏠', '🏢', '🚗', '✈️', '🗺️', '🧭',
    '🏋️', '🏃', '🚴', '🧘', '⚽', '🏀', '🥊', '🏆', '🥇', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤝', '🙌',
    '🍎', '🥑', '🥦', '🍳', '🍕', '☕', '💧', '🎨', '🎵', '🎸', '🎬', '📖', '✍️', '🧿', '♟️', '🎲', '😎', '🙂', '😄', '🤘',
  ];

  // onPick recebe o emoji, ou '' para limpar quando allowClear é verdadeiro.
  function emojiPicker({ value = '', onPick, allowClear = false }) {
    return h('div', { class: 'emoji-grid', role: 'listbox', 'aria-label': 'Emojis' },
      allowClear ? h('button', { type: 'button', title: 'Sem símbolo', 'aria-label': 'Sem símbolo', onClick: () => onPick('') }, '∅') : null,
      EMOJIS.map((emoji) => h('button', {
        type: 'button',
        class: emoji === value ? 'on' : '',
        'data-emoji': emoji,
        onClick: () => onPick(emoji),
      }, emoji)));
  }

  function pickEmoji(value) {
    return root.App.ui.dialog.open((close) => [
      h('h2', {}, 'Escolher ícone'),
      emojiPicker({ value, onPick: close }),
    ]);
  }

  Object.assign(root.App.ui, { emojiPicker, pickEmoji, EMOJIS });
})(globalThis);
