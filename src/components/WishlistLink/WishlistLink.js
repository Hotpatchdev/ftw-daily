import React from 'react';
import { connect } from 'react-redux';
import { NamedLink } from '../../components';
import { HeartIcon } from '../SaveListingButton/SaveListingButton';
import { savedListingIds } from '../../util/wishlist';
import css from './WishlistLink.module.css';

export const WishlistLinkComponent = ({ count, compact = false }) => (
  <NamedLink className={css.link} name="WishlistPage" title="Your wishlist">
    <HeartIcon />
    <span className={compact ? css.srOnly : css.label}>
      Saved spaces{count ? ` (${count})` : ''}
    </span>
  </NamedLink>
);

export default connect(state => ({ count: savedListingIds(state.user.currentUser).length }))(
  WishlistLinkComponent
);
