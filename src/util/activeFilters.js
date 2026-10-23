import { normaliseSchedule, scheduleSummary } from './bookingSchedule';

export const PRICE_FILTER_PARAMS = {
  price: 'price',
  pub_pricePerDayFilter: 'pricePerDay',
  pub_pricePerWeekFilter: 'pricePerWeek',
  pub_pricePerMonthFilter: 'pricePerMonth',
};

const values = value =>
  typeof value === 'string'
    ? Array.from(
        new Set(
          value
            .replace(/^has_(any|all):/, '')
            .split(',')
            .filter(Boolean)
        )
      )
    : [];
const flattenOptions = options =>
  (options || []).reduce(
    (all, option) =>
      all.concat(
        option.children && option.children.length ? flattenOptions(option.children) : [option]
      ),
    []
  );
const validDate = value =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

export const activeFilterTags = (params, filters) => {
  const tags = [];
  if (typeof params.keywords === 'string' && params.keywords.trim()) {
    tags.push({ param: 'keywords', type: 'keyword', value: params.keywords });
  }
  const dates = typeof params.dates === 'string' ? params.dates.split(',') : [];
  if (params.schedule) {
    try {
      const schedule = normaliseSchedule(params.schedule);
      tags.push({ param: 'schedule', type: 'schedule', label: scheduleSummary(schedule) });
    } catch (e) {
      /* Invalid schedules are reported by the search loader. */
    }
  }
  if (dates.length === 2 && dates.every(validDate) && dates[0] <= dates[1]) {
    tags.push({ param: 'dates', type: 'dates', start: dates[0], end: dates[1] });
  }
  Object.keys(PRICE_FILTER_PARAMS).forEach(param => {
    const range = typeof params[param] === 'string' ? params[param].split(',') : [];
    if (
      range.length === 2 &&
      range.every(v => /^\d+(\.\d+)?$/.test(v) && Number.isFinite(Number(v))) &&
      Number(range[0]) <= Number(range[1])
    ) {
      tags.push({
        param,
        type: 'price',
        min: Number(range[0]),
        max: Number(range[1]),
        unit: PRICE_FILTER_PARAMS[param],
      });
    }
  });
  const optionsByParam = new Map();
  filters
    .filter(filter => ['SelectSingleFilter', 'SelectMultipleFilter'].includes(filter.type))
    .forEach(filter => {
      const names = Array.isArray(filter.queryParamNames)
        ? filter.queryParamNames
        : [filter.queryParamNames];
      names.forEach(param => {
        const options = optionsByParam.get(param) || new Map();
        flattenOptions((filter.config || {}).options).forEach(option => {
          if (!options.has(option.key)) options.set(option.key, option.label);
        });
        optionsByParam.set(param, options);
      });
    });
  optionsByParam.forEach((options, param) => {
    values(params[param]).forEach(value => {
      if (options.has(value))
        tags.push({ param, value, type: 'option', label: options.get(value) });
    });
  });
  return tags;
};

// Clear one value, not the other selections sharing its API query parameter.
// Pagination is reset; the map area, location, sorting and other criteria survive.
export const removeFilterTag = (params, tag, filters) => {
  const next = { ...params };
  delete next.page;
  if (!tag) {
    delete next.schedule;
    filters.forEach(filter => {
      const names = Array.isArray(filter.queryParamNames)
        ? filter.queryParamNames
        : [filter.queryParamNames];
      names.forEach(name => delete next[name]);
    });
    Object.keys(PRICE_FILTER_PARAMS).forEach(name => delete next[name]);
  } else if (tag.type === 'option') {
    const raw = params[tag.param];
    const prefix = typeof raw === 'string' ? (raw.match(/^has_(any|all):/) || [''])[0] : '';
    const remaining = values(raw).filter(value => value !== tag.value);
    if (remaining.length) next[tag.param] = prefix + remaining.join(',');
    else delete next[tag.param];
  } else {
    delete next[tag.param];
  }
  if (!next.keywords && next.sort === 'relevance') delete next.sort;
  return next;
};
