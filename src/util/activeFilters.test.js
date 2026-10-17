import { activeFilterTags, removeFilterTag } from './activeFilters';

const filters = [
  { type: 'KeywordFilter', queryParamNames: ['keywords'] },
  { type: 'BookingDateRangeFilter', queryParamNames: ['dates'] },
  { type: 'PriceFilter', queryParamNames: ['price'] },
  {
    type: 'SelectMultipleFilter',
    queryParamNames: ['pub_amenities'],
    config: {
      options: [
        { key: 'wifi', label: 'WiFi' },
        { key: 'parking', label: 'Parking' },
      ],
    },
  },
  {
    type: 'SelectMultipleFilter',
    queryParamNames: ['pub_amenities'],
    config: {
      options: [
        { key: 'wifi', label: 'WiFi' },
        { key: 'mirror', label: 'Mirror' },
      ],
    },
  },
  {
    type: 'SelectMultipleFilter',
    queryParamNames: ['pub_category'],
    config: {
      options: [
        {
          label: 'Beauty',
          children: [
            { key: 'salon', label: 'Salon' },
            { key: 'barber', label: 'Barber' },
          ],
        },
      ],
    },
  },
];

describe('active search filter tags', () => {
  it('resolves nested options and shared parameters without duplicating tags', () => {
    const tags = activeFilterTags(
      { pub_amenities: 'has_all:wifi,parking,wifi', pub_category: 'salon' },
      filters
    );
    expect(tags.map(tag => tag.label)).toEqual(['WiFi', 'Parking', 'Salon']);
  });

  it.each(['has_all:', 'has_any:', ''])(
    'preserves %s semantics and unrelated search context',
    prefix => {
      const params = {
        pub_amenities: prefix + 'wifi,parking',
        pub_category: 'salon',
        address: 'London',
        bounds: 'map-area',
        origin: 'map-origin',
        sort: 'createdAt',
        page: 4,
      };
      expect(
        removeFilterTag(params, { param: 'pub_amenities', type: 'option', value: 'wifi' }, filters)
      ).toEqual({
        pub_amenities: prefix + 'parking',
        pub_category: 'salon',
        address: 'London',
        bounds: 'map-area',
        origin: 'map-origin',
        sort: 'createdAt',
      });
      expect(params.pub_amenities).toBe(prefix + 'wifi,parking');
    }
  );

  it('deletes the query parameter after removing its last selected value', () => {
    expect(
      removeFilterTag(
        { pub_category: 'has_any:salon', pub_amenities: 'wifi' },
        { param: 'pub_category', type: 'option', value: 'salon' },
        filters
      )
    ).toEqual({ pub_amenities: 'wifi' });
  });

  it('clears all filter variants and pagination while retaining location and ordinary sorting', () => {
    const params = {
      keywords: 'studio',
      dates: '2026-11-01,2026-11-02',
      price: '0,50',
      pub_pricePerDayFilter: '0,100',
      pub_pricePerWeekFilter: '0,500',
      pub_pricePerMonthFilter: '0,1000',
      pub_category: 'salon',
      pub_amenities: 'wifi',
      page: 3,
      address: 'London',
      bounds: 'area',
      mapSearch: true,
      sort: '-price',
    };
    expect(removeFilterTag(params, null, filters)).toEqual({
      address: 'London',
      bounds: 'area',
      mapSearch: true,
      sort: '-price',
    });
  });

  it('removes the internal relevance sort only when its keyword is removed', () => {
    expect(
      removeFilterTag(
        { keywords: 'salon', sort: 'relevance', pub_amenities: 'wifi' },
        { param: 'keywords', type: 'keyword' },
        filters
      )
    ).toEqual({ pub_amenities: 'wifi' });
  });

  it('recognises each price unit, valid dates and keyword text', () => {
    const tags = activeFilterTags(
      {
        keywords: 'salon',
        dates: '2026-11-01,2026-11-02',
        price: '0,10',
        pub_pricePerDayFilter: '10,50',
        pub_pricePerWeekFilter: '50,200',
        pub_pricePerMonthFilter: '200,500',
      },
      filters
    );
    expect(tags.filter(tag => tag.type === 'price').map(tag => tag.unit)).toEqual([
      'price',
      'pricePerDay',
      'pricePerWeek',
      'pricePerMonth',
    ]);
    expect(tags.find(tag => tag.type === 'dates').start).toBe('2026-11-01');
    expect(tags.find(tag => tag.type === 'keyword').value).toBe('salon');
  });

  it('ignores malformed ranges, impossible dates and unknown option values', () => {
    expect(
      activeFilterTags(
        {
          dates: '2026-02-30,2026-03-02',
          price: '50,10',
          pub_pricePerDayFilter: 'bad,10',
          pub_amenities: 'unknown',
        },
        filters
      )
    ).toEqual([]);
  });
});
