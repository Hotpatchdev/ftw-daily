import React, { useRef } from 'react';
import { array, bool, func, object, shape, string } from 'prop-types';
import classNames from 'classnames';
import config from '../../config';
import routeConfiguration from '../../routeConfiguration';
import { FormattedMessage } from '../../util/reactIntl';
import { createResourceLocatorString } from '../../util/routes';
import { isAnyFilterActive } from '../../util/search';
import { propTypes } from '../../util/types';
import { SearchResultsPanel, SortBy } from '../../components';
import ActiveFilterTags from '../../components/ActiveFilterTags/ActiveFilterTags';
import DiscoveryFilters from '../../components/DiscoveryFilters/DiscoveryFilters';
import { removeFilterTag } from '../../util/activeFilters';
import css from './SearchPage.module.css';

const MainPanel = props => {
  const {
    className,
    rootClassName,
    urlQueryParams,
    listings,
    searchInProgress,
    searchListingsError,
    searchParamsAreInSync,
    onActivateListing,
    onManageDisableScrolling,
    onOpenModal,
    onCloseModal,
    onMapIconClick,
    pagination,
    searchParamsForPagination,
    filterConfig,
    sortConfig,
    h1,
    history,
  } = props;
  const heading = useRef(null);
  const params = searchParamsForPagination || urlQueryParams;
  const navigate = next =>
    history.push(createResourceLocatorString('SearchPage', routeConfiguration(), {}, next));
  const conflicting = isAnyFilterActive(sortConfig.conflictingFilters, params, filterConfig);
  const listingsAreLoaded = !searchInProgress && searchParamsAreInSync && !!pagination;
  const totalItems = listingsAreLoaded && pagination.totalItems != null ? pagination.totalItems : 0;
  const applyFilters = next => {
    const hasConflict = isAnyFilterActive(sortConfig.conflictingFilters, next, filterConfig);
    const search = { ...next };
    if (hasConflict) delete search[sortConfig.queryParamName];
    navigate(search);
  };
  const sort = (param, value) => {
    const next = { ...params };
    delete next.page;
    if (value) next[param] = value;
    else delete next[param];
    navigate(next);
  };
  return (
    <div className={classNames(rootClassName || css.searchResultContainer, className)}>
      <h1 className={css.h1} ref={heading} tabIndex={-1}>
        {h1}
      </h1>
      <div className={css.discoveryToolbar}>
        <DiscoveryFilters
          params={params}
          filters={filterConfig}
          onApply={applyFilters}
          onOpen={onOpenModal}
          onClose={onCloseModal}
          onManageDisableScrolling={onManageDisableScrolling}
          resultsCount={totalItems}
          listingsAreLoaded={listingsAreLoaded}
          searchInProgress={searchInProgress}
        />
        {sortConfig.active ? (
          <SortBy
            sort={params[sortConfig.queryParamName]}
            isConflictingFilterActive={!!conflicting}
            onSelect={sort}
            showAsPopup
            contentPlacementOffset={-14}
          />
        ) : null}
        <button type="button" className={css.discoveryMapButton} onClick={onMapIconClick}>
          Map
        </button>
      </div>
      <p className={css.discoveryResultCount} aria-live="polite">
        {searchInProgress
          ? 'Finding spaces…'
          : listingsAreLoaded
          ? `${totalItems} spaces found`
          : ''}
      </p>
      <ActiveFilterTags
        params={params}
        filters={filterConfig}
        onRemove={tag => navigate(removeFilterTag(params, tag, filterConfig))}
        onClear={() => navigate(removeFilterTag(params, null, filterConfig))}
        onEmpty={() => {
          if (heading.current) heading.current.focus();
        }}
      />
      <div className={classNames(css.listings, { [css.newSearchInProgress]: !listingsAreLoaded })}>
        {searchListingsError ? (
          <h2 className={css.error}>
            <FormattedMessage id="SearchPage.searchError" />
          </h2>
        ) : null}
        <SearchResultsPanel
          className={css.searchListingsPanel}
          listings={listings}
          pagination={listingsAreLoaded ? pagination : null}
          search={params}
          setActiveListing={onActivateListing}
        />
      </div>
    </div>
  );
};

MainPanel.defaultProps = {
  className: null,
  rootClassName: null,
  listings: [],
  pagination: null,
  searchParamsForPagination: null,
  filterConfig: config.custom.filters,
  sortConfig: config.custom.sortConfig,
};
MainPanel.propTypes = {
  className: string,
  rootClassName: string,
  h1: string,
  urlQueryParams: object.isRequired,
  listings: array,
  searchInProgress: bool.isRequired,
  searchListingsError: propTypes.error,
  searchParamsAreInSync: bool.isRequired,
  onActivateListing: func.isRequired,
  onManageDisableScrolling: func.isRequired,
  onOpenModal: func.isRequired,
  onCloseModal: func.isRequired,
  onMapIconClick: func.isRequired,
  pagination: propTypes.pagination,
  searchParamsForPagination: object,
  filterConfig: propTypes.filterConfig,
  sortConfig: propTypes.sortConfig,
  history: shape({ push: func.isRequired }).isRequired,
};
export default MainPanel;
