import React from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { UserCard, Modal, InlineTextButton } from '../../components';
import { EnquiryForm } from '../../forms';

import css from './ListingPage.module.css';
import ListingKeyDetails from './ListingKeyDetails';

const SectionHeading = props => {
  const {
    priceTitle,
    formattedPrice,
    title,
    id,
    richTitle,
    category,
    hostLink,
    showContactUser,
    onContactUser,
    listing,
    // unitType,
    priceType,
    currentUser,
    authorDisplayName,
    isEnquiryModalOpen,
    onCloseEnquiryModal,
    sendEnquiryError,
    sendEnquiryInProgress,
    onSubmitEnquiry,
    onManageDisableScrolling,
  } = props;

  const unitTranslationKey = `ListingPage.${priceType}`;

  // const isHourly = unitType === LINE_ITEM_UNITS;
  // const isDaily = unitType === LINE_ITEM_DAY;

  // const unitTranslationKey = isHourly
  //   ? 'ListingPage.perHour'
  //   : isDaily
  //   ? 'ListingPage.perDay'
  //   : 'ListingPage.perUnit';

  //const patch = JSON.stringify(richTitle);

  //var data = {subject: JSON.stringify(richTitle)};

  //var params = jQuery.param(data);

  //var patch = 'https://share.hsforms.com/1Zq6xDjz7RCG8gjdC1vBbgA57edm?' + params;

  //console.log('params', JSON.stringify(params));

  var data = title;
  var patchId = id;

  var url =
    'https://share.hsforms.com/1Zq6xDjz7RCG8gjdC1vBbgA57edm?patch_name=' +
    encodeURIComponent(JSON.stringify(data)) +
    '&patch_url=https://www.hotpatch.com/l/' +
    encodeURIComponent(patchId);

  return (
    <div className={css.sectionHeading}>
      <div className={css.heading}>
        <h1 className={css.title}>{richTitle}</h1>
        <div className={css.headingPrice}>
          <p className={css.desktopPerUnit}>from</p>
          <div className={css.desktopPriceValue} title={priceTitle}>
            {formattedPrice}
          </div>
          <div className={css.desktopPerUnit}>
            <FormattedMessage id={unitTranslationKey} />
          </div>
        </div>
        <ListingKeyDetails
          listingId={id}
          title={title}
          publicData={props.publicData}
          geolocation={props.geolocation}
          published={props.published}
        />
        <div className={css.author}>
          {category}
          <FormattedMessage id="ListingPage.hostedBy" values={{ name: hostLink }} />
          {showContactUser ? (
            <span className={css.contactWrapper}>
              <span className={css.separator}>•</span>
              <InlineTextButton
                rootClassName={css.contactLink}
                onClick={onContactUser}
                enforcePagePreloadFor="SignupPage"
              >
                <FormattedMessage id="ListingPage.contactUser" />
              </InlineTextButton>
              {/* {!!currentUser ? (
                <a
                  className={css.contactLink} target="_blank"
                  href={url}
                >
                  <FormattedMessage id="ListingPage.contactUser" />
                </a>
              ) : (
                <span
                  className={css.contactLink}
                  onClick={onContactUser}
                >
                  <FormattedMessage id="ListingPage.contactUser" />
                </span>
              )} */}
            </span>
          ) : null}
        </div>
      </div>

      {/* <Modal
        id="ListingPage.enquiry"
        contentClassName={css.enquiryModalContent}
        isOpen={isEnquiryModalOpen}
        onClose={onCloseEnquiryModal}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
      >
        <EnquiryForm
          className={css.enquiryForm}
          submitButtonWrapperClassName={css.enquirySubmitButtonWrapper}
          listingTitle={title}
          authorDisplayName={authorDisplayName}
          sendEnquiryError={sendEnquiryError}
          onSubmit={onSubmitEnquiry}
          inProgress={sendEnquiryInProgress}
        />
      </Modal> */}
    </div>
  );
};

export default SectionHeading;
