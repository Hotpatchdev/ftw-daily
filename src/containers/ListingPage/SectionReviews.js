import React, { useEffect, useRef } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { Reviews, NamedLink } from '../../components';
import { createSlug } from '../../util/urlHelpers';

import css from './ListingPage.module.css';

const SectionReviews = props => {
  const { reviews, fetchReviewsError, listingId, listingTitle } = props;
  const root = useRef(null);
  useEffect(() => {
    if (window.location.hash === '#reviews' && root.current) {
      root.current.scrollIntoView({ block: 'start' });
    }
  }, []);

  const reviewsError = (
    <h2 className={css.errorText}>
      <FormattedMessage id="ListingPage.reviewsError" />
    </h2>
  );

  return (
    <div id="reviews" ref={root} className={css.sectionReviews}>
      <h2 className={css.reviewsHeading}>
        <FormattedMessage id="ListingPage.reviewsHeading" values={{ count: reviews.length }} />
      </h2>
      {fetchReviewsError ? reviewsError : null}
      {listingId ? (
        <NamedLink
          name="ListingReviewsPage"
          params={{ id: listingId, slug: createSlug(listingTitle) }}
        >
          View all reviews
        </NamedLink>
      ) : null}
      <Reviews reviews={reviews} />
    </div>
  );
};

export default SectionReviews;
