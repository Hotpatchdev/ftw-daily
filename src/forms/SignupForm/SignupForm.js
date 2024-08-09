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
  FieldSelect,
  FieldRadioButton,
} from '../../components';

import css from './SignupForm.module.css';
import { _interestedPatches } from './interestedPatches';
import FieldCheckboxComponent from '../../components/FieldCheckbox/FieldCheckbox';

const KEY_CODE_ENTER = 13;

const SignupFormComponent = props => (
  <FinalForm
    {...props}
    render={fieldRenderProps => {
      const {
        rootClassName,
        className,
        formId,
        handleSubmit,
        inProgress,
        invalid,
        intl,
        onOpenTermsOfService,
      } = fieldRenderProps;

      const [hearAbtUsOtherShow, setHearAbtUsOtherShow] = useState(false);
      // email
      const emailLabel = intl.formatMessage({
        id: 'SignupForm.emailLabel',
      });
      const emailPlaceholder = intl.formatMessage({
        id: 'SignupForm.emailPlaceholder',
      });
      const emailRequiredMessage = intl.formatMessage({
        id: 'SignupForm.emailRequired',
      });
      const emailRequired = validators.required(emailRequiredMessage);
      const emailInvalidMessage = intl.formatMessage({
        id: 'SignupForm.emailInvalid',
      });
      const emailValid = validators.emailFormatValid(emailInvalidMessage);

      // password
      const passwordLabel = intl.formatMessage({
        id: 'SignupForm.passwordLabel',
      });
      const hearLabel = intl.formatMessage({
        id: 'SignupForm.HearAboutUs',
      });
      const hearOtherLabel = intl.formatMessage({
        id: 'SignupForm.HearAboutUsOtherLabel',
      });
      const passwordPlaceholder = intl.formatMessage({
        id: 'SignupForm.passwordPlaceholder',
      });
      const passwordRequiredMessage = intl.formatMessage({
        id: 'SignupForm.passwordRequired',
      });
      const passwordMinLengthMessage = intl.formatMessage(
        {
          id: 'SignupForm.passwordTooShort',
        },
        {
          minLength: validators.PASSWORD_MIN_LENGTH,
        }
      );
      const passwordMaxLengthMessage = intl.formatMessage(
        {
          id: 'SignupForm.passwordTooLong',
        },
        {
          maxLength: validators.PASSWORD_MAX_LENGTH,
        }
      );
      const passwordMinLength = validators.minLength(
        passwordMinLengthMessage,
        validators.PASSWORD_MIN_LENGTH
      );
      const passwordMaxLength = validators.maxLength(
        passwordMaxLengthMessage,
        validators.PASSWORD_MAX_LENGTH
      );
      const passwordRequired = validators.requiredStringNoTrim(passwordRequiredMessage);
      const passwordValidators = validators.composeValidators(
        passwordRequired,
        passwordMinLength,
        passwordMaxLength
      );

      // firstName
      const firstNameLabel = intl.formatMessage({
        id: 'SignupForm.firstNameLabel',
      });
      const firstNamePlaceholder = intl.formatMessage({
        id: 'SignupForm.firstNamePlaceholder',
      });
      const firstNameRequiredMessage = intl.formatMessage({
        id: 'SignupForm.firstNameRequired',
      });
      const firstNameRequired = validators.required(firstNameRequiredMessage);

      // lastName
      const lastNameLabel = intl.formatMessage({
        id: 'SignupForm.lastNameLabel',
      });
      const lastNamePlaceholder = intl.formatMessage({
        id: 'SignupForm.lastNamePlaceholder',
      });
      const lastNameRequiredMessage = intl.formatMessage({
        id: 'SignupForm.lastNameRequired',
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
      const planRequiredMessage = intl.formatMessage({
        id: 'SignupForm.planRequired',
      });
      const hearRequiredMessage = intl.formatMessage({
        id: 'SignupForm.hearRequired',
      });
      const phoneRequired = validators.required(phoneRequiredMessage);
      const hearRequired = validators.required(hearRequiredMessage);
      const planRequired = validators.required(planRequiredMessage);

      const classes = classNames(rootClassName || css.root, className);
      const submitInProgress = inProgress;
      const submitDisabled = invalid || submitInProgress;

      const handleTermsKeyUp = e => {
        // Allow click action with keyboard like with normal links
        if (e.keyCode === KEY_CODE_ENTER) {
          onOpenTermsOfService();
        }
      };
      const termsLink = (
        <span
          className={css.termsLink}
          onClick={onOpenTermsOfService}
          role="button"
          tabIndex="0"
          onKeyUp={handleTermsKeyUp}
        >
          <FormattedMessage id="SignupForm.termsAndConditionsLinkText" />
        </span>
      );

      const handleChangeHearAbtUs = e => {
        if (e === 'Other') setHearAbtUsOtherShow(true);
        else setHearAbtUsOtherShow(false);
      };

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          <div>
            <p></p>
            <p className={css.bottomWrapperText}>
              <span className={css.password}>
                <FormattedMessage id="SignupForm.Intro" />
              </span>
            </p>
          </div>
          <div>
            <label className={css.subTitle}>
              <FormattedMessage id="SignupForm.planningToUse" />
            </label>
            <div className={css.radioButtonRow}>
              <FieldRadioButton
                id="Hosting"
                name="planningType"
                label={'Hosting'}
                value="Hosting"
                showAsRequired={true}
                circleClassName={css.radioButtonCircle}
                className={css.radioButtonLabel}
                required={true}
              />
              <FieldRadioButton
                id="Renting"
                name="planningType"
                label={'Renting'}
                value="Renting"
                circleClassName={css.radioButtonCircle}
                className={css.radioButtonLabel}
                showAsRequired={true}
                required={true}
              />
              <FieldRadioButton
                id="Both"
                name="planningType"
                label={'Both'}
                value="Both"
                circleClassName={css.radioButtonCircle}
                className={css.radioButtonLabel}
                showAsRequired={true}
                required={true}
                validate={planRequired}
              />
            </div>
            <div className={css.firstAndLastField}>
              <FieldTextInput
                type="email"
                id={formId ? `${formId}.email` : 'email'}
                name="email"
                autoComplete="email"
                label={emailLabel}
                placeholder={emailPlaceholder}
                validate={validators.composeValidators(emailRequired, emailValid)}
              />
            </div>
            <div className={css.name}>
              <FieldTextInput
                className={css.firstNameRoot}
                type="text"
                id={formId ? `${formId}.fname` : 'fname'}
                name="fname"
                autoComplete="given-name"
                label={firstNameLabel}
                placeholder={firstNamePlaceholder}
                validate={firstNameRequired}
              />
              <FieldTextInput
                className={css.lastNameRoot}
                type="text"
                id={formId ? `${formId}.lname` : 'lname'}
                name="lname"
                autoComplete="family-name"
                label={lastNameLabel}
                placeholder={lastNamePlaceholder}
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

            <FieldTextInput
              className={css.password}
              type="password"
              id={formId ? `${formId}.password` : 'password'}
              name="password"
              autoComplete="new-password"
              label={passwordLabel}
              placeholder={passwordPlaceholder}
              validate={passwordValidators}
            />

            <div className={css.firstAndLastField}>
              <label className={css.subTitle}>
                <FormattedMessage id="SignupForm.InterestedPatches" />
              </label>
              <ul className={css.radioButtonRowInterestedPatch}>
                {_interestedPatches.map((val, index) => (
                  // <FieldRadioButton
                  //   id={val.id}
                  //   name={val.id}
                  //   label={val.id}
                  //   value={val.id}
                  //   circleClassName={css.radioButtonCircle}
                  //   className={css.radioButtonInterestedPatch}
                  //   labelCss={css.radioButtonInterestedPatchLabel}
                  //   key={index}
                  // />
                  <li key={index} className={css.radioButtonInterestedPatch}>
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
            <div className={css.firstAndLastField}>
              <FieldSelect
                id="hearAbout"
                name="hearAboutUs"
                style={{ fontSize: '16px' }}
                label={hearLabel}
                validate={hearRequired}
                onChange={handleChangeHearAbtUs}
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
                className={css.phone}
                style={hearAbtUsOtherShow ? { display: 'block' } : { display: 'none' }}
                type="text"
                id={formId ? `${formId}.hearAbout` : 'hearAbout'}
                name="hearAboutUsOther"
                placeholder={hearOtherLabel}
              />
            </div>
          </div>

          <div className={css.bottomWrapper}>
            <p className={css.bottomWrapperText}>
              <span className={css.termsText}>
                <FormattedMessage
                  id="SignupForm.termsAndConditionsAcceptText"
                  values={{ termsLink }}
                />
              </span>
            </p>
            <PrimaryButton type="submit" inProgress={submitInProgress} disabled={submitDisabled}>
              <FormattedMessage id="SignupForm.signUp" />
            </PrimaryButton>
          </div>
        </Form>
      );
    }}
  />
);

SignupFormComponent.defaultProps = { inProgress: false };

const { bool, func } = PropTypes;

SignupFormComponent.propTypes = {
  inProgress: bool,

  onOpenTermsOfService: func.isRequired,

  // from injectIntl
  intl: intlShape.isRequired,
};

const SignupForm = compose(injectIntl)(SignupFormComponent);
SignupForm.displayName = 'SignupForm';

export default SignupForm;
