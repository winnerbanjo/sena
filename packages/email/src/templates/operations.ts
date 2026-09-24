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
  renderCommissionZeroBadge,
  renderReservationSummary,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 23. operations.daily_brief
// ----------------------------------------------------------------------
export interface DailyBriefParams {
  recipientName: string;
  propertyName: string;
  dateFormatted: string;
  arrivalsCount: number;
  departuresCount: number;
  inHouseGuestsCount: number;
  occupancyPercentage: number;
  dirtyRoomsCount: number;
  revenueExpectedTodayFormatted: string;
  vipArrivals?: string[];
  dashboardUrl?: string;
}

export function renderDailyBriefEmail(params: DailyBriefParams): EmailRenderResult {
  const subject = `Morning Brief: ${params.dateFormatted} · ${params.propertyName} (${params.occupancyPercentage}% Occupancy)`;
  const dashUrl = params.dashboardUrl || `${SENA_BRAND.appUrl}/dashboard`;

  const content = `
    ${renderHeading(
      'Morning Property Brief',
      `${params.propertyName} · ${params.dateFormatted}`
    )}
    ${renderParagraph(`Good morning ${escapeHtml(params.recipientName)},`)}
    ${renderParagraph(
      `Here is your daily operational forecast and guest movement summary for today.`
    )}
    <div style="display: table; width: 100%; margin: 20px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td width="32%" style="background-color: #FAF7F2; border: 1px solid #ECE7DE; border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight};">Occupancy</div>
            <div style="font-size: 24px; font-weight: 700; color: ${SENA_BRAND.colors.deepClay}; margin-top: 4px;">${params.occupancyPercentage}%</div>
          </td>
          <td width="2%"></td>
          <td width="32%" style="background-color: #FAF7F2; border: 1px solid #ECE7DE; border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight};">Arrivals</div>
            <div style="font-size: 24px; font-weight: 700; color: ${SENA_BRAND.colors.terracotta}; margin-top: 4px;">${params.arrivalsCount}</div>
          </td>
          <td width="2%"></td>
          <td width="32%" style="background-color: #FAF7F2; border: 1px solid #ECE7DE; border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: ${SENA_BRAND.colors.inkLight};">Departures</div>
            <div style="font-size: 24px; font-weight: 700; color: ${SENA_BRAND.colors.ink}; margin-top: 4px;">${params.departuresCount}</div>
          </td>
        </tr>
      </table>
    </div>
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Currently In-House', `${params.inHouseGuestsCount} Guests`)}
        ${renderDetailRow('Rooms Awaiting Housekeeping', `${params.dirtyRoomsCount} Rooms`)}
        ${renderDetailRow('Expected Daily Revenue', `<strong style="color: ${SENA_BRAND.colors.terracotta};">${escapeHtml(params.revenueExpectedTodayFormatted)}</strong>`, true)}
      </table>
    `,
      'Operations & Housekeeping'
    )}
    ${
      params.vipArrivals && params.vipArrivals.length > 0
        ? renderCard(
            `
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: ${SENA_BRAND.colors.ink};">
            ${params.vipArrivals.map((vip) => `<li style="margin-bottom: 6px;">${escapeHtml(vip)}</li>`).join('')}
          </ul>
        `,
            'VIP / Return Guest Arrivals',
            { text: 'VIP Attention', variant: 'terracotta' }
          )
        : ''
    }
    ${renderButton('Open Daily Front Desk Roster', dashUrl)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Daily operational brief for ${params.propertyName}: ${params.occupancyPercentage}% occupancy, ${params.arrivalsCount} arrivals.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 24. operations.end_of_day_summary (Night Audit Summary)
// ----------------------------------------------------------------------
export interface EndOfDaySummaryParams {
  recipientName: string;
  propertyName: string;
  auditDateFormatted: string;
  totalRoomsSold: number;
  occupancyPercentage: number;
  adrFormatted: string;
  revParFormatted: string;
  totalDailyRevenueFormatted: string;
  directBookingSharePercentage: number;
  commissionSavedFormatted: string;
  dashboardReportsUrl?: string;
}

export function renderEndOfDaySummaryEmail(
  params: EndOfDaySummaryParams
): EmailRenderResult {
  const subject = `Night Audit Summary: ${params.auditDateFormatted} · ${params.propertyName}`;
  const reportsUrl = params.dashboardReportsUrl || `${SENA_BRAND.appUrl}/analytics`;

  const content = `
    ${renderHeading(
      'Night Audit & Daily Yield Summary',
      `${params.propertyName} · Audited for ${params.auditDateFormatted}`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.recipientName)},`)}
    ${renderParagraph(
      `The automated night audit for <strong>${escapeHtml(params.propertyName)}</strong> has completed successfully. Below is your financial performance and room yield metrics for ${escapeHtml(params.auditDateFormatted)}.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Total Revenue Realized', `<strong style="font-size: 16px; color: ${SENA_BRAND.colors.terracotta};">${escapeHtml(params.totalDailyRevenueFormatted)}</strong>`, false, true)}
        ${renderDetailRow('Rooms Occupied', `${params.totalRoomsSold} Rooms (${params.occupancyPercentage}%)`)}
        ${renderDetailRow('Average Daily Rate (ADR)', escapeHtml(params.adrFormatted))}
        ${renderDetailRow('RevPAR', escapeHtml(params.revParFormatted))}
        ${renderDetailRow('Direct Booking Share', `${params.directBookingSharePercentage}%`)}
        ${renderDetailRow('Sena Commission Saved', `<strong style="color: ${SENA_BRAND.colors.success};">${escapeHtml(params.commissionSavedFormatted)} (₦0 OTA fees)</strong>`, true, true)}
      </table>
    `,
      'Audited Key Performance Indicators'
    )}
    ${renderButton('View Audited Financials & Ledger', reportsUrl)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Night audit complete for ${params.propertyName}: ${params.totalDailyRevenueFormatted} revenue, ADR ${params.adrFormatted}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 25. operations.direct_booking_alert
// ----------------------------------------------------------------------
export interface DirectBookingAlertParams {
  recipientName: string;
  propertyName: string;
  reference: string;
  guestName: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmountFormatted: string;
  bookingUrl?: string;
}

export function renderDirectBookingAlertEmail(
  params: DirectBookingAlertParams
): EmailRenderResult {
  const subject = `Direct Booking: ${params.guestName} · ${params.roomType} (${params.reference}) · ₦0 Commission`;
  const url = params.bookingUrl || `${SENA_BRAND.appUrl}/reservations`;

  const content = `
    ${renderHeading(
      'New Direct Reservation',
      `${params.propertyName} · 100% Direct Revenue Kept`
    )}
    ${renderCommissionZeroBadge()}
    ${renderParagraph(`Hello ${escapeHtml(params.recipientName)},`)}
    ${renderParagraph(
      `A new direct reservation was booked through your Sena booking engine. Because this booking came directly through your website, you pay <strong>₦0 commission</strong>.`
    )}
    ${renderReservationSummary({
      reference: params.reference,
      guestName: params.guestName,
      roomType: params.roomType,
      checkIn: params.checkInDate,
      checkOut: params.checkOutDate,
      nights: params.nights,
      totalAmountFormatted: params.totalAmountFormatted,
      statusBadge: 'Direct Booking',
    })}
    ${renderButton('View in Sena Dashboard', url)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Direct booking received for ${params.guestName}. Sena commission: ₦0.`,
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
