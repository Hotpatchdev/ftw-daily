import React, { useEffect, useRef } from 'react';
import { injectIntl } from '../../util/reactIntl';
import { activeFilterTags } from '../../util/activeFilters';
import { formatCurrencyMajorUnit } from '../../util/currency';
import config from '../../config';
import css from './ActiveFilterTags.module.css';

const ActiveFilterTags = ({ params, filters, onRemove, onClear, onEmpty, intl }) => {
  const tags = activeFilterTags(params, filters);
  const pendingFocus = useRef(null);
  const buttons = useRef([]);
  const signature = tags.map(tag => `${tag.param}:${tag.value || ''}`).join('|');
  useEffect(() => {
    if (pendingFocus.current !== null) {
      const target = buttons.current[Math.min(pendingFocus.current, tags.length - 1)];
      if (tags.length && target) target.focus();
      else onEmpty();
      pendingFocus.current = null;
    }
  }, [signature]); // Focus only after a user-triggered removal changes the tags.
  const label = tag => {
    if (tag.type === 'keyword')
      return intl.formatMessage({ id: 'SearchPage.keywordTag' }, { keyword: tag.value });
    if (tag.type === 'dates') {
      const date = value =>
        intl.formatDate(new Date(`${value}T00:00:00Z`), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });
      return intl.formatMessage(
        { id: 'SearchPage.dateTag' },
        { start: date(tag.start), end: date(tag.end) }
      );
    }
    if (tag.type === 'price')
      return intl.formatMessage(
        { id: 'SearchPage.priceTag' },
        {
          min: formatCurrencyMajorUnit(intl, config.currencyConfig.currency, tag.min),
          max: formatCurrencyMajorUnit(intl, config.currencyConfig.currency, tag.max),
          unit: intl.formatMessage({ id: `ListingCard.${tag.unit}` }),
        }
      );
    return tag.label;
  };
  return tags.length ? (
    <section
      className={css.root}
      aria-label={intl.formatMessage({ id: 'SearchPage.appliedFilters' })}
    >
      <ul className={css.list}>
        {tags.map((tag, index) => {
          const text = label(tag);
          return (
            <li key={`${tag.param}:${tag.value || ''}`}>
              <button
                className={css.tag}
                type="button"
                ref={node => {
                  buttons.current[index] = node;
                }}
                aria-label={intl.formatMessage({ id: 'SearchPage.removeFilter' }, { filter: text })}
                onClick={() => {
                  pendingFocus.current = index;
                  onRemove(tag);
                }}
              >
                <span>{text}</span>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
                  <path d="m2 2 8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        className={css.clear}
        type="button"
        onClick={() => {
          pendingFocus.current = 0;
          onClear();
        }}
      >
        {intl.formatMessage({ id: 'SearchPage.clearFilters' })}
      </button>
    </section>
  ) : null;
};

export default injectIntl(ActiveFilterTags);
