"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSubscriptionActivatedEmail = renderSubscriptionActivatedEmail;
exports.renderSubscriptionUpgradedEmail = renderSubscriptionUpgradedEmail;
exports.renderSubscriptionRenewalEmail = renderSubscriptionRenewalEmail;
exports.renderSubscriptionInvoiceEmail = renderSubscriptionInvoiceEmail;
exports.renderSubscriptionPaymentFailedEmail = renderSubscriptionPaymentFailedEmail;
exports.renderSubscriptionLimitApproachingEmail = renderSubscriptionLimitApproachingEmail;
exports.renderSubscriptionCancelledEmail = renderSubscriptionCancelledEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderSubscriptionActivatedEmail(params) {
    const subject = `Sena ${params.planName} Activated · ${params.organizationName}`;
    const content = `
    ${(0, elements_1.renderHeading)(`Welcome to Sena ${params.planName}`, 'Your hospitality operating system plan is active.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`Your subscription to the <strong>${escapeHtml(params.planName)}</strong> tier has been successfully activated for <strong>${escapeHtml(params.organizationName)}</strong>.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Subscription Plan', escapeHtml(params.planName))}
        ${(0, elements_1.renderDetailRow)('Billing Cadence', escapeHtml(params.billingCycle === 'yearly' ? 'Annual Billing' : 'Monthly Billing'))}
        ${(0, elements_1.renderDetailRow)('Subscription Rate', escapeHtml(params.amountFormatted))}
        ${(0, elements_1.renderDetailRow)('Room Capacity Limit', `Up to ${params.roomLimit} Rooms`)}
        ${(0, elements_1.renderDetailRow)('Next Billing Renewal', escapeHtml(params.nextBillingDate), true)}
      </table>
    `, 'Subscription Plan Overview', { text: 'Active', variant: 'success' })}
    ${(0, elements_1.renderParagraph)('All plan features including multi-property management, direct booking widgets, staff permission rosters, and real-time housekeeping are available immediately.')}
    ${(0, elements_1.renderButton)('Open Sena Console', `${brand_1.SENA_BRAND.appUrl}/dashboard`)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Sena ${params.planName} is active for ${params.organizationName}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSubscriptionUpgradedEmail(params) {
    const subject = `Sena Plan Upgraded to ${params.newPlan}`;
    const content = `
    ${(0, elements_1.renderHeading)('Subscription Upgraded', `Your organization is now on the ${escapeHtml(params.newPlan)} tier.`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`Your subscription for <strong>${escapeHtml(params.organizationName)}</strong> has been upgraded from ${escapeHtml(params.previousPlan)} to <strong>${escapeHtml(params.newPlan)}</strong>.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('New Tier', escapeHtml(params.newPlan))}
        ${(0, elements_1.renderDetailRow)('Rate', escapeHtml(params.newAmountFormatted))}
        ${(0, elements_1.renderDetailRow)('Effective Date', escapeHtml(params.effectiveDate), true)}
      </table>
    `, 'Updated Plan Details', { text: 'Upgraded', variant: 'terracotta' })}
    ${(0, elements_1.renderButton)('Explore New Features', `${brand_1.SENA_BRAND.appUrl}/settings/billing`)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your Sena plan has been upgraded to ${params.newPlan}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSubscriptionRenewalEmail(params) {
    const subject = `Upcoming Sena Subscription Renewal · ${params.renewalDate}`;
    const content = `
    ${(0, elements_1.renderHeading)('Upcoming Renewal Notice', 'Your subscription will automatically renew soon.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`This is a courtesy notice that your <strong>${escapeHtml(params.planName)}</strong> subscription for ${escapeHtml(params.organizationName)} will renew on <strong>${escapeHtml(params.renewalDate)}</strong>.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Plan', escapeHtml(params.planName))}
        ${(0, elements_1.renderDetailRow)('Renewal Date', escapeHtml(params.renewalDate))}
        ${(0, elements_1.renderDetailRow)('Renewal Amount', `<strong style="color: ${brand_1.SENA_BRAND.colors.deepClay};">${escapeHtml(params.amountFormatted)}</strong>`)}
        ${params.paymentMethodLast4 ? (0, elements_1.renderDetailRow)('Billing Card', `Card ending in ${escapeHtml(params.paymentMethodLast4)}`, true) : ''}
      </table>
    `, 'Renewal Summary')}
    ${(0, elements_1.renderParagraph)('No action is required if you wish to maintain your active subscription. You can update your payment method or modify your subscription settings anytime in your billing portal.')}
    ${(0, elements_1.renderButton)('Review Billing Settings', `${brand_1.SENA_BRAND.appUrl}/settings/billing`, 'left', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your Sena subscription will renew on ${params.renewalDate}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSubscriptionInvoiceEmail(params) {
    const subject = `Invoice ${params.invoiceNumber} Paid · Sena Subscription`;
    const content = `
    ${(0, elements_1.renderHeading)('Sena Subscription Receipt', `Invoice ${escapeHtml(params.invoiceNumber)} settled successfully.`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`Thank you for your payment. Your subscription fee of <strong>${escapeHtml(params.amountFormatted)}</strong> for ${escapeHtml(params.organizationName)} has been processed.`)}
    ${(0, elements_1.renderAmountSummary)({
        lines: [
            { label: `Sena ${params.planName} (${params.billingPeriod})`, amount: params.amountFormatted, isBold: true },
        ],
        total: params.amountFormatted,
        isPaid: true,
    })}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Invoice Number', `<code style="font-family: monospace; color: ${brand_1.SENA_BRAND.colors.deepClay};">${escapeHtml(params.invoiceNumber)}</code>`)}
        ${(0, elements_1.renderDetailRow)('Organization', escapeHtml(params.organizationName))}
        ${(0, elements_1.renderDetailRow)('Date Settled', escapeHtml(params.paidAt), true)}
      </table>
    `, 'Invoice Particulars')}
    ${params.downloadInvoiceUrl
        ? (0, elements_1.renderButton)('Download PDF Tax Invoice', params.downloadInvoiceUrl)
        : ''}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Tax receipt for Sena invoice ${params.invoiceNumber}. Total: ${params.amountFormatted}`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSubscriptionPaymentFailedEmail(params) {
    const subject = `Action Required: Subscription Payment Failed for ${params.organizationName}`;
    const billingUrl = params.updateBillingUrl || `${brand_1.SENA_BRAND.appUrl}/settings/billing`;
    const content = `
    ${(0, elements_1.renderHeading)('Payment Unsuccessful', 'We could not renew your Sena subscription.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`We were unable to charge your card on file for your <strong>${escapeHtml(params.planName)}</strong> subscription (${escapeHtml(params.amountFormatted)}) for ${escapeHtml(params.organizationName)}.`)}
    ${(0, elements_1.renderAlertCallout)('Your property booking engines and front desk access remain active during our 3-day grace period. Please update your billing method to prevent service interruption.', 'danger')}
    ${(0, elements_1.renderButton)('Update Payment Method', billingUrl)}
    ${(0, elements_1.renderParagraph)(params.nextRetryDate
        ? `We will automatically retry the card on <strong>${escapeHtml(params.nextRetryDate)}</strong>.`
        : 'Please update your card details at your earliest convenience.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Subscription payment failed for ${params.organizationName}. Please update your billing details.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSubscriptionLimitApproachingEmail(params) {
    const subject = `Notice: Approaching room limit on your Sena ${params.planName} plan`;
    const url = params.upgradeUrl || `${brand_1.SENA_BRAND.appUrl}/settings/billing`;
    const content = `
    ${(0, elements_1.renderHeading)('Plan Capacity Notice', 'You are nearing your configured inventory threshold.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`Your property portfolio under <strong>${escapeHtml(params.organizationName)}</strong> currently has <strong>${params.currentRoomCount}</strong> rooms configured out of your plan limit of <strong>${params.maxRoomLimit}</strong> rooms.`)}
    ${(0, elements_1.renderCard)(`
      <div style="font-size: 13px; color: ${brand_1.SENA_BRAND.colors.inkMuted}; margin-bottom: 8px;">Inventory Utilization</div>
      <div style="background-color: #E8E1D5; border-radius: 4px; height: 10px; width: 100%; overflow: hidden;">
        <div style="background-color: ${brand_1.SENA_BRAND.colors.terracotta}; height: 100%; width: ${Math.min(100, Math.round((params.currentRoomCount / params.maxRoomLimit) * 100))}%;"></div>
      </div>
      <div style="font-size: 12px; font-weight: 600; color: ${brand_1.SENA_BRAND.colors.deepClay}; margin-top: 8px; text-align: right;">
        ${params.currentRoomCount} / ${params.maxRoomLimit} Rooms (${Math.round((params.currentRoomCount / params.maxRoomLimit) * 100)}%)
      </div>
    `, 'Room Inventory Cap')}
    ${(0, elements_1.renderParagraph)('To add additional rooms, categories, or secondary properties without restriction, upgrade to the next tier in your billing settings.')}
    ${(0, elements_1.renderButton)('Upgrade Room Capacity', url)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `You have reached ${params.currentRoomCount} of ${params.maxRoomLimit} rooms on Sena.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSubscriptionCancelledEmail(params) {
    const subject = `Subscription Cancelled · ${params.organizationName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Subscription Cancellation', 'Your subscription cancellation has been confirmed.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`As requested, your <strong>${escapeHtml(params.planName)}</strong> subscription for ${escapeHtml(params.organizationName)} has been set to cancel. You will retain full operational access to your properties until <strong>${escapeHtml(params.accessEndDate)}</strong>.`)}
    ${(0, elements_1.renderAlertCallout)('After this date, your direct booking engines will be paused and accounts will transition to read-only archival mode. Your guest and transaction data will be securely preserved.', 'info')}
    ${(0, elements_1.renderParagraph)('If you changed your mind or wish to resume your subscription before your term ends, you can reactivate anytime.', true)}
    ${(0, elements_1.renderButton)('Reactivate Subscription', `${brand_1.SENA_BRAND.appUrl}/settings/billing`)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your Sena subscription will end on ${params.accessEndDate}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
