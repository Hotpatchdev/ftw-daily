import React, { Component } from 'react';
import { InlineShareButtons } from 'sharethis-reactjs';
import { array, arrayOf, bool, object, func, shape, string, oneOf } from 'prop-types';
import { FormattedMessage, intlShape, injectIntl } from '../../util/reactIntl';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import config from '../../config';
import routeConfiguration from '../../routeConfiguration';
import { findOptionsForSelectFilter } from '../../util/search';
import {
  LISTING_STATE_PENDING_APPROVAL,
  LISTING_STATE_CLOSED,
  propTypes,
  HOURLY_PRICE,
} from '../../util/types';
import { types as sdkTypes } from '../../util/sdkLoader';
import {
  LISTING_PAGE_DRAFT_VARIANT,
  LISTING_PAGE_PENDING_APPROVAL_VARIANT,
  LISTING_PAGE_PARAM_TYPE_DRAFT,
  LISTING_PAGE_PARAM_TYPE_EDIT,
  createSlug,
} from '../../util/urlHelpers';
import { formatMoney } from '../../util/currency';
import { createResourceLocatorString, findRouteByRouteName } from '../../util/routes';
import {
  ensureListing,
  ensureOwnListing,
  ensureUser,
  userDisplayNameAsString,
  getLowestPrice,
  getSelectedCategories,
} from '../../util/data';
import { timestampToDate, calculateQuantityFromHours } from '../../util/dates';
import { richText } from '../../util/richText';
import { getMarketplaceEntities } from '../../ducks/marketplaceData.duck';
import { manageDisableScrolling, isScrollingDisabled } from '../../ducks/UI.duck';
import { initializeCardPaymentData } from '../../ducks/stripe.duck.js';
import {
  Page,
  NamedLink,
  NamedRedirect,
  LayoutSingleColumn,
  LayoutWrapperTopbar,
  LayoutWrapperMain,
  LayoutWrapperFooter,
  Footer,
  BookingPanel,
} from '../../components';
import moment, { relativeTimeRounding } from 'moment';
import { TopbarContainer, NotFoundPage } from '../../containers';

import {
  sendEnquiry,
  loadData,
  setInitialValues,
  fetchTimeSlotsTime,
  fetchTransactionLineItems,
} from './ListingPage.duck';
import SectionImages from './SectionImages';
import SectionAvatar from './SectionAvatar';
import SectionHeading from './SectionHeading';
import SectionDescriptionMaybe from './SectionDescriptionMaybe';
import SectionFeaturesMaybe from './SectionFeaturesMaybe';
import SectionReviews from './SectionReviews';
import SectionHostMaybe from './SectionHostMaybe';
import SectionMiscMaybe from './SectionMiscMaybe';
import SectionEquipmentMaybe from './SectionEquipmentMaybe';
import SectionRulesMaybe from './SectionRulesMaybe';
import SectionMapMaybe from './SectionMapMaybe';
import SectionCapacity from './SectionCapacity';
import SectionSeats from './SectionSeats';
import css from './ListingPage.module.css';
import Swal from 'sweetalert2';

const MIN_LENGTH_FOR_LONG_WORDS_IN_TITLE = 16;

const { UUID, Money } = sdkTypes;

const priceData = (price, intl) => {
  if (
    price &&
    (price.currency === config.currency || price.currency === config.additionalCurrency)
  ) {
    const formattedPrice = formatMoney(intl, price);
    return { formattedPrice, priceTitle: formattedPrice };
  } else if (price) {
    return {
      formattedPrice: `(${price.currency})`,
      priceTitle: `Unsupported currency (${price.currency})`,
    };
  }
  return {};
};

const categoryLabel = (categories, key) => {
  const cats = getSelectedCategories(key, categories);
  const categoryOptionsToSelect = categories && categories.filter(item => cats.includes(item.key));

  return [...new Set(categoryOptionsToSelect.map(({ label }) => label))].join(' | ');
};

