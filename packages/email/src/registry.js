"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_RENDERERS = void 0;
const account = __importStar(require("./templates/account"));
const reservation = __importStar(require("./templates/reservation"));
const payment = __importStar(require("./templates/payment"));
const stay = __importStar(require("./templates/stay"));
const staff = __importStar(require("./templates/staff"));
const operations = __importStar(require("./templates/operations"));
const subscription = __importStar(require("./templates/subscription"));
const security = __importStar(require("./templates/security"));
const support = __importStar(require("./templates/support"));
const editorial = __importStar(require("./templates/editorial"));
exports.EMAIL_RENDERERS = {
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
