import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { DATE_TYPE_DATE, DATE_TYPE_DATETIME, LINE_ITEM_DAY, HOURLY_PRICE } from '../../util/types';
import { ensureListing } from '../../util/data';
import { BookingBreakdown, PrimaryButton } from '../../components';
import { types as sdkTypes } from '../../util/sdkLoader';
import css from './TransactionPanel.module.css';
import { FormattedMessage } from 'react-intl';
import LineItemDiscountMaybe from '../BookingBreakdown/LineItemDiscountMaybe';
import FieldDiscount from '../../forms/BookingTimeForm/FiledDiscount';

// Functional component as a helper to build BookingBreakdown
const BreakdownMaybe = props => {
  const {
    className,
    rootClassName,
    breakdownClassName,
    transaction,
    transactionRole,
    unitType,
    promocode,
    intl,
    onSumbitBookingRequestEnquiry,
  } = props;
  const [planType, setPlanType] = useState(null);
  const [result, setResult] = React.useState({
    _sdkType: 'Money',
    amount: 0,
    currency: 'GBP',
  });
  var dataToSend = {};

  useEffect(() => {
    const _publicDataPlan = transaction?.attributes?.protectedData.planType || null;
    setPlanType(_publicDataPlan);
    if (_publicDataPlan !== 'price') {
      dataToSend = {
        bookingDates: {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        },
        enquirybookingType: _publicDataPlan,
        fromWhere: 'enquiry',
      };
    } else if (_publicDataPlan === 'price') {
      dataToSend = {
        enquirybookingType: _publicDataPlan,
        fromWhere: 'enquiry',
        bookingStartDate: { date: new Date(startDate) },
        bookingEndDate: { date: new Date(endDate) },
        bookingStartTime: startTime?.toString(),
        bookingEndTime: endTime?.toString(),
      };
    }
  }, [transaction]);

  const { startTime, endTime, displayStartDate, displayEndDate, startDate, endDate } =
    transaction?.attributes?.protectedData || {};
  const loaded = transaction && transaction.id && transaction.booking && transaction.booking.id;
  const listingAttributes = ensureListing(transaction.listing).attributes;
  const timeZone =
    loaded && listingAttributes.availabilityPlan
      ? listingAttributes.availabilityPlan.timezone
      : 'Etc/UTC';
  const bookingType =
    (transaction &&
      transaction.attributes &&
      transaction.attributes.protectedData &&
      transaction.attributes.protectedData.type) ||
    HOURLY_PRICE;
  const dateType = bookingType === HOURLY_PRICE ? DATE_TYPE_DATETIME : DATE_TYPE_DATE;

  const classes = classNames(rootClassName || css.breakdownMaybe, className);
  const breakdownClasses = classNames(breakdownClassName || css.breakdown);

  // console.log(
  //   'breakdown maybe',
  //   Object.keys(transaction.attributes.protectedData),
  //   transaction.attributes.protectedData
  // );

  if (
    transaction?.attributes?.lastTransition &&
    transaction.attributes.lastTransition === 'transition/enquire' &&
    transaction?.attributes?.protectedData &&
    Object.keys(transaction.attributes.protectedData).length > 0
    // && transactionRole === 'provider'
  ) {
    const formatDate = timestamp => {
      const date = new Date(timestamp);
      const options = { weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: true };
      return date.toLocaleTimeString('en-US', options);
    };
    function formatDateDaily(dateString) {
      const date = new Date(dateString);
      const options = { month: 'long', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }
    const formatDay = timestamp => {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const formatMonthDay = timestamp => {
      const date = new Date(timestamp);
      const options = { month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    };

    const startTimeFormatted = formatDate(startTime);
    const startDayFormatted = formatDay(startTime);
    const startMonthDayFormatted = formatMonthDay(startTime);

    const endTimeFormatted = formatDate(endTime);
    const endDayFormatted = formatDay(endTime);
    const endMonthDayFormatted = formatMonthDay(endTime);

    const calculateHours = (startTime, endTime) => {
      const differenceInMillis = endTime - startTime;
      const differenceInHours = differenceInMillis / (1000 * 60 * 60);
      return differenceInHours;
    };
    const calculateDays = (startDay, endDay) => {
      const startDate = new Date(startDay);
      const endDate = new Date(endDay);
      const differenceInMillis = endDate - startDate;
      const differenceInDays = differenceInMillis / (1000 * 60 * 60 * 24);
      return differenceInDays; // Adding 1 to include both start and end date
    };
    const calculateWeeks = (startDay, endDay) => {
      const startDate = new Date(startDay);
      const endDate = new Date(endDay);
      const differenceInMillis = endDate - startDate;
      const differenceInDays = differenceInMillis / (1000 * 60 * 60 * 24);
      const differenceInWeeks = differenceInDays / 7;
      const roundedWeeks = parseFloat(differenceInWeeks.toFixed(1));
      return roundedWeeks;
    };
    const calculateMonths = (startDay, endDay) => {
      const startDate = new Date(startDay);
      const endDate = new Date(endDay);

      // Calculate the total difference in full months
      let totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12;
      totalMonths -= startDate.getMonth();
      totalMonths += endDate.getMonth();

      // Calculate the number of days in the start and end months
      const daysInStartMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0
      ).getDate();
      const daysInEndMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();

      // Calculate the number of days from the start date to the end of the start month
      const daysFromStart = daysInStartMonth - startDate.getDate() + 1;

      // Calculate the number of days from the beginning of the end month to the end date
      const daysToEnd = endDate.getDate();

      // Calculate the fraction of the first month
      const fractionOfStartMonth = daysFromStart / daysInStartMonth;

      // Calculate the fraction of the last month
      const fractionOfEndMonth = daysToEnd / daysInEndMonth;

      // If the start and end dates are in the same month, we need to adjust the total months calculation
      if (
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth()
      ) {
        totalMonths = fractionOfStartMonth;
      } else {
        totalMonths = totalMonths - 1 + fractionOfStartMonth + fractionOfEndMonth;
      }

      // Round to one decimal place
      const roundedMonths = parseFloat(totalMonths.toFixed(1));

      return roundedMonths;
    };

    // const _numberOfHours = calculateDays(displayStartDate, displayEndDate);
    const _numberOfHours =
      planType === 'price'
        ? calculateHours(startTime, endTime)
        : planType === 'pricePerDay'
        ? calculateDays(displayStartDate, displayEndDate)
        : planType === 'pricePerMonth'
        ? calculateMonths(displayStartDate, displayEndDate)
        : calculateWeeks(displayStartDate, displayEndDate);
    let pricePerHour = null;
    let _currencyType = null;
    let _currencySymbol = '£';

    if (planType === 'price') {
      pricePerHour = transaction?.listing?.attributes?.price?.amount / 100;
      _currencyType = transaction?.listing?.attributes?.price?.currency;
    } else if (planType === 'pricePerDay') {
      _currencyType = transaction?.listing?.attributes?.publicData?.pricePerDay?.currency;
      pricePerHour = transaction?.listing?.attributes?.publicData?.pricePerDay?.amount / 100;
    } else if (planType === 'pricePerMonth') {
      _currencyType = transaction?.listing?.attributes?.publicData?.pricePerMonth?.currency;
      pricePerHour = transaction?.listing?.attributes?.publicData?.pricePerMonth?.amount / 100;
    } else if (planType === 'pricePerWeek') {
      _currencyType = transaction?.listing?.attributes?.publicData?.pricePerWeek?.currency;
      pricePerHour = transaction?.listing?.attributes?.publicData?.pricePerWeek?.amount / 100;
    }

    if (_currencyType === 'EUR') {
      _currencySymbol = '€';
    } else if (_currencyType === 'USD') {
      _currencySymbol = '$';
    }

    const _hourlyPrice = (pricePerHour * _numberOfHours).toFixed(2);
    const _serviceFee = (_hourlyPrice / 10).toFixed(2);
    const _totalPrice =
      transactionRole === 'provider'
        ? (_hourlyPrice - _serviceFee).toFixed(2)
        : (+_hourlyPrice + +_serviceFee).toFixed(2);

    const _bookerCustomerPriceLabel =
      transactionRole === 'provider' ? "You'll make" : 'Total price';

    const _formattedDate = new Date(displayEndDate);
    _formattedDate.setDate(_formattedDate.getDate() - 1);
    let formattedDate1dayLessEndDate = _formattedDate.toISOString().split('T')[0];

    console.log('breakdown maybe =>', formattedDate1dayLessEndDate);
    const updateResult = data => {
      setResult(data);
    };

    return (
      <div>
        <div className={css.customBreakDownDateTimeMain}>
          <div>
            <h5 style={{ margin: 3 }}>Booking start</h5>
            <h4
              style={planType === 'price' ? { fontWeight: 'bold', margin: 3 } : { display: 'none' }}
            >
              {startTimeFormatted}
            </h4>
            <h4 style={{ margin: 3 }}>{formatDateDaily(displayStartDate)}</h4>
          </div>
          <div>
            <h5 style={{ margin: 3 }}>Booking end</h5>
            <h4
              style={planType === 'price' ? { fontWeight: 'bold', margin: 3 } : { display: 'none' }}
            >
              {endTimeFormatted}
            </h4>
            <h4 style={{ margin: 3 }}>
              {planType === 'price'
                ? formatDateDaily(displayEndDate)
                : formatDateDaily(formattedDate1dayLessEndDate)}
            </h4>
          </div>
        </div>
        <div className={css.customBreakDownDateTimeMain}>
          <div>
            <h4 style={{ margin: 3 }}>
              Number of{' '}
              {planType === 'price'
                ? 'hours'
                : planType === 'pricePerWeek'
                ? 'weeks'
                : planType === 'pricePerMonth'
                ? 'months'
                : 'days'}
            </h4>
            <h4 style={{ margin: 3 }}>
              {_currencySymbol}
              {planType === 'price'
                ? transaction?.listing?.attributes?.price?.amount / 100
                : planType === 'pricePerWeek'
                ? transaction?.listing?.attributes?.publicData?.pricePerWeekFilter
                : planType === 'pricePerMonth'
                ? transaction?.listing?.attributes?.publicData?.pricePerMonthFilter
                : transaction?.listing?.attributes?.publicData?.pricePerDayFilter}{' '}
              * {_numberOfHours}{' '}
              {planType === 'price'
                ? 'hour(s)'
                : planType === 'pricePerWeek'
                ? 'week(s)'
                : planType === 'pricePerMonth'
                ? 'month(s)'
                : 'day(s)'}
            </h4>
          </div>
          <div>
            <h4 style={{ margin: 3 }}>
              {_numberOfHours}{' '}
              {planType === 'price'
                ? 'hour(s)'
                : planType === 'pricePerWeek'
                ? 'week(s)'
                : planType === 'pricePerMonth'
                ? 'month(s)'
                : 'day(s)'}
            </h4>
            <h4 style={{ margin: 3 }}>
              {_currencySymbol}
              {_hourlyPrice}{' '}
            </h4>
          </div>
        </div>
        <div className={css.customBreakDownDateTimeMain}>
          <div>
            <h4 style={{ fontWeight: 'bold', margin: 3 }}>Subtotal</h4>
            <h5 style={{ margin: 3 }}>Service Fees*</h5>
          </div>
          <div>
            <h4 style={{ margin: 3 }}>
              {_currencySymbol}
              {_hourlyPrice}
            </h4>
            <h5 style={{ margin: 3 }}>
              {transactionRole === 'provider' && '-'}
              {_currencySymbol}
              {_serviceFee}
            </h5>
          </div>
        </div>
        <div className={css.customBreakDownDateTimeMain}>
          <div>
            <h3 style={{ margin: 3 }}>{_bookerCustomerPriceLabel}</h3>
          </div>
          <div>
            <h3 style={{ margin: 3 }}>
              {_currencySymbol}
              {_totalPrice}
            </h3>
          </div>
        </div>
        <p className={css.feeInfo}>
          * The fee helps us run the platform and provide the best possible service to you!
        </p>
        {transactionRole === 'customer' && (
          <>
            <div className={css.fieldDiscount}>
              <FieldDiscount
                promo={props.promocode}
                updateDiscount={props.updateDiscount}
                updateResult={updateResult}
                result={result}
                isProvider={transactionRole === 'provider'}
                transaction={transaction}
                intl={intl}
              />
              <p className={css.wontChargeInfo}>You won't be charged yet </p>
            </div>

            <div className={css.submitButtonClasses}>
              <PrimaryButton onClick={() => onSumbitBookingRequestEnquiry(dataToSend)}>
                Request to book
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    );
  }

  return loaded ? (
    <div className={classes}>
      <BookingBreakdown
        promocode={promocode}
        className={breakdownClasses}
        userRole={transactionRole}
        unitType={unitType}
        transaction={transaction}
        booking={transaction.booking}
        dateType={dateType}
        timeZone={timeZone}
      />
    </div>
  ) : null;
};

export default BreakdownMaybe;
