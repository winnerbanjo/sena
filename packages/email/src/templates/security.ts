import { SENA_BRAND } from '../components/brand';
import {
  renderSenaEmailLayout,
  htmlToPlainText,
} from '../components/layout';
import {
  renderHeading,
  renderParagraph,
  renderButton,
  renderSecurityBox,
  renderAlertCallout,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 33. security.email_changed
// ----------------------------------------------------------------------
export interface SecurityEmailChangedParams {
  userName: string;
  oldEmail: string;
  newEmail: string;
  timestamp?: string;
  ipAddress?: string;
}

export function renderSecurityEmailChangedEmail(
  params: SecurityEmailChangedParams
): EmailRenderResult {
  const subject = 'Security Alert: Primary email address changed on your Sena account';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading(
      'Security Alert: Email Changed',
      'The primary email for your account was modified.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `The email address associated with your Sena administrator account was changed from <strong>${escapeHtml(params.oldEmail)}</strong> to <strong>${escapeHtml(params.newEmail)}</strong>.`
    )}
    ${renderSecurityBox({
      time,
      ip: params.ipAddress,
    })}
    ${renderAlertCallout(
      'If you authorized this change, no further action is needed. If you did <strong>not</strong> authorize this change, your account may be compromised. Please lock your account immediately and contact our security team.',
      'danger'
    )}
    ${renderButton('Lock Account & Contact Security', `mailto:${SENA_BRAND.supportEmail}?subject=URGENT:+Unauthorized+Email+Change`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'Security alert: The primary email address on your Sena account was changed.',
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 34. security.new_device_session
// ----------------------------------------------------------------------
export interface SecurityNewDeviceParams {
  userName: string;
  device: string;
  browser: string;
  ipAddress: string;
  approxLocation?: string;
  timestamp?: string;
}

export function renderSecurityNewDeviceEmail(
  params: SecurityNewDeviceParams
): EmailRenderResult {
  const subject = 'Security Alert: Sign-in from new device or browser';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading(
      'New Device Recognized',
      'A sign-in occurred from an unrecognized device or browser.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      'Your Sena account was just accessed from a browser or location we haven\'t seen before.'
    )}
    ${renderSecurityBox({
      time,
      device: `${params.device} · ${params.browser}`,
      location: params.approxLocation,
      ip: params.ipAddress,
    })}
    ${renderParagraph(
      'If this was you, you can safely disregard this message. If not, please terminate all sessions and change your password immediately.'
    )}
    ${renderButton('Review Active Sessions', `${SENA_BRAND.appUrl}/settings/security`, 'left', true)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `New device sign-in detected for ${params.userName}.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 35. security.suspicious_login
// ----------------------------------------------------------------------
export interface SecuritySuspiciousLoginParams {
  userName: string;
  ipAddress: string;
  attemptLocation?: string;
  device?: string;
  timestamp?: string;
}

export function renderSecuritySuspiciousLoginEmail(
  params: SecuritySuspiciousLoginParams
): EmailRenderResult {
  const subject = 'URGENT: Suspicious sign-in attempt blocked';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading(
      'Suspicious Activity Blocked',
      'We prevented an unauthorized sign-in attempt to your account.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderAlertCallout(
      'Our automated intrusion detection system blocked an anomalous sign-in attempt with an incorrect password from an unrecognized IP address.',
      'danger'
    )}
    ${renderSecurityBox({
      time,
      location: params.attemptLocation || 'Unknown Location',
      device: params.device || 'Unrecognized client',
      ip: params.ipAddress,
    })}
    ${renderParagraph(
      'Because multiple failed attempts were recorded, we strongly recommend resetting your password immediately and enabling Two-Factor Authentication (2FA).'
    )}
    ${renderButton('Reset Password & Enable 2FA', `${SENA_BRAND.appUrl}/settings/security`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'A suspicious login attempt to your Sena account was blocked.',
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 36. security.mfa_enabled
// ----------------------------------------------------------------------
export interface SecurityMfaEnabledParams {
  userName: string;
  timestamp?: string;
}

export function renderSecurityMfaEnabledEmail(
  params: SecurityMfaEnabledParams
): EmailRenderResult {
  const subject = 'Two-Factor Authentication (2FA) enabled on your Sena account';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading(
      'Two-Factor Authentication Enabled',
      'Your account security has been strengthened.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Two-factor authentication (TOTP authenticator app) was successfully enabled for your Sena account on <strong>${escapeHtml(time)}</strong>.`
    )}
    ${renderAlertCallout(
      'You will now be required to enter a 6-digit verification code from your authenticator app each time you sign in.',
      'info'
    )}
    ${renderParagraph(
      'Ensure you have safely stored your one-time emergency recovery codes in a secure location.'
    )}
    ${renderButton('View Security Settings', `${SENA_BRAND.appUrl}/settings/security`, 'left', true)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'Two-Factor Authentication is now active on your Sena account.',
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 37. security.mfa_disabled
// ----------------------------------------------------------------------
export interface SecurityMfaDisabledParams {
  userName: string;
  timestamp?: string;
  ipAddress?: string;
}

export function renderSecurityMfaDisabledEmail(
  params: SecurityMfaDisabledParams
): EmailRenderResult {
  const subject = 'Security Alert: Two-Factor Authentication (2FA) was disabled';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading(
      'Security Alert: 2FA Disabled',
      'Two-factor authentication has been removed from your account.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderAlertCallout(
      `Two-factor authentication on your account was disabled on <strong>${escapeHtml(time)}</strong>. Your account is now protected by password only.`,
      'warning'
    )}
    ${
      params.ipAddress
        ? renderSecurityBox({
            time,
            ip: params.ipAddress,
          })
        : ''
    }
    ${renderParagraph(
      'If you did not perform this action, please change your password immediately and contact Sena Support.'
    )}
    ${renderButton('Re-enable Two-Factor Authentication', `${SENA_BRAND.appUrl}/settings/security`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'Security alert: Two-Factor Authentication was deactivated on your Sena account.',
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
