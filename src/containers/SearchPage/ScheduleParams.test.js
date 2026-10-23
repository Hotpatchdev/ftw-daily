import { validFilterParams, pickSearchParamsOnly } from './SearchPage.helpers';
import { removeFilterTag, activeFilterTags } from '../../util/activeFilters';
import { discoverySearchParams, validateDiscoverySearch } from '../../util/discoverySearch';
import config from '../../config';

const value = { unit: 'hourly', days: ['2027-02-01', '2027-02-03'], start: '09:00', end: '15:00', same: true, timeZone: 'Europe/London' };
const schedule = JSON.stringify(value);

it('preserves the schedule in map moves, sorting and URL synchronisation', () => {
  const params = { schedule, page: 2, address: 'London', pub_amenities: 'has_all:wifi' };
  expect(validFilterParams(params, config.custom.filters).schedule).toBe(schedule);
  expect(pickSearchParamsOnly(params, config.custom.filters, config.custom.sortConfig).schedule).toBe(schedule);
});
it('removes the schedule with its tag or Clear filters while retaining location', () => {
  const params = { schedule, address: 'London', page: 2 };
  const tag = activeFilterTags(params, config.custom.filters).find(tag => tag.type === 'schedule');
  expect(tag.label).toBe('2 sessions · 12 hours');
  expect(removeFilterTag(params, tag, config.custom.filters)).toEqual({ address: 'London' });
  expect(removeFilterTag(params, null, config.custom.filters)).toEqual({ address: 'London' });
});
it('submits the homepage schedule and rejects invalid per-day hours', () => {
  expect(JSON.parse(discoverySearchParams({ schedule: value }).schedule)).toEqual(value);
  expect(validateDiscoverySearch({ schedule: { ...value, same: false, overrides: { '2027-02-03': { start: '15:00', end: '09:00' } } } }).dates).toBeTruthy();
});
