import { SENA_BRAND } from '../components/brand';
import {
  renderSenaEmailLayout,
  htmlToPlainText,
} from '../components/layout';
import {
  renderHeading,
  renderParagraph,
  renderButton,
  renderAmountSummary,
  renderCard,
  renderDetailRow,
  renderAlertCallout,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 11. payment.payment_received
// ----------------------------------------------------------------------
export interface PaymentReceivedParams {
  guestName: string;
  reference: string;
  paymentReference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  amountFormatted: string;
  paymentMethod: string;
  paidAt: string;
  items?: Array<{ label: string; amount: string }>;
  receiptDownloadUrl?: string;
}

export function renderPaymentReceivedEmail(
  params: PaymentReceivedParams
): EmailRenderResult {
  const subject = `Payment Receipt: ${params.amountFormatted} for Booking ${params.reference} at ${params.propertyName}`;

  const defaultItems = params.items || [
    { label: `Accommodation Deposit (${params.reference})`, amount: params.amountFormatted, isBold: true },
  ];

  const content = `
    ${renderHeading(
      'Payment Receipt',
      `Official transaction record from ${escapeHtml(params.propertyName)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `We have successfully received and settled your payment of <strong>${escapeHtml(params.amountFormatted)}</strong>.`
    )}
    ${renderAmountSummary({
      lines: defaultItems,
      total: params.amountFormatted,
      isPaid: true,
    })}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Transaction Reference', `<code style="font-family: monospace; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.paymentReference)}</code>`)}
        ${renderDetailRow('Booking Reference', `<strong style="color: ${SENA_BRAND.colors.deepClay}; font-family: monospace;">${escapeHtml(params.reference)}</strong>`)}
        ${renderDetailRow('Payment Channel', escapeHtml(params.paymentMethod))}
        ${renderDetailRow('Date & Time', escapeHtml(params.paidAt), true)}
      </table>
    `,
      'Transaction Details',
      { text: 'Settled', variant: 'success' }
    )}
    ${
      params.receiptDownloadUrl
        ? renderButton('Download PDF Receipt', params.receiptDownloadUrl)
        : ''
    }
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Payment of ${params.amountFormatted} received for booking ${params.reference}.`,
    headerType: 'property',
    propertyName: params.propertyName,
    propertyLogoUrl: params.propertyLogoUrl,
    propertyAddress: params.propertyAddress,
    propertyPhone: params.propertyPhone,
    propertyEmail: params.propertyEmail,
    footerType: 'property',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 12. payment.bank_transfer_instructions
// ----------------------------------------------------------------------
export interface BankTransferInstructionsParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountFormatted: string;
  whatsappContact?: string;
  expiresInHours?: number;
}

