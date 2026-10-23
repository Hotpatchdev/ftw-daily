(function() {
  const root = document.getElementById('hp-schedule-preview');
  const defaults = () => ({
    unit: 'hourly',
    mode: 'selected',
    days: [2, 4, 6],
    start: '09:00',
    end: '15:00',
    zone: 'Europe/London',
    same: true,
    overrides: {},
    review: false,
    minimum: 5,
  });
  let state = defaults();
  const query = s => root.querySelector(s);
  const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const dateLabel = d =>
    new Date(Date.UTC(2026, 10, d)).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  const session = d =>
    state.same
      ? { start: state.start, end: state.end }
      : state.overrides[d] || { start: state.start, end: state.end };
  const isoDate = d => '2026-11-' + String(d).padStart(2, '0');
  function render() {
    const minimumResult = window.HotPatchScheduleRules.assessMinimum({
      unit: state.unit,
      minimum: state.minimum,
      sessions: state.days.map(d => ({ date: isoDate(d), ...session(d) })),
    });
    const minimumUnit =
      state.unit === 'hourly' ? 'hours per session' : 'consecutive days per booking';
    query('#hp-minimum').value = String(state.minimum);
    Array.from(query('#hp-minimum').options).forEach(option => {
      if (Number(option.value) > 0) option.textContent = option.value + ' ' + minimumUnit;
    });
    query('#hp-minimum-label').textContent = state.minimum
      ? 'Minimum booking: ' + state.minimum + ' ' + minimumUnit + '.'
      : 'No additional host minimum in this example.';
    root
      .querySelectorAll('[data-unit]')
      .forEach(b => b.setAttribute('aria-pressed', b.dataset.unit === state.unit));
    root
      .querySelectorAll('[data-dates]')
      .forEach(b => b.setAttribute('aria-pressed', b.dataset.dates === state.mode));
    query('.hp-hourly').hidden = state.unit !== 'hourly';
    query('.hp-daily').hidden = state.unit !== 'daily';
    query('.hp-zone').hidden = state.unit !== 'hourly';
    query('#hp-start').value = state.start;
    query('#hp-end').value = state.end;
    query('#hp-same').checked = state.same;
    query('#hp-zone').value = state.zone;
    query('.hp-hourly h3').textContent = state.same
      ? 'What time works?'
      : 'Default hours for new dates';
    query('.hp-date-hint').textContent =
      state.mode === 'range'
        ? 'Choose the first and last day of your date range.'
        : 'Choose any dates, including days that aren’t consecutive.';
    const days = query('.hp-days');
    days.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const blank = document.createElement('span');
      blank.setAttribute('aria-hidden', 'true');
      days.append(blank);
    }
    for (let d = 1; d <= 30; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = d;
      b.dataset.day = d;
      b.setAttribute('aria-label', dateLabel(d));
      b.setAttribute('aria-pressed', state.days.includes(d));
      days.append(b);
    }
    root.querySelectorAll('[data-quick]').forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.quick === state.start + ',' + state.end);
      const [start, end] = b.dataset.quick.split(',');
      const duration = (minutes(end) - minutes(start)) / 60;
      b.disabled = state.unit === 'hourly' && duration < state.minimum;
      b.querySelector('span').textContent = b.disabled
        ? duration + 'h · minimum ' + state.minimum + 'h'
        : { '08:00': '8am–12pm', '13:00': '1pm–5pm', '18:00': '6pm–10pm', '09:00': '9am–5pm' }[
            start
          ];
    });
    const list = query('.hp-session-list');
    list.replaceChildren();
    let total = 0;
    let invalid = false;
    state.days
      .sort((a, b) => a - b)
      .forEach(d => {
        const s = session(d);
        const ok = validTime(s.start) && validTime(s.end) && minutes(s.end) > minutes(s.start);
        if (state.unit === 'hourly' && !ok) invalid = true;
        if (ok) total += (minutes(s.end) - minutes(s.start)) / 60;
        const row = document.createElement('div');
        row.className = 'hp-session';
        const date = document.createElement('span');
        date.className = 'hp-session-date';
        date.textContent = dateLabel(d);
        row.append(date);
        const hours = document.createElement('span');
        hours.className = 'hp-session-hours';
        hours.textContent = state.unit === 'daily' ? 'Daily booking' : s.start + '–' + s.end;
        row.append(hours);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'hp-remove';
        remove.dataset.remove = d;
        remove.setAttribute('aria-label', 'Remove ' + dateLabel(d));
        remove.textContent = '×';
        row.append(remove);
        if (state.unit === 'hourly' && !state.same) {
          const fields = document.createElement('div');
          fields.className = 'hp-custom-fields';
          ['start', 'end'].forEach(key => {
            const label = document.createElement('label');
            label.textContent = key === 'start' ? 'From' : 'To';
            const input = document.createElement('input');
            input.type = 'time';
            input.step = 1800;
            input.value = s[key];
            input.dataset.session = d;
            input.dataset.key = key;
            input.setAttribute(
              'aria-label',
              (key === 'start' ? 'From time on ' : 'To time on ') + dateLabel(d)
            );
            label.append(input);
            fields.append(label);
          });
          row.append(fields);
        }
        const violation = minimumResult.violations.find(
          v => v.dates.includes(isoDate(d)) && v.kind !== 'invalid-time'
        );
        if (violation) {
          const warning = document.createElement('span');
          warning.className = 'hp-session-warning';
          warning.textContent =
            violation.kind === 'hours'
              ? 'Selected ' + violation.actual + 'h · minimum ' + state.minimum + 'h per session'
              : 'Part of a ' +
                violation.actual +
                '-day run · minimum ' +
                state.minimum +
                ' consecutive days';
          row.append(warning);
        }
        list.append(row);
      });
    if (!state.days.length) {
      const p = document.createElement('p');
      p.className = 'hp-secondary';
      p.textContent = 'No dates selected';
      list.append(p);
    }
    const belowMinimum = minimumResult.violations.some(v => v.kind !== 'invalid-time');
    query('.hp-error').hidden = !invalid && !belowMinimum;
    query('.hp-error').textContent = invalid
      ? 'Each session needs an end time later than its start time.'
      : state.unit === 'hourly'
      ? 'Each session must be at least ' +
        state.minimum +
        ' hours. Hours on separate dates do not add together to meet this minimum.'
      : 'Each booking must include at least ' +
        state.minimum +
        ' consecutive days. Separate date groups are checked individually.';
    query('#hp-summary').textContent =
      state.unit === 'daily'
        ? state.days.length + ' day' + (state.days.length === 1 ? '' : 's')
        : state.days.length +
          ' session' +
          (state.days.length === 1 ? '' : 's') +
          ' · ' +
          (invalid ? 'Check your times' : Number(total.toFixed(2)) + ' hours total');
    query('#hp-total-detail').textContent =
      state.unit === 'daily'
        ? 'Host’s daily access hours apply.'
        : state.zone.replace(/_/g, ' ') + ' · Only the selected hours on each day';
    query('#hp-review').disabled = !minimumResult.ok;
    query('.hp-review').hidden = !state.review || !minimumResult.ok;
    const review = query('#hp-review-list');
    review.replaceChildren();
    state.days.forEach(d => {
      const p = document.createElement('p');
      const s = session(d);
      p.textContent =
        dateLabel(d) +
        (state.unit === 'daily' ? ' · Daily booking' : ' · ' + s.start + '–' + s.end);
      review.append(p);
    });
    root.querySelectorAll('button').forEach(button => button.classList.add('cursor-interaction'));
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    state.review = false;
    if (b.dataset.unit) {
      state.unit = b.dataset.unit;
    } else if (b.dataset.dates) {
      state.mode = b.dataset.dates;
      if (state.mode === 'range' && state.days.length) {
        const first = Math.min(...state.days),
          last = Math.max(...state.days);
        state.days = Array.from({ length: last - first + 1 }, (_, i) => first + i);
      }
    } else if (b.dataset.day) {
      const day = Number(b.dataset.day);
      if (state.mode === 'selected') {
        state.days = state.days.includes(day)
          ? state.days.filter(d => d !== day)
          : state.days.concat(day);
      } else if (state.days.length === 1) {
        const first = Math.min(day, state.days[0]),
          last = Math.max(day, state.days[0]);
        state.days = Array.from({ length: last - first + 1 }, (_, i) => first + i);
      } else state.days = [day];
    } else if (b.dataset.remove) {
      state.days = state.days.filter(d => d !== Number(b.dataset.remove));
      state.mode = 'selected';
    } else if (b.dataset.quick) {
      [state.start, state.end] = b.dataset.quick.split(',');
    } else if (b.id === 'hp-clear') {
      state.days = [];
    } else if (b.id === 'hp-reset') {
      state = defaults();
    } else if (b.id === 'hp-review') {
      state.review = true;
    }
    render();
  });
  root.addEventListener('change', e => {
    const el = e.target;
    state.review = false;
    if (el.id === 'hp-minimum') state.minimum = Number(el.value);
    else if (el.id === 'hp-start') state.start = el.value;
    else if (el.id === 'hp-end') state.end = el.value;
    else if (el.id === 'hp-zone') state.zone = el.value;
    else if (el.id === 'hp-same') {
      if (!el.checked)
        state.days.forEach(d => (state.overrides[d] = { start: state.start, end: state.end }));
      state.same = el.checked;
    } else if (el.dataset.session) {
      const d = Number(el.dataset.session);
      state.overrides[d] = { ...session(d), [el.dataset.key]: el.value };
    }
    render();
  });
  render();
})();
