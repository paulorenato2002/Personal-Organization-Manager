(function (root) {
  const dates = root.App && root.App.dates ? root.App.dates : require('./dates.js');
  const { addDays, weekday, lastDayOfMonth } = dates;

  function monthlyDate(year, month, day) {
    const d = Math.min(day, lastDayOfMonth(year, month));
    return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function nextOccurrence(freq, afterISO) {
    if (freq.type === 'daily') return addDays(afterISO, 1);
    if (freq.type === 'weekly') {
      const delta = ((freq.weekday - weekday(afterISO) + 7) % 7) || 7;
      return addDays(afterISO, delta);
    }
    let [year, month] = afterISO.split('-').map(Number);
    let candidate = monthlyDate(year, month, freq.day);
    if (candidate <= afterISO) {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
      candidate = monthlyDate(year, month, freq.day);
    }
    return candidate;
  }

  const occursOn = (freq, iso) => nextOccurrence(freq, addDays(iso, -1)) === iso;

  function anchor(item) {
    return item.doneThrough || addDays(item.startDate, -1);
  }

  function rotinaStatus(item, today) {
    const first = nextOccurrence(item.freq, anchor(item));
    if (first > today) {
      return { state: item.completions.length ? 'done' : 'upcoming', date: first };
    }
    if (first === today) return { state: 'due', date: first };
    if (item.freq.type === 'daily') return { state: 'due', date: today };
    return { state: 'overdue', date: first };
  }

  // Última ocorrência até hoje; sem nenhuma, a próxima (concluir adianta um ciclo).
  function settleDate(item, today) {
    let current = nextOccurrence(item.freq, anchor(item));
    if (current > today) return current;
    let next = nextOccurrence(item.freq, current);
    while (next <= today) {
      current = next;
      next = nextOccurrence(item.freq, current);
    }
    return current;
  }

  function completeRotina(item, today) {
    const occurrence = settleDate(item, today);
    return {
      ...item,
      doneThrough: occurrence,
      completions: [...item.completions, { occurrence, doneOn: today, prevDoneThrough: item.doneThrough }],
    };
  }

  function undoRotina(item) {
    if (!item.completions.length) return item;
    const last = item.completions[item.completions.length - 1];
    return { ...item, doneThrough: last.prevDoneThrough, completions: item.completions.slice(0, -1) };
  }

  const api = { nextOccurrence, occursOn, rotinaStatus, completeRotina, undoRotina };
  root.App = root.App || {};
  root.App.recurrence = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
