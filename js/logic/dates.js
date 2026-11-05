(function (root) {
  const pad = (n) => String(n).padStart(2, '0');

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(iso, n) {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  const weekday = (iso) => fromISO(iso).getDay();

  const lastDayOfMonth = (year, month1to12) => new Date(year, month1to12, 0).getDate();

  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  const api = { toISO, fromISO, addDays, weekday, lastDayOfMonth, compare };
  root.App = root.App || {};
  root.App.dates = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
