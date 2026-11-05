(function (root) {
  function dayLevel(habit, value) {
    if (value === undefined || value === null) return 'none';
    if (habit.type === 'check') return value === true ? 'full' : 'none';
    if (habit.type === 'counter') {
      if (typeof value !== 'number') return 'none';
      if (value >= habit.goal) return 'full';
      return value > 0 ? 'partial' : 'none';
    }
    if (!Array.isArray(value)) return 'none';
    const marked = habit.listItems.filter((x) => value.includes(x)).length;
    if (habit.listItems.length > 0 && marked === habit.listItems.length) return 'full';
    return marked > 0 ? 'partial' : 'none';
  }

  const valueOn = (habit, log, iso) => (log[iso] ? log[iso][habit.id] : undefined);

  // Estado do quadradinho: full (verde), partial (amarelo), none (vermelho),
  // pending (hoje, ainda sem registro) ou blank (fora do período da meta).
  function gridCell(habit, log, iso, today) {
    if (iso > today) return 'blank';
    const level = dayLevel(habit, valueOn(habit, log, iso));
    if (level !== 'none') return level;
    if (iso < habit.startDate) return 'blank';
    return iso === today ? 'pending' : 'none';
  }

  function dayScore(habits, log, iso) {
    const active = habits.filter((h) => h.startDate <= iso);
    return {
      done: active.filter((h) => dayLevel(h, valueOn(h, log, iso)) === 'full').length,
      total: active.length,
    };
  }

  const decimal = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

  function formatAmount(habit, value) {
    const { unit } = habit;
    if (unit === 'ml' && value >= 1000) return `${decimal(value / 1000)} L`;
    if (unit === 'min' && value >= 60) {
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return minutes ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${hours} h`;
    }
    return unit ? `${decimal(value)} ${unit}` : decimal(value);
  }

  const stepLabel = (habit) => `+${formatAmount(habit, habit.step)}`;

  const api = { dayLevel, gridCell, dayScore, formatAmount, stepLabel };
  root.App = root.App || {};
  root.App.habits = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
