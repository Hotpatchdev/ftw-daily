import React, { useEffect, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { Modal, LocationAutocompleteInput } from '../../components';
import config from '../../config';
import { groupAmenities } from '../../util/amenityGroups';
import { removeFilterTag } from '../../util/activeFilters';
import {
  priceUnits,
  selectedValues,
  toggleFilterValue,
  validDate,
  pricePopulationKey,
  loadPricePopulation,
  priceSummary,
  histogram,
  essentials,
} from '../../util/discoveryFilters';
import css from './DiscoveryFilters.module.css';

const Icon = ({ name }) => {
  const paths = {
    location: (
      <>
        <path d="M18 10c0 5-6 10-6 10S6 15 6 10a6 6 0 1112 0z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4m8-4v4M4 10h16" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10l2 2M5 19l2-2M17 7l2-2" />
      </>
    ),
    wifi: (
      <>
        <path d="M3 9a15 15 0 0118 0M6 12a10 10 0 0112 0m-9 3a5 5 0 016 0" />
        <circle cx="12" cy="19" r="1" />
      </>
    ),
    heat: (
      <>
        <path d="M7 20V4m5 16V4m5 16V4M4 8h16M4 16h16" />
      </>
    ),
    parking: (
      <>
        <path d="M8 21V3h6a5 5 0 010 10H8" />
      </>
    ),
    bathroom: (
      <>
        <path d="M4 12h16v4a4 4 0 01-4 4H8a4 4 0 01-4-4zm2 8v2m12-2v2M6 12V5a2 2 0 014 0v2" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

const Group = ({ group, selected, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded
    ? group.options
    : group.options.filter((option, index) => index < 3 || selected.includes(option.key));
  return (
    <fieldset className={css.amenityGroup}>
      <legend>{group.label}</legend>
      {shown.map(option => (
        <label key={option.key} className={css.checkbox}>
          <input
            type="checkbox"
            checked={selected.includes(option.key)}
            onChange={() => onToggle(option.key)}
          />
          <span>{option.label}</span>
        </label>
      ))}
      {group.options.length > 3 ? (
        <button
          type="button"
          className={css.showMore}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show more'}{' '}
          <span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
        </button>
      ) : null}
    </fieldset>
  );
};

export const DiscoveryFiltersComponent = ({
  params = {},
  filters,
  onApply,
  onOpen,
  onClose,
  onManageDisableScrolling,
  onLoadPrices,
  resultsCount,
  listingsAreLoaded,
  searchInProgress,
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [editor, setEditor] = useState(null);
  const [location, setLocation] = useState({ search: '' });
  const [dates, setDates] = useState(['', '']);
  const [error, setError] = useState(null);
  const [population, setPopulation] = useState(null);
  const [priceError, setPriceError] = useState(false);
  const [retry, setRetry] = useState(0);
  const trigger = useRef(null);
  const closeButton = useRef(null);
  const dateButton = useRef(null);
  const locationButton = useRef(null);
  const populationKey = pricePopulationKey(draft);
  const currency = config.currency;
  const money = value =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  const activeUnit = priceUnits.find(unit => draft[unit.param]) || priceUnits[0];
  const summary = population ? priceSummary(population, activeUnit.field, currency) : null;
  const range =
    typeof draft[activeUnit.param] === 'string'
      ? draft[activeUnit.param].split(',').map(Number)
      : [];
  const validRange =
    range.length === 2 && range.every(Number.isFinite) && range[0] >= 0 && range[1] >= range[0];
  const domainMax = Math.max(
    10,
    Math.ceil(Math.max(...(summary ? summary.values : []), validRange ? range[1] : 0) / 10) * 10
  );
  const min = validRange ? range[0] : 0;
  const max = validRange ? range[1] : domainMax;
  const bins = summary ? histogram(summary.values, domainMax) : [];
  const peak = Math.max(1, ...bins.map(bin => bin.count));
  const selected = selectedValues(draft.pub_amenities);
  const categories = selectedValues(draft.pub_category);
  const essentialKeys = new Set(essentials.map(option => option.key));
  const general = filters.find(filter => filter.id === 'general_amenities');
  const availableKeys = new Set((general ? general.config.options : []).map(option => option.key));
  const selectedCategories = filters.filter(filter => filter.config.isCategory);
  const amenityFilters = filters.filter(
    filter =>
      filter.queryParamNames.includes('pub_amenities') &&
      (filter.config.isGeneralAmenities ||
        !categories.length ||
        filter.config.catKeys.split(',').some(key => categories.includes(key)) ||
        filter.config.options.some(option => selected.includes(option.key)))
  );
  const seen = new Set(essentialKeys);
  const amenitySections = amenityFilters.map(filter => ({
    ...filter,
    options: filter.config.options.filter(option => {
      if (seen.has(option.key)) return false;
      seen.add(option.key);
      return true;
    }),
  }));

  useEffect(() => {
    if (open && closeButton.current) closeButton.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setPopulation(null);
    setPriceError(false);
    const timer = setTimeout(() => {
      onLoadPrices(draft, retry > 0, () => active)
        .then(listings => {
          if (active) setPopulation(listings);
        })
        .catch(() => {
          if (active) setPriceError(true);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // The population excludes price and ordering; changing the range reuses it.
  }, [open, populationKey, retry]);

  const close = () => {
    setOpen(false);
    onClose();
    if (trigger.current) trigger.current.focus();
  };
  const launch = () => {
    setDraft(params);
    const [start = '', end = ''] = typeof params.dates === 'string' ? params.dates.split(',') : [];
    setDates([start, end]);
    setLocation({
      search: params.address || '',
      selectedPlace: params.bounds
        ? { address: params.address, bounds: params.bounds, origin: params.origin }
        : null,
    });
    setEditor(null);
    setError(null);
    setOpen(true);
    onOpen();
  };
  const updatePrice = (low, high) => {
    if (!Number.isFinite(low) || !Number.isFinite(high)) return;
    const next = { ...draft };
    priceUnits.forEach(unit => delete next[unit.param]);
    next[activeUnit.param] = `${low},${high}`;
    setDraft(next);
  };
  const changeUnit = param => {
    const next = { ...draft };
    priceUnits.forEach(unit => delete next[unit.param]);
    // A unit change must not reinterpret a previous hourly amount as a daily rate.
    const data = population
      ? priceSummary(population, priceUnits.find(unit => unit.param === param).field, currency)
      : null;
    const limit = Math.max(10, Math.ceil(Math.max(0, ...(data ? data.values : [])) / 10) * 10);
    next[param] = `0,${limit}`;
    setDraft(next);
  };
  const toggleAmenity = key =>
    setDraft(
      toggleFilterValue(
        draft,
        'pub_amenities',
        key,
        (general && general.config.searchMode) || 'has_any'
      )
    );
  const saveLocation = () => {
    if (location.search && !location.selectedPlace) {
      setError('Choose a location from the suggestions, or clear the field.');
      return;
    }
    const next = { ...draft };
    ['address', 'bounds', 'origin', 'mapSearch'].forEach(key => delete next[key]);
    if (location.selectedPlace) {
      next.address = location.selectedPlace.address || location.search;
      next.bounds = location.selectedPlace.bounds;
      if (config.sortSearchByDistance && location.selectedPlace.origin)
        next.origin = location.selectedPlace.origin;
    }
    setDraft(next);
    setError(null);
    setEditor(null);
    if (locationButton.current) locationButton.current.focus();
  };
  const saveDates = () => {
    if ((dates[0] || dates[1]) && (!dates.every(validDate) || dates[0] > dates[1])) {
      setError('Choose a valid start and end date, or clear both.');
      return;
    }
    const next = { ...draft, dates: dates[0] ? dates.join(',') : undefined };
    delete next.schedule;
    setDraft(next);
    setError(null);
    setEditor(null);
    if (dateButton.current) dateButton.current.focus();
  };
  const apply = () => {
    const next = { ...draft };
    delete next.page;
    if (!next.keywords && next.sort === 'relevance') delete next.sort;
    onApply(next);
    close();
  };
  const reset = () => {
    const next = removeFilterTag(draft, null, filters);
    setDraft(next);
    setDates(['', '']);
    setError(null);
    setEditor(null);
  };
  const datesLabel =
    draft.dates && draft.dates.split(',').length === 2 && draft.dates.split(',').every(validDate)
      ? draft.dates
          .split(',')
          .map(value =>
            new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              timeZone: 'UTC',
            })
          )
          .join(' – ')
      : 'Any dates';
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll('button, input, select, summary, a[href]')
    ).filter(element => !element.disabled && element.getClientRects().length);
    const first = controls[0],
      last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button type="button" ref={trigger} className={css.trigger} onClick={launch}>
        Filters
      </button>
      <Modal
        id="DiscoveryFilters"
        isOpen={open}
        onClose={close}
        usePortal
        onManageDisableScrolling={onManageDisableScrolling}
        containerClassName={css.panel}
        scrollLayerClassName={css.overlay}
        contentClassName={css.content}
      >
        {open ? (
          <section
            className={css.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discovery-filters-title"
            onKeyDown={trapFocus}
          >
            <header className={css.header}>
              <button
                type="button"
                className={css.close}
                ref={closeButton}
                aria-label="Close filters"
                onClick={close}
              >
                ×
              </button>
              <h2 id="discovery-filters-title">Filters</h2>
              <button type="button" className={css.reset} onClick={reset}>
                Reset
              </button>
            </header>
            <div className={css.body}>
              <div className={css.summaryCard}>
                <span className={css.summaryIcon}>
                  <Icon name="location" />
                </span>
                <div>
                  <h3>Location</h3>
                  <p>{draft.address || 'Anywhere'}</p>
                </div>
                <button
                  type="button"
                  ref={locationButton}
                  aria-expanded={editor === 'location'}
                  onClick={() => {
                    setEditor(editor === 'location' ? null : 'location');
                    setError(null);
                  }}
                >
                  Change
                </button>
              </div>
              {editor === 'location' ? (
                <div className={css.editor}>
                  <label htmlFor="filter-location">City, postcode or address</label>
                  <LocationAutocompleteInput
                    id="filter-location"
                    placeholder="City, postcode or address"
                    input={{
                      name: 'filter-location',
                      value: location,
                      onChange: setLocation,
                      onFocus: () => {},
                      onBlur: () => {},
                    }}
                    meta={{}}
                    closeOnBlur
                  />
                  <button type="button" className={css.save} onClick={saveLocation}>
                    Save location
                  </button>
                </div>
              ) : null}
              <div className={css.summaryCard}>
                <span className={css.summaryIcon}>
                  <Icon name="calendar" />
                </span>
                <div>
                  <h3>Date &amp; Time</h3>
                  <p>{datesLabel}</p>
                </div>
                <button
                  type="button"
                  ref={dateButton}
                  aria-expanded={editor === 'dates'}
                  onClick={() => {
                    setEditor(editor === 'dates' ? null : 'dates');
                    setError(null);
                  }}
                >
                  Change
                </button>
              </div>
              {editor === 'dates' ? (
                <div className={css.editor}>
                  <div className={css.dateFields}>
                    <label>
                      From
                      <input
                        type="date"
                        value={dates[0]}
                        max={dates[1] || undefined}
                        onInput={event => setDates([event.target.value, dates[1]])}
                        onChange={event => setDates([event.target.value, dates[1]])}
                      />
                    </label>
                    <label>
                      To
                      <input
                        type="date"
                        value={dates[1]}
                        min={dates[0] || undefined}
                        onInput={event => setDates([dates[0], event.target.value])}
                        onChange={event => setDates([dates[0], event.target.value])}
                      />
                    </label>
                  </div>
                  <p className={css.hint}>Choose specific times when booking a space.</p>
                  <button
                    type="button"
                    className={css.textButton}
                    onClick={() => setDates(['', ''])}
                  >
                    Any dates
                  </button>
                  <button type="button" className={css.save} onClick={saveDates}>
                    Save dates
                  </button>
                </div>
              ) : null}
              {error ? (
                <p role="alert" className={css.error}>
                  {error}
                </p>
              ) : null}

              <section className={css.priceSection} aria-labelledby="discovery-price-title">
                <div className={css.priceHeading}>
                  <h3 id="discovery-price-title">Price range</h3>
                  <label className={css.unit}>
                    Rate
                    <select
                      aria-label="Pricing unit"
                      value={activeUnit.param}
                      onChange={event => changeUnit(event.target.value)}
                    >
                      {priceUnits.map(unit => (
                        <option key={unit.param} value={unit.param}>
                          Per {unit.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {summary && summary.count ? (
                  <p className={css.average}>
                    The average {activeUnit.adjective} price is {money(summary.average)}
                  </p>
                ) : null}
                <p className={css.hint} aria-live="polite">
                  {priceError
                    ? 'Price distribution is unavailable.'
                    : !population
                    ? 'Loading current listing prices…'
                    : summary.count
                    ? `Based on ${summary.count} matching ${currency} listings with ${activeUnit.adjective} rates. Other currencies are excluded.`
                    : `No matching ${currency} ${activeUnit.adjective} rates to chart.`}
                </p>
                {priceError ? (
                  <button
                    type="button"
                    className={css.textButton}
                    onClick={() => setRetry(retry + 1)}
                  >
                    Retry price data
                  </button>
                ) : null}
                {summary && summary.count ? (
                  <div
                    className={css.histogram}
                    role="img"
                    aria-label={`Price distribution for ${summary.count} matching ${currency} ${activeUnit.adjective} rates`}
                  >
                    {bins.map((bin, index) => (
                      <span
                        key={index}
                        className={bin.max >= min && bin.min <= max ? css.selectedBar : css.bar}
                        style={{ height: `${(bin.count / peak) * 100}%` }}
                        title={`${money(bin.min)}–${money(bin.max)}: ${bin.count} listings`}
                      />
                    ))}
                  </div>
                ) : null}
                <div className={css.sliders}>
                  <div className={css.track} />
                  <div
                    className={css.selectedTrack}
                    style={{
                      left: `${(min / domainMax) * 100}%`,
                      width: `${((max - min) / domainMax) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    aria-label="Minimum price"
                    min="0"
                    max={domainMax}
                    step="1"
                    value={min}
                    onChange={event => updatePrice(Math.min(Number(event.target.value), max), max)}
                  />
                  <input
                    type="range"
                    aria-label="Maximum price"
                    min="0"
                    max={domainMax}
                    step="1"
                    value={max}
                    onChange={event => updatePrice(min, Math.max(Number(event.target.value), min))}
                  />
                </div>
                <div className={css.priceFields}>
                  <label>
                    Minimum ({currency})
                    <input
                      type="number"
                      aria-label={`Minimum price in ${currency}`}
                      min="0"
                      max={max}
                      step="1"
                      value={min}
                      onChange={event =>
                        updatePrice(Math.min(Math.max(0, Number(event.target.value)), max), max)
                      }
                    />
                  </label>
                  <label>
                    Maximum ({currency})
                    <input
                      type="number"
                      aria-label={`Maximum price in ${currency}`}
                      min={min}
                      step="1"
                      value={max}
                      onChange={event =>
                        updatePrice(min, Math.max(min, Number(event.target.value)))
                      }
                    />
                  </label>
                </div>
              </section>

              <section className={css.essentials} aria-labelledby="discovery-essentials-title">
                <h3 id="discovery-essentials-title">Essential Amenities</h3>
                <div className={css.chips}>
                  {essentials
                    .filter(option => availableKeys.has(option.key))
                    .map(option => (
                      <button
                        type="button"
                        key={option.key}
                        aria-pressed={selected.includes(option.key)}
                        onClick={() => toggleAmenity(option.key)}
                      >
                        <Icon name={option.icon} />
                        {option.label}
                      </button>
                    ))}
                </div>
              </section>
              {amenitySections
                .filter(filter => filter.options.length)
                .map(filter => (
                  <details key={filter.id} className={css.disclosure}>
                    <summary>
                      <span>
                        <strong>{filter.label}</strong>
                        <small>Filter to what you need.</small>
                      </span>
                    </summary>
                    {groupAmenities(filter.options, filter.id).map(group => (
                      <Group
                        key={group.label}
                        group={group}
                        selected={selected}
                        onToggle={toggleAmenity}
                      />
                    ))}
                  </details>
                ))}
              <details className={css.disclosure}>
                <summary>
                  <span>
                    <strong>Type of space</strong>
                    <small>Choose the categories that suit you.</small>
                  </span>
                </summary>
                {selectedCategories.map(filter => (
                  <Group
                    key={filter.id}
                    group={{ label: filter.label, options: filter.config.options }}
                    selected={categories}
                    onToggle={key =>
                      setDraft(
                        toggleFilterValue(draft, 'pub_category', key, filter.config.searchMode)
                      )
                    }
                  />
                ))}
              </details>
              <details className={css.disclosure}>
                <summary>
                  <span>
                    <strong>Keyword</strong>
                    <small>{draft.keywords || 'Search for a space'}</small>
                  </span>
                </summary>
                <label className={css.keyword}>
                  What do you need the space for?
                  <input
                    type="search"
                    value={draft.keywords || ''}
                    onChange={event => setDraft({ ...draft, keywords: event.target.value })}
                  />
                </label>
              </details>
            </div>
            <footer className={css.footer}>
              <button type="button" disabled={!!editor} onClick={apply}>
                Show{' '}
                {JSON.stringify(draft) === JSON.stringify(params) &&
                listingsAreLoaded &&
                !searchInProgress
                  ? `${resultsCount} `
                  : ''}
                spaces
              </button>
            </footer>
          </section>
        ) : null}
      </Modal>
    </>
  );
};

export default connect(null, { onLoadPrices: loadPricePopulation })(DiscoveryFiltersComponent);
