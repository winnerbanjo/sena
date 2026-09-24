"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPaymentReceivedEmail = renderPaymentReceivedEmail;
exports.renderBankTransferInstructionsEmail = renderBankTransferInstructionsEmail;
exports.renderPaymentPendingEmail = renderPaymentPendingEmail;
exports.renderPaymentFailedEmail = renderPaymentFailedEmail;
exports.renderRefundConfirmationEmail = renderRefundConfirmationEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderPaymentReceivedEmail(params) {
    const subject = `Payment Receipt: ${params.amountFormatted} for Booking ${params.reference} at ${params.propertyName}`;
    const defaultItems = params.items || [
        { label: `Accommodation Deposit (${params.reference})`, amount: params.amountFormatted, isBold: true },
    ];
    const content = `
    ${(0, elements_1.renderHeading)('Payment Receipt', `Official transaction record from ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`We have successfully received and settled your payment of <strong>${escapeHtml(params.amountFormatted)}</strong>.`)}
    ${(0, elements_1.renderAmountSummary)({
        lines: defaultItems,
        total: params.amountFormatted,
        isPaid: true,
    })}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Transaction Reference', `<code style="font-family: monospace; color: ${brand_1.SENA_BRAND.colors.deepClay};">${escapeHtml(params.paymentReference)}</code>`)}
        ${(0, elements_1.renderDetailRow)('Booking Reference', `<strong style="color: ${brand_1.SENA_BRAND.colors.deepClay}; font-family: monospace;">${escapeHtml(params.reference)}</strong>`)}
        ${(0, elements_1.renderDetailRow)('Payment Channel', escapeHtml(params.paymentMethod))}
        ${(0, elements_1.renderDetailRow)('Date & Time', escapeHtml(params.paidAt), true)}
      </table>
    `, 'Transaction Details', { text: 'Settled', variant: 'success' })}
    ${params.receiptDownloadUrl
        ? (0, elements_1.renderButton)('Download PDF Receipt', params.receiptDownloadUrl)
        : ''}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
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
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderBankTransferInstructionsEmail(params) {
    const subject = `Payment Instructions for Booking ${params.reference} · ${params.propertyName}`;
    const expiryHours = params.expiresInHours || 24;
    const content = `
    ${(0, elements_1.renderHeading)('Bank Transfer Instructions', `Complete your reservation at ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`To confirm your reservation (Ref: <strong>${escapeHtml(params.reference)}</strong>), please transfer the total of <strong>${escapeHtml(params.amountFormatted)}</strong> to the property's official bank account within <strong>${expiryHours} hours</strong>.`)}
    ${(0, elements_1.renderCard)(`
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Bank Name</div>
        <div style="font-size: 15px; font-weight: 600; color: ${brand_1.SENA_BRAND.colors.ink}; margin-top: 2px;">${escapeHtml(params.bankName)}</div>
      </div>
      <div style="margin-bottom: 12px; background-color: #FFFFFF; border: 1px solid ${brand_1.SENA_BRAND.colors.sand}; border-radius: 6px; padding: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Account Number</div>
        <div style="font-size: 22px; font-weight: 700; font-family: monospace; letter-spacing: 2px; color: ${brand_1.SENA_BRAND.colors.terracotta}; margin-top: 3px;">
          ${escapeHtml(params.accountNumber)}
        </div>
      </div>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Beneficiary Account Name</div>
        <div style="font-size: 14px; font-weight: 600; color: ${brand_1.SENA_BRAND.colors.ink}; margin-top: 2px;">${escapeHtml(params.accountName)}</div>
      </div>
      <div style="border-top: 1px solid #ECE7DE; padding-top: 12px; margin-top: 12px;">
        <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight}; letter-spacing: 0.5px;">Required Payment Narration</div>
        <div style="font-size: 15px; font-weight: 700; font-family: monospace; color: ${brand_1.SENA_BRAND.colors.deepClay}; margin-top: 2px;">
          ${escapeHtml(params.reference)}
        </div>
      </div>
    `, 'Official Bank Account', { text: 'Awaiting Transfer', variant: 'warning' })}
    ${(0, elements_1.renderAlertCallout)(`<strong>Verification Note:</strong> Please include booking reference <code>${escapeHtml(params.reference)}</code> in the transfer narration to ensure immediate clearance.` +
        (params.whatsappContact
            ? `<br/>You can also send a proof of transfer to our front desk via WhatsApp at <strong>${escapeHtml(params.whatsappContact)}</strong>.`
            : ''), 'warning')}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
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
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderPaymentPendingEmail(params) {
    const subject = `Payment Pending Confirmation: Booking ${params.reference} · ${params.propertyName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Payment Being Verified', `Your transaction for booking ${escapeHtml(params.reference)} is under review.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`We have received your payment notice of <strong>${escapeHtml(params.amountFormatted)}</strong> via ${escapeHtml(params.paymentMethod)}. Our front desk is verifying the settlement with our banking partners.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Booking Reference', escapeHtml(params.reference))}
        ${(0, elements_1.renderDetailRow)('Amount', escapeHtml(params.amountFormatted))}
        ${(0, elements_1.renderDetailRow)('Channel', escapeHtml(params.paymentMethod))}
        ${(0, elements_1.renderDetailRow)('Current Status', 'Verification in Progress', true, true, brand_1.SENA_BRAND.colors.warning)}
      </table>
    `, 'Verification Status', { text: 'Pending Verification', variant: 'warning' })}
    ${(0, elements_1.renderParagraph)('Once verified, you will automatically receive an official confirmation receipt. If you have any questions, our front desk is here to assist.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Payment verification in progress for booking ${params.reference}.`,
        headerType: 'property',
        propertyName: params.propertyName,
        propertyAddress: params.propertyAddress,
        propertyPhone: params.propertyPhone,
        propertyEmail: params.propertyEmail,
        footerType: 'property',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderPaymentFailedEmail(params) {
    const subject = `Action Required: Payment Unsuccessful for Booking ${params.reference}`;
    const content = `
    ${(0, elements_1.renderHeading)('Payment Unsuccessful', `We were unable to process your payment for booking ${escapeHtml(params.reference)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`Your recent transaction attempt of <strong>${escapeHtml(params.amountFormatted)}</strong> for your stay at <strong>${escapeHtml(params.propertyName)}</strong> could not be completed.`)}
    ${params.reason
        ? (0, elements_1.renderAlertCallout)(`<strong>Decline Reason:</strong> ${escapeHtml(params.reason)}`, 'danger')
        : (0, elements_1.renderAlertCallout)('The card issuer or banking network declined the transaction. No funds were debited from your account.', 'danger')}
    ${(0, elements_1.renderParagraph)('Your room reservation is temporarily held. Please click the button below to retry using another card or bank transfer before your hold expires.')}
    ${(0, elements_1.renderButton)('Retry Payment Now', params.retryPaymentUrl)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Payment could not be completed for booking ${params.reference}. Please retry to secure your room.`,
        headerType: 'property',
        propertyName: params.propertyName,
        propertyAddress: params.propertyAddress,
        propertyPhone: params.propertyPhone,
        propertyEmail: params.propertyEmail,
        footerType: 'property',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderRefundConfirmationEmail(params) {
    const subject = `Refund Processed: ${params.refundAmountFormatted} for Booking ${params.reference}`;
    const content = `
    ${(0, elements_1.renderHeading)('Refund Processed', `Funds have been returned to your original payment method.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`A refund in the amount of <strong>${escapeHtml(params.refundAmountFormatted)}</strong> has been processed for booking <strong>${escapeHtml(params.reference)}</strong> at ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Refund Reference', `<code style="font-family: monospace; color: ${brand_1.SENA_BRAND.colors.deepClay};">${escapeHtml(params.refundReference)}</code>`)}
        ${(0, elements_1.renderDetailRow)('Booking Reference', escapeHtml(params.reference))}
        ${(0, elements_1.renderDetailRow)('Refund Amount', `<strong style="color: ${brand_1.SENA_BRAND.colors.terracotta}; font-size: 15px;">${escapeHtml(params.refundAmountFormatted)}</strong>`)}
        ${(0, elements_1.renderDetailRow)('Date Processed', escapeHtml(params.processedAt))}
        ${params.reason ? (0, elements_1.renderDetailRow)('Reason', escapeHtml(params.reason), true) : ''}
      </table>
    `, 'Refund Details', { text: 'Refunded', variant: 'neutral' })}
    ${(0, elements_1.renderParagraph)('Depending on your banking institution, funds typically reflect in your account within 3 to 7 business days.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Refund of ${params.refundAmountFormatted} processed for booking ${params.reference}.`,
        headerType: 'property',
        propertyName: params.propertyName,
        propertyAddress: params.propertyAddress,
        propertyPhone: params.propertyPhone,
        propertyEmail: params.propertyEmail,
        footerType: 'property',
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
