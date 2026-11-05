(function (root) {
  const CURRENT_VERSION = 2;
  const FILE_NAME = 'organizador-dados.json';
  const SAVE_DELAY_MS = 500;
  const LISTS = ['sessions', 'sectors', 'clients', 'items', 'habitGroups', 'habits'];
  const OBJECTS = ['profile', 'settings', 'habitLog'];

  function validateImport(obj) {
    const fail = (error) => ({ ok: false, error });
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fail('Esse arquivo não é um backup do organizador.');
    if (typeof obj.version !== 'number') return fail('Esse arquivo não é um backup do organizador.');
    if (obj.version > CURRENT_VERSION) return fail('Esse arquivo veio de uma versão mais nova do app.');
    for (const key of LISTS) {
      if (!Array.isArray(obj[key])) return fail('Esse arquivo de backup está incompleto ou corrompido.');
    }
    for (const key of OBJECTS) {
      if (!obj[key] || typeof obj[key] !== 'object') return fail('Esse arquivo de backup está incompleto ou corrompido.');
    }
    return { ok: true };
  }

  let dbPromise = null;
  let folderHandle = null;
  let fileState = 'off';
  let latest = null;
  let timer = null;
  const statusListeners = new Set();
  let lastStatus = { state: 'saved', file: 'off' };

  function setStatus(patch) {
    lastStatus = { ...lastStatus, message: undefined, ...patch, file: fileState, folder: folderHandle ? folderHandle.name : null };
    statusListeners.forEach((fn) => fn(lastStatus));
  }

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('organizador', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('state');
          request.result.createObjectStore('handles');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return db().then((conn) => new Promise((resolve, reject) => {
      const transaction = conn.transaction(store, mode);
      const request = fn(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }));
  }

  const isFileSyncAvailable = () => typeof root.showDirectoryPicker === 'function';

  async function restoreFolder() {
    if (!isFileSyncAvailable()) return;
    const handle = await tx('handles', 'readonly', (s) => s.get('folder'));
    if (!handle) return;
    folderHandle = handle;
    const permission = await handle.queryPermission({ mode: 'readwrite' });
    fileState = permission === 'granted' ? 'on' : 'needs-permission';
  }

  async function load() {
    const state = await tx('state', 'readonly', (s) => s.get('current'));
    try {
      await restoreFolder();
    } catch (error) {
      fileState = 'off';
    }
    setStatus({ state: 'saved' });
    return state || null;
  }

  async function writeFile(state) {
    if (!folderHandle || fileState !== 'on') return;
    const file = await folderHandle.getFileHandle(FILE_NAME, { create: true });
    const writable = await file.createWritable();
    await writable.write(JSON.stringify(state, null, 1));
    await writable.close();
  }

  async function save(state) {
    const toSave = { ...state, savedAt: new Date().toISOString() };
    await tx('state', 'readwrite', (s) => s.put(toSave, 'current'));
    await writeFile(toSave);
  }

  function friendly(error) {
    if (error && error.name === 'QuotaExceededError') return 'Sem espaço para salvar. Exporte um backup e remova fotos grandes.';
    return 'Não foi possível salvar. Seus dados continuam abertos; exporte um backup por segurança.';
  }

  function flush() {
    timer = null;
    if (!latest) return Promise.resolve();
    return save(latest).then(
      () => setStatus({ state: 'saved' }),
      (error) => setStatus({ state: 'error', message: friendly(error) })
    );
  }

  function attach(store) {
    latest = store.getState();
    store.subscribe((state) => {
      latest = state;
      setStatus({ state: 'saving' });
      clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    });
    root.addEventListener('pagehide', () => { if (timer) flush(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); flush(); }
    });
  }

  // Lê os dados que já estejam na pasta. Retorna null se não houver arquivo.
  async function readFolderFile(handle) {
    let file;
    try {
      file = await handle.getFileHandle(FILE_NAME);
    } catch (error) {
      if (error && error.name === 'NotFoundError') return null;
      throw error;
    }
    const parsed = JSON.parse(await (await file.getFile()).text());
    if (!validateImport(parsed).ok) throw new Error('invalid');
    return parsed;
  }

  // onExisting(dados) responde 'load' (usar os dados da pasta), 'replace' (gravar por cima)
  // ou null (desistir). Retorna { ok, loaded }, com loaded preenchido quando os dados vêm da pasta.
  async function chooseFolder({ onExisting } = {}) {
    let handle;
    try {
      handle = await root.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
      if (error && error.name !== 'AbortError') setStatus({ state: 'error', message: 'Não foi possível usar essa pasta.' });
      return { ok: false, loaded: null };
    }
    let existing = null;
    try {
      existing = await readFolderFile(handle);
    } catch (error) {
      setStatus({ state: 'error', message: `Essa pasta tem um ${FILE_NAME} que não pôde ser lido. Escolha outra pasta ou mova esse arquivo.` });
      return { ok: false, loaded: null };
    }
    let decision = 'replace';
    if (existing) {
      decision = onExisting ? await onExisting(existing) : null;
      if (!decision) return { ok: false, loaded: null };
    }
    try {
      await tx('handles', 'readwrite', (s) => s.put(handle, 'folder'));
      folderHandle = handle;
      fileState = 'on';
      if (decision === 'load') {
        setStatus({});
        return { ok: true, loaded: existing };
      }
      await flush();
      setStatus({});
      return { ok: true, loaded: null };
    } catch (error) {
      setStatus({ state: 'error', message: 'Não foi possível usar essa pasta.' });
      return { ok: false, loaded: null };
    }
  }

  async function reconnectFolder() {
    if (!folderHandle) return chooseFolder();
    const permission = await folderHandle.requestPermission({ mode: 'readwrite' });
    fileState = permission === 'granted' ? 'on' : 'needs-permission';
    if (fileState === 'on') await flush();
    setStatus({});
    return fileState === 'on';
  }

  function exportFile(state) {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `organizador-dados-${new Date().toLocaleDateString('sv-SE')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  async function importFile(file) {
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      throw new Error('Esse arquivo não é um JSON válido.');
    }
    const result = validateImport(parsed);
    if (!result.ok) throw new Error(result.error);
    if (latest) exportFile(latest);
    return parsed;
  }

  function onStatus(fn) {
    statusListeners.add(fn);
    fn(lastStatus);
    return () => statusListeners.delete(fn);
  }

  const api = {
    validateImport, load, save, attach, chooseFolder, reconnectFolder,
    exportFile, importFile, onStatus, isFileSyncAvailable, flush,
  };
  root.App = root.App || {};
  root.App.persist = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
