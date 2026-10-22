import React, { useRef, useState } from 'react';
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
  const touchStart = useRef(null);
  const suppressClick = useRef(false);
  const photoCount = hasImages ? listing.images.length : 0;
  const movePhoto = direction => {
    if (photoCount > 1) {
      setSelection({ listingKey, index: (selectedIndex + direction + photoCount) % photoCount });
    }
  };
  const startSwipe = event => {
    suppressClick.current = false;
    touchStart.current =
      event.touches.length === 1
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, listingKey }
        : null;
  };
  const endSwipe = event => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || start.listingKey !== listingKey || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && photoCount > 1) {
      suppressClick.current = true;
      movePhoto(dx < 0 ? 1 : -1);
    }
  };
  // Keep controls centred and bounded even on listings with many photos.
  const firstDot = Math.max(0, Math.min(selectedIndex - 2, photoCount - 5));
  const dotImages = hasImages ? listing.images.slice(firstDot, firstDot + 5) : [];

  // Action bar is wrapped with a div that prevents the click events
  // to the parent that would otherwise open the image carousel
  const actionBar = listing.id ? (
    <div onClick={e => e.stopPropagation()}>
      <ActionBarMaybe isOwnListing={isOwnListing} listing={listing} editParams={editParams} />
    </div>
  ) : null;

  const viewPhotosButton = hasImages ? (
    <button type="button" className={css.viewPhotos} onClick={handleViewPhotosClick}>
      All photos
    </button>
  ) : null;

  return (
    <div className={css.sectionImages}>
      <div className={css.threeToTwoWrapper}>
        <div className={css.aspectWrapper}>
          {actionBar}
          <button
            type="button"
            className={css.galleryMainButton}
            aria-label={`View photos of ${title}`}
            disabled={!hasImages}
            onTouchStart={startSwipe}
            onTouchEnd={endSwipe}
            onTouchCancel={() => {
              touchStart.current = null;
            }}
            onKeyDown={event => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                movePhoto(event.key === 'ArrowRight' ? 1 : -1);
              }
            }}
            onClick={event => {
              if (suppressClick.current && event && event.detail !== 0) {
                suppressClick.current = false;
                event.preventDefault();
                return;
              }
              handleViewPhotosClick(event);
            }}
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
          {photoCount > 1 ? (
            <div className={css.galleryDots} role="group" aria-label="Listing photos">
              {dotImages.map((image, dotIndex) => {
                const index = firstDot + dotIndex;
                return (
                  <button
                    key={image.id.uuid}
                    type="button"
                    className={css.galleryDot}
                    aria-label={`Show photo ${index + 1} of ${photoCount}`}
                    aria-pressed={selectedIndex === index}
                    onClick={() => setSelection({ listingKey, index })}
                  >
                    <span aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : null}
          {hasImages ? (
            <span className={css.galleryStatus} role="status">
              Photo {selectedIndex + 1} of {photoCount}
            </span>
          ) : null}
        </div>
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
