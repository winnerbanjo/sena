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
  renderAlertCallout,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 20. staff.invitation
// ----------------------------------------------------------------------
export interface StaffInvitationParams {
  invitedEmail: string;
  inviterName: string;
  propertyName: string;
  roleName: string;
  inviteUrl: string;
  expiresInDays?: number;
}

export function renderStaffInvitationEmail(
  params: StaffInvitationParams
): EmailRenderResult {
  const subject = `Invitation to join ${params.propertyName} on Sena`;
  const expiry = params.expiresInDays || 7;

  const content = `
    ${renderHeading(
      'Staff Team Invitation',
      `You've been invited to join the hospitality operations team.`
    )}
    ${renderParagraph(
      `<strong>${escapeHtml(params.inviterName)}</strong> has invited you to join the team at <strong>${escapeHtml(params.propertyName)}</strong> on the Sena Hospitality Operating System.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Property', escapeHtml(params.propertyName))}
        ${renderDetailRow('Assigned Role', escapeHtml(params.roleName))}
        ${renderDetailRow('Invited By', escapeHtml(params.inviterName))}
        ${renderDetailRow('Invitation Expiry', `Valid for ${expiry} days`, true)}
      </table>
    `,
      'Invitation Details',
      { text: params.roleName, variant: 'terracotta' }
    )}
    ${renderParagraph(
      'Click below to set your account password and access your department console.'
    )}
    ${renderButton('Accept Invitation & Join Team', params.inviteUrl)}
    ${renderParagraph(
      'If you were not expecting this invitation, you can disregard this email.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `${params.inviterName} invited you to join ${params.propertyName} on Sena.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 21. staff.invitation_accepted
// ----------------------------------------------------------------------
export interface StaffInvitationAcceptedParams {
  managerName: string;
  staffName: string;
  staffEmail: string;
  roleName: string;
  propertyName: string;
  dashboardStaffUrl?: string;
}

export function renderStaffInvitationAcceptedEmail(
  params: StaffInvitationAcceptedParams
): EmailRenderResult {
  const subject = `${params.staffName} accepted invitation to ${params.propertyName}`;
  const manageUrl = params.dashboardStaffUrl || `${SENA_BRAND.appUrl}/team`;

  const content = `
    ${renderHeading(
      'Staff Invitation Accepted',
      `New team member activated at ${escapeHtml(params.propertyName)}.`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.managerName)},`)}
    ${renderParagraph(
      `<strong>${escapeHtml(params.staffName)}</strong> (${escapeHtml(params.staffEmail)}) has accepted your invitation and activated their access as <strong>${escapeHtml(params.roleName)}</strong>.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Team Member', escapeHtml(params.staffName))}
        ${renderDetailRow('Email', escapeHtml(params.staffEmail))}
        ${renderDetailRow('Role', escapeHtml(params.roleName))}
        ${renderDetailRow('Property', escapeHtml(params.propertyName), true)}
      </table>
    `,
      'Team Member Profile',
      { text: 'Active Member', variant: 'success' }
    )}
    ${renderButton('Manage Team Permissions', manageUrl)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `${params.staffName} joined ${params.propertyName} as ${params.roleName}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 22. staff.access_removed
// ----------------------------------------------------------------------
export interface StaffAccessRemovedParams {
  staffName: string;
  propertyName: string;
  supportEmail?: string;
}

export function renderStaffAccessRemovedEmail(
  params: StaffAccessRemovedParams
): EmailRenderResult {
  const subject = `Sena access update for ${params.propertyName}`;

  const content = `
    ${renderHeading(
      'Access Deactivated',
      `Your access permissions have been updated.`
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.staffName)},`)}
    ${renderParagraph(
      `This message confirms that your access to <strong>${escapeHtml(params.propertyName)}</strong> on the Sena Operating System has been removed by property administration.`
    )}
    ${renderAlertCallout(
      'You will no longer be able to log in to this property console or view guest reservations. If you believe this is in error, please speak with your General Manager.',
      'info'
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Your access to ${params.propertyName} on Sena has been deactivated.`,
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
