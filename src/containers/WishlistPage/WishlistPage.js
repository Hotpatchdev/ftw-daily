import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import {
  Page,
  LayoutSingleColumn,
  LayoutWrapperTopbar,
  LayoutWrapperMain,
  LayoutWrapperFooter,
  Footer,
  ListingCard,
  NamedLink,
} from '../../components';
import { TopbarContainer } from '../../containers';
import SaveListingButton from '../../components/SaveListingButton/SaveListingButton';
import { getListingsById } from '../../ducks/marketplaceData.duck';
import { loadWishlist } from '../../ducks/Wishlist.duck';
import { savedListingIds } from '../../util/wishlist';
import { isScrollingDisabled } from '../../ducks/UI.duck';
import css from './WishlistPage.module.css';

export const WishlistPageComponent = ({
  ids,
  listings,
  loading,
  loaded,
  loadError,
  saveError,
  scrollingDisabled,
  history,
  location,
  reload,
}) => {
  useEffect(() => {
    if (loaded && new URLSearchParams(location.search).has('save')) {
      history.replace({ ...location, search: '' });
    }
  }, [loaded, history, location]);
  const available = ids.map(id => listings.find(listing => listing.id.uuid === id)).filter(Boolean);
  const unavailable = loaded
    ? ids.filter(id => !listings.some(listing => listing.id.uuid === id))
    : [];
  return (
    <Page
      title="Your saved spaces | HotPatch"
      description="Revisit and compare your saved HotPatch spaces."
      scrollingDisabled={scrollingDisabled}
    >
      <LayoutSingleColumn>
        <LayoutWrapperTopbar>
          <TopbarContainer currentPage="WishlistPage" />
        </LayoutWrapperTopbar>
        <LayoutWrapperMain>
          <main className={css.root}>
            <div className={css.heading}>
              <div>
                <span className={css.eyebrow}>YOUR SHORTLIST</span>
                <h1>Your saved spaces</h1>
                <p>Keep the spaces you love in one place. Come back when you’re ready to book.</p>
              </div>
              <NamedLink className={css.browse} name="SearchPage">
                Find more spaces
              </NamedLink>
            </div>
            {loading || (!loaded && !loadError) ? (
              <p role="status">Loading your saved spaces…</p>
            ) : null}
            {loadError ? (
              <div role="alert">
                <p>We couldn’t load your wishlist. Your saved spaces haven’t been removed.</p>
                <button
                  className={css.browse}
                  onClick={() => reload(new URLSearchParams(location.search).get('save'))}
                >
                  Try again
                </button>
              </div>
            ) : null}
            {saveError ? (
              <p role="alert" className={css.error}>
                {saveError.message}
              </p>
            ) : null}
            {loaded && !ids.length ? (
              <div className={css.empty}>
                <h2>A little space for your favourites</h2>
                <p>
                  Tap the heart on any space to save it here. Your wishlist stays with your account
                  across devices.
                </p>
                <NamedLink className={css.primary} name="SearchPage">
                  Explore Patches
                </NamedLink>
              </div>
            ) : null}
            {loaded && ids.length ? (
              <p className={css.count}>
                {ids.length} saved {ids.length === 1 ? 'space' : 'spaces'}
              </p>
            ) : null}
            <div className={css.grid}>
              {available.map(listing => (
                <ListingCard
                  key={listing.id.uuid}
                  listing={listing}
                  renderSizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw"
                />
              ))}
            </div>
            {unavailable.length ? (
              <section className={css.unavailable} aria-label="Unavailable saved spaces">
                <h2>Some spaces are no longer available</h2>
                <p>They’re still on your wishlist. You can remove them below.</p>
                {unavailable.map(id => (
                  <div className={css.unavailableItem} key={id}>
                    <span>Unavailable space</span>
                    <SaveListingButton id={id} title="this unavailable space" text />
                  </div>
                ))}
              </section>
            ) : null}
          </main>
        </LayoutWrapperMain>
        <LayoutWrapperFooter>
          <Footer />
        </LayoutWrapperFooter>
      </LayoutSingleColumn>
    </Page>
  );
};

const mapState = state => ({
  ids: savedListingIds(state.user.currentUser),
  listings: getListingsById(state, state.Wishlist.resultIds),
  loading: state.Wishlist.loading,
  loaded: state.Wishlist.loaded,
  loadError: state.Wishlist.loadError,
  saveError: state.Wishlist.saveError,
  scrollingDisabled: isScrollingDisabled(state),
});

export default withRouter(connect(mapState, { reload: loadWishlist })(WishlistPageComponent));