export class ListingPageComponent extends Component {
  constructor(props) {
    super(props);
    const { enquiryModalOpenForListingId, params } = props;
    this.state = {
      promocode: false,
      pageClassNames: [],
      imageCarouselOpen: false,
      enquiryModalOpen: enquiryModalOpenForListingId === params.id,
      bookingType: null,
      enquiryDateTimeDataError: false,
      enquiryDateTimeData: {
        StartDate: '',
        EndDate: '',
        StartTime: '',
        EndTime: '',
        planType: '',
      },
    };

    this.handleSubmit = this.handleSubmit.bind(this);
    this.onContactUser = this.onContactUser.bind(this);
    this.onSubmitEnquiry = this.onSubmitEnquiry.bind(this);
    this.toggleBookingType = this.toggleBookingType.bind(this);
  }

  updateEnquiryDateTime = data => {
    this.setState({
      enquiryDateTimeData: { ...this.state.enquiryDateTimeData, ...data },
    });
  };

  updateDiscount = val => {
    this.setState({ promocode: val });
  };
  toggleBookingType(bookingType) {
    this.setState({ bookingType });
  }

  handleSubmit(values) {
    const {
      history,
      getListing,
      params,
      callSetInitialValues,
      onInitializeCardPaymentData,
    } = this.props;
    const { bookingType } = this.state;
    const listingId = new UUID(params.id);
    const listing = getListing(listingId);

    const { bookingStartTime, bookingEndTime, bookingDates, ...restOfValues } = values;
    const bookingStart =
      bookingType === HOURLY_PRICE
        ? timestampToDate(bookingStartTime)
        : moment
            .utc(bookingDates.startDate)
            .startOf('day')
            .toDate();
    const bookingEnd =
      bookingType === HOURLY_PRICE
        ? timestampToDate(bookingEndTime)
        : moment
            .utc(bookingDates.endDate)
            .startOf('day')
            .toDate();
    const promocode = this.state.promocode;

    const bookingData = {
      // quantity: calculateQuantityFromHours(bookingStart, bookingEnd),
      bookingType,
      promocode,
      ...restOfValues,
    };

    const initialValues = {
      listing,
      bookingData,
      bookingDates: {
        bookingStart,
        bookingEnd,
      },
      confirmPaymentError: null,
    };

    const saveToSessionStorage = !this.props.currentUser;

    const routes = routeConfiguration();
    // Customize checkout page state with current listing and selected bookingDates
    const { setInitialValues } = findRouteByRouteName('CheckoutPage', routes);

    callSetInitialValues(setInitialValues, initialValues, saveToSessionStorage);

    // Clear previous Stripe errors from store if there is any
    onInitializeCardPaymentData();

    console.log('submit booking =>', initialValues);
    // Redirect to CheckoutPage
    history.push(
      createResourceLocatorString(
        'CheckoutPage',
        routes,
        { id: listing.id.uuid, slug: createSlug(listing.attributes.title) },
        {}
      )
    );
  }

