// Search uses the existing inclusive date-range filter and Google place bounds.
export const validateDiscoverySearch = values => {
  const errors = {};
  const location = values.location;
  if (location && location.search && !location.selectedPlace) {
    errors.location = 'Choose a location from the suggestions, or clear it to search everywhere.';
  }
  if (!!values.startDate !== !!values.endDate) {
    errors.dates = 'Choose both a start and end date, or clear both to stay flexible.';
  } else if (values.startDate && values.endDate < values.startDate) {
    errors.dates = 'The end date must be on or after the start date.';
  }
  return errors;
};

export const discoverySearchParams = values => {
  const place = values.location && values.location.selectedPlace;
  const keywords = (values.keywords || '').trim();
  return {
    ...(keywords ? { keywords } : {}),
    ...(place ? { address: place.address || values.location.search, bounds: place.bounds } : {}),
    ...(values.startDate && values.endDate
      ? { dates: `${values.startDate},${values.endDate}` }
      : {}),
  };
};
