import * as account from './templates/account';
import * as reservation from './templates/reservation';
import * as payment from './templates/payment';
import * as stay from './templates/stay';
import * as staff from './templates/staff';
import * as operations from './templates/operations';
import * as subscription from './templates/subscription';
import * as security from './templates/security';
import * as support from './templates/support';
import * as editorial from './templates/editorial';

export type SenaEmailType =
  // 1. Account
  | 'account.welcome'
  | 'account.verify_email'
  | 'account.property_setup_complete'
  | 'account.sign_in_alert'
  | 'account.password_reset'
  | 'account.password_changed'
  // 2. Reservation
  | 'reservation.booking_confirmation'
  | 'reservation.new_booking_hotel'
  | 'reservation.booking_modified'
  | 'reservation.booking_cancelled'
  // 3. Payment
  | 'payment.payment_received'
  | 'payment.bank_transfer_instructions'
  | 'payment.payment_pending'
  | 'payment.payment_failed'
  | 'payment.refund_confirmation'
  // 4. Stay Lifecycle
  | 'stay.upcoming_stay'
  | 'stay.checkin_confirmation'
  | 'stay.checkout_thank_you'
  | 'stay.stay_receipt'
  // 5. Hotel Staff
  | 'staff.invitation'
  | 'staff.invitation_accepted'
  | 'staff.access_removed'
  // 6. Hotel Operations
  | 'operations.daily_brief'
  | 'operations.end_of_day_summary'
  | 'operations.direct_booking_alert'
  // 7. Subscription
  | 'subscription.activated'
  | 'subscription.upgraded'
  | 'subscription.renewal_reminder'
  | 'subscription.invoice_receipt'
  | 'subscription.payment_failed'
  | 'subscription.limit_approaching'
  | 'subscription.cancelled'
  // 8. Security
  | 'security.email_changed'
  | 'security.new_device_session'
  | 'security.suspicious_login'
  | 'security.mfa_enabled'
  | 'security.mfa_disabled'
  // 9. Support
  | 'support.request_received'
  | 'support.staff_reply'
  | 'support.ticket_resolved'
  // 10. Editorial
  | 'editorial.product_update';

export interface EmailParamMap {
  'account.welcome': account.WelcomeEmailParams;
  'account.verify_email': account.VerifyEmailParams;
  'account.property_setup_complete': account.PropertySetupCompleteParams;
  'account.sign_in_alert': account.SignInAlertParams;
  'account.password_reset': account.PasswordResetParams;
  'account.password_changed': account.PasswordChangedParams;

  'reservation.booking_confirmation': reservation.BookingConfirmationParams;
  'reservation.new_booking_hotel': reservation.NewBookingHotelParams;
  'reservation.booking_modified': reservation.BookingModifiedParams;
  'reservation.booking_cancelled': reservation.BookingCancelledParams;

  'payment.payment_received': payment.PaymentReceivedParams;
  'payment.bank_transfer_instructions': payment.BankTransferInstructionsParams;
  'payment.payment_pending': payment.PaymentPendingParams;
  'payment.payment_failed': payment.PaymentFailedParams;
  'payment.refund_confirmation': payment.RefundConfirmationParams;

  'stay.upcoming_stay': stay.UpcomingStayParams;
  'stay.checkin_confirmation': stay.CheckinConfirmationParams;
  'stay.checkout_thank_you': stay.CheckoutThankYouParams;
  'stay.stay_receipt': stay.StayReceiptParams;

  'staff.invitation': staff.StaffInvitationParams;
  'staff.invitation_accepted': staff.StaffInvitationAcceptedParams;
  'staff.access_removed': staff.StaffAccessRemovedParams;

  'operations.daily_brief': operations.DailyBriefParams;
  'operations.end_of_day_summary': operations.EndOfDaySummaryParams;
  'operations.direct_booking_alert': operations.DirectBookingAlertParams;

  'subscription.activated': subscription.SubscriptionActivatedParams;
  'subscription.upgraded': subscription.SubscriptionUpgradedParams;
  'subscription.renewal_reminder': subscription.SubscriptionRenewalParams;
  'subscription.invoice_receipt': subscription.SubscriptionInvoiceParams;
  'subscription.payment_failed': subscription.SubscriptionPaymentFailedParams;
  'subscription.limit_approaching': subscription.SubscriptionLimitApproachingParams;
  'subscription.cancelled': subscription.SubscriptionCancelledParams;