  onContactUser() {
    const {
      currentUser,
      history,
      callSetInitialValues,
      params,
      location,
      getOwnListing,
      getListing,
    } = this.props;
    // const listingId = new UUID(params.id);
    // const isPendingApprovalVariant = params.variant === LISTING_PAGE_PENDING_APPROVAL_VARIANT;
    // const isDraftVariant = params.variant === LISTING_PAGE_DRAFT_VARIANT;
    // const currentListing =
    //   isPendingApprovalVariant || isDraftVariant
    //     ? ensureOwnListing(getOwnListing(listingId))
    //     : ensureListing(getListing(listingId));

    // var data = currentListing?.attributes?.title
    // var patchId = currentListing?.id?.uuid;

    // var url = "https://share.hsforms.com/1Zq6xDjz7RCG8gjdC1vBbgA57edm?patch_name=" + encodeURIComponent(JSON.stringify(data)) + "&patch_url=https://www.hotpatch.com/l/" + encodeURIComponent(patchId);

    if (!currentUser) {
      const state = { from: `${location.pathname}${location.search}${location.hash}` };
      // const state = { from: url };

      // We need to log in before showing the modal, but first we need to ensure
      // that modal does open when user is redirected back to this listingpage
      callSetInitialValues(setInitialValues, { enquiryModalOpenForListingId: params.id });

      // signup and return back to listingPage.
      history.push(createResourceLocatorString('SignupPage', routeConfiguration(), {}, {}), state);
    } else {
      console.log('user is loged in but enquirey modal is not opening');
      this.setState({ enquiryModalOpen: true });
    }
  }
  formatTimeString(StartTime, EndTime, SDate, EDate) {
    const [startHour, startMinute] = StartTime.split(':').map(Number);
    const [endHour, endMinute] = EndTime.split(':').map(Number);

    // Create new Date objects for the start and end times
    const startDateTime = new Date(SDate);
    startDateTime.setHours(startHour);
    startDateTime.setMinutes(startMinute);

    const endDateTime = new Date(EDate);
    endDateTime.setHours(endHour);
    endDateTime.setMinutes(endMinute);

    // Convert the Date objects to timestamps
    return {
      startTimestamp: startDateTime.getTime(),
      endTimestamp: endDateTime.getTime(),
    };
  }

