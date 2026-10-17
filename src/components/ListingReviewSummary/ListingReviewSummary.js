import React, { useEffect, useRef, useState } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { createInstance } from '../../util/sdkLoader';
import { createReviewSummaryLoader } from '../../util/listingReviews';
import css from './ListingReviewSummary.module.css';

let loadSummary;
const getSummary = id => {
  if (!loadSummary) {
    // Use a public, in-memory SDK session; account data is never needed here.
    loadSummary = createReviewSummaryLoader(
      createInstance({
        clientId: process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID,
        ...(process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL
          ? { baseUrl: process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL }
          : {}),
      })
    );
  }
  return loadSummary(id);
};

const ListingReviewSummary = ({ listingId }) => {
  const element = useRef(null);
  const [result, setResult] = useState(null);
  useEffect(() => {
    let mounted = true;
    setResult(null);
    const load = () =>
      Promise.resolve()
        .then(() => getSummary(listingId))
        .then(summary => {
          if (mounted) setResult({ listingId, ...summary });
        })
        .catch(() => {}); // An unavailable rating must not appear as zero reviews.
    let observer;
    if (typeof IntersectionObserver === 'undefined') load();
    else {
      observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            observer.disconnect();
            load();
          }
        },
        { rootMargin: '100px' }
      );
      observer.observe(element.current);
    }
    return () => {
      mounted = false;
      if (observer) observer.disconnect();
    };
  }, [listingId]);
  const summary = result && result.listingId === listingId ? result : null;
  return (
    <div ref={element} className={css.root}>
      {summary ? (
        summary.count ? (
          <span>
            <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" className={css.star}>
              <path
                fill="currentColor"
                d="m10 1 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L10 15.3l-5.6 2.9 1.1-6.2L1 7.6l6.2-.9z"
              />
            </svg>
            <FormattedMessage
              id="ListingCard.reviewSummary"
              values={{
                rating: summary.average.toFixed(1),
                count: summary.count,
              }}
            />
          </span>
        ) : (
          <FormattedMessage id="ListingCard.noReviews" />
        )
      ) : null}
    </div>
  );
};

export default ListingReviewSummary;
