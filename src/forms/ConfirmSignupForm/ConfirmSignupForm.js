import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { compose } from 'redux';
import { FormattedMessage, injectIntl, intlShape } from '../../util/reactIntl';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';
import * as validators from '../../util/validators';
import {
  Form,
  PrimaryButton,
  FieldTextInput,
  FieldPhoneNumberInput,
  FieldRadioButton,
  FieldSelect,
} from '../../components';

import css from './ConfirmSignupForm.module.css';
import _css from '../SignupForm/SignupForm.module.css';
import FieldCheckboxComponent from '../../components/FieldCheckbox/FieldCheckbox';
import { _interestedPatches } from '../SignupForm/interestedPatches';

const KEY_CODE_ENTER = 13;

const ConfirmSignupFormComponent = props => {
  const [hearAbtUsOtherShowError, setHearAbtUsOtherShowError] = useState(false);
  const [hearAbtUsOtherShow, setHearAbtUsOtherShow] = useState(false);

  const handleFormSubmittion = values => {
    console.log(values, props);
    if (values.hearAboutUs === 'Other' && !values.hearAboutUsOther) {
      setHearAbtUsOtherShowError(true);
    } else {
      props.onSubmit(values);
    }
  };

  return (
    <FinalForm
      {...props}
      onSubmit={handleFormSubmittion}
      render={formRenderProps => {
        const {
          rootClassName,
          className,
          formId,
          inProgress,
          invalid,
          intl,
          onOpenTermsOfService,
          authInfo,
          idp,
        } = formRenderProps;

        // email
        const emailLabel = intl.formatMessage({
          id: 'ConfirmSignupForm.emailLabel',
        });
        const emailPlaceholder = intl.formatMessage({
          id: 'ConfirmSignupForm.emailPlaceholder',
        });
        const emailRequiredMessage = intl.formatMessage({
          id: 'ConfirmSignupForm.emailRequired',
        });
        const emailRequired = validators.required(emailRequiredMessage);
        const emailInvalidMessage = intl.formatMessage({
          id: 'ConfirmSignupForm.emailInvalid',
        });
        const emailValid = validators.emailFormatValid(emailInvalidMessage);

        // firstName
        const firstNameLabel = intl.formatMessage({
          id: 'ConfirmSignupForm.firstNameLabel',
        });
        const firstNamePlaceholder = intl.formatMessage({
          id: 'ConfirmSignupForm.firstNamePlaceholder',
        });
        const firstNameRequiredMessage = intl.formatMessage({
          id: 'ConfirmSignupForm.firstNameRequired',
        });
        const firstNameRequired = validators.required(firstNameRequiredMessage);

        // lastName
        const lastNameLabel = intl.formatMessage({
          id: 'ConfirmSignupForm.lastNameLabel',
        });
        const lastNamePlaceholder = intl.formatMessage({
          id: 'ConfirmSignupForm.lastNamePlaceholder',
        });
        const lastNameRequiredMessage = intl.formatMessage({
          id: 'ConfirmSignupForm.lastNameRequired',
        });
        const lastNameRequired = validators.required(lastNameRequiredMessage);

        // phone number
        const phoneLabel = intl.formatMessage({
          id: 'SignupForm.phoneLabel',
        });
        const phonePlaceholder = intl.formatMessage({
          id: 'SignupForm.phonePlaceholder',
        });
        const phoneRequiredMessage = intl.formatMessage({
          id: 'SignupForm.phoneRequired',
        });
        const hearRequiredMessage = intl.formatMessage({
          id: 'SignupForm.hearRequired',
        });

        const planRequiredMessage = intl.formatMessage({
          id: 'SignupForm.planRequired',
        });

        const phoneRequired = validators.required(phoneRequiredMessage);
        const hearRequired = validators.required(hearRequiredMessage);
        const planRequired = validators.required(planRequiredMessage);

        const hearLabel = intl.formatMessage({
          id: 'SignupForm.HearAboutUs',
        });
        const hearOtherLabel = intl.formatMessage({
          id: 'SignupForm.HearAboutUsOtherLabel',
        });

        const classes = classNames(rootClassName || css.root, className);
        const submitInProgress = inProgress;
        const submitDisabled = invalid || submitInProgress;

        const handleTermsKeyUp = e => {
          // Allow click action with keyboard like with normal links
          if (e.keyCode === KEY_CODE_ENTER) {
            onOpenTermsOfService();
          }
        };

        const handleChangeHearAbtUs = e => {
          if (e === 'Other') setHearAbtUsOtherShow(true);
          else setHearAbtUsOtherShow(false);
        };

        const termsLink = (
          <span
            className={css.termsLink}
            onClick={onOpenTermsOfService}
            role="button"
            tabIndex="0"
            onKeyUp={handleTermsKeyUp}
          >
            <FormattedMessage id="ConfirmSignupForm.termsAndConditionsLinkText" />
          </span>
        );

        // If authInfo is not available we should not show the ConfirmForm
        if (!authInfo) {
          return;
        }

        // Initial values from idp provider
        const { email, firstName, lastName } = authInfo;

        return (
          <Form className={classes} onSubmit={formRenderProps.handleSubmit}>
            <div>
              <label className={_css.subTitle}>
                <FormattedMessage id="SignupForm.planningToUse" />
              </label>
              <div className={_css.radioButtonRow}>
                <FieldRadioButton
                  id="Hosting"
                  name="planningType"
                  label={'Hosting'}
                  value="Hosting"
                  showAsRequired={true}
                  circleClassName={_css.radioButtonCircle}
                  className={_css.radioButtonLabel}
                  required={true}
                />
                <FieldRadioButton
                  id="Renting"
                  name="planningType"
                  label={'Renting'}
                  value="Renting"
                  circleClassName={_css.radioButtonCircle}
                  className={_css.radioButtonLabel}
                  showAsRequired={true}
                  required={true}
                />
                <FieldRadioButton
                  id="Both"
                  name="planningType"
                  label={'Both'}
                  value="Both"
                  circleClassName={_css.radioButtonCircle}
                  className={_css.radioButtonLabel}
                  showAsRequired={true}
                  required={true}
                  validate={planRequired}
                />
              </div>
              <FieldTextInput
                type="email"
                id={formId ? `${formId}.email` : 'email'}
                name="email"
                autoComplete="email"
                label={emailLabel}
                placeholder={emailPlaceholder}
                initialValue={email}
                validate={validators.composeValidators(emailRequired, emailValid)}
              />
              <div className={css.name}>
                <FieldTextInput
                  className={css.firstNameRoot}
                  type="text"
                  id={formId ? `${formId}.firstName` : 'firstName'}
                  name="firstName"
                  autoComplete="given-name"
                  label={firstNameLabel}
                  placeholder={firstNamePlaceholder}
                  initialValue={firstName}
                  validate={firstNameRequired}
                />
                <FieldTextInput
                  className={css.lastNameRoot}
                  type="text"
                  id={formId ? `${formId}.lastName` : 'lastName'}
                  name="lastName"
                  autoComplete="family-name"
                  label={lastNameLabel}
                  placeholder={lastNamePlaceholder}
                  initialValue={lastName}
                  validate={lastNameRequired}
                />
              </div>

              <FieldPhoneNumberInput
                className={css.phone}
                id={formId ? `${formId}.phoneNumber` : 'phoneNumber'}
                name="phoneNumber"
                label={phoneLabel}
                placeholder={phonePlaceholder}
                validate={phoneRequired}
              />
              <div className={_css.firstAndLastField}>
                <label className={_css.subTitle}>
                  <FormattedMessage id="SignupForm.InterestedPatches" />
                </label>
                <ul className={_css.radioButtonRowInterestedPatch}>
                  {_interestedPatches.map((val, index) => (
                    // <FieldRadioButton
                    //   id={val.id}
                    //   name={val.id}
                    //   label={val.id}
                    //   value={val.id}
                    //   circleClassName={_css.radioButtonCircle}
                    //   className={_css.radioButtonInterestedPatch}
                    //   label_css={_css.radioButtonInterestedPatchLabel}
                    //   key={index}
                    // />
                    <li key={index} className={_css.radioButtonInterestedPatch}>
                      <FieldCheckboxComponent
                        id={val.id}
                        name={val.name}
                        label={val.id}
                        value={val.id}
                      />
                    </li>
                  ))}
                </ul>
              </div>
              <div className={_css.firstAndLastField}>
                <FieldSelect
                  id="hearAbout"
                  name="hearAboutUs"
                  style={{ fontSize: '16px' }}
                  label={hearLabel}
                  validate={hearRequired}
                  onChange={handleChangeHearAbtUs}
                  onFocus={() => setHearAbtUsOtherShowError(false)}
                >
                  <option selected disabled value="" key="">
                    Select
                  </option>
                  <option value="Google" key="Google">
                    Google
                  </option>
                  <option
                    value="Recommendation by friend or colleague"
                    key="Recommendation by friend or colleague"
                  >
                    Recommendation by friend or colleague
                  </option>
                  <option value="Social Media" key="Social Media">
                    Social Media
                  </option>
                  <option value="Blog" key="Blog">
                    Blog
                  </option>
                  <option value="Other" key="Other">
                    Other
                  </option>
                </FieldSelect>
                <FieldTextInput
                  className={_css.phone}
                  style={hearAbtUsOtherShow ? { display: 'block' } : { display: 'none' }}
                  type="text"
                  id={formId ? `${formId}.hearAbout` : 'hearAbout'}
                  name="hearAboutUsOther"
                  placeholder={hearOtherLabel}
                  onFocus={() => setHearAbtUsOtherShowError(false)}
                  // validate={hearAbtUsOtherShow && hearOtherRequired}
                />
                {hearAbtUsOtherShowError && (
                  <p
                    style={{
                      color: '#ef7171',
                      fontSize: 16,
                      fontFamily: 'sofiapro, Helvetica, Arial, sans-serif',
                      margin: 0,
                    }}
                  >
                    We’d love to know where you heard about us!
                  </p>
                )}
              </div>
            </div>

            <div className={css.bottomWrapper}>
              <p className={css.bottomWrapperText}>
                <span className={css.termsText}>
                  <FormattedMessage
                    id="ConfirmSignupForm.termsAndConditionsAcceptText"
                    values={{ termsLink }}
                  />
                </span>
              </p>
              <PrimaryButton type="submit" inProgress={submitInProgress} disabled={submitDisabled}>
                <FormattedMessage id="ConfirmSignupForm.signUp" values={{ idp: idp }} />
              </PrimaryButton>
            </div>
          </Form>
        );
      }}
    />
  );
};

ConfirmSignupFormComponent.defaultProps = { inProgress: false };

const { bool, func } = PropTypes;

ConfirmSignupFormComponent.propTypes = {
  inProgress: bool,

  onOpenTermsOfService: func.isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

const ConfirmSignupForm = compose(injectIntl)(ConfirmSignupFormComponent);
ConfirmSignupForm.displayName = 'ConfirmSignupForm';

export default ConfirmSignupForm;