  onSubmitEnquiry(values, unitType, currentListing, lineItems) {
    const { history, params, onSendEnquiry } = this.props;
    const { EndDate, EndTime, StartDate, StartTime, planType } = this.state.enquiryDateTimeData;
    const routes = routeConfiguration();
    const listingId = new UUID(params.id);
    const { message } = values;
    let modifiedMessage = message;

    if (planType === 'price' && (EndTime === '' || StartDate === '' || StartTime === '')) {
      this.setState({ enquiryDateTimeDataError: true });
    } else if (planType !== 'price' && (EndDate === '' || StartDate === '')) {
      this.setState({ enquiryDateTimeDataError: true });
    } else {
      this.setState({ enquiryDateTimeDataError: false });

      const _EndDate = planType === 'price' ? StartDate : EndDate; // if price, end date is same as start date

      const protectedData = {
        startTime: StartTime || null,
        endTime: EndTime || null,
        displayStartDate: new Date(StartDate).toISOString().split('T')[0],
        displayEndDate: new Date(_EndDate).toISOString().split('T')[0],
        startDate: StartDate.toString(),
        endDate: _EndDate.toString(),
        planType: planType,
      };

      console.log('onSubmitEnquiry', protectedData);
      //! Remove comments to apply regex functionality on messages

      const hideEmail = text =>
        text.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'HIDDEN');
      const hidePhone = text =>
        text.replace(/(\+?\d{0,2}\s?)?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{4}/g, 'HIDDEN');
      const hideWebsite = text =>
        text.replace(/(https?:\/\/)?(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/\S*)?/g, 'HIDDEN');
      modifiedMessage = hideEmail(modifiedMessage);
      modifiedMessage = hidePhone(modifiedMessage);
      modifiedMessage = hideWebsite(modifiedMessage);

      // console.log('regex,', modifiedMessage, !modifiedMessage.includes('HIDDEN'));
      if (modifiedMessage.includes('HIDDEN')) {
        Swal.fire({
          title: "Hold your horses! We can't hit that send button just yet",
          text: `Contact info can't be shared until a booking is confirmed.
           To send the message, please remove the contact info.`,
          confirmButtonText: 'Edit Message',
          confirmButtonColor: '#5cbfcc',
        }).then(() => {
          return;
        });
        return;
      }

      onSendEnquiry(listingId, modifiedMessage.trim(), unitType, protectedData)
        .then(txId => {
          this.setState({ enquiryModalOpen: false });

          // Redirect to OrderDetailsPage
          history.push(
            createResourceLocatorString('OrderDetailsPage', routes, { id: txId.uuid }, {})
          );
        })
        .catch(() => {
          // Ignore, error handling in duck file
        });
    }
  }

  render() {
    const {
      unitType,
      isAuthenticated,
      currentUser,
      getListing,
      getOwnListing,
      intl,
      onManageDisableScrolling,
      onFetchTimeSlots,
      params: rawParams,
      location,
      scrollingDisabled,
      showListingError,
      reviews,
      fetchReviewsError,
      sendEnquiryInProgress,
      sendEnquiryError,
      timeSlots,
      monthlyTimeSlots,
      fetchTimeSlotsError,
      filterConfig,
      onFetchTransactionLineItems,
      lineItems,
      fetchLineItemsInProgress,
      fetchLineItemsError,
    } = this.props;

    const listingId = new UUID(rawParams.id);
    const isPendingApprovalVariant = rawParams.variant === LISTING_PAGE_PENDING_APPROVAL_VARIANT;
    const isDraftVariant = rawParams.variant === LISTING_PAGE_DRAFT_VARIANT;
    const currentListing =
      isPendingApprovalVariant || isDraftVariant
        ? ensureOwnListing(getOwnListing(listingId))
        : ensureListing(getListing(listingId));

    const listingSlug = rawParams.slug || createSlug(currentListing.attributes.title || '');
    const params = { slug: listingSlug, ...rawParams };
    console.log('Listing Page =>', this.state.enquiryDateTimeData);

    const listingType = isDraftVariant
      ? LISTING_PAGE_PARAM_TYPE_DRAFT
      : LISTING_PAGE_PARAM_TYPE_EDIT;
    const listingTab = isDraftVariant ? 'photos' : 'description';

    const isApproved =
      currentListing.id && currentListing.attributes.state !== LISTING_STATE_PENDING_APPROVAL;

    const pendingIsApproved = isPendingApprovalVariant && isApproved;

    // If a /pending-approval URL is shared, the UI requires
    // authentication and attempts to fetch the listing from own
    // listings. This will fail with 403 Forbidden if the author is
    // another user. We use this information to try to fetch the
    // public listing.
    const pendingOtherUsersListing =
      (isPendingApprovalVariant || isDraftVariant) &&
      showListingError &&
      showListingError.status === 403;
    const shouldShowPublicListingPage = pendingIsApproved || pendingOtherUsersListing;

    if (shouldShowPublicListingPage) {
      return <NamedRedirect name="ListingPage" params={params} search={location.search} />;
    }

    const {
      description = '',
      geolocation = null,
      price = null,
      title = '',
      availabilityPlan = null,
      publicData,
    } = currentListing.attributes;

    // console.log('currentListing', currentListing);
    const richTitle = (
      <span>
        {richText(title, {
          longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS_IN_TITLE,
          longWordClass: css.longWord,
        })}
      </span>
    );

    const bookingTitle = (
      <FormattedMessage id="ListingPage.bookingTitle" values={{ title: richTitle }} />
    );

    const planSubtitle = {
      'availability-plan/day': 'days',
      'availability-plan/time': 'hours',
    };
    const subtitle = availabilityPlan ? planSubtitle[availabilityPlan.type] : '';
    const bookingSubTitle = intl.formatMessage(
      { id: 'ListingPage.bookingSubTitle' },
      { availabilityPlan: subtitle }
    );

    const topbar = <TopbarContainer />;

    if (showListingError && showListingError.status === 404) {
      // 404 listing not found

      return <NotFoundPage />;
    } else if (showListingError) {
      // Other error in fetching listing

      const errorTitle = intl.formatMessage({
        id: 'ListingPage.errorLoadingListingTitle',
      });
      //temp
      return (
        <Page title={errorTitle} scrollingDisabled={scrollingDisabled}>
          <LayoutSingleColumn className={css.pageRoot}>
            <LayoutWrapperTopbar>{topbar}</LayoutWrapperTopbar>
            <LayoutWrapperMain>
              <p className={css.errorText}>
                <FormattedMessage id="ListingPage.errorLoadingListingMessage" />
              </p>
            </LayoutWrapperMain>
            <LayoutWrapperFooter>
              <Footer />
            </LayoutWrapperFooter>
          </LayoutSingleColumn>
        </Page>
      );
    } else if (!currentListing.id) {
      // Still loading the listing

      const loadingTitle = intl.formatMessage({
        id: 'ListingPage.loadingListingTitle',
      });

      return (
        <Page title={loadingTitle} scrollingDisabled={scrollingDisabled}>
          <LayoutSingleColumn className={css.pageRoot}>
            <LayoutWrapperTopbar>{topbar}</LayoutWrapperTopbar>
            <LayoutWrapperMain>
              <p className={css.loadingText}>
                <FormattedMessage id="ListingPage.loadingListingMessage" />
              </p>
            </LayoutWrapperMain>
            <LayoutWrapperFooter>
              <Footer />
            </LayoutWrapperFooter>
          </LayoutSingleColumn>
        </Page>
      );
    }

    const handleViewPhotosClick = e => {
      // Stop event from bubbling up to prevent image click handler
      // trying to open the carousel as well.
      e.stopPropagation();
      this.setState({
        imageCarouselOpen: true,
      });
    };
    const authorAvailable = currentListing && currentListing.author;
    const userAndListingAuthorAvailable = !!(currentUser && authorAvailable);
    const isOwnListing =
      userAndListingAuthorAvailable && currentListing.author.id.uuid === currentUser.id.uuid;
    const showContactUser = authorAvailable && (!currentUser || (currentUser && !isOwnListing));

    const currentAuthor = authorAvailable ? currentListing.author : null;
    const ensuredAuthor = ensureUser(currentAuthor);

    // When user is banned or deleted the listing is also deleted.
    // Because listing can be never showed with banned or deleted user we don't have to provide
    // banned or deleted display names for the function
    const authorDisplayName = userDisplayNameAsString(ensuredAuthor, '');

    const {
      key: priceType,
      value: { amount, currency },
    } = getLowestPrice(currentListing);

    const { formattedPrice, priceTitle } = priceData(
      amount && currency ? new Money(amount, currency) : null,
      intl
    );

    const handleBookingSubmit = values => {
      const isCurrentlyClosed = currentListing.attributes.state === LISTING_STATE_CLOSED;
      if (isOwnListing || isCurrentlyClosed) {
        window.scrollTo(0, 0);
      } else {
        this.handleSubmit(values);
      }
    };

    const listingImages = (listing, variantName) =>
      (listing.images || [])
        .map(image => {
          const variants = image.attributes.variants;
          const variant = variants ? variants[variantName] : null;

          // deprecated
          // for backwards combatility only
          const sizes = image.attributes.sizes;
          const size = sizes ? sizes.find(i => i.name === variantName) : null;

          return variant || size;
        })
        .filter(variant => variant != null);

    const facebookImages = listingImages(currentListing, 'facebook');
    const twitterImages = listingImages(currentListing, 'twitter');
    const schemaImages = JSON.stringify(facebookImages.map(img => img.url));
    const siteTitle = config.siteTitle;
    const schemaTitle = intl.formatMessage(
      { id: 'ListingPage.schemaTitle' },
      { title, price: formattedPrice, siteTitle }
    );

    const hostLink = (
      <NamedLink
        className={css.authorNameLink}
        name="ListingPage"
        params={params}
        to={{ hash: '#host' }}
      >
        {authorDisplayName}
      </NamedLink>
    );

    // const amenityOptions = findOptionsForSelectFilter('amenities', filterConfig);
    // const categoryOptions = findOptionsForSelectFilter('category', filterConfig);
    const amenityIds = config.custom.amenities.map(a => a.id);
    const amenityOptions = findOptionsForSelectFilter(amenityIds, filterConfig);
    const catIds = config.custom.categories.map(c => c.id);
    const categoryOptions = findOptionsForSelectFilter(catIds, filterConfig);
    const category =
      publicData && publicData.category ? (
        <span>
          {categoryLabel(categoryOptions, publicData.category)}
          <span className={css.separator}>•</span>
        </span>
      ) : null;

    const hasImages = currentListing.images && currentListing.images.length > 0;
    const firstImage =
      hasImages && currentListing.images[0].attributes.variants
        ? currentListing.images[0].attributes.variants['landscape-crop2x'].url
        : null;

    const listingLink = typeof window === 'undefined' ? '' : window.location.href;
    const emailMessageForSharing = intl.formatMessage(
      { id: 'ListingPage.emailMessageForSharing' },
      { listingLink: listingLink, listingName: currentListing.attributes.title }
    );

    return (
      <Page
        title={schemaTitle}
        scrollingDisabled={scrollingDisabled}
        author={authorDisplayName}
        contentType="website"
        description={description}
        facebookImages={facebookImages}
        twitterImages={twitterImages}
        schema={{
          '@context': 'http://schema.org',
          '@type': 'ItemPage',
          description: description,
          name: schemaTitle,
          image: schemaImages,
        }}
      >
        <LayoutSingleColumn className={css.pageRoot}>
          <LayoutWrapperTopbar>{topbar}</LayoutWrapperTopbar>
          <LayoutWrapperMain>
            <div>
              <SectionImages
                title={title}
                listing={currentListing}
                isOwnListing={isOwnListing}
                editParams={{
                  id: listingId.uuid,
                  slug: listingSlug,
                  type: listingType,
                  tab: listingTab,
                }}
                imageCarouselOpen={this.state.imageCarouselOpen}
                onImageCarouselClose={() => this.setState({ imageCarouselOpen: false })}
                handleViewPhotosClick={handleViewPhotosClick}
                onManageDisableScrolling={onManageDisableScrolling}
              />
              <div className={css.contentContainer}>
                <SectionAvatar user={currentAuthor} params={params} />
                <div className={css.mainContent}>
                  <SectionHeading
                    priceTitle={priceTitle}
                    formattedPrice={formattedPrice}
                    richTitle={richTitle}
                    title={title}
                    id={listingId.uuid}
                    unitType={unitType}
                    category={category}
                    hostLink={hostLink}
                    showContactUser={showContactUser}
                    onContactUser={this.onContactUser}
                    priceType={priceType}
                    currentUser={currentUser}
                    onCloseEnquiryModal={() => this.setState({ enquiryModalOpen: false })}
                    sendEnquiryError={sendEnquiryError}
                    sendEnquiryInProgress={sendEnquiryInProgress}
                    onSubmitEnquiry={params => {
                      const { unitType = config.fallbackUnitType } =
                        currentListing.attributes.publicData || {};
                      this.onSubmitEnquiry(params, unitType);
                    }}
                    onManageDisableScrolling={onManageDisableScrolling}
                  />
                  <div className={css.shareButtons}>
                    <InlineShareButtons
                      config={{
                        alignment: 'left',
                        color: 'social',
                        enabled: true,
                        networks: ['twitter', 'facebook', 'whatsapp', 'email'],
                        radius: 4,
                        size: 45,

                        title: 'Check out this listing on HotPatch!',
                        subject: 'Check out this listing on HotPatch!',
                        servicePopup: true,
                        message: emailMessageForSharing,
                        image: firstImage,
                      }}
                    />
                  </div>
                  <p></p>
                  <SectionCapacity publicData={publicData} />
                  {/* <SectionSeats publicData={publicData} /> */}
                  <SectionDescriptionMaybe description={description} />

                  <SectionMiscMaybe publicData={publicData} />
                  <SectionEquipmentMaybe publicData={publicData} />
                  <SectionFeaturesMaybe options={amenityOptions} publicData={publicData} />
                  <SectionRulesMaybe publicData={publicData} />
                  <SectionMapMaybe
                    geolocation={geolocation}
                    publicData={publicData}
                    listingId={currentListing.id}
                  />
                  <SectionReviews reviews={reviews} fetchReviewsError={fetchReviewsError} />
                  <SectionHostMaybe
                    title={title}
                    id={listingId.uuid}
                    listing={currentListing}
                    authorDisplayName={authorDisplayName}
                    onContactUser={this.onContactUser}
                    isEnquiryModalOpen={isAuthenticated && this.state.enquiryModalOpen}
                    onCloseEnquiryModal={() => this.setState({ enquiryModalOpen: false })}
                    sendEnquiryError={sendEnquiryError}
                    sendEnquiryInProgress={sendEnquiryInProgress}
                    onSubmitEnquiry={params => {
                      const { unitType = config.fallbackUnitType } =
                        currentListing.attributes.publicData || {};
                      this.onSubmitEnquiry(params, unitType, currentListing, lineItems);
                    }}
                    currentUser={currentUser}
                    onManageDisableScrolling={onManageDisableScrolling}
                    updateDiscount={this.updateDiscount}
                    promocode={this.state.promocode}
                    className={css.bookingPanel}
                    isOwnListing={isOwnListing}
                    unitType={unitType}
                    onSubmit={handleBookingSubmit}
                    subTitle={bookingSubTitle}
                    timeSlots={timeSlots}
                    fetchTimeSlotsError={fetchTimeSlotsError}
                    monthlyTimeSlots={monthlyTimeSlots}
                    onFetchTimeSlots={onFetchTimeSlots}
                    onFetchTransactionLineItems={onFetchTransactionLineItems}
                    lineItems={lineItems}
                    fetchLineItemsInProgress={fetchLineItemsInProgress}
                    fetchLineItemsError={fetchLineItemsError}
                    bookingType={this.state.bookingType}
                    toggleBookingType={this.toggleBookingType}
                    updateEnquiryDateTime={this.updateEnquiryDateTime}
                    planType={this.state.enquiryDateTimeData.planType}
                    enquiryDateTimeDataError={this.state.enquiryDateTimeDataError}
                  />
                </div>
                <BookingPanel
                  updateDiscount={this.updateDiscount}
                  promocode={this.state.promocode}
                  className={css.bookingPanel}
                  listing={currentListing}
                  isOwnListing={isOwnListing}
                  unitType={unitType}
                  onSubmit={handleBookingSubmit}
                  title={bookingTitle}
                  subTitle={bookingSubTitle}
                  authorDisplayName={authorDisplayName}
                  onManageDisableScrolling={onManageDisableScrolling}
                  timeSlots={timeSlots}
                  fetchTimeSlotsError={fetchTimeSlotsError}
                  monthlyTimeSlots={monthlyTimeSlots}
                  onFetchTimeSlots={onFetchTimeSlots}
                  onFetchTransactionLineItems={onFetchTransactionLineItems}
                  lineItems={lineItems}
                  fetchLineItemsInProgress={fetchLineItemsInProgress}
                  fetchLineItemsError={fetchLineItemsError}
                  bookingType={this.state.bookingType}
                  toggleBookingType={this.toggleBookingType}
                />
              </div>
            </div>
          </LayoutWrapperMain>
          <LayoutWrapperFooter>
            <Footer />
          </LayoutWrapperFooter>
        </LayoutSingleColumn>
      </Page>
    );
  }
}

