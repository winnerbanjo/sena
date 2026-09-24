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
  renderSecurityBox,
  renderAlertCallout,
} from '../components/elements';

export interface EmailRenderResult {
  subject: string;
  html: string;
  text: string;
}

// ----------------------------------------------------------------------
// 01. account.welcome
// ----------------------------------------------------------------------
export interface WelcomeEmailParams {
  userName: string;
  organizationName: string;
  propertyName?: string;
  setupUrl?: string;
}

export function renderWelcomeEmail(params: WelcomeEmailParams): EmailRenderResult {
  const setupUrl = params.setupUrl || `${SENA_BRAND.appUrl}/onboarding`;
  const subject = `Welcome to Sena · ${params.organizationName}`;

  const content = `
    ${renderHeading(
      `Welcome to Sena, ${params.userName}`,
      'Modern infrastructure for high-performing hospitality.'
    )}
    ${renderParagraph(
      `Your organization <strong>${escapeHtml(params.organizationName)}</strong> has been registered on Sena. You're ready to set up room categories, configure live rates, connect direct booking widgets, and streamline property operations.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Account Holder', escapeHtml(params.userName))}
        ${renderDetailRow('Organization', escapeHtml(params.organizationName))}
        ${params.propertyName ? renderDetailRow('Initial Property', escapeHtml(params.propertyName)) : ''}
        ${renderDetailRow('Direct Booking Fee', '0% (₦0 commission)', true, true, SENA_BRAND.colors.terracotta)}
      </table>
    `,
      'Account Overview'
    )}
    ${renderParagraph(
      'Complete your property profile in less than 5 minutes to generate your direct booking engine and start receiving reservations.'
    )}
    ${renderButton('Complete Property Setup', setupUrl)}
    ${renderParagraph(
      'If you have any questions or require concierge migration from your legacy PMS, reply directly to this email or reach our support team anytime.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Welcome to Sena. Let's get ${params.organizationName} set up and ready for direct bookings.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 02. account.verify_email
// ----------------------------------------------------------------------
export interface VerifyEmailParams {
  userName: string;
  verificationUrl?: string;
  otpCode?: string;
  expiresInMinutes?: number;
}

export function renderVerifyEmail(params: VerifyEmailParams): EmailRenderResult {
  const expiresIn = params.expiresInMinutes || 10;
  const subject = params.otpCode
    ? `${params.otpCode} is your Sena verification code`
    : 'Verify your email address for Sena';

  const otpBox = params.otpCode
    ? `
      <div style="background-color: #FAF7F2; border: 1px solid #E8E1D5; border-radius: 8px; padding: 28px 24px; text-align: center; margin: 24px 0;">
        <span style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; letter-spacing: 8px; font-weight: 700; color: #71382D; display: inline-block;">
          ${escapeHtml(params.otpCode)}
        </span>
        <div style="font-size: 11px; font-family: monospace; color: #8C8275; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px;">
          Valid for ${expiresIn} minutes · Single-use code
        </div>
      </div>
    `
    : '';

  const buttonSection = params.verificationUrl
    ? `
      ${renderButton('Verify Email Address', params.verificationUrl)}
      <div style="font-size: 12px; color: ${SENA_BRAND.colors.inkLight}; word-break: break-all; margin-top: 24px; padding-top: 16px; border-top: 1px solid #ECE7DE;">
        Or copy and paste this URL into your browser:<br/>
        <a href="${escapeHtml(params.verificationUrl)}" style="color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.verificationUrl)}</a>
      </div>
    `
    : '';

  const content = `
    ${renderHeading('Verify your email address', 'One final step to secure your Sena account.')}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      params.otpCode
        ? `Please enter the 6-digit security code below in your Sena setup screen to verify that this work email belongs to you:`
        : `Please click the button below to confirm that this email belongs to you. This verification link expires in <strong>${expiresIn} minutes</strong>.`
    )}
    ${otpBox}
    ${buttonSection}
    ${renderParagraph(
      'If you did not request this verification code, please ignore this email. Your account remains completely secure.',
      true
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: params.otpCode
      ? `Your Sena verification code is ${params.otpCode}. Valid for ${expiresIn} minutes.`
      : 'Verify your email address to activate your Sena account.',
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 03. account.property_setup_complete
// ----------------------------------------------------------------------
export interface PropertySetupCompleteParams {
  userName: string;
  propertyName: string;
  propertyCode: string;
  bookingUrl: string;
  roomCount: number;
}

export function renderPropertySetupCompleteEmail(
  params: PropertySetupCompleteParams
): EmailRenderResult {
  const subject = `${params.propertyName} is live on Sena`;

  const content = `
    ${renderHeading(
      `${params.propertyName} is Ready`,
      'Your property profile, inventory, and direct booking engine are configured.'
    )}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Congratulations! <strong>${escapeHtml(params.propertyName)}</strong> has been successfully configured on Sena. Your inventory is now mapped and your zero-commission direct booking engine is live.`
    )}
    ${renderCard(
      `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${renderDetailRow('Property Name', escapeHtml(params.propertyName))}
        ${renderDetailRow('Property Code', `<code style="font-family: monospace; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.propertyCode)}</code>`)}
        ${renderDetailRow('Configured Rooms', `${params.roomCount} Rooms`)}
        ${renderDetailRow('Direct Booking Engine', `<a href="${escapeHtml(params.bookingUrl)}" target="_blank" style="color: ${SENA_BRAND.colors.terracotta}; font-weight: 500;">View Public Engine</a>`, true)}
      </table>
    `,
      'Property Launch Summary',
      { text: 'Live & Accepting Guests', variant: 'success' }
    )}
    ${renderParagraph(
      'Share your direct booking link on your Instagram bio, Google Business Profile, and official website to capture direct reservations with zero commission fees.'
    )}
    ${renderButton('Open Property Dashboard', `${SENA_BRAND.appUrl}/dashboard`)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `${params.propertyName} is officially live on Sena. View your direct booking engine now.`,
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 04. account.sign_in_alert
// ----------------------------------------------------------------------
export interface SignInAlertParams {
  userName: string;
  userEmail: string;
  ipAddress?: string;
  device?: string;
  location?: string;
  timestamp?: string;
}

export function renderSignInAlertEmail(params: SignInAlertParams): EmailRenderResult {
  const subject = 'New sign-in to your Sena account';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading('New Sign-in Detected', 'We noticed a new sign-in to your Sena administrative account.')}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      'A new sign-in to your account was recorded with the following details:'
    )}
    ${renderSecurityBox({
      time,
      device: params.device,
      location: params.location,
      ip: params.ipAddress,
    })}
    ${renderParagraph(
      'If this was you, no action is needed. If you did not sign in at this time, please reset your password immediately to secure your property data.'
    )}
    ${renderButton('Secure Account / Change Password', `${SENA_BRAND.appUrl}/settings/security`, 'left', true)}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'A new sign-in to your Sena account was recorded.',
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 05. account.password_reset
// ----------------------------------------------------------------------
export interface PasswordResetParams {
  userName: string;
  resetUrl: string;
  expiresInMinutes?: number;
}

export function renderPasswordResetEmail(params: PasswordResetParams): EmailRenderResult {
  const expiresIn = params.expiresInMinutes || 30;
  const subject = 'Reset your Sena password';

  const content = `
    ${renderHeading('Reset your password', 'A request was received to reset the password for your account.')}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `Click the button below to choose a new password. This reset link remains valid for <strong>${expiresIn} minutes</strong>.`
    )}
    ${renderButton('Reset Password', params.resetUrl)}
    ${renderAlertCallout(
      'If you did not request a password reset, please disregard this email. Your current password remains secure.',
      'info'
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'Reset your password for your Sena administrative account.',
    headerType: 'platform',
    footerType: 'platform',
  });

  return { subject, html, text: htmlToPlainText(html) };
}

// ----------------------------------------------------------------------
// 06. account.password_changed
// ----------------------------------------------------------------------
export interface PasswordChangedParams {
  userName: string;
  timestamp?: string;
  ipAddress?: string;
}

export function renderPasswordChangedEmail(params: PasswordChangedParams): EmailRenderResult {
  const subject = 'Your Sena password was updated';
  const time = params.timestamp || new Date().toUTCString();

  const content = `
    ${renderHeading('Password Updated', 'Your account credentials have been successfully updated.')}
    ${renderParagraph(`Hello ${escapeHtml(params.userName)},`)}
    ${renderParagraph(
      `The password for your Sena account was changed on <strong>${escapeHtml(time)}</strong>.`
    )}
    ${
      params.ipAddress
        ? renderSecurityBox({
            time,
            ip: params.ipAddress,
          })
        : ''
    }
    ${renderAlertCallout(
      'If you made this change, you can safely disregard this message. If you did not update your password, please contact Sena Support immediately at <a href="mailto:' +
        SENA_BRAND.supportEmail +
        '" style="color: #71382D; font-weight: 600;">' +
        SENA_BRAND.supportEmail +
        '</a>.',
      'warning'
    )}
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: 'Your Sena account password was successfully updated.',
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
