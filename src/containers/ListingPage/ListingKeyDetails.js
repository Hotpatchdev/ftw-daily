import React from 'react';
import { NamedLink } from '../../components';
import ListingReviewSummary from '../../components/ListingReviewSummary/ListingReviewSummary';
import { createSlug } from '../../util/urlHelpers';
import config from '../../config';
import css from './ListingPage.module.css';

const ListingKeyDetails = ({ listingId, title, publicData = {}, geolocation, published }) => {
  const capacity = Number(publicData.capacity);
  const hasCapacity = Number.isSafeInteger(capacity) && capacity > 0;
  const address = publicData.location && publicData.location.address;
  return (
    <div className={css.keyDetails} aria-label="Space details">
      {geolocation ? (
        <a href="#listing-location" className={css.keyDetail}>
          {config.maps.fuzzy.enabled ? 'View approximate location' : address || 'View location'}
        </a>
      ) : null}
      {hasCapacity ? <span className={css.keyDetail}>Capacity: {capacity}</span> : null}
      {published ? (
        <NamedLink
          title={`Reviews for ${title}`}
          name="ListingReviewsPage"
          params={{ id: listingId, slug: createSlug(title) }}
          className={css.keyDetail}
        >
          Reviews
          <ListingReviewSummary listingId={listingId} />
        </NamedLink>
      ) : null}
    </div>
  );
};

export default ListingKeyDetails;
