import { SENA_BRAND } from '../components/brand';
import {
  renderSenaEmailLayout,
  htmlToPlainText,
} from '../components/layout';
import {
  renderHeading,
  renderParagraph,
  renderButton,
  renderReservationSummary,
  renderCommissionZeroBadge,
  renderAlertCallout,
  renderCard,
  renderDetailRow,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 07. reservation.booking_confirmation (To Guest)
// ----------------------------------------------------------------------
export interface BookingConfirmationParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  roomType: string;
  roomNumber?: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmountFormatted: string;
  checkInTime?: string;
  checkOutTime?: string;
  specialRequests?: string;
  manageBookingUrl?: string;
}

export function renderBookingConfirmationEmail(
  params: BookingConfirmationParams
): EmailRenderResult {
  const subject = `Confirmed: Your stay at ${params.propertyName} (${params.reference})`;
  const checkInNote = params.checkInTime ? ` from ${params.checkInTime}` : ' from 2:00 PM';
  const checkOutNote = params.checkOutTime ? ` by ${params.checkOutTime}` : ' by 11:00 AM';

  const content = `
    ${renderHeading(
      'Your Reservation is Confirmed',
      `We look forward to welcoming you to ${escapeHtml(params.propertyName)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `Your reservation has been confirmed. Below are your stay details, check-in instructions, and booking reference.`
    )}
    ${renderReservationSummary({
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
    ${
      params.specialRequests
        ? renderCard(
            `<p style="margin: 0; font-size: 14px; color: ${SENA_BRAND.colors.ink};">${escapeHtml(params.specialRequests)}</p>`,
            'Special Requests'
          )
        : ''
    }
    <div style="background-color: #FAF7F2; border-radius: 6px; padding: 18px; margin: 24px 0; font-size: 13px; line-height: 1.6; color: ${SENA_BRAND.colors.inkMuted};">
      <strong style="color: ${SENA_BRAND.colors.deepClay};">Arrival & Check-in Information:</strong><br/>
      Please present a valid government-issued ID upon arrival at the front desk. Early check-in or late checkout is subject to availability upon request.
    </div>
    ${
      params.manageBookingUrl
        ? renderButton('Manage Reservation', params.manageBookingUrl)
        : ''
    }
    ${renderParagraph(
      `Need to update your itinerary or arrange airport transfer? Simply reply directly to this email or call our front desk at ${escapeHtml(params.propertyPhone || '+234 1 234 5678')}.`,
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
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

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 08. reservation.new_booking_hotel (To GM / Front Desk)
// ----------------------------------------------------------------------
export interface NewBookingHotelParams {
  propertyName: string;
  reference: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmountFormatted: string;
  paymentStatus: string;
  channel: 'direct_engine' | 'front_desk' | 'ota' | 'corporate';
  dashboardUrl?: string;
}

export function renderNewBookingHotelEmail(
  params: NewBookingHotelParams
): EmailRenderResult {
  const isDirect = params.channel === 'direct_engine';
  const subject = `New Booking: ${params.guestName} · ${params.roomType} (${params.reference})`;
  const manageUrl = params.dashboardUrl || `${SENA_BRAND.appUrl}/reservations`;

  const content = `
    ${renderHeading(
      'New Reservation Received',
      `${params.propertyName} · Ref: ${params.reference}`
    )}
    ${isDirect ? renderCommissionZeroBadge() : ''}
    ${renderReservationSummary({
      reference: params.reference,
      guestName: params.guestName,
      roomType: params.roomType,
      checkIn: params.checkInDate,
      checkOut: params.checkOutDate,
      nights: params.nights,
      totalAmountFormatted: params.totalAmountFormatted,
      statusBadge: params.paymentStatus,
    })}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Guest Name', escapeHtml(params.guestName))}
        ${renderDetailRow('Guest Email', `<a href="mailto:${escapeHtml(params.guestEmail)}" style="color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.guestEmail)}</a>`)}
        ${renderDetailRow('Guest Phone', escapeHtml(params.guestPhone))}
        ${renderDetailRow('Booking Source', isDirect ? 'Direct Booking Engine (0% Fee)' : escapeHtml(params.channel), true)}
      </table>
    `,
      'Guest Contact Details'
    )}
    ${renderButton('View Reservation in Sena Console', manageUrl)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `New reservation confirmed for ${params.guestName} (${params.roomType}) at ${params.propertyName}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 09. reservation.booking_modified (To Guest)
// ----------------------------------------------------------------------
export interface BookingModifiedParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmountFormatted: string;
  modificationsSummary: string;
  manageBookingUrl?: string;
}

export function renderBookingModifiedEmail(
  params: BookingModifiedParams
): EmailRenderResult {
  const subject = `Updated Reservation: ${params.reference} at ${params.propertyName}`;

  const content = `
    ${renderHeading(
      'Your Reservation Has Been Updated',
      `Changes have been applied to booking ${escapeHtml(params.reference)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `Your reservation at <strong>${escapeHtml(params.propertyName)}</strong> has been updated according to your recent request.`
    )}
    ${renderAlertCallout(`<strong>Summary of Changes:</strong><br/>${escapeHtml(params.modificationsSummary)}`, 'info')}
    ${renderReservationSummary({
      reference: params.reference,
      guestName: params.guestName,
      roomType: params.roomType,
      checkIn: params.checkInDate,
      checkOut: params.checkOutDate,
      nights: params.nights,
      totalAmountFormatted: params.totalAmountFormatted,
      statusBadge: 'Updated',
    })}
    ${
      params.manageBookingUrl
        ? renderButton('Review Your Stay', params.manageBookingUrl)
        : ''
    }
  `;

  const html = renderSenaEmailLayout(content, {
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

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 10. reservation.booking_cancelled (To Guest)
// ----------------------------------------------------------------------
export interface BookingCancelledParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  refundPolicyNotice?: string;
}

export function renderBookingCancelledEmail(
  params: BookingCancelledParams
): EmailRenderResult {
  const subject = `Cancellation Confirmed: Booking ${params.reference} at ${params.propertyName}`;

  const content = `
    ${renderHeading(
      'Reservation Cancelled',
      `Booking reference: ${escapeHtml(params.reference)}`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `As requested, your reservation for <strong>${escapeHtml(params.roomType)}</strong> at <strong>${escapeHtml(params.propertyName)}</strong> scheduled for ${escapeHtml(params.checkInDate)} to ${escapeHtml(params.checkOutDate)} has been cancelled.`
    )}
    ${
      params.refundPolicyNotice
        ? renderAlertCallout(
            `<strong>Refund & Policy Note:</strong><br/>${escapeHtml(params.refundPolicyNotice)}`,
            'info'
          )
        : ''
    }
    ${renderParagraph(
      'We hope to have the opportunity to welcome you in the future. If this cancellation was made in error, please contact the front desk immediately.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
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
