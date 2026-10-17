import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import {
  Page,
  LayoutSingleColumn,
  LayoutWrapperTopbar,
  LayoutWrapperMain,
  LayoutWrapperFooter,
  Footer,
  NamedLink,
  Reviews,
  PaginationLinks,
} from '../../components';
import { TopbarContainer, NotFoundPage } from '../../containers';
import { loadReviews } from '../../ducks/ListingReviews.duck';
import { isScrollingDisabled } from '../../ducks/UI.duck';
import { createSlug, stringify } from '../../util/urlHelpers';
import { reviewViewParams, sortedReviews, REVIEWS_PAGE_SIZE } from '../../util/reviewsView';
import css from './ListingReviewsPage.module.css';

export const ListingReviewsPageComponent = ({
  data,
  params,
  location,
  history,
  reload,
  scrollingDisabled,
}) => {
  const { listing, loading, loaded, error, reviews } = data;
  const { sort, page: requestedPage } = reviewViewParams(location.search);
  const ordered = sortedReviews(reviews, sort);
  const totalPages = Math.max(1, Math.ceil(ordered.length / REVIEWS_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const shown = ordered.slice((page - 1) * REVIEWS_PAGE_SIZE, page * REVIEWS_PAGE_SIZE);
  const title = listing ? listing.attributes.title : 'this space';
  const listingParams = { id: params.id, slug: listing ? createSlug(title) : params.slug };
  if (error && error.status === 404) return <NotFoundPage />;
  return (
    <Page title={`Reviews for ${title} | HotPatch`} scrollingDisabled={scrollingDisabled}>
      <LayoutSingleColumn>
        <LayoutWrapperTopbar>
          <TopbarContainer currentPage="ListingReviewsPage" />
        </LayoutWrapperTopbar>
        <LayoutWrapperMain>
          <div className={css.root}>
            <NamedLink
              className={css.back}
              name="ListingPage"
              params={listingParams}
              to={{ hash: '#reviews' }}
            >
              Back to the listing
            </NamedLink>
            <h1>Reviews for {title}</h1>
            {loading || (!loaded && !error) ? <p role="status">Loading public reviews…</p> : null}
            {error ? (
              <div role="alert">
                <p>We couldn’t load all reviews. Please try again.</p>
                <button className={css.retry} onClick={() => reload(params.id, true)}>
                  Try again
                </button>
              </div>
            ) : null}
            {loaded && !reviews.length ? <p>This space hasn’t been reviewed yet.</p> : null}
            {loaded && reviews.length ? (
              <>
                <div className={css.controls}>
                  <p>
                    {(
                      reviews.reduce((sum, review) => sum + review.attributes.rating, 0) /
                      reviews.length
                    ).toFixed(1)}{' '}
                    out of 5 · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                  </p>
                  <div>
                    <label htmlFor="reviews-sort">Sort reviews</label>
                    <select
                      id="reviews-sort"
                      value={sort}
                      onChange={event =>
                        history.push({
                          ...location,
                          search: stringify({ sort: event.target.value }),
                        })
                      }
                    >
                      <option value="recent">Most recent</option>
                      <option value="highest">Highest rated</option>
                      <option value="lowest">Lowest rated</option>
                    </select>
                  </div>
                </div>
                <p role="status" className={css.count}>
                  Showing {(page - 1) * REVIEWS_PAGE_SIZE + 1}–
                  {Math.min(page * REVIEWS_PAGE_SIZE, reviews.length)} of {reviews.length} reviews
                </p>
                <Reviews reviews={shown} />
                {totalPages > 1 ? (
                  <PaginationLinks
                    pageName="ListingReviewsPage"
                    pagePathParams={listingParams}
                    pageSearchParams={{ sort }}
                    pagination={{
                      page,
                      totalPages,
                      totalItems: reviews.length,
                      perPage: REVIEWS_PAGE_SIZE,
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </LayoutWrapperMain>
        <LayoutWrapperFooter>
          <Footer />
        </LayoutWrapperFooter>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapState = state => ({
  data: state.ListingReviews,
  scrollingDisabled: isScrollingDisabled(state),
});
export default withRouter(connect(mapState, { reload: loadReviews })(ListingReviewsPageComponent));
