import React, { useState } from 'react';
import { shape, string } from 'prop-types';
import { FormattedMessage } from '../../util/reactIntl';
import classNames from 'classnames';

import css from './SectionRulesMaybe.module.css';

const SectionRulesMaybe = props => {
  const { className, rootClassName, publicData } = props;
  const rules = publicData && publicData.rules;
  const [expandedRules, setExpandedRules] = useState(null);
  const expanded = expandedRules === rules;
  const firstLines =
    typeof rules === 'string'
      ? rules
          .split('\n')
          .slice(0, 3)
          .join('\n')
      : '';
  const preview =
    firstLines.length > 400 ? firstLines.slice(0, 400).replace(/\s+\S*$/, '') : firstLines;
  const canExpand = typeof rules === 'string' && preview.length < rules.length;
  const classes = classNames(rootClassName || css.root, className);
  return typeof rules === 'string' && rules.trim() ? (
    <div className={classes}>
      <h2 className={css.title}>
        <FormattedMessage id="ListingPage.rulesTitle" />
      </h2>
      <p id="listing-house-rules" className={css.rules}>
        {canExpand && !expanded ? `${preview}…` : rules}
      </p>
      {canExpand ? (
        <button
          type="button"
          className={css.toggle}
          aria-expanded={expanded}
          aria-controls="listing-house-rules"
          onClick={() => setExpandedRules(expanded ? null : rules)}
        >
          {expanded ? 'Show fewer rules' : 'Read all house rules'}
        </button>
      ) : null}
    </div>
  ) : null;
};

SectionRulesMaybe.defaultProps = { className: null, rootClassName: null };

SectionRulesMaybe.propTypes = {
  className: string,
  rootClassName: string,
  publicData: shape({
    rules: string,
  }),
};

export default SectionRulesMaybe;
