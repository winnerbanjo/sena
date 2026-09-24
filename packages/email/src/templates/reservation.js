"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderBookingConfirmationEmail = renderBookingConfirmationEmail;
exports.renderNewBookingHotelEmail = renderNewBookingHotelEmail;
exports.renderBookingModifiedEmail = renderBookingModifiedEmail;
exports.renderBookingCancelledEmail = renderBookingCancelledEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderBookingConfirmationEmail(params) {
    const subject = `Confirmed: Your stay at ${params.propertyName} (${params.reference})`;
    const checkInNote = params.checkInTime ? ` from ${params.checkInTime}` : ' from 2:00 PM';
    const checkOutNote = params.checkOutTime ? ` by ${params.checkOutTime}` : ' by 11:00 AM';
    const content = `
    ${(0, elements_1.renderHeading)('Your Reservation is Confirmed', `We look forward to welcoming you to ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`Your reservation has been confirmed. Below are your stay details, check-in instructions, and booking reference.`)}
    ${(0, elements_1.renderReservationSummary)({
        reference: params.reference,
        guestName: params.guestName,
        roomType: params.roomType,
        roomNumber: params.roomNumber,
        checkIn: `${params.checkInDate} (${checkInNote})`,
        checkOut: `${params.checkOutDate} (${checkOutNote})`,
        nights: params.nights,
        totalAmountFormatted: params.totalAmountFormatted,
        statusBadge: 'Confirmed',
    })}
    ${params.specialRequests
        ? (0, elements_1.renderCard)(`<p style="margin: 0; font-size: 14px; color: ${brand_1.SENA_BRAND.colors.ink};">${escapeHtml(params.specialRequests)}</p>`, 'Special Requests')
        : ''}
    <div style="background-color: #FAF7F2; border-radius: 6px; padding: 18px; margin: 24px 0; font-size: 13px; line-height: 1.6; color: ${brand_1.SENA_BRAND.colors.inkMuted};">
      <strong style="color: ${brand_1.SENA_BRAND.colors.deepClay};">Arrival & Check-in Information:</strong><br/>
      Please present a valid government-issued ID upon arrival at the front desk. Early check-in or late checkout is subject to availability upon request.
    </div>
    ${params.manageBookingUrl
        ? (0, elements_1.renderButton)('Manage Reservation', params.manageBookingUrl)
        : ''}
    ${(0, elements_1.renderParagraph)(`Need to update your itinerary or arrange airport transfer? Simply reply directly to this email or call our front desk at ${escapeHtml(params.propertyPhone || '+234 1 234 5678')}.`, true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your reservation at ${params.propertyName} is confirmed. Booking ref: ${params.reference}`,
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
function renderNewBookingHotelEmail(params) {
    const isDirect = params.channel === 'direct_engine';
    const subject = `New Booking: ${params.guestName} · ${params.roomType} (${params.reference})`;
    const manageUrl = params.dashboardUrl || `${brand_1.SENA_BRAND.appUrl}/reservations`;
    const content = `
    ${(0, elements_1.renderHeading)('New Reservation Received', `${params.propertyName} · Ref: ${params.reference}`)}
    ${isDirect ? (0, elements_1.renderCommissionZeroBadge)() : ''}
    ${(0, elements_1.renderReservationSummary)({
        reference: params.reference,
        guestName: params.guestName,
        roomType: params.roomType,
        checkIn: params.checkInDate,
        checkOut: params.checkOutDate,
        nights: params.nights,
        totalAmountFormatted: params.totalAmountFormatted,
        statusBadge: params.paymentStatus,
    })}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Guest Name', escapeHtml(params.guestName))}
        ${(0, elements_1.renderDetailRow)('Guest Email', `<a href="mailto:${escapeHtml(params.guestEmail)}" style="color: ${brand_1.SENA_BRAND.colors.deepClay};">${escapeHtml(params.guestEmail)}</a>`)}
        ${(0, elements_1.renderDetailRow)('Guest Phone', escapeHtml(params.guestPhone))}
        ${(0, elements_1.renderDetailRow)('Booking Source', isDirect ? 'Direct Booking Engine (0% Fee)' : escapeHtml(params.channel), true)}
      </table>
    `, 'Guest Contact Details')}
    ${(0, elements_1.renderButton)('View Reservation in Sena Console', manageUrl)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `New reservation confirmed for ${params.guestName} (${params.roomType}) at ${params.propertyName}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderBookingModifiedEmail(params) {
    const subject = `Updated Reservation: ${params.reference} at ${params.propertyName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Your Reservation Has Been Updated', `Changes have been applied to booking ${escapeHtml(params.reference)}.`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`Your reservation at <strong>${escapeHtml(params.propertyName)}</strong> has been updated according to your recent request.`)}
    ${(0, elements_1.renderAlertCallout)(`<strong>Summary of Changes:</strong><br/>${escapeHtml(params.modificationsSummary)}`, 'info')}
    ${(0, elements_1.renderReservationSummary)({
        reference: params.reference,
        guestName: params.guestName,
        roomType: params.roomType,
        checkIn: params.checkInDate,
        checkOut: params.checkOutDate,
        nights: params.nights,
        totalAmountFormatted: params.totalAmountFormatted,
        statusBadge: 'Updated',
    })}
    ${params.manageBookingUrl
        ? (0, elements_1.renderButton)('Review Your Stay', params.manageBookingUrl)
        : ''}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your reservation at ${params.propertyName} has been updated.`,
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
function renderBookingCancelledEmail(params) {
    const subject = `Cancellation Confirmed: Booking ${params.reference} at ${params.propertyName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Reservation Cancelled', `Booking reference: ${escapeHtml(params.reference)}`)}
    ${(0, elements_1.renderParagraph)(`Dear ${escapeHtml(params.guestName)},`)}
    ${(0, elements_1.renderParagraph)(`As requested, your reservation for <strong>${escapeHtml(params.roomType)}</strong> at <strong>${escapeHtml(params.propertyName)}</strong> scheduled for ${escapeHtml(params.checkInDate)} to ${escapeHtml(params.checkOutDate)} has been cancelled.`)}
    ${params.refundPolicyNotice
        ? (0, elements_1.renderAlertCallout)(`<strong>Refund & Policy Note:</strong><br/>${escapeHtml(params.refundPolicyNotice)}`, 'info')
        : ''}
    ${(0, elements_1.renderParagraph)('We hope to have the opportunity to welcome you in the future. If this cancellation was made in error, please contact the front desk immediately.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your reservation ${params.reference} at ${params.propertyName} has been cancelled.`,
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