  'security.email_changed': security.SecurityEmailChangedParams;
  'security.new_device_session': security.SecurityNewDeviceParams;
  'security.suspicious_login': security.SecuritySuspiciousLoginParams;
  'security.mfa_enabled': security.SecurityMfaEnabledParams;
  'security.mfa_disabled': security.SecurityMfaDisabledParams;

  'support.request_received': support.SupportRequestReceivedParams;
  'support.staff_reply': support.SupportStaffReplyParams;
  'support.ticket_resolved': support.SupportTicketResolvedParams;

  'editorial.product_update': editorial.EditorialProductEmailParams;
}

export const EMAIL_RENDERERS: {
  [K in SenaEmailType]: (params: EmailParamMap[K]) => account.EmailRenderResult;
} = {
  'account.welcome': account.renderWelcomeEmail,
  'account.verify_email': account.renderVerifyEmail,
  'account.property_setup_complete': account.renderPropertySetupCompleteEmail,
  'account.sign_in_alert': account.renderSignInAlertEmail,
  'account.password_reset': account.renderPasswordResetEmail,
  'account.password_changed': account.renderPasswordChangedEmail,

  'reservation.booking_confirmation': reservation.renderBookingConfirmationEmail,
  'reservation.new_booking_hotel': reservation.renderNewBookingHotelEmail,
  'reservation.booking_modified': reservation.renderBookingModifiedEmail,
  'reservation.booking_cancelled': reservation.renderBookingCancelledEmail,

  'payment.payment_received': payment.renderPaymentReceivedEmail,
  'payment.bank_transfer_instructions': payment.renderBankTransferInstructionsEmail,
  'payment.payment_pending': payment.renderPaymentPendingEmail,
  'payment.payment_failed': payment.renderPaymentFailedEmail,
  'payment.refund_confirmation': payment.renderRefundConfirmationEmail,

  'stay.upcoming_stay': stay.renderUpcomingStayEmail,
  'stay.checkin_confirmation': stay.renderCheckinConfirmationEmail,
  'stay.checkout_thank_you': stay.renderCheckoutThankYouEmail,
  'stay.stay_receipt': stay.renderStayReceiptEmail,

  'staff.invitation': staff.renderStaffInvitationEmail,
  'staff.invitation_accepted': staff.renderStaffInvitationAcceptedEmail,
  'staff.access_removed': staff.renderStaffAccessRemovedEmail,

  'operations.daily_brief': operations.renderDailyBriefEmail,
  'operations.end_of_day_summary': operations.renderEndOfDaySummaryEmail,
  'operations.direct_booking_alert': operations.renderDirectBookingAlertEmail,

  'subscription.activated': subscription.renderSubscriptionActivatedEmail,
  'subscription.upgraded': subscription.renderSubscriptionUpgradedEmail,
  'subscription.renewal_reminder': subscription.renderSubscriptionRenewalEmail,
  'subscription.invoice_receipt': subscription.renderSubscriptionInvoiceEmail,
  'subscription.payment_failed': subscription.renderSubscriptionPaymentFailedEmail,
  'subscription.limit_approaching': subscription.renderSubscriptionLimitApproachingEmail,
  'subscription.cancelled': subscription.renderSubscriptionCancelledEmail,

  'security.email_changed': security.renderSecurityEmailChangedEmail,
  'security.new_device_session': security.renderSecurityNewDeviceEmail,
  'security.suspicious_login': security.renderSecuritySuspiciousLoginEmail,
  'security.mfa_enabled': security.renderSecurityMfaEnabledEmail,
  'security.mfa_disabled': security.renderSecurityMfaDisabledEmail,

  'support.request_received': support.renderSupportRequestReceivedEmail,
  'support.staff_reply': support.renderSupportStaffReplyEmail,
  'support.ticket_resolved': support.renderSupportTicketResolvedEmail,

  'editorial.product_update': editorial.renderEditorialProductEmail,
};
