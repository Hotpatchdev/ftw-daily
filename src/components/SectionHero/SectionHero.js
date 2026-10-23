import React, { useState } from 'react';
import { object, string } from 'prop-types';
import classNames from 'classnames';
import { Form as FinalForm, Field } from 'react-final-form';
import { LocationAutocompleteInput, NamedLink } from '../../components';
import { createResourceLocatorString } from '../../util/routes';
import routeConfiguration from '../../routeConfiguration';
import { discoverySearchParams, validateDiscoverySearch } from '../../util/discoverySearch';
import { scheduleSummary } from '../../util/bookingSchedule';
import BookingSchedulePicker from '../BookingSchedulePicker/BookingSchedulePicker';
import heroImage from './images/newSlider/Hero 44.jpg';
import css from './SectionHero.module.css';

const SectionHero = ({ rootClassName, className, history }) => {
  const [showDates, setShowDates] = useState(false);
  const submit = values =>
    history.push(
      createResourceLocatorString(
        'SearchPage',
        routeConfiguration(),
        {},
        discoverySearchParams(values)
      )
    );

  return (
    <section
      className={classNames(rootClassName || css.root, className)}
      aria-labelledby="discovery-title"
    >
      <img className={css.background} src={heroImage} alt="" />
      <div className={css.content}>
        <span className={css.eyebrow}>MAKE SPACE WORK FOR YOU</span>
        <h1 id="discovery-title" className={css.title}>
          Find your perfect workspace
        </h1>
        <p className={css.subtitle}>
          Find &amp; book flexible spaces on demand.
          <br />
          From salons to studios, make room for what you do.
        </p>
        <FinalForm
          onSubmit={submit}
          validate={validateDiscoverySearch}
          render={({ handleSubmit, values, errors, submitFailed, form }) => (
            <form className={css.search} onSubmit={handleSubmit} aria-label="Find a Patch">
              <label className={css.field}>
                <span className={css.label}>01 &nbsp; What</span>
                <Field
                  name="keywords"
                  component="input"
                  type="search"
                  placeholder="What do you need the space for?"
                />
              </label>
              <div className={css.field}>
                <label className={css.label} htmlFor="discovery-location">
                  02 &nbsp; Where
                </label>
                <Field
                  name="location"
                  format={v => v}
                  render={({ input, meta }) => (
                    <LocationAutocompleteInput
                      id="discovery-location"
                      input={input}
                      meta={meta}
                      className={css.location}
                      iconClassName={css.locationIcon}
                      inputClassName={css.locationInput}
                      predictionsClassName={css.predictions}
                      placeholder="City, postcode or neighbourhood"
                      closeOnBlur
                    />
                  )}
                />
                {submitFailed && errors.location ? (
                  <span role="alert" className={css.error}>
                    {errors.location}
                  </span>
                ) : null}
              </div>
              <div className={css.field}>
                <button
                  className={css.dateToggle}
                  type="button"
                  aria-expanded={showDates}
                  aria-controls="discovery-dates"
                  onClick={() => setShowDates(!showDates)}
                >
                  <span className={css.label}>03 &nbsp; When</span>
                  <span>
                    {values.schedule && values.schedule.days.length
                      ? scheduleSummary(values.schedule)
                      : 'Choose your dates & times (optional)'}
                  </span>
                </button>
                {submitFailed && errors.dates ? (
                  <span role="alert" className={css.error}>
                    {errors.dates}
                  </span>
                ) : null}
              </div>
              {showDates ? (
                <div id="discovery-dates" className={css.scheduleEditor}>
                  <BookingSchedulePicker
                    value={values.schedule}
                    onChange={schedule => form.change('schedule', schedule)}
                    idPrefix="homepage-schedule"
                  />
                  <button
                    type="button"
                    className={css.doneDates}
                    onClick={() => setShowDates(false)}
                  >
                    Done
                  </button>
                </div>
              ) : null}
              <button className={css.submit} type="submit">
                Search Patches<span aria-hidden="true">→</span>
              </button>
            </form>
          )}
        />
        <div className={css.links}>
          <NamedLink name="SearchPage">Explore all Patches</NamedLink>
          <span aria-hidden="true">·</span>
          <NamedLink name="NewListingPage">Have a space? List your Patch</NamedLink>
        </div>
      </div>
    </section>
  );
};

SectionHero.propTypes = { rootClassName: string, className: string, history: object.isRequired };
export default SectionHero;
