"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderUpcomingStayEmail = renderUpcomingStayEmail;
exports.renderCheckinConfirmationEmail = renderCheckinConfirmationEmail;
exports.renderCheckoutThankYouEmail = renderCheckoutThankYouEmail;
exports.renderStayReceiptEmail = renderStayReceiptEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderUpcomingStayEmail(params) {
    const subject = `Looking Forward to Welcoming You · ${params.propertyName}`;
    const checkInTime = params.checkInTime || '2:00 PM';
    const content = `
    ${(0, elements_1.renderHeading)('Your Stay Begins Soon', `We are preparing for your arrival at ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`Your check-in date is approaching on <strong>${escapeHtml(params.checkInDate)}</strong> (from ${escapeHtml(checkInTime)}). Our team is dedicated to making your visit seamless and memorable.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Booking Reference', escapeHtml(params.reference))}
        ${(0, elements_1.renderDetailRow)('Room Category', escapeHtml(params.roomType))}
        ${(0, elements_1.renderDetailRow)('Check-in Date', escapeHtml(params.checkInDate))}
        ${(0, elements_1.renderDetailRow)('Check-in Time', `From ${escapeHtml(checkInTime)}`)}
        ${params.propertyAddress ? (0, elements_1.renderDetailRow)('Location', escapeHtml(params.propertyAddress), true) : ''}
      </table>
    `, 'Upcoming Stay Overview', { text: 'Arrival Ready', variant: 'terracotta' })}
    ${params.directionsOrTips
        ? (0, elements_1.renderCard)(`<p style="margin: 0; font-size: 14px; line-height: 1.6; color: ${brand_1.SENA_BRAND.colors.ink};">${escapeHtml(params.directionsOrTips)}</p>`, 'Directions & Arrival Advice')
        : ''}
    ${params.manageBookingUrl
        ? (0, elements_1.renderButton)('View Reservation Details', params.manageBookingUrl)
        : ''}
    ${(0, elements_1.renderParagraph)(`If you have estimated arrival times or special dietary requirements, reply directly to this email or reach us at ${escapeHtml(params.propertyPhone || '+234 1 234 5678')}.`, true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Looking forward to welcoming you to ${params.propertyName} on ${params.checkInDate}.`,
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
function renderCheckinConfirmationEmail(params) {
    const subject = `Welcome to Room ${params.roomNumber} · ${params.propertyName}`;
    const checkoutTime = params.checkoutTime || '11:00 AM';
    const content = `
    ${(0, elements_1.renderHeading)(`Welcome to ${params.propertyName}`, `You are checked in to Room ${escapeHtml(params.roomNumber)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`It is our pleasure to welcome you. Below are your essential in-house details for a comfortable stay.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Room Assigned', `<strong style="font-size: 16px; color: ${brand_1.SENA_BRAND.colors.deepClay};">Room ${escapeHtml(params.roomNumber)}</strong>`)}
        ${(0, elements_1.renderDetailRow)('Room Category', escapeHtml(params.roomType))}
        ${(0, elements_1.renderDetailRow)('Check-out Date', escapeHtml(params.checkoutDate))}
        ${(0, elements_1.renderDetailRow)('Check-out Time', `By ${escapeHtml(checkoutTime)}`, true)}
      </table>
    `, 'In-House Stay Details', { text: 'Checked In', variant: 'success' })}
    ${params.wifiNetwork
        ? (0, elements_1.renderCard)(`
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${(0, elements_1.renderDetailRow)('Network SSID', `<strong style="font-family: monospace;">${escapeHtml(params.wifiNetwork)}</strong>`)}
            ${params.wifiPassword ? (0, elements_1.renderDetailRow)('Password', `<code style="font-family: monospace; font-size: 14px; color: ${brand_1.SENA_BRAND.colors.terracotta}; font-weight: bold;">${escapeHtml(params.wifiPassword)}</code>`, true) : ''}
          </table>
        `, 'High-Speed Guest Wi-Fi')
        : ''}
    ${params.breakfastTimes
        ? `<div style="background-color: #FAF7F2; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: ${brand_1.SENA_BRAND.colors.inkMuted};">
            <strong style="color: ${brand_1.SENA_BRAND.colors.deepClay};">Breakfast Service:</strong> ${escapeHtml(params.breakfastTimes)}
          </div>`
        : ''}
    ${(0, elements_1.renderParagraph)(`To request room service, housekeeping, or assistance, dial the front desk from your room phone or call ${escapeHtml(params.propertyPhone || 'reception')}.`, true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Welcome to ${params.propertyName}. You are checked into Room ${params.roomNumber}.`,
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
function renderCheckoutThankYouEmail(params) {
    const subject = `Thank You for Staying With Us · ${params.propertyName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Thank You for Your Stay', `We hope you enjoyed your time at ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`Thank you for choosing <strong>${escapeHtml(params.propertyName)}</strong>. Our entire team appreciated having you as our guest, and we hope your stay was restful and seamless.`)}
    ${(0, elements_1.renderParagraph)('Your feedback is invaluable in helping us maintain our hospitality standards. We would appreciate two minutes of your time to share your experience.')}
    ${params.reviewUrl
        ? (0, elements_1.renderButton)('Share Your Feedback', params.reviewUrl)
        : ''}
    ${(0, elements_1.renderParagraph)('We look forward to welcoming you back on your next visit.', true)}
    ${params.bookAgainUrl
        ? (0, elements_1.renderButton)('Book Your Next Stay (Zero Booking Fees)', params.bookAgainUrl, 'left', true)
        : ''}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Thank you for staying at ${params.propertyName}. We hope to welcome you again soon.`,
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
function renderStayReceiptEmail(params) {
    const subject = `Final Folio & Receipt: ${params.folioNumber} · ${params.propertyName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Official Folio & Statement', `Complete stay account for booking ${escapeHtml(params.reference)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`Please find below your final itemized folio from your stay at <strong>${escapeHtml(params.propertyName)}</strong>.`)}
    ${(0, elements_1.renderAmountSummary)({
        lines: params.folioItems,
        total: params.totalAmountFormatted,
        isPaid: true,
    })}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Folio Reference', `<code style="font-family: monospace; color: ${brand_1.SENA_BRAND.colors.deepClay};">${escapeHtml(params.folioNumber)}</code>`)}
        ${(0, elements_1.renderDetailRow)('Reservation Ref', escapeHtml(params.reference))}
        ${(0, elements_1.renderDetailRow)('Stay Period', `${escapeHtml(params.checkInDate)} – ${escapeHtml(params.checkOutDate)}`)}
        ${(0, elements_1.renderDetailRow)('Settlement Status', 'Settled in Full', true, true, brand_1.SENA_BRAND.colors.success)}
      </table>
    `, 'Folio Audit Context')}
    ${params.downloadUrl
        ? (0, elements_1.renderButton)('Download Official PDF Statement', params.downloadUrl)
        : ''}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Final stay folio and receipt from ${params.propertyName}. Total: ${params.totalAmountFormatted}`,
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
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
