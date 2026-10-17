import { groupAmenities } from './amenityGroups';
import { generalAmenitiesOptions, hairAndBeautyAmenitiesOptions } from '../custom-config-options';

describe('amenity presentation groups', () => {
  it('preserves every existing facility key exactly once', () => {
    [generalAmenitiesOptions, hairAndBeautyAmenitiesOptions].forEach(options => {
      const keys = groupAmenities(options).reduce(
        (all, group) => all.concat(group.options.map(o => o.key)),
        []
      );
      expect(keys.sort()).toEqual(options.map(o => o.key).sort());
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
  it('keeps access and parking in separate groups', () => {
    const groups = groupAmenities(generalAmenitiesOptions);
    expect(groups.find(g => g.label === 'Parking & transport').options.map(o => o.key)).toContain(
      'free-parking'
    );
    expect(
      groups.find(g => g.label === 'Access & accessibility').options.map(o => o.key)
    ).toContain('step-free-access');
    expect(
      groups.find(g => g.label === 'Access & accessibility').options.map(o => o.key)
    ).toContain('wheelchair-access');
    const facilities = groups.find(g => g.label === 'Facilities & hygiene').options.map(o => o.key);
    expect(facilities).toContain('toilet');
    expect(facilities).toContain('handwash-station');
  });
});
