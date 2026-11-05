(function (root) {
  const load = (key, path) => (root.App && root.App[key] ? root.App[key] : require(path));
  const dates = load('dates', './dates.js');
  const recurrence = load('recurrence', './recurrence.js');
  const { addDays, weekday } = dates;

  function eventsBetween(items, startIso, endIso) {
    const out = {};
    const add = (iso, item) => { (out[iso] = out[iso] || []).push(item); };
    const inRange = (iso) => iso >= startIso && iso <= endIso;
    for (const item of items) {
      if (item.deletedAt) continue;
      if (item.kind === 'compromisso') {
        const day = item.start.slice(0, 10);
        if (inRange(day)) add(day, item);
      } else if (item.kind === 'pontual') {
        if (item.dueDate && inRange(item.dueDate)) add(item.dueDate, item);
      } else {
        for (let day = startIso; day <= endIso; day = addDays(day, 1)) {
          if (day >= item.startDate && recurrence.occursOn(item.freq, day)) add(day, item);
        }
      }
    }
    return out;
  }

  const weekDays = (iso) => {
    const first = addDays(iso, -weekday(iso));
    return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  };

  function monthGrid(year, month1to12) {
    const pad = String(month1to12).padStart(2, '0');
    const firstOfMonth = `${year}-${pad}-01`;
    const lastOfMonth = `${year}-${pad}-${String(dates.lastDayOfMonth(year, month1to12)).padStart(2, '0')}`;
    const out = [];
    for (let day = weekDays(firstOfMonth)[0]; ; day = addDays(day, 1)) {
      out.push(day);
      if (day >= lastOfMonth && weekday(day) === 6) break;
    }
    return out;
  }

  const minutes = (start) => {
    const [hh, mm] = start.slice(11, 16).split(':').map(Number);
    return hh * 60 + mm;
  };

  // Distribui compromissos do dia em faixas, para os sobrepostos não se esconderem.
  function layoutDay(compromissos) {
    const sorted = [...compromissos].sort((a, b) => minutes(a.start) - minutes(b.start));
    const placed = [];
    let cluster = [];
    let clusterEnd = -1;
    const closeCluster = () => {
      const lanes = cluster.reduce((max, x) => Math.max(max, x.lane + 1), 0);
      cluster.forEach((x) => { x.lanes = lanes; });
      cluster = [];
    };
    for (const item of sorted) {
      const start = minutes(item.start);
      const end = start + (item.durationMin || 60);
      if (start >= clusterEnd) { closeCluster(); clusterEnd = end; }
      clusterEnd = Math.max(clusterEnd, end);
      const used = new Set(cluster.filter((x) => x.end > start).map((x) => x.lane));
      let lane = 0;
      while (used.has(lane)) lane += 1;
      const entry = { item, start, end, lane, lanes: 1 };
      cluster.push(entry);
      placed.push(entry);
    }
    closeCluster();
    return placed;
  }

  const api = { eventsBetween, monthGrid, weekDays, layoutDay };
  root.App = root.App || {};
  root.App.agenda = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
