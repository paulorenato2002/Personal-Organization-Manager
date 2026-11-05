(function (root) {
  const load = (key, path) => (root.App && root.App[key] ? root.App[key] : require(path));
  const dates = load('dates', '../logic/dates.js');
  const recurrence = load('recurrence', '../logic/recurrence.js');
  const quickadd = load('quickadd', '../logic/quickadd.js');

  const CLIENT_COLORS = ['#f2b872', '#70d8cd', '#a0b4ff', '#f28b82', '#c3e88d', '#e6a4e8', '#ffd866', '#7fc8f8'];
  const uid = () => globalThis.crypto.randomUUID();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const minDate = (a, b) => (a && a < b ? a : b);

  function createStore(initial, { now = () => new Date() } = {}) {
    let state = initial;
    let snapshot = null;
    let snapshotPending = false;
    const listeners = new Set();

    const today = () => dates.toISO(now());
    const stamp = () => now().toISOString();

    function emit() {
      // O desfazer só vale para a última ação: qualquer mudança seguinte o invalida.
      if (snapshotPending) snapshotPending = false;
      else snapshot = null;
      listeners.forEach((fn) => fn(state));
    }

    function saveSnapshot() {
      snapshot = clone({ items: state.items, sectors: state.sectors, sessions: state.sessions, clients: state.clients });
      snapshotPending = true;
    }

    function patchItem(id, fn) {
      state.items = state.items.map((i) => (i.id === id ? fn(i) : i));
    }

    const addLog = (item, entry) => ({ ...item, log: [...(item.log || []), { at: stamp(), ...entry }] });

    function ensureClient(name) {
      const upper = name.toUpperCase();
      const found = state.clients.find((c) => c.name === upper);
      if (found) return found;
      const client = { id: uid(), name: upper, color: CLIENT_COLORS[state.clients.length % CLIENT_COLORS.length] };
      state.clients = [...state.clients, client];
      return client;
    }

    function baseItem(kind, sectorId, title, clientId) {
      const item = { id: uid(), kind, sectorId, title, notes: '', subtasks: [], createdAt: stamp(), log: [] };
      if (clientId) item.clientId = clientId;
      return addLog(item, { day: today(), action: 'created' });
    }

    function kindFields(kind) {
      if (kind === 'rotina') return { freq: { type: 'daily' }, startDate: today(), doneThrough: null, completions: [] };
      if (kind === 'compromisso') return { start: `${today()}T09:00`, durationMin: 60 };
      return { dueDate: today() };
    }

    function quickAdd({ kind, sectorId, text }) {
      const parsed = quickadd.parse(text);
      if (!parsed) return null;
      const client = parsed.clientName ? ensureClient(parsed.clientName) : null;
      const item = { ...baseItem(kind, sectorId, parsed.title, client && client.id), ...kindFields(kind) };
      state.items = [...state.items, item];
      emit();
      return item;
    }

    function addCompromisso({ sectorId, title, start, durationMin = 60 }) {
      const item = { ...baseItem('compromisso', sectorId, title), start, durationMin };
      state.items = [...state.items, item];
      emit();
      return item;
    }

    function updateItem(id, patch) {
      patchItem(id, (i) => ({ ...i, ...patch }));
      emit();
    }

    function setItemClient(id, name) {
      const clean = String(name || '').trim();
      const client = clean ? ensureClient(clean) : null;
      patchItem(id, (i) => {
        const { clientId, ...rest } = i;
        return client ? { ...rest, clientId: client.id } : rest;
      });
      emit();
    }

    function changeKind(id, kind) {
      patchItem(id, (i) => {
        if (i.kind === kind) return i;
        const { freq, startDate, doneThrough, completions, dueDate, doneAt, start, durationMin, ...rest } = i;
        return { ...rest, kind, ...kindFields(kind) };
      });
      emit();
    }

    function withoutLastDone(item) {
      const lastDone = (item.log || []).map((e) => e.action).lastIndexOf('done');
      return { ...item, log: (item.log || []).filter((_, index) => index !== lastDone) };
    }

    function toggleItem(id) {
      const day = today();
      patchItem(id, (item) => {
        if (item.kind === 'rotina') {
          const done = recurrence.rotinaStatus(item, day).state === 'done';
          if (done) return withoutLastDone(recurrence.undoRotina(item));
          return addLog(recurrence.completeRotina(item, day), { day, action: 'done' });
        }
        if (item.doneAt) {
          const { doneAt, ...rest } = item;
          return withoutLastDone(rest);
        }
        return addLog({ ...item, doneAt: stamp() }, { day, action: 'done' });
      });
      emit();
    }

    function softDelete(item, day) {
      return addLog({ ...item, deletedAt: stamp() }, { day: minDate(item.dueDate, day), action: 'deleted' });
    }

    function deleteItem(id) {
      saveSnapshot();
      const target = state.items.find((i) => i.id === id);
      if (target && target.kind === 'pontual') {
        patchItem(id, (i) => softDelete(i, today()));
      } else {
        state.items = state.items.filter((i) => i.id !== id);
      }
      emit();
    }

    function moveOne(item, to) {
      const day = minDate(item.dueDate, today());
      return addLog({ ...item, dueDate: to }, { day, action: 'moved', from: item.dueDate || null, to });
    }

    function movePontual(id, iso) {
      saveSnapshot();
      patchItem(id, (i) => moveOne(i, iso));
      emit();
    }

    const inDay = (fromIso) => (i) => i.kind === 'pontual' && !i.doneAt && !i.deletedAt && i.dueDate === fromIso;

    function moveDay(fromIso, toIso) {
      saveSnapshot();
      const match = inDay(fromIso);
      state.items = state.items.map((i) => (match(i) ? moveOne(i, toIso) : i));
      emit();
    }

    function deleteDay(fromIso) {
      saveSnapshot();
      const match = inDay(fromIso);
      state.items = state.items.map((i) => (match(i) ? softDelete(i, today()) : i));
      emit();
    }

    function clearHistory() {
      state.items = state.items
        .filter((i) => !(i.kind === 'pontual' && (i.deletedAt || i.doneAt)))
        .map((i) => ({ ...i, log: [] }));
      snapshot = null;
      emit();
    }

    function dropSectorItems(sectorIds) {
      const day = today();
      state.items = state.items
        .filter((i) => i.kind === 'pontual' || !sectorIds.includes(i.sectorId))
        .map((i) => {
          if (!sectorIds.includes(i.sectorId)) return i;
          if (i.deletedAt) return { ...i, sectorId: null };
          if (i.doneAt) return { ...i, sectorId: null, deletedAt: stamp() };
          return { ...softDelete(i, day), sectorId: null };
        });
    }

    const nextOrder = (list) => list.reduce((max, x) => Math.max(max, x.order + 1), 0);

    function addSession(name) {
      const session = { id: uid(), name, icon: '📁', cover: null, order: nextOrder(state.sessions) };
      state.sessions = [...state.sessions, session];
      emit();
      return session;
    }

    function updateIn(key, id, patch) {
      state[key] = state[key].map((x) => (x.id === id ? { ...x, ...patch } : x));
      emit();
    }

    function deleteSession(id) {
      if (state.sessions.length <= 1) return false;
      saveSnapshot();
      dropSectorItems(state.sectors.filter((s) => s.sessionId === id).map((s) => s.id));
      state.sectors = state.sectors.filter((s) => s.sessionId !== id);
      state.sessions = state.sessions.filter((s) => s.id !== id);
      emit();
      return true;
    }

    function addSector(sessionId, name) {
      const siblings = state.sectors.filter((s) => s.sessionId === sessionId);
      const sector = { id: uid(), sessionId, name, icon: '📌', cover: null, order: nextOrder(siblings) };
      state.sectors = [...state.sectors, sector];
      emit();
      return sector;
    }

    function deleteSector(id) {
      saveSnapshot();
      dropSectorItems([id]);
      state.sectors = state.sectors.filter((s) => s.id !== id);
      emit();
    }

    function reorder(collection, id, newIndex) {
      const target = state[collection].find((x) => x.id === id);
      if (!target) return;
      const sameScope = (x) => {
        if (collection === 'sectors') return x.sessionId === target.sessionId;
        if (collection === 'habits') return x.groupId === target.groupId;
        return true;
      };
      const siblings = state[collection].filter(sameScope).sort((a, b) => a.order - b.order).filter((x) => x.id !== id);
      siblings.splice(Math.max(0, Math.min(newIndex, siblings.length)), 0, target);
      const orders = new Map(siblings.map((x, order) => [x.id, order]));
      state[collection] = state[collection].map((x) => (orders.has(x.id) ? { ...x, order: orders.get(x.id) } : x));
      emit();
    }

    function updateClient(id, patch) {
      const next = { ...patch };
      if (next.name !== undefined) {
        next.name = next.name.trim().toUpperCase();
        if (!next.name || state.clients.some((c) => c.id !== id && c.name === next.name)) return false;
      }
      updateIn('clients', id, next);
      return true;
    }

    function addClient(name) {
      const upper = String(name || '').trim().toUpperCase();
      if (!upper || state.clients.some((c) => c.name === upper)) return null;
      const client = ensureClient(upper);
      emit();
      return client;
    }

    function deleteClient(id) {
      state.clients = state.clients.filter((c) => c.id !== id);
      state.items = state.items.map((item) => {
        if (item.clientId !== id) return item;
        const { clientId, ...rest } = item;
        return rest;
      });
      emit();
    }

    function addHabitGroup(name) {
      const group = { id: uid(), name, order: nextOrder(state.habitGroups) };
      state.habitGroups = [...state.habitGroups, group];
      emit();
      return group;
    }

    function deleteHabitGroup(id) {
      state.habits = state.habits.filter((h) => h.groupId !== id);
      state.habitGroups = state.habitGroups.filter((g) => g.id !== id);
      emit();
    }

    function addHabit(groupId, fields) {
      const siblings = state.habits.filter((h) => h.groupId === groupId);
      const habit = { id: uid(), groupId, order: nextOrder(siblings), startDate: today(), ...fields };
      state.habits = [...state.habits, habit];
      emit();
      return habit;
    }

    function deleteHabit(id) {
      state.habits = state.habits.filter((h) => h.id !== id);
      emit();
    }

    function setHabitValue(habitId, iso, value) {
      state.habitLog = { ...state.habitLog, [iso]: { ...(state.habitLog[iso] || {}), [habitId]: value } };
      emit();
    }

    return {
      getState: () => state,
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      today,
      canUndo: () => snapshot !== null,
      undo() {
        if (!snapshot) return false;
        state = { ...state, ...snapshot };
        emit();
        return true;
      },
      replaceState(next) {
        state = next;
        snapshot = null;
        emit();
      },
      quickAdd,
      addCompromisso,
      updateItem,
      setItemClient,
      changeKind,
      toggleItem,
      deleteItem,
      movePontual,
      moveDay,
      deleteDay,
      clearHistory,
      addSession,
      updateSession: (id, patch) => updateIn('sessions', id, patch),
      deleteSession,
      addSector,
      updateSector: (id, patch) => updateIn('sectors', id, patch),
      deleteSector,
      reorder,
      updateClient,
      addClient,
      deleteClient,
      addHabitGroup,
      updateHabitGroup: (id, patch) => updateIn('habitGroups', id, patch),
      deleteHabitGroup,
      addHabit,
      updateHabit: (id, patch) => updateIn('habits', id, patch),
      deleteHabit,
      setHabitValue,
      setSettings(patch) {
        state.settings = { ...state.settings, ...patch };
        emit();
      },
      setProfile(patch) {
        state.profile = { ...state.profile, ...patch };
        emit();
      },
    };
  }

  const api = { createStore };
  root.App = root.App || {};
  root.App.createStore = createStore;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
