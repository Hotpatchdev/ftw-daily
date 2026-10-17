import React, { useState } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { ResponsiveImage, Modal, ImageCarousel } from '../../components';
import ActionBarMaybe from './ActionBarMaybe';

import css from './ListingPage.module.css';

const SectionImages = props => {
  const {
    title,
    listing,
    isOwnListing,
    editParams,
    handleViewPhotosClick,
    imageCarouselOpen,
    onImageCarouselClose,
    onManageDisableScrolling,
  } = props;

  const hasImages = listing.images && listing.images.length > 0;
  const listingKey = listing.id && listing.id.uuid;
  const [selection, setSelection] = useState({ listingKey, index: 0 });
  const selectedIndex =
    selection.listingKey === listingKey && hasImages && listing.images[selection.index]
      ? selection.index
      : 0;
  const selectedImage = hasImages ? listing.images[selectedIndex] : null;

  // Action bar is wrapped with a div that prevents the click events
  // to the parent that would otherwise open the image carousel
  const actionBar = listing.id ? (
    <div onClick={e => e.stopPropagation()}>
      <ActionBarMaybe isOwnListing={isOwnListing} listing={listing} editParams={editParams} />
    </div>
  ) : null;

  const viewPhotosButton = hasImages ? (
    <button className={css.viewPhotos} onClick={handleViewPhotosClick}>
      <FormattedMessage
        id="ListingPage.viewImagesButton"
        values={{ count: listing.images.length }}
      />
    </button>
  ) : null;

  return (
    <div
      className={
        hasImages && listing.images.length > 1 ? css.galleryWithThumbnails : css.sectionImages
      }
    >
      <div className={css.threeToTwoWrapper}>
        <div className={css.aspectWrapper}>
          {actionBar}
          <button
            type="button"
            className={css.galleryMainButton}
            aria-label={`View photos of ${title}`}
            disabled={!hasImages}
            onClick={handleViewPhotosClick}
          >
            <ResponsiveImage
              rootClassName={css.rootForImage}
              alt={title}
              image={selectedImage}
              variants={[
                'landscape-crop',
                'landscape-crop2x',
                'landscape-crop4x',
                'landscape-crop6x',
              ]}
            />
          </button>
          {viewPhotosButton}
        </div>
        {hasImages && listing.images.length > 1 ? (
          <div className={css.galleryThumbnails} role="group" aria-label="Listing photos">
            {listing.images.map((image, index) => (
              <button
                key={image.id.uuid}
                type="button"
                className={css.galleryThumbnail}
                aria-label={`Show photo ${index + 1} of ${listing.images.length}`}
                aria-pressed={selectedIndex === index}
                onClick={() => setSelection({ listingKey, index })}
              >
                <ResponsiveImage
                  rootClassName={css.galleryThumbnailImage}
                  alt=""
                  image={image}
                  variants={['landscape-crop', 'landscape-crop2x']}
                  sizes="104px"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Modal
        id="ListingPage.imageCarousel"
        scrollLayerClassName={css.carouselModalScrollLayer}
        containerClassName={css.carouselModalContainer}
        lightCloseButton
        isOpen={imageCarouselOpen}
        onClose={onImageCarouselClose}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
      >
        <ImageCarousel
          key={`${listingKey}-${selectedIndex}-${imageCarouselOpen}`}
          images={listing.images || []}
          initialImageIndex={selectedIndex}
        />
      </Modal>
    </div>
  );
};

export default SectionImages;
