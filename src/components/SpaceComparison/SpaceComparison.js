import React, { useEffect, useRef } from 'react';
import { injectIntl, FormattedMessage } from '../../util/reactIntl';
import { NamedLink } from '../../components';
import ListingReviewSummary from '../ListingReviewSummary/ListingReviewSummary';
import { comparisonAmenities, comparisonPrices } from '../../util/spaceComparison';
import { formatMoney } from '../../util/currency';
import { types } from '../../util/sdkLoader';
import { createSlug } from '../../util/urlHelpers';
import config from '../../config';
import css from './SpaceComparison.module.css';

const SpaceComparison = ({ listings, intl }) => {
  const heading = useRef(null);
  useEffect(() => {
    heading.current.focus();
  }, []);
  const options = config.custom.amenities.reduce(
    (all, filter) => all.concat(filter.config.options),
    []
  );
  const groups = comparisonAmenities(listings, options);
  const prices = comparisonPrices(listings);
  const renderPrice = price => {
    if (!price) return 'Not listed';
    try {
      return formatMoney(intl, new types.Money(price.amount, price.currency));
    } catch (error) {
      return 'Price unavailable';
    }
  };
  const details = key =>
    listings.map(listing => {
      const value = (listing.attributes.publicData || {})[key];
      return typeof value === 'string' && value.trim() ? value : null;
    });
  const misc = details('miscAmenities');
  const equipment = details('equipmentProvided');
  return (
    <section aria-labelledby="comparison-title">
      <h2 id="comparison-title" ref={heading} tabIndex={-1}>
        Compare your saved spaces
      </h2>
      <p id="comparison-help" className={css.note}>
        Listed rates only. Final price, fees and availability depend on your booking details. On
        smaller screens, scroll the table sideways to see each space.
      </p>
      <div className={css.scroll} role="region" aria-label="Space comparison table" tabIndex={0}>
        <table className={css.table} aria-describedby="comparison-help">
          <caption className={css.caption}>
            Prices and listed amenities for {listings.length} saved spaces
          </caption>
          <thead>
            <tr>
              <th scope="col">Space</th>
              {listings.map(listing => (
                <th scope="col" key={listing.id.uuid}>
                  <NamedLink
                    name="ListingPage"
                    params={{ id: listing.id.uuid, slug: createSlug(listing.attributes.title) }}
                  >
                    {listing.attributes.title}
                  </NamedLink>
                  <ListingReviewSummary listingId={listing.id.uuid} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.length ? (
              prices.map(row => (
                <tr key={row.key}>
                  <th scope="row">
                    <FormattedMessage id={`ListingCard.${row.key}`} />
                  </th>
                  {row.values.map((price, index) => (
                    <td key={listings[index].id.uuid}>{renderPrice(price)}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <th scope="row">Prices</th>
                {listings.map(listing => (
                  <td key={listing.id.uuid}>Not listed</td>
                ))}
              </tr>
            )}
          </tbody>
          {groups.map(group => (
            <tbody key={group.label}>
              <tr className={css.group}>
                <th colSpan={listings.length + 1} scope="rowgroup">
                  {group.label}
                </th>
              </tr>
              {group.options.map(option => (
                <tr key={option.key}>
                  <th scope="row">{option.label}</th>
                  {listings.map(listing => {
                    const amenities = (listing.attributes.publicData || {}).amenities;
                    return (
                      <td key={listing.id.uuid}>
                        {Array.isArray(amenities) && amenities.includes(option.key)
                          ? 'Listed'
                          : 'Not listed'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          ))}
          <tbody>
            {!groups.length ? (
              <tr>
                <th scope="row">Amenities</th>
                {listings.map(listing => (
                  <td key={listing.id.uuid}>Not listed</td>
                ))}
              </tr>
            ) : null}
            {[
              [misc, 'Other amenities'],
              [equipment, 'Equipment provided'],
            ]
              .filter(([values]) => values.some(Boolean))
              .map(([values, label]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {values.map((value, index) => (
                    <td className={css.details} key={listings[index].id.uuid}>
                      {value || 'Not listed'}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className={css.note}>
        “Not listed” means the host hasn’t included that detail. Check the listing or ask the host
        if it matters for your booking.
      </p>
    </section>
  );
};

export default injectIntl(SpaceComparison);
