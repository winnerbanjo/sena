"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSecurityEmailChangedEmail = renderSecurityEmailChangedEmail;
exports.renderSecurityNewDeviceEmail = renderSecurityNewDeviceEmail;
exports.renderSecuritySuspiciousLoginEmail = renderSecuritySuspiciousLoginEmail;
exports.renderSecurityMfaEnabledEmail = renderSecurityMfaEnabledEmail;
exports.renderSecurityMfaDisabledEmail = renderSecurityMfaDisabledEmail;
const brand_1 = require("../components/brand");
const layout_1 = require("../components/layout");
const elements_1 = require("../components/elements");
function renderSecurityEmailChangedEmail(params) {
    const subject = 'Security Alert: Primary email address changed on your Sena account';
    const time = params.timestamp || new Date().toUTCString();
    const content = `
    ${(0, elements_1.renderHeading)('Security Alert: Email Changed', 'The primary email for your account was modified.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`The email address associated with your Sena administrator account was changed from <strong>${escapeHtml(params.oldEmail)}</strong> to <strong>${escapeHtml(params.newEmail)}</strong>.`)}
    ${(0, elements_1.renderSecurityBox)({
        time,
        ip: params.ipAddress,
    })}
    ${(0, elements_1.renderAlertCallout)('If you authorized this change, no further action is needed. If you did <strong>not</strong> authorize this change, your account may be compromised. Please lock your account immediately and contact our security team.', 'danger')}
    ${(0, elements_1.renderButton)('Lock Account & Contact Security', `mailto:${brand_1.SENA_BRAND.supportEmail}?subject=URGENT:+Unauthorized+Email+Change`)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: 'Security alert: The primary email address on your Sena account was changed.',
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSecurityNewDeviceEmail(params) {
    const subject = 'Security Alert: Sign-in from new device or browser';
    const time = params.timestamp || new Date().toUTCString();
    const content = `
    ${(0, elements_1.renderHeading)('New Device Recognized', 'A sign-in occurred from an unrecognized device or browser.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)('Your Sena account was just accessed from a browser or location we haven\'t seen before.')}
    ${(0, elements_1.renderSecurityBox)({
        time,
        device: `${params.device} · ${params.browser}`,
        location: params.approxLocation,
        ip: params.ipAddress,
    })}
    ${(0, elements_1.renderParagraph)('If this was you, you can safely disregard this message. If not, please terminate all sessions and change your password immediately.')}
    ${(0, elements_1.renderButton)('Review Active Sessions', `${brand_1.SENA_BRAND.appUrl}/settings/security`, 'left', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: `New device sign-in detected for ${params.userName}.`,
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSecuritySuspiciousLoginEmail(params) {
    const subject = 'URGENT: Suspicious sign-in attempt blocked';
    const time = params.timestamp || new Date().toUTCString();
    const content = `
    ${(0, elements_1.renderHeading)('Suspicious Activity Blocked', 'We prevented an unauthorized sign-in attempt to your account.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderAlertCallout)('Our automated intrusion detection system blocked an anomalous sign-in attempt with an incorrect password from an unrecognized IP address.', 'danger')}
    ${(0, elements_1.renderSecurityBox)({
        time,
        location: params.attemptLocation || 'Unknown Location',
        device: params.device || 'Unrecognized client',
        ip: params.ipAddress,
    })}
    ${(0, elements_1.renderParagraph)('Because multiple failed attempts were recorded, we strongly recommend resetting your password immediately and enabling Two-Factor Authentication (2FA).')}
    ${(0, elements_1.renderButton)('Reset Password & Enable 2FA', `${brand_1.SENA_BRAND.appUrl}/settings/security`)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: 'A suspicious login attempt to your Sena account was blocked.',
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSecurityMfaEnabledEmail(params) {
    const subject = 'Two-Factor Authentication (2FA) enabled on your Sena account';
    const time = params.timestamp || new Date().toUTCString();
    const content = `
    ${(0, elements_1.renderHeading)('Two-Factor Authentication Enabled', 'Your account security has been strengthened.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderParagraph)(`Two-factor authentication (TOTP authenticator app) was successfully enabled for your Sena account on <strong>${escapeHtml(time)}</strong>.`)}
    ${(0, elements_1.renderAlertCallout)('You will now be required to enter a 6-digit verification code from your authenticator app each time you sign in.', 'info')}
    ${(0, elements_1.renderParagraph)('Ensure you have safely stored your one-time emergency recovery codes in a secure location.')}
    ${(0, elements_1.renderButton)('View Security Settings', `${brand_1.SENA_BRAND.appUrl}/settings/security`, 'left', true)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: 'Two-Factor Authentication is now active on your Sena account.',
        headerType: 'platform',
        footerType: 'platform',
    });
    return { subject, html, text: (0, layout_1.htmlToPlainText)(html) };
}
function renderSecurityMfaDisabledEmail(params) {
    const subject = 'Security Alert: Two-Factor Authentication (2FA) was disabled';
    const time = params.timestamp || new Date().toUTCString();
    const content = `
    ${(0, elements_1.renderHeading)('Security Alert: 2FA Disabled', 'Two-factor authentication has been removed from your account.')}
    ${(0, elements_1.renderParagraph)(`Hello ${escapeHtml(params.userName)},`)}
    ${(0, elements_1.renderAlertCallout)(`Two-factor authentication on your account was disabled on <strong>${escapeHtml(time)}</strong>. Your account is now protected by password only.`, 'warning')}
    ${params.ipAddress
        ? (0, elements_1.renderSecurityBox)({
            time,
            ip: params.ipAddress,
        })
        : ''}
    ${(0, elements_1.renderParagraph)('If you did not perform this action, please change your password immediately and contact Sena Support.')}
    ${(0, elements_1.renderButton)('Re-enable Two-Factor Authentication', `${brand_1.SENA_BRAND.appUrl}/settings/security`)}
  `;
    const html = (0, layout_1.renderSenaEmailLayout)(content, {
        title: subject,
        previewText: 'Security alert: Two-Factor Authentication was deactivated on your Sena account.',
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
