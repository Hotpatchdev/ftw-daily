import React, { useState } from 'react';
import { FormattedMessage } from '../../util/reactIntl';
import { richText } from '../../util/richText';

import css from './ListingPage.module.css';

const MIN_LENGTH_FOR_LONG_WORDS_IN_DESCRIPTION = 20;

const SectionDescriptionMaybe = props => {
  const { description } = props;
  const [expandedDescription, setExpandedDescription] = useState(null);
  const expanded = expandedDescription === description;
  // Keep the preview at a word boundary; preserve the host's complete text on expansion.
  const preview = description && description.slice(0, 600).replace(/\s+\S*$/, '');
  const canExpand = description && description.length > 700;
  const visibleDescription = canExpand && !expanded ? `${preview}…` : description;
  return description ? (
    <div className={css.sectionDescription}>
      <h2 className={css.descriptionTitle}>
        <FormattedMessage id="ListingPage.descriptionTitle" />
      </h2>
      <p id="listing-description" className={css.description}>
        {richText(visibleDescription, {
          longWordMinLength: MIN_LENGTH_FOR_LONG_WORDS_IN_DESCRIPTION,
          longWordClass: css.longWord,
        })}
      </p>
      {canExpand ? (
        <button
          type="button"
          className={css.descriptionToggle}
          aria-expanded={expanded}
          aria-controls="listing-description"
          onClick={() => setExpandedDescription(expanded ? null : description)}
        >
          <FormattedMessage
            id={expanded ? 'ListingPage.readLessDescription' : 'ListingPage.readMoreDescription'}
            defaultMessage={expanded ? 'Show less' : 'Read more about this space'}
          />
        </button>
      ) : null}
    </div>
  ) : null;
};

export default SectionDescriptionMaybe;
