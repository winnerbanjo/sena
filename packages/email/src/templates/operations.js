"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDailyBriefEmail = renderDailyBriefEmail;
exports.renderEndOfDaySummaryEmail = renderEndOfDaySummaryEmail;
exports.renderDirectBookingAlertEmail = renderDirectBookingAlertEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderDailyBriefEmail(params) {
    const subject = `Morning Brief: ${params.dateFormatted} · ${params.propertyName} (${params.occupancyPercentage}% Occupancy)`;
    const dashUrl = params.dashboardUrl || `${brand_1.SENA_BRAND.appUrl}/dashboard`;
    const content = `
    ${(0, elements_1.renderHeading)('Morning Property Brief', `${params.propertyName} · ${params.dateFormatted}`)}
    ${(0, elements_1.renderParagraph)(`Good morning ${escapeHtml(params.recipientName)},`)}
    ${(0, elements_1.renderParagraph)(`Here is your daily operational forecast and guest movement summary for today.`)}
    <div style="display: table; width: 100%; margin: 20px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td width="32%" style="background-color: #FAF7F2; border: 1px solid #ECE7DE; border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight};">Occupancy</div>
            <div style="font-size: 24px; font-weight: 700; color: ${brand_1.SENA_BRAND.colors.deepClay}; margin-top: 4px;">${params.occupancyPercentage}%</div>
          </td>
          <td width="2%"></td>
          <td width="32%" style="background-color: #FAF7F2; border: 1px solid #ECE7DE; border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight};">Arrivals</div>
            <div style="font-size: 24px; font-weight: 700; color: ${brand_1.SENA_BRAND.colors.terracotta}; margin-top: 4px;">${params.arrivalsCount}</div>
          </td>
          <td width="2%"></td>
          <td width="32%" style="background-color: #FAF7F2; border: 1px solid #ECE7DE; border-radius: 8px; padding: 14px; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; color: ${brand_1.SENA_BRAND.colors.inkLight};">Departures</div>
            <div style="font-size: 24px; font-weight: 700; color: ${brand_1.SENA_BRAND.colors.ink}; margin-top: 4px;">${params.departuresCount}</div>
          </td>
        </tr>
      </table>
    </div>
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Currently In-House', `${params.inHouseGuestsCount} Guests`)}
        ${(0, elements_1.renderDetailRow)('Rooms Awaiting Housekeeping', `${params.dirtyRoomsCount} Rooms`)}
        ${(0, elements_1.renderDetailRow)('Expected Daily Revenue', `<strong style="color: ${brand_1.SENA_BRAND.colors.terracotta};">${escapeHtml(params.revenueExpectedTodayFormatted)}</strong>`, true)}
      </table>
    `, 'Operations & Housekeeping')}
    ${params.vipArrivals && params.vipArrivals.length > 0
        ? (0, elements_1.renderCard)(`
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: ${brand_1.SENA_BRAND.colors.ink};">
            ${params.vipArrivals.map((vip) => `<li style="margin-bottom: 6px;">${escapeHtml(vip)}</li>`).join('')}
          </ul>
        `, 'VIP / Return Guest Arrivals', { text: 'VIP Attention', variant: 'terracotta' })
        : ''}
    ${(0, elements_1.renderButton)('Open Daily Front Desk Roster', dashUrl)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Daily operational brief for ${params.propertyName}: ${params.occupancyPercentage}% occupancy, ${params.arrivalsCount} arrivals.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderEndOfDaySummaryEmail(params) {
    const subject = `Night Audit Summary: ${params.auditDateFormatted} · ${params.propertyName}`;
    const reportsUrl = params.dashboardReportsUrl || `${brand_1.SENA_BRAND.appUrl}/analytics`;
    const content = `
    ${(0, elements_1.renderHeading)('Night Audit & Daily Yield Summary', `${params.propertyName} · Audited for ${params.auditDateFormatted}`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.recipientName)},`)}
    ${(0, elements_1.renderParagraph)(`The automated night audit for <strong>${escapeHtml(params.propertyName)}</strong> has completed successfully. Below is your financial performance and room yield metrics for ${escapeHtml(params.auditDateFormatted)}.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Total Revenue Realized', `<strong style="font-size: 16px; color: ${brand_1.SENA_BRAND.colors.terracotta};">${escapeHtml(params.totalDailyRevenueFormatted)}</strong>`, false, true)}
        ${(0, elements_1.renderDetailRow)('Rooms Occupied', `${params.totalRoomsSold} Rooms (${params.occupancyPercentage}%)`)}
        ${(0, elements_1.renderDetailRow)('Average Daily Rate (ADR)', escapeHtml(params.adrFormatted))}
        ${(0, elements_1.renderDetailRow)('RevPAR', escapeHtml(params.revParFormatted))}
        ${(0, elements_1.renderDetailRow)('Direct Booking Share', `${params.directBookingSharePercentage}%`)}
        ${(0, elements_1.renderDetailRow)('Sena Commission Saved', `<strong style="color: ${brand_1.SENA_BRAND.colors.success};">${escapeHtml(params.commissionSavedFormatted)} (₦0 OTA fees)</strong>`, true, true)}
      </table>
    `, 'Audited Key Performance Indicators')}
    ${(0, elements_1.renderButton)('View Audited Financials & Ledger', reportsUrl)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Night audit complete for ${params.propertyName}: ${params.totalDailyRevenueFormatted} revenue, ADR ${params.adrFormatted}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderDirectBookingAlertEmail(params) {
    const subject = `Direct Booking: ${params.guestName} · ${params.roomType} (${params.reference}) · ₦0 Commission`;
    const url = params.bookingUrl || `${brand_1.SENA_BRAND.appUrl}/reservations`;
    const content = `
    ${(0, elements_1.renderHeading)('New Direct Reservation', `${params.propertyName} · 100% Direct Revenue Kept`)}
    ${(0, elements_1.renderCommissionZeroBadge)()}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.recipientName)},`)}
    ${(0, elements_1.renderParagraph)(`A new direct reservation was booked through your Sena booking engine. Because this booking came directly through your website, you pay <strong>₦0 commission</strong>.`)}
    ${(0, elements_1.renderReservationSummary)({
        reference: params.reference,
        guestName: params.guestName,
        roomType: params.roomType,
        checkIn: params.checkInDate,
        checkOut: params.checkOutDate,
        nights: params.nights,
        totalAmountFormatted: params.totalAmountFormatted,
        statusBadge: 'Direct Booking',
    })}
    ${(0, elements_1.renderButton)('View in Sena Dashboard', url)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Direct booking received for ${params.guestName}. Sena commission: ₦0.`,
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
