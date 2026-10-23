const {
  assessMinimum,
} = require('../../public/static/previews/booking-schedule/booking-schedule-rules');

const hourly = (date, start = '09:00', end = '11:00') => ({ date, start, end });
const daily = dates => dates.map(date => ({ date }));

describe('schedule preview minimums', () => {
  it('does not pool hours from different dates to meet a per-session minimum', () => {
    const result = assessMinimum({
      unit: 'hourly',
      minimum: 5,
      sessions: [hourly('2026-11-02'), hourly('2026-11-04'), hourly('2026-11-06')],
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(3);
    expect(result.violations[0]).toMatchObject({ actual: 2, minimum: 5 });
  });

  it('accepts the exact hourly minimum and supports fractional-hour minimums', () => {
    expect(
      assessMinimum({
        unit: 'hourly',
        minimum: 5,
        sessions: [hourly('2026-11-02', '09:00', '14:00')],
      }).ok
    ).toBe(true);
    expect(
      assessMinimum({
        unit: 'hourly',
        minimum: 2.5,
        sessions: [hourly('2026-11-02', '09:00', '11:30')],
      }).ok
    ).toBe(true);
    expect(
      assessMinimum({
        unit: 'hourly',
        minimum: 2.5,
        sessions: [hourly('2026-11-02', '09:00', '11:29')],
      }).ok
    ).toBe(false);
  });

  it('identifies the individual session that is too short', () => {
    const result = assessMinimum({
      unit: 'hourly',
      minimum: 5,
      sessions: [hourly('2026-11-02', '09:00', '14:00'), hourly('2026-11-04', '09:00', '13:00')],
    });
    expect(result.violations).toEqual([
      { kind: 'hours', dates: ['2026-11-04'], actual: 4, minimum: 5 },
    ]);
  });

  it('rejects invalid, equal and reversed times even without a host minimum', () => {
    ['09:00', '08:00', '', '24:00'].forEach(end => {
      expect(
        assessMinimum({
          unit: 'hourly',
          minimum: 0,
          sessions: [hourly('2026-11-02', '09:00', end)],
        }).ok
      ).toBe(false);
    });
  });

  it('requires each daily date group to satisfy the consecutive-day minimum', () => {
    const sessions = daily(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(assessMinimum({ unit: 'daily', minimum: 5, sessions }).ok).toBe(true);
    const split = daily(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-07']);
    const result = assessMinimum({ unit: 'daily', minimum: 5, sessions: split });
    expect(result.ok).toBe(false);
    expect(result.violations.map(v => v.actual)).toEqual([2, 3]);
  });

  it('accepts separate daily groups when each independently meets its minimum', () => {
    expect(
      assessMinimum({
        unit: 'daily',
        minimum: 2,
        sessions: daily(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06']),
      }).ok
    ).toBe(true);
  });

  it('counts calendar days across month boundaries and daylight-saving changes', () => {
    expect(
      assessMinimum({
        unit: 'daily',
        minimum: 3,
        sessions: daily(['2026-10-24', '2026-10-25', '2026-10-26']),
      }).ok
    ).toBe(true);
    expect(
      assessMinimum({ unit: 'daily', minimum: 2, sessions: daily(['2026-10-31', '2026-11-01']) }).ok
    ).toBe(true);
  });

  it('does not accept an empty schedule or count duplicate/invalid dates', () => {
    expect(assessMinimum({ unit: 'daily', minimum: 0, sessions: [] }).ok).toBe(false);
    expect(() =>
      assessMinimum({ unit: 'daily', minimum: 2, sessions: daily(['2026-11-02', '2026-11-02']) })
    ).toThrow();
    expect(() =>
      assessMinimum({ unit: 'daily', minimum: 0, sessions: daily(['2026-02-30']) })
    ).toThrow();
  });

  it('rejects unsupported units and invalid minimum values', () => {
    [-1, NaN, '5'].forEach(minimum =>
      expect(() => assessMinimum({ unit: 'hourly', minimum, sessions: [] })).toThrow()
    );
    expect(() => assessMinimum({ unit: 'weekly', minimum: 2, sessions: [] })).toThrow();
    expect(() => assessMinimum({ unit: 'daily', minimum: 1.5, sessions: [] })).toThrow();
  });
});
