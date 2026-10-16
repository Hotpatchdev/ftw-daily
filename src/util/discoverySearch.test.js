import { discoverySearchParams, validateDiscoverySearch } from './discoverySearch';

describe('discovery search', () => {
  it('supports an unrestricted browse without inventing a location', () => {
    expect(discoverySearchParams({})).toEqual({});
  });
  it('combines keyword, selected Google bounds and the existing inclusive date filter', () => {
    expect(
      discoverySearchParams({
        keywords: '  salon chair ',
        location: { search: 'London', selectedPlace: { bounds: 'bounds', address: 'London, UK' } },
        startDate: '2026-11-01',
        endDate: '2026-11-02',
      })
    ).toEqual({
      keywords: 'salon chair',
      address: 'London, UK',
      bounds: 'bounds',
      dates: '2026-11-01,2026-11-02',
    });
  });
  it('rejects unselected location text instead of silently ignoring it', () => {
    expect(validateDiscoverySearch({ location: { search: 'London' } }).location).toBeTruthy();
  });
  it('requires both dates and rejects a reversed date range', () => {
    expect(validateDiscoverySearch({ startDate: '2026-11-02' }).dates).toBeTruthy();
    expect(
      validateDiscoverySearch({ startDate: '2026-11-02', endDate: '2026-11-01' }).dates
    ).toBeTruthy();
    expect(validateDiscoverySearch({ startDate: '2026-11-02', endDate: '2026-11-02' })).toEqual({});
  });
});
