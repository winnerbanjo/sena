import { SENA_BRAND } from '../components/brand';
import {
  renderSenaEmailLayout,
  htmlToPlainText,
} from '../components/layout';
import {
  renderHeading,
  renderParagraph,
  renderButton,
  renderCard,
  renderDetailRow,
  renderAlertCallout,
  renderAmountSummary,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 26. subscription.activated
// ----------------------------------------------------------------------
export interface SubscriptionActivatedParams {
  userName: string;
  organizationName: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amountFormatted: string;
  roomLimit: number;
  nextBillingDate: string;
}

export function renderSubscriptionActivatedEmail(
  params: SubscriptionActivatedParams
): EmailRenderResult {
  const subject = `Sena ${params.planName} Activated · ${params.organizationName}`;

  const content = `
    ${renderHeading(
      `Welcome to Sena ${params.planName}`,
      'Your hospitality operating system plan is active.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Your subscription to the <strong>${escapeHtml(params.planName)}</strong> tier has been successfully activated for <strong>${escapeHtml(params.organizationName)}</strong>.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Subscription Plan', escapeHtml(params.planName))}
        ${renderDetailRow('Billing Cadence', escapeHtml(params.billingCycle === 'yearly' ? 'Annual Billing' : 'Monthly Billing'))}
        ${renderDetailRow('Subscription Rate', escapeHtml(params.amountFormatted))}
        ${renderDetailRow('Room Capacity Limit', `Up to ${params.roomLimit} Rooms`)}
        ${renderDetailRow('Next Billing Renewal', escapeHtml(params.nextBillingDate), true)}
      </table>
    `,
      'Subscription Plan Overview',
      { text: 'Active', variant: 'success' }
    )}
    ${renderParagraph(
      'All plan features including multi-property management, direct booking widgets, staff permission rosters, and real-time housekeeping are available immediately.'
    )}
    ${renderButton('Open Sena Console', `${SENA_BRAND.appUrl}/dashboard`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Sena ${params.planName} is active for ${params.organizationName}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 27. subscription.upgraded
// ----------------------------------------------------------------------
export interface SubscriptionUpgradedParams {
  userName: string;
  organizationName: string;
  previousPlan: string;
  newPlan: string;
  newAmountFormatted: string;
  effectiveDate: string;
}

export function renderSubscriptionUpgradedEmail(
  params: SubscriptionUpgradedParams
): EmailRenderResult {
  const subject = `Sena Plan Upgraded to ${params.newPlan}`;

  const content = `
    ${renderHeading(
      'Subscription Upgraded',
      `Your organization is now on the ${escapeHtml(params.newPlan)} tier.`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Your subscription for <strong>${escapeHtml(params.organizationName)}</strong> has been upgraded from ${escapeHtml(params.previousPlan)} to <strong>${escapeHtml(params.newPlan)}</strong>.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('New Tier', escapeHtml(params.newPlan))}
        ${renderDetailRow('Rate', escapeHtml(params.newAmountFormatted))}
        ${renderDetailRow('Effective Date', escapeHtml(params.effectiveDate), true)}
      </table>
    `,
      'Updated Plan Details',
      { text: 'Upgraded', variant: 'terracotta' }
    )}
    ${renderButton('Explore New Features', `${SENA_BRAND.appUrl}/settings/billing`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Your Sena plan has been upgraded to ${params.newPlan}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 28. subscription.renewal_reminder
// ----------------------------------------------------------------------
export interface SubscriptionRenewalParams {
  userName: string;
  organizationName: string;
  planName: string;
  renewalDate: string;
  amountFormatted: string;
  paymentMethodLast4?: string;
}

export function renderSubscriptionRenewalEmail(
  params: SubscriptionRenewalParams
): EmailRenderResult {
  const subject = `Upcoming Sena Subscription Renewal · ${params.renewalDate}`;

  const content = `
    ${renderHeading(
      'Upcoming Renewal Notice',
      'Your subscription will automatically renew soon.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `This is a courtesy notice that your <strong>${escapeHtml(params.planName)}</strong> subscription for ${escapeHtml(params.organizationName)} will renew on <strong>${escapeHtml(params.renewalDate)}</strong>.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Plan', escapeHtml(params.planName))}
        ${renderDetailRow('Renewal Date', escapeHtml(params.renewalDate))}
        ${renderDetailRow('Renewal Amount', `<strong style="color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.amountFormatted)}</strong>`)}
        ${params.paymentMethodLast4 ? renderDetailRow('Billing Card', `Card ending in ${escapeHtml(params.paymentMethodLast4)}`, true) : ''}
      </table>
    `,
      'Renewal Summary'
    )}
    ${renderParagraph(
      'No action is required if you wish to maintain your active subscription. You can update your payment method or modify your subscription settings anytime in your billing portal.'
    )}
    ${renderButton('Review Billing Settings', `${SENA_BRAND.appUrl}/settings/billing`, 'left', true)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Your Sena subscription will renew on ${params.renewalDate}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 29. subscription.invoice_receipt
// ----------------------------------------------------------------------
export interface SubscriptionInvoiceParams {
  userName: string;
  organizationName: string;
  invoiceNumber: string;
  billingPeriod: string;
  amountFormatted: string;
  planName: string;
  paidAt: string;
  downloadInvoiceUrl?: string;
}

export function renderSubscriptionInvoiceEmail(
  params: SubscriptionInvoiceParams
): EmailRenderResult {
  const subject = `Invoice ${params.invoiceNumber} Paid · Sena Subscription`;

  const content = `
    ${renderHeading(
      'Sena Subscription Receipt',
      `Invoice ${escapeHtml(params.invoiceNumber)} settled successfully.`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Thank you for your payment. Your subscription fee of <strong>${escapeHtml(params.amountFormatted)}</strong> for ${escapeHtml(params.organizationName)} has been processed.`
    )}
    ${renderAmountSummary({
      lines: [
        { label: `Sena ${params.planName} (${params.billingPeriod})`, amount: params.amountFormatted, isBold: true },
      ],
      total: params.amountFormatted,
      isPaid: true,
    })}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Invoice Number', `<code style="font-family: monospace; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.invoiceNumber)}</code>`)}
        ${renderDetailRow('Organization', escapeHtml(params.organizationName))}
        ${renderDetailRow('Date Settled', escapeHtml(params.paidAt), true)}
      </table>
    `,
      'Invoice Particulars'
    )}
    ${
      params.downloadInvoiceUrl
        ? renderButton('Download PDF Tax Invoice', params.downloadInvoiceUrl)
        : ''
    }
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Tax receipt for Sena invoice ${params.invoiceNumber}. Total: ${params.amountFormatted}`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 30. subscription.payment_failed
// ----------------------------------------------------------------------
export interface SubscriptionPaymentFailedParams {
  userName: string;
  organizationName: string;
  planName: string;
  amountFormatted: string;
  nextRetryDate?: string;
  updateBillingUrl?: string;
}

export function renderSubscriptionPaymentFailedEmail(
  params: SubscriptionPaymentFailedParams
): EmailRenderResult {
  const subject = `Action Required: Subscription Payment Failed for ${params.organizationName}`;
  const billingUrl = params.updateBillingUrl || `${SENA_BRAND.appUrl}/settings/billing`;

  const content = `
    ${renderHeading(
      'Payment Unsuccessful',
      'We could not renew your Sena subscription.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `We were unable to charge your card on file for your <strong>${escapeHtml(params.planName)}</strong> subscription (${escapeHtml(params.amountFormatted)}) for ${escapeHtml(params.organizationName)}.`
    )}
    ${renderAlertCallout(
      'Your property booking engines and front desk access remain active during our 3-day grace period. Please update your billing method to prevent service interruption.',
      'danger'
    )}
    ${renderButton('Update Payment Method', billingUrl)}
    ${renderParagraph(
      params.nextRetryDate
        ? `We will automatically retry the card on <strong>${escapeHtml(params.nextRetryDate)}</strong>.`
        : 'Please update your card details at your earliest convenience.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Subscription payment failed for ${params.organizationName}. Please update your billing details.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 31. subscription.limit_approaching
// ----------------------------------------------------------------------
export interface SubscriptionLimitApproachingParams {
  userName: string;
  organizationName: string;
  planName: string;
  currentRoomCount: number;
  maxRoomLimit: number;
  upgradeUrl?: string;
}

export function renderSubscriptionLimitApproachingEmail(
  params: SubscriptionLimitApproachingParams
): EmailRenderResult {
  const subject = `Notice: Approaching room limit on your Sena ${params.planName} plan`;
  const url = params.upgradeUrl || `${SENA_BRAND.appUrl}/settings/billing`;

  const content = `
    ${renderHeading(
      'Plan Capacity Notice',
      'You are nearing your configured inventory threshold.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Your property portfolio under <strong>${escapeHtml(params.organizationName)}</strong> currently has <strong>${params.currentRoomCount}</strong> rooms configured out of your plan limit of <strong>${params.maxRoomLimit}</strong> rooms.`
    )}
    ${renderCard(
      `
      <div style="font-size: 13px; color: ${SENA_BRAND.colors.inkMuted}; margin-bottom: 8px;">Inventory Utilization</div>
      <div style="background-color: #E8E1D5; border-radius: 4px; height: 10px; width: 100%; overflow: hidden;">
        <div style="background-color: ${SENA_BRAND.colors.terracotta}; height: 100%; width: ${Math.min(100, Math.round((params.currentRoomCount / params.maxRoomLimit) * 100))}%;"></div>
      </div>
      <div style="font-size: 12px; font-weight: 600; color: ${SENA_BRAND.colors.deepClay}; margin-top: 8px; text-align: right;">
        ${params.currentRoomCount} / ${params.maxRoomLimit} Rooms (${Math.round((params.currentRoomCount / params.maxRoomLimit) * 100)}%)
      </div>
    `,
      'Room Inventory Cap'
    )}
    ${renderParagraph(
      'To add additional rooms, categories, or secondary properties without restriction, upgrade to the next tier in your billing settings.'
    )}
    ${renderButton('Upgrade Room Capacity', url)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `You have reached ${params.currentRoomCount} of ${params.maxRoomLimit} rooms on Sena.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 32. subscription.cancelled
// ----------------------------------------------------------------------
export interface SubscriptionCancelledParams {
  userName: string;
  organizationName: string;
  planName: string;
  accessEndDate: string;
}

export function renderSubscriptionCancelledEmail(
  params: SubscriptionCancelledParams
): EmailRenderResult {
  const subject = `Subscription Cancelled · ${params.organizationName}`;

  const content = `
    ${renderHeading(
      'Subscription Cancellation',
      'Your subscription cancellation has been confirmed.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `As requested, your <strong>${escapeHtml(params.planName)}</strong> subscription for ${escapeHtml(params.organizationName)} has been set to cancel. You will retain full operational access to your properties until <strong>${escapeHtml(params.accessEndDate)}</strong>.`
    )}
    ${renderAlertCallout(
      'After this date, your direct booking engines will be paused and accounts will transition to read-only archival mode. Your guest and transaction data will be securely preserved.',
      'info'
    )}
    ${renderParagraph(
      'If you changed your mind or wish to resume your subscription before your term ends, you can reactivate anytime.',
      true
    )}
    ${renderButton('Reactivate Subscription', `${SENA_BRAND.appUrl}/settings/billing`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Your Sena subscription will end on ${params.accessEndDate}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