export function renderBankTransferInstructionsEmail(
  params: BankTransferInstructionsParams
): EmailRenderResult {
  const subject = `Payment Instructions for Booking ${params.reference} · ${params.propertyName}`;
  const expiryHours = params.expiresInHours || 24;

  const content = `
    ${renderHeading(
      'Bank Transfer Instructions',
      `Complete your reservation at ${escapeHtml(params.propertyName)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `To confirm your reservation (Ref: <strong>${escapeHtml(params.reference)}</strong>), please transfer the total of <strong>${escapeHtml(params.amountFormatted)}</strong> to the property's official bank account within <strong>${expiryHours} hours</strong>.`
    )}
    ${renderCard(
      `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Bank Name</div>
        <div style="font-size: 15px; font-weight: 600; color: ${SENA_BRAND.colors.ink}; margin-top: 2px;">${escapeHtml(params.bankName)}</div>
      </div>
      <div style="margin-bottom: 12px; background-color: #FFFFFF; border: 1px solid ${SENA_BRAND.colors.sand}; border-radius: 6px; padding: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Account Number</div>
        <div style="font-size: 22px; font-weight: 700; font-family: monospace; letter-spacing: 2px; color: ${SENA_BRAND.colors.terracotta}; margin-top: 3px;">
          ${escapeHtml(params.accountNumber)}
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Beneficiary Account Name</div>
        <div style="font-size: 14px; font-weight: 600; color: ${SENA_BRAND.colors.ink}; margin-top: 2px;">${escapeHtml(params.accountName)}</div>
      </div>
      <div style="border-top: 1px solid #ECE7DE; padding-top: 12px; margin-top: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Required Payment Narration</div>
        <div style="font-size: 15px; font-weight: 700; font-family: monospace; color: ${SENA_BRAND.colors.deepClay}; margin-top: 2px;">
          ${escapeHtml(params.reference)}
        </div>
      </div>
    `,
      'Official Bank Account',
      { text: 'Awaiting Transfer', variant: 'warning' }
    )}
    ${renderAlertCallout(
      `<strong>Verification Note:</strong> Please include booking reference <code>${escapeHtml(params.reference)}</code> in the transfer narration to ensure immediate clearance.` +
        (params.whatsappContact
          ? `<br/>You can also send a proof of transfer to our front desk via WhatsApp at <strong>${escapeHtml(params.whatsappContact)}</strong>.`
          : ''),
      'warning'
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Bank transfer instructions for your stay at ${params.propertyName}. Total: ${params.amountFormatted}`,
    headerType: 'property',
    propertyName: params.propertyName,
    propertyLogoUrl: params.propertyLogoUrl,
    propertyAddress: params.propertyAddress,
    propertyPhone: params.propertyPhone,
    propertyEmail: params.propertyEmail,
    footerType: 'property',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 13. payment.payment_pending
// ----------------------------------------------------------------------
export interface PaymentPendingParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  amountFormatted: string;
  paymentMethod: string;
}

export function renderPaymentPendingEmail(
  params: PaymentPendingParams
): EmailRenderResult {
  const subject = `Payment Pending Confirmation: Booking ${params.reference} · ${params.propertyName}`;

  const content = `
    ${renderHeading(
      'Payment Being Verified',
      `Your transaction for booking ${escapeHtml(params.reference)} is under review.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `We have received your payment notice of <strong>${escapeHtml(params.amountFormatted)}</strong> via ${escapeHtml(params.paymentMethod)}. Our front desk is verifying the settlement with our banking partners.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Booking Reference', escapeHtml(params.reference))}
        ${renderDetailRow('Amount', escapeHtml(params.amountFormatted))}
        ${renderDetailRow('Channel', escapeHtml(params.paymentMethod))}
        ${renderDetailRow('Current Status', 'Verification in Progress', true, true, SENA_BRAND.colors.warning)}
      </table>
    `,
      'Verification Status',
      { text: 'Pending Verification', variant: 'warning' }
    )}
    ${renderParagraph(
      'Once verified, you will automatically receive an official confirmation receipt. If you have any questions, our front desk is here to assist.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Payment verification in progress for booking ${params.reference}.`,
    headerType: 'property',
    propertyName: params.propertyName,
    propertyAddress: params.propertyAddress,
    propertyPhone: params.propertyPhone,
    propertyEmail: params.propertyEmail,
    footerType: 'property',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 14. payment.payment_failed
// ----------------------------------------------------------------------
export interface PaymentFailedParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  amountFormatted: string;
  retryPaymentUrl: string;
  reason?: string;
}

export function renderPaymentFailedEmail(
  params: PaymentFailedParams
): EmailRenderResult {
  const subject = `Action Required: Payment Unsuccessful for Booking ${params.reference}`;

  const content = `
    ${renderHeading(
      'Payment Unsuccessful',
      `We were unable to process your payment for booking ${escapeHtml(params.reference)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `Your recent transaction attempt of <strong>${escapeHtml(params.amountFormatted)}</strong> for your stay at <strong>${escapeHtml(params.propertyName)}</strong> could not be completed.`
    )}
    ${
      params.reason
        ? renderAlertCallout(
            `<strong>Decline Reason:</strong> ${escapeHtml(params.reason)}`,
            'danger'
          )
        : renderAlertCallout(
            'The card issuer or banking network declined the transaction. No funds were debited from your account.',
            'danger'
          )
    }
    ${renderParagraph(
      'Your room reservation is temporarily held. Please click the button below to retry using another card or bank transfer before your hold expires.'
    )}
    ${renderButton('Retry Payment Now', params.retryPaymentUrl)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Payment could not be completed for booking ${params.reference}. Please retry to secure your room.`,
    headerType: 'property',
    propertyName: params.propertyName,
    propertyAddress: params.propertyAddress,
    propertyPhone: params.propertyPhone,
    propertyEmail: params.propertyEmail,
    footerType: 'property',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 15. payment.refund_confirmation
// ----------------------------------------------------------------------
export interface RefundConfirmationParams {
  guestName: string;
  reference: string;
  refundReference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  refundAmountFormatted: string;
  processedAt: string;
  reason?: string;
}

export function renderRefundConfirmationEmail(
  params: RefundConfirmationParams
): EmailRenderResult {
  const subject = `Refund Processed: ${params.refundAmountFormatted} for Booking ${params.reference}`;

  const content = `
    ${renderHeading(
      'Refund Processed',
      `Funds have been returned to your original payment method.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `A refund in the amount of <strong>${escapeHtml(params.refundAmountFormatted)}</strong> has been processed for booking <strong>${escapeHtml(params.reference)}</strong> at ${escapeHtml(params.propertyName)}.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Refund Reference', `<code style="font-family: monospace; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.refundReference)}</code>`)}
        ${renderDetailRow('Booking Reference', escapeHtml(params.reference))}
        ${renderDetailRow('Refund Amount', `<strong style="color: ${SENA_BRAND.colors.terracotta}; font-size: 15px;">${escapeHtml(params.refundAmountFormatted)}</strong>`)}
        ${renderDetailRow('Date Processed', escapeHtml(params.processedAt))}
        ${params.reason ? renderDetailRow('Reason', escapeHtml(params.reason), true) : ''}
      </table>
    `,
      'Refund Details',
      { text: 'Refunded', variant: 'neutral' }
    )}
    ${renderParagraph(
      'Depending on your banking institution, funds typically reflect in your account within 3 to 7 business days.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Refund of ${params.refundAmountFormatted} processed for booking ${params.reference}.`,
    headerType: 'property',
    propertyName: params.propertyName,
    propertyAddress: params.propertyAddress,
    propertyPhone: params.propertyPhone,
    propertyEmail: params.propertyEmail,
    footerType: 'property',
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
