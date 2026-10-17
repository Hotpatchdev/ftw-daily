import React from 'react';
import sortBy from 'lodash/sortBy';
import { FormattedMessage } from '../../util/reactIntl';
import { PropertyGroup } from '../../components';
import { groupAmenities } from '../../util/amenityGroups';

import css from './ListingPage.module.css';

const SectionFeaturesMaybe = props => {
  const { options, publicData } = props;
  if (!publicData) {
    return null;
  }

  const selectedOptions = publicData && publicData.amenities ? publicData.amenities : [];
  const selectedOptionsFull = options.filter(opt => selectedOptions.includes(opt.key));
  const groups = groupAmenities(sortBy(selectedOptionsFull, 'label'));

  if (!groups.length) {
    return null;
  }

  return (
    <div className={css.sectionFeatures}>
      <h2 className={css.featuresTitle}>
        <FormattedMessage id="ListingPage.featuresTitle" />
      </h2>
      {groups.map(group => (
        <div key={group.label} className={css.amenityGroup}>
          <h3 className={css.amenityGroupTitle}>{group.label}</h3>
          <PropertyGroup
            id={`ListingPage.amenities.${group.label}`}
            options={group.options}
            selectedOptions={selectedOptions}
            twoColumns={true}
          />
        </div>
      ))}
    </div>
  );
};

export default SectionFeaturesMaybe;