ListingPageComponent.defaultProps = {
  unitType: config.bookingUnitType,
  currentUser: null,
  enquiryModalOpenForListingId: null,
  showListingError: null,
  reviews: [],
  fetchReviewsError: null,
  timeSlots: null,
  monthlyTimeSlots: null,
  fetchTimeSlotsError: null,
  sendEnquiryError: null,
  filterConfig: config.custom.filters,
  lineItems: null,
  fetchLineItemsError: null,
};

ListingPageComponent.propTypes = {
  // from withRouter
  history: shape({
    push: func.isRequired,
  }).isRequired,
  location: shape({
    search: string,
  }).isRequired,

  // from injectIntl
  intl: intlShape.isRequired,

  params: shape({
    id: string.isRequired,
    slug: string,
    variant: oneOf([LISTING_PAGE_DRAFT_VARIANT, LISTING_PAGE_PENDING_APPROVAL_VARIANT]),
  }).isRequired,

  isAuthenticated: bool.isRequired,
  currentUser: propTypes.currentUser,
  getListing: func.isRequired,
  getOwnListing: func.isRequired,
  onManageDisableScrolling: func.isRequired,
  scrollingDisabled: bool.isRequired,
  enquiryModalOpenForListingId: string,
  showListingError: propTypes.error,
  callSetInitialValues: func.isRequired,
  reviews: arrayOf(propTypes.review),
  fetchReviewsError: propTypes.error,
  timeSlots: arrayOf(propTypes.timeSlot),
  monthlyTimeSlots: object,

  fetchTimeSlotsError: propTypes.error,
  sendEnquiryInProgress: bool.isRequired,
  sendEnquiryError: propTypes.error,
  onSendEnquiry: func.isRequired,
  onInitializeCardPaymentData: func.isRequired,
  filterConfig: array,
  onFetchTransactionLineItems: func.isRequired,
  lineItems: array,
  fetchLineItemsInProgress: bool.isRequired,
  fetchLineItemsError: propTypes.error,
};

