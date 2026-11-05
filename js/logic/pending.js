(function (root) {
  const recurrence = root.App && root.App.recurrence ? root.App.recurrence : require('./recurrence.js');

  const isOpenPontual = (i) => i.kind === 'pontual' && !i.doneAt && !i.deletedAt;
  const doneToday = (i, today) => i.completions.some((c) => c.doneOn === today);

  function isDone(item, today) {
    if (item.kind === 'rotina') return recurrence.rotinaStatus(item, today).state === 'done';
    return Boolean(item.doneAt);
  }

  function pendingByDay(items, today) {
    const groups = new Map();
    for (const item of items) {
      if (!isOpenPontual(item) || !item.dueDate || item.dueDate >= today) continue;
      if (!groups.has(item.dueDate)) groups.set(item.dueDate, []);
      groups.get(item.dueDate).push(item);
    }
    return [...groups.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, list]) => ({ date, items: list }));
  }

  function inToday(item, today) {
    if (item.deletedAt) return false;
    if (item.kind === 'rotina') {
      const { state } = recurrence.rotinaStatus(item, today);
      return state === 'due' || state === 'overdue' || doneToday(item, today);
    }
    if (item.kind === 'compromisso') return item.start.slice(0, 10) === today;
    return item.dueDate === today;
  }

  const todayList = (items, today) => items.filter((i) => inToday(i, today));

  function dayProgress(items, today) {
    const list = todayList(items, today);
    return { done: list.filter((i) => isDone(i, today)).length, total: list.length };
  }

  const BUCKETS = { done: 'done', moved: 'moved', deleted: 'deleted' };

  function historyByDay(items) {
    const days = new Map();
    for (const item of items) {
      if (item.kind !== 'pontual') continue;
      for (const entry of item.log || []) {
        const bucket = BUCKETS[entry.action];
        if (!bucket) continue;
        if (!days.has(entry.day)) days.set(entry.day, { date: entry.day, done: [], moved: [], deleted: [] });
        days.get(entry.day)[bucket].push({ ...item, entry });
      }
    }
    return [...days.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function activityLog(items) {
    const out = [];
    for (const item of items) {
      for (const entry of item.log || []) out.push({ ...entry, title: item.title, itemId: item.id });
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }

  const api = { pendingByDay, todayList, dayProgress, historyByDay, activityLog, isDone };
  root.App = root.App || {};
  root.App.pending = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
