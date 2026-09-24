"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSupportRequestReceivedEmail = renderSupportRequestReceivedEmail;
exports.renderSupportStaffReplyEmail = renderSupportStaffReplyEmail;
exports.renderSupportTicketResolvedEmail = renderSupportTicketResolvedEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderSupportRequestReceivedEmail(params) {
    const emailSubject = `[Ticket #${params.ticketId}] We received your inquiry: ${params.subject}`;
    const content = `
    ${(0, elements_1.renderHeading)('Support Request Received', `Case Reference: #${escapeHtml(params.ticketId)}`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)('Thank you for reaching out to Sena Hospitality Concierge Support. Our team has received your ticket and is reviewing the details.')}
    ${(0, elements_1.renderCard)(`
      <div style="font-size: 13px; font-weight: 600; color: ${brand_1.SENA_BRAND.colors.deepClay}; margin-bottom: 8px;">
        ${escapeHtml(params.subject)}
      </div>
      <div style="font-size: 14px; line-height: 1.6; color: ${brand_1.SENA_BRAND.colors.ink}; background-color: #FFFFFF; border: 1px solid #ECE7DE; border-radius: 6px; padding: 12px;">
        ${escapeHtml(params.messageSnippet)}
      </div>
      <div style="margin-top: 12px; font-size: 12px; color: ${brand_1.SENA_BRAND.colors.inkMuted};">
        Standard response time: Within 2 business hours (Priority accounts within 30 minutes).
      </div>
    `, 'Inquiry Summary', { text: `Ticket #${params.ticketId}`, variant: 'terracotta' })}
    ${(0, elements_1.renderParagraph)('You can reply directly to this email to add more context, screenshots, or logs to this case.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: emailSubject,
        previewText: `Ticket #${params.ticketId} received: ${params.subject}`,
        headerType: 'platform',
        footerType: 'platform',
        showSupportLink: false,
    });
    return { subject: emailSubject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSupportStaffReplyEmail(params) {
    const emailSubject = `Re: [Ticket #${params.ticketId}] ${params.subject}`;
    const content = `
    ${(0, elements_1.renderHeading)(`Update on Case #${params.ticketId}`, `Response from ${escapeHtml(params.agentName)} · Sena Concierge Support`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    <div style="background-color: #FAF7F2; border-left: 3px solid ${brand_1.SENA_BRAND.colors.terracotta}; padding: 18px; margin: 20px 0; border-radius: 0 6px 6px 0; font-size: 14px; line-height: 1.6; color: ${brand_1.SENA_BRAND.colors.ink};">
      ${params.replyContentHtml}
    </div>
    ${(0, elements_1.renderParagraph)('Simply reply directly to this email if you have follow-up questions or need additional assistance.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: emailSubject,
        previewText: `Response from ${params.agentName} regarding Ticket #${params.ticketId}.`,
        headerType: 'platform',
        footerType: 'platform',
        showSupportLink: false,
    });
    return { subject: emailSubject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSupportTicketResolvedEmail(params) {
    const emailSubject = `[Resolved] Ticket #${params.ticketId}: ${params.subject}`;
    const content = `
    ${(0, elements_1.renderHeading)('Support Request Resolved', `Ticket #${escapeHtml(params.ticketId)} has been closed.`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`Your support inquiry regarding <strong>"${escapeHtml(params.subject)}"</strong> has been marked as resolved by our technical team.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Case Number', `#${escapeHtml(params.ticketId)}`)}
        ${(0, elements_1.renderDetailRow)('Subject', escapeHtml(params.subject))}
        ${(0, elements_1.renderDetailRow)('Status', 'Closed / Resolved', true, true, brand_1.SENA_BRAND.colors.success)}
      </table>
    `, 'Case Resolution Details', { text: 'Resolved', variant: 'success' })}
    ${params.satisfactionSurveyUrl
        ? `
        ${(0, elements_1.renderParagraph)('How did we do? We would appreciate your quick feedback on your support experience.')}
        ${(0, elements_1.renderButton)('Rate Support Experience', params.satisfactionSurveyUrl, 'left', true)}
      `
        : ''}
    ${(0, elements_1.renderParagraph)('If your issue was not resolved or you need further help, simply reply to this email to instantly reopen this case.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: emailSubject,
        previewText: `Ticket #${params.ticketId} has been resolved.`,
        headerType: 'platform',
        footerType: 'platform',
        showSupportLink: false,
    });
    return { subject: emailSubject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