const mapStateToProps = state => {
  const { isAuthenticated } = state.Auth;
  const {
    showListingError,
    reviews,
    fetchReviewsError,
    monthlyTimeSlots,
    timeSlots,
    fetchTimeSlotsError,
    sendEnquiryInProgress,
    sendEnquiryError,
    lineItems,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    enquiryModalOpenForListingId,
  } = state.ListingPage;
  const { currentUser } = state.user;

  const getListing = id => {
    const ref = { id, type: 'listing' };
    const listings = getMarketplaceEntities(state, [ref]);
    return listings.length === 1 ? listings[0] : null;
  };

  const getOwnListing = id => {
    const ref = { id, type: 'ownListing' };
    const listings = getMarketplaceEntities(state, [ref]);
    return listings.length === 1 ? listings[0] : null;
  };

  return {
    isAuthenticated,
    currentUser,
    getListing,
    getOwnListing,
    scrollingDisabled: isScrollingDisabled(state),
    enquiryModalOpenForListingId,
    showListingError,
    reviews,
    fetchReviewsError,
    monthlyTimeSlots,
    timeSlots,
    fetchTimeSlotsError,
    lineItems,
    fetchLineItemsInProgress,
    fetchLineItemsError,
    sendEnquiryInProgress,
    sendEnquiryError,
  };
};

