import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import classNames from 'classnames';
import { setSavedListing } from '../../ducks/Wishlist.duck';
import { savedListingIds } from '../../util/wishlist';
import { createResourceLocatorString } from '../../util/routes';
import routeConfiguration from '../../routeConfiguration';
import css from './SaveListingButton.module.css';

export const HeartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"
      fill="currentColor"
      fillOpacity=".12"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>
);

export const SaveListingButtonComponent = ({
  id,
  title,
  className,
  saved,
  savingId,
  error,
  authenticated,
  onSave,
  history,
  text = false,
}) => {
  const label = saved ? `Remove ${title} from your wishlist` : `Save ${title} to your wishlist`;
  const click = () => {
    if (!authenticated) {
      history.push(
        createResourceLocatorString('WishlistPage', routeConfiguration(), {}, { save: id })
      );
    } else {
      onSave(id, !saved);
    }
  };
  return (
    <div className={classNames(css.root, className)}>
      <button
        type="button"
        className={classNames(css.button, { [css.saved]: saved, [css.textButton]: text })}
        aria-label={label}
        aria-pressed={saved}
        disabled={!!savingId}
        onClick={click}
        title={label}
      >
        <HeartIcon />
        {text ? <span>{savingId === id ? 'Saving…' : saved ? 'Remove' : 'Save space'}</span> : null}
      </button>
      {error ? (
        <span className={css.error} role="alert">
          {error.message}
        </span>
      ) : null}
    </div>
  );
};

const mapState = (state, props) => ({
  saved: savedListingIds(state.user.currentUser).includes(props.id),
  authenticated: state.Auth.isAuthenticated,
  savingId: state.Wishlist.savingId,
  error:
    state.Wishlist.saveError && state.Wishlist.saveError.id === props.id
      ? state.Wishlist.saveError
      : null,
});

export default withRouter(
  connect(mapState, { onSave: setSavedListing })(SaveListingButtonComponent)
);
