/* Pure preview rules. No availability, booking or payment requests. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HotPatchScheduleRules = factory();
})(typeof window !== 'undefined' ? window : this, function() {
  const dateNumber = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const stamp = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value
      ? stamp / 86400000
      : NaN;
  };
  const minutes = value =>
    typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
      : NaN;

  function assessMinimum({ unit, sessions, minimum }) {
    const validRule =
      Number.isFinite(minimum) &&
      minimum >= 0 &&
      (unit === 'hourly' || (unit === 'daily' && Number.isInteger(minimum)));
    if (!validRule || !Array.isArray(sessions)) throw new Error('Invalid schedule minimum');
    const dates = sessions.map(session => session.date);
    if (
      dates.some(date => !Number.isFinite(dateNumber(date))) ||
      new Set(dates).size !== dates.length
    )
      throw new Error('Invalid or duplicate schedule dates');
    const violations = [];
    const runs = [];
    if (unit === 'hourly') {
      sessions.forEach(session => {
        const duration = minutes(session.end) - minutes(session.start);
        if (!Number.isFinite(duration) || duration <= 0)
          violations.push({ kind: 'invalid-time', dates: [session.date] });
        else if (duration < minimum * 60)
          violations.push({ kind: 'hours', dates: [session.date], actual: duration / 60, minimum });
      });
    } else {
      dates
        .slice()
        .sort()
        .forEach(date => {
          const previous = runs[runs.length - 1];
          if (previous && dateNumber(date) === dateNumber(previous[previous.length - 1]) + 1)
            previous.push(date);
          else runs.push([date]);
        });
      runs.forEach(run => {
        if (run.length < minimum)
          violations.push({ kind: 'days', dates: run, actual: run.length, minimum });
      });
    }
    return { ok: sessions.length > 0 && violations.length === 0, violations, runs };
  }
  return { assessMinimum };
});
