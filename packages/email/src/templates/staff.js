"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStaffInvitationEmail = renderStaffInvitationEmail;
exports.renderStaffInvitationAcceptedEmail = renderStaffInvitationAcceptedEmail;
exports.renderStaffAccessRemovedEmail = renderStaffAccessRemovedEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderStaffInvitationEmail(params) {
    const subject = `Invitation to join ${params.propertyName} on Sena`;
    const expiry = params.expiresInDays || 7;
    const content = `
    ${(0, elements_1.renderHeading)('Staff Team Invitation', `You've been invited to join the hospitality operations team.`)}
    ${(0, elements_1.renderParagraph)(`<strong>${escapeHtml(params.inviterName)}</strong> has invited you to join the team at <strong>${escapeHtml(params.propertyName)}</strong> on the Sena Hospitality Operating System.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Property', escapeHtml(params.propertyName))}
        ${(0, elements_1.renderDetailRow)('Assigned Role', escapeHtml(params.roleName))}
        ${(0, elements_1.renderDetailRow)('Invited By', escapeHtml(params.inviterName))}
        ${(0, elements_1.renderDetailRow)('Invitation Expiry', `Valid for ${expiry} days`, true)}
      </table>
    `, 'Invitation Details', { text: params.roleName, variant: 'terracotta' })}
    ${(0, elements_1.renderParagraph)('Click below to set your account password and access your department console.')}
    ${(0, elements_1.renderButton)('Accept Invitation & Join Team', params.inviteUrl)}
    ${(0, elements_1.renderParagraph)('If you were not expecting this invitation, you can disregard this email.', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `${params.inviterName} invited you to join ${params.propertyName} on Sena.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderStaffInvitationAcceptedEmail(params) {
    const subject = `${params.staffName} accepted invitation to ${params.propertyName}`;
    const manageUrl = params.dashboardStaffUrl || `${brand_1.SENA_BRAND.appUrl}/team`;
    const content = `
    ${(0, elements_1.renderHeading)('Staff Invitation Accepted', `New team member activated at ${escapeHtml(params.propertyName)}.`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.managerName)},`)}
    ${(0, elements_1.renderParagraph)(`<strong>${escapeHtml(params.staffName)}</strong> (${escapeHtml(params.staffEmail)}) has accepted your invitation and activated their access as <strong>${escapeHtml(params.roleName)}</strong>.`)}
    ${(0, elements_1.renderCard)(`
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${(0, elements_1.renderDetailRow)('Team Member', escapeHtml(params.staffName))}
        ${(0, elements_1.renderDetailRow)('Email', escapeHtml(params.staffEmail))}
        ${(0, elements_1.renderDetailRow)('Role', escapeHtml(params.roleName))}
        ${(0, elements_1.renderDetailRow)('Property', escapeHtml(params.propertyName), true)}
      </table>
    `, 'Team Member Profile', { text: 'Active Member', variant: 'success' })}
    ${(0, elements_1.renderButton)('Manage Team Permissions', manageUrl)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `${params.staffName} joined ${params.propertyName} as ${params.roleName}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderStaffAccessRemovedEmail(params) {
    const subject = `Sena access update for ${params.propertyName}`;
    const content = `
    ${(0, elements_1.renderHeading)('Access Deactivated', `Your access permissions have been updated.`)}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.staffName)},`)}
    ${(0, elements_1.renderParagraph)(`This message confirms that your access to <strong>${escapeHtml(params.propertyName)}</strong> on the Sena Operating System has been removed by property administration.`)}
    ${(0, elements_1.renderAlertCallout)('You will no longer be able to log in to this property console or view guest reservations. If you believe this is in error, please speak with your General Manager.', 'info')}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `Your access to ${params.propertyName} on Sena has been deactivated.`,
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
