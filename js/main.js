(async function () {
  const { persist, seed, createStore, shell, onboarding } = window.App;
  const app = document.getElementById('app');
  document.documentElement.dataset.theme = 'dark';
  shell.initBackground();

  let state = null;
  let storageError = false;
  try {
    state = await persist.load();
  } catch (error) {
    storageError = true;
  }

  const isFirstRun = !state;
  if (isFirstRun) {
    const answer = await onboarding.show(app);
    state = answer.loaded || seed.initialState(answer);
  }
  state = seed.migrate(state);

  const store = createStore(state);
  window.App.store = store;
  persist.attach(store);
  shell.start(store);
  if (isFirstRun && !storageError) persist.flush();
  else if (storageError) shell.toast('Não foi possível abrir os dados salvos neste navegador.');
  window.App.ready = true;
})();
