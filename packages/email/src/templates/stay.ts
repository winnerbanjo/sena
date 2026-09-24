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
  renderAmountSummary,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 16. stay.upcoming_stay
// ----------------------------------------------------------------------
export interface UpcomingStayParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  roomType: string;
  checkInDate: string;
  checkInTime?: string;
  directionsOrTips?: string;
  manageBookingUrl?: string;
}

export function renderUpcomingStayEmail(params: UpcomingStayParams): EmailRenderResult {
  const subject = `Looking Forward to Welcoming You · ${params.propertyName}`;
  const checkInTime = params.checkInTime || '2:00 PM';

  const content = `
    ${renderHeading(
      'Your Stay Begins Soon',
      `We are preparing for your arrival at ${escapeHtml(params.propertyName)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `Your check-in date is approaching on <strong>${escapeHtml(params.checkInDate)}</strong> (from ${escapeHtml(checkInTime)}). Our team is dedicated to making your visit seamless and memorable.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Booking Reference', escapeHtml(params.reference))}
        ${renderDetailRow('Room Category', escapeHtml(params.roomType))}
        ${renderDetailRow('Check-in Date', escapeHtml(params.checkInDate))}
        ${renderDetailRow('Check-in Time', `From ${escapeHtml(checkInTime)}`)}
        ${params.propertyAddress ? renderDetailRow('Location', escapeHtml(params.propertyAddress), true) : ''}
      </table>
    `,
      'Upcoming Stay Overview',
      { text: 'Arrival Ready', variant: 'terracotta' }
    )}
    ${
      params.directionsOrTips
        ? renderCard(
            `<p style="margin: 0; font-size: 14px; line-height: 1.6; color: ${SENA_BRAND.colors.ink};">${escapeHtml(params.directionsOrTips)}</p>`,
            'Directions & Arrival Advice'
          )
        : ''
    }
    ${
      params.manageBookingUrl
        ? renderButton('View Reservation Details', params.manageBookingUrl)
        : ''
    }
    ${renderParagraph(
      `If you have estimated arrival times or special dietary requirements, reply directly to this email or reach us at ${escapeHtml(params.propertyPhone || '+234 1 234 5678')}.`,
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
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

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 17. stay.checkin_confirmation
// ----------------------------------------------------------------------
export interface CheckinConfirmationParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  roomNumber: string;
  roomType: string;
  wifiNetwork?: string;
  wifiPassword?: string;
  breakfastTimes?: string;
  checkoutDate: string;
  checkoutTime?: string;
}

export function renderCheckinConfirmationEmail(
  params: CheckinConfirmationParams
): EmailRenderResult {
  const subject = `Welcome to Room ${params.roomNumber} · ${params.propertyName}`;
  const checkoutTime = params.checkoutTime || '11:00 AM';

  const content = `
    ${renderHeading(
      `Welcome to ${params.propertyName}`,
      `You are checked in to Room ${escapeHtml(params.roomNumber)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `It is our pleasure to welcome you. Below are your essential in-house details for a comfortable stay.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Room Assigned', `<strong style="font-size: 16px; color: ${SENA_BRAND.colors.deepClay};">Room ${escapeHtml(params.roomNumber)}</strong>`)}
        ${renderDetailRow('Room Category', escapeHtml(params.roomType))}
        ${renderDetailRow('Check-out Date', escapeHtml(params.checkoutDate))}
        ${renderDetailRow('Check-out Time', `By ${escapeHtml(checkoutTime)}`, true)}
      </table>
    `,
      'In-House Stay Details',
      { text: 'Checked In', variant: 'success' }
    )}
    ${
      params.wifiNetwork
        ? renderCard(
            `
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            ${renderDetailRow('Network SSID', `<strong style="font-family: monospace;">${escapeHtml(params.wifiNetwork)}</strong>`)}
            ${params.wifiPassword ? renderDetailRow('Password', `<code style="font-family: monospace; font-size: 14px; color: ${SENA_BRAND.colors.terracotta}; font-weight: bold;">${escapeHtml(params.wifiPassword)}</code>`, true) : ''}
          </table>
        `,
            'High-Speed Guest Wi-Fi'
          )
        : ''
    }
    ${
      params.breakfastTimes
        ? `<div style="background-color: #FAF7F2; border-radius: 6px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: ${SENA_BRAND.colors.inkMuted};">
            <strong style="color: ${SENA_BRAND.colors.deepClay};">Breakfast Service:</strong> ${escapeHtml(params.breakfastTimes)}
          </div>`
        : ''
    }
    ${renderParagraph(
      `To request room service, housekeeping, or assistance, dial the front desk from your room phone or call ${escapeHtml(params.propertyPhone || 'reception')}.`,
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
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

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 18. stay.checkout_thank_you
// ----------------------------------------------------------------------
export interface CheckoutThankYouParams {
  guestName: string;
  reference: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  reviewUrl?: string;
  bookAgainUrl?: string;
}

export function renderCheckoutThankYouEmail(
  params: CheckoutThankYouParams
): EmailRenderResult {
  const subject = `Thank You for Staying With Us · ${params.propertyName}`;

  const content = `
    ${renderHeading(
      'Thank You for Your Stay',
      `We hope you enjoyed your time at ${escapeHtml(params.propertyName)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `Thank you for choosing <strong>${escapeHtml(params.propertyName)}</strong>. Our entire team appreciated having you as our guest, and we hope your stay was restful and seamless.`
    )}
    ${renderParagraph(
      'Your feedback is invaluable in helping us maintain our hospitality standards. We would appreciate two minutes of your time to share your experience.'
    )}
    ${
      params.reviewUrl
        ? renderButton('Share Your Feedback', params.reviewUrl)
        : ''
    }
    ${renderParagraph(
      'We look forward to welcoming you back on your next visit.',
      true
    )}
    ${
      params.bookAgainUrl
        ? renderButton('Book Your Next Stay (Zero Booking Fees)', params.bookAgainUrl, 'left', true)
        : ''
    }
  `;

  const html = renderSenaEmailLayout(content, {
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

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 19. stay.stay_receipt (Final In-House Stay Folio)
// ----------------------------------------------------------------------
export interface StayReceiptParams {
  guestName: string;
  reference: string;
  folioNumber: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyLogoUrl?: string;
  checkInDate: string;
  checkOutDate: string;
  folioItems: Array<{ label: string; amount: string }>;
  totalAmountFormatted: string;
  downloadUrl?: string;
}

export function renderStayReceiptEmail(params: StayReceiptParams): EmailRenderResult {
  const subject = `Final Folio & Receipt: ${params.folioNumber} · ${params.propertyName}`;

  const content = `
    ${renderHeading(
      'Official Folio & Statement',
      `Complete stay account for booking ${escapeHtml(params.reference)}.`
    )}
    ${renderParagraph(`Dear ${escapeHtml(params.guestName)},`)}
    ${renderParagraph(
      `Please find below your final itemized folio from your stay at <strong>${escapeHtml(params.propertyName)}</strong>.`
    )}
    ${renderAmountSummary({
      lines: params.folioItems,
      total: params.totalAmountFormatted,
      isPaid: true,
    })}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Folio Reference', `<code style="font-family: monospace; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.folioNumber)}</code>`)}
        ${renderDetailRow('Reservation Ref', escapeHtml(params.reference))}
        ${renderDetailRow('Stay Period', `${escapeHtml(params.checkInDate)} – ${escapeHtml(params.checkOutDate)}`)}
        ${renderDetailRow('Settlement Status', 'Settled in Full', true, true, SENA_BRAND.colors.success)}
      </table>
    `,
      'Folio Audit Context'
    )}
    ${
      params.downloadUrl
        ? renderButton('Download Official PDF Statement', params.downloadUrl)
        : ''
    }
  `;

  const html = renderSenaEmailLayout(content, {
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
