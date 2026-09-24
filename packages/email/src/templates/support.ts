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
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 38. support.request_received
// ----------------------------------------------------------------------
export interface SupportRequestReceivedParams {
  userName: string;
  ticketId: string;
  subject: string;
  messageSnippet: string;
}

export function renderSupportRequestReceivedEmail(
  params: SupportRequestReceivedParams
): EmailRenderResult {
  const emailSubject = `[Ticket #${params.ticketId}] We received your inquiry: ${params.subject}`;

  const content = `
    ${renderHeading(
      'Support Request Received',
      `Case Reference: #${escapeHtml(params.ticketId)}`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      'Thank you for reaching out to Sena Hospitality Concierge Support. Our team has received your ticket and is reviewing the details.'
    )}
    ${renderCard(
      `
      <div style="font-size: 13px; font-weight: 600; color: ${SENA_BRAND.colors.deepClay}; margin-bottom: 8px;">
        ${escapeHtml(params.subject)}
      </div>
      <div style="font-size: 14px; line-height: 1.6; color: ${SENA_BRAND.colors.ink}; background-color: #FFFFFF; border: 1px solid #ECE7DE; border-radius: 6px; padding: 12px;">
        ${escapeHtml(params.messageSnippet)}
      </div>
      <div style="margin-top: 12px; font-size: 12px; color: ${SENA_BRAND.colors.inkMuted};">
        Standard response time: Within 2 business hours (Priority accounts within 30 minutes).
      </div>
    `,
      'Inquiry Summary',
      { text: `Ticket #${params.ticketId}`, variant: 'terracotta' }
    )}
    ${renderParagraph(
      'You can reply directly to this email to add more context, screenshots, or logs to this case.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: emailSubject,
    previewText: `Ticket #${params.ticketId} received: ${params.subject}`,
    headerType: 'platform',
    footerType: 'platform',
    showSupportLink: false,
  });

  return { subject: emailSubject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 39. support.staff_reply
// ----------------------------------------------------------------------
export interface SupportStaffReplyParams {
  userName: string;
  agentName: string;
  ticketId: string;
  subject: string;
  replyContentHtml: string;
}

export function renderSupportStaffReplyEmail(
  params: SupportStaffReplyParams
): EmailRenderResult {
  const emailSubject = `Re: [Ticket #${params.ticketId}] ${params.subject}`;

  const content = `
    ${renderHeading(
      `Update on Case #${params.ticketId}`,
      `Response from ${escapeHtml(params.agentName)} · Sena Concierge Support`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    <div style="background-color: #FAF7F2; border-left: 3px solid ${SENA_BRAND.colors.terracotta}; padding: 18px; margin: 20px 0; border-radius: 0 6px 6px 0; font-size: 14px; line-height: 1.6; color: ${SENA_BRAND.colors.ink};">
      ${params.replyContentHtml}
    </div>
    ${renderParagraph(
      'Simply reply directly to this email if you have follow-up questions or need additional assistance.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: emailSubject,
    previewText: `Response from ${params.agentName} regarding Ticket #${params.ticketId}.`,
    headerType: 'platform',
    footerType: 'platform',
    showSupportLink: false,
  });

  return { subject: emailSubject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 40. support.ticket_resolved
// ----------------------------------------------------------------------
export interface SupportTicketResolvedParams {
  userName: string;
  ticketId: string;
  subject: string;
  satisfactionSurveyUrl?: string;
}

export function renderSupportTicketResolvedEmail(
  params: SupportTicketResolvedParams
): EmailRenderResult {
  const emailSubject = `[Resolved] Ticket #${params.ticketId}: ${params.subject}`;

  const content = `
    ${renderHeading(
      'Support Request Resolved',
      `Ticket #${escapeHtml(params.ticketId)} has been closed.`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Your support inquiry regarding <strong>"${escapeHtml(params.subject)}"</strong> has been marked as resolved by our technical team.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Case Number', `#${escapeHtml(params.ticketId)}`)}
        ${renderDetailRow('Subject', escapeHtml(params.subject))}
        ${renderDetailRow('Status', 'Closed / Resolved', true, true, SENA_BRAND.colors.success)}
      </table>
    `,
      'Case Resolution Details',
      { text: 'Resolved', variant: 'success' }
    )}
    ${
      params.satisfactionSurveyUrl
        ? `
        ${renderParagraph('How did we do? We would appreciate your quick feedback on your support experience.')}
        ${renderButton('Rate Support Experience', params.satisfactionSurveyUrl, 'left', true)}
      `
        : ''
    }
    ${renderParagraph(
      'If your issue was not resolved or you need further help, simply reply to this email to instantly reopen this case.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: emailSubject,
    previewText: `Ticket #${params.ticketId} has been resolved.`,
    headerType: 'platform',
    footerType: 'platform',
    showSupportLink: false,
  });

  return { subject: emailSubject, html, text: htmlToPlainText(html) };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