const mapDispatchToProps = dispatch => ({
  onManageDisableScrolling: (componentId, disableScrolling) =>
    dispatch(manageDisableScrolling(componentId, disableScrolling)),
  callSetInitialValues: (setInitialValues, values) => dispatch(setInitialValues(values)),
  onSendEnquiry: (listingId, message, unitType, protectedData) =>
    dispatch(sendEnquiry(listingId, message, unitType, protectedData)),
  callSetInitialValues: (setInitialValues, values, saveToSessionStorage) =>
    dispatch(setInitialValues(values, saveToSessionStorage)),
  onFetchTransactionLineItems: (bookingData, listingId, isOwnListing) => {
    return dispatch(fetchTransactionLineItems(bookingData, listingId, isOwnListing));
  },
  // onSendEnquiry: (listingId, message, protectedData) =>
  //   dispatch(sendEnquiry(listingId, message, protectedData)),
  onInitializeCardPaymentData: () => dispatch(initializeCardPaymentData()),
  onFetchTimeSlots: (listingId, start, end, timeZone) =>
    dispatch(fetchTimeSlotsTime(listingId, start, end, timeZone)),
});

// Note: it is important that the withRouter HOC is **outside** the
// connect HOC, otherwise React Router won't rerender any Route
// components since connect implements a shouldComponentUpdate
// lifecycle hook.
//
// See: https://github.com/ReactTraining/react-router/issues/4671
const ListingPage = compose(
  withRouter,
  connect(mapStateToProps, mapDispatchToProps),
  injectIntl
)(ListingPageComponent);

export default ListingPage;
