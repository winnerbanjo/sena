"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSenaEmailLayout = renderSenaEmailLayout;
exports.renderSenaEmailHeader = renderSenaEmailHeader;
exports.renderSenaPropertyHeader = renderSenaPropertyHeader;
exports.renderSenaEmailFooter = renderSenaEmailFooter;
exports.renderSenaPropertyFooter = renderSenaPropertyFooter;
exports.renderSenaEditorialFooter = renderSenaEditorialFooter;
exports.htmlToPlainText = htmlToPlainText;
const brand_1 = require("./brand");
/**
 * Standard Sena Email Layout Wrapper
 * Built with bulletproof HTML tables compatible with Gmail, Apple Mail, Outlook, and mobile screens.
 */
function renderSenaEmailLayout(contentHtml, options) {
    const { title, previewText = '', headerType = 'platform', propertyName, propertyLogoUrl, propertyAddress, propertyPhone, propertyEmail, footerType = 'platform', unsubscribeUrl, showSupportLink = true, } = options;
    let headerHtml = '';
    if (headerType === 'platform') {
        headerHtml = renderSenaEmailHeader();
    }
    else if (headerType === 'property' && propertyName) {
        headerHtml = renderSenaPropertyHeader({
            propertyName,
            propertyLogoUrl,
            propertyAddress,
            propertyPhone,
        });
    }
    let footerHtml = '';
    if (footerType === 'platform') {
        footerHtml = renderSenaEmailFooter({ showSupportLink, unsubscribeUrl });
    }
    else if (footerType === 'property' && propertyName) {
        footerHtml = renderSenaPropertyFooter({
            propertyName,
            propertyAddress,
            propertyPhone,
            propertyEmail,
        });
    }
    else if (footerType === 'editorial') {
        footerHtml = renderSenaEditorialFooter({ unsubscribeUrl });
    }
    // Preheader text that hides after being read by mail clients
    const preheaderHtml = previewText
        ? `
      <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #FAF7F2; opacity: 0;">
        ${escapeHtml(previewText)}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>
    `
        : '';
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    html, body {
      margin: 0 auto !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      background-color: #FAF7F2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    * {
      -ms-text-size-adjust: 100%;
      -webkit-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt !important;
      mso-table-rspace: 0pt !important;
    }
    table {
      border-spacing: 0 !important;
      border-collapse: collapse !important;
      table-layout: fixed !important;
      margin: 0 auto !important;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    a {
      color: #B85C3E;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
      }
      .mobile-padding {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .mobile-stack {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .mobile-align-left {
        text-align: left !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF7F2; color: #191816;">
  ${preheaderHtml}
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #FAF7F2;">
    <tr>
      <td align="center" style="padding: 32px 12px 48px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-container" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E8E1D5; overflow: hidden; box-shadow: 0 4px 16px rgba(25, 24, 22, 0.03);">
          ${headerHtml}
          <tr>
            <td class="mobile-padding" style="padding: 36px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #191816;">
              ${contentHtml}
            </td>
          </tr>
          ${footerHtml}
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
/**
 * Standard Sena Platform Email Header
 */
function renderSenaEmailHeader() {
    return `
    <tr>
      <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #F0ECE4; background-color: #FFFFFF;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td valign="middle" align="left">
              <a href="${brand_1.SENA_BRAND.websiteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${brand_1.SENA_BRAND.logoUrl}" alt="Sena" width="96" style="display: block; width: 96px; max-width: 96px; height: auto;" border="0" />
              </a>
            </td>
            <td valign="middle" align="right" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; letter-spacing: 0.3px; color: #8C8275;">
              hospitality, simplified.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}
/**
 * Guest-Facing Property Email Header
 */
function renderSenaPropertyHeader(params) {
    return `
    <tr>
      <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid #F0ECE4; background-color: #FFFFFF;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td valign="middle" align="left">
              ${params.propertyLogoUrl
        ? `<img src="${escapeHtml(params.propertyLogoUrl)}" alt="${escapeHtml(params.propertyName)}" height="38" style="max-height: 38px; width: auto; display: block; margin-bottom: 6px;" border="0" />`
        : ''}
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 600; color: #71382D; letter-spacing: -0.2px;">
                ${escapeHtml(params.propertyName)}
              </div>
              ${params.propertyAddress
        ? `<div style="font-size: 12px; color: #8C8275; margin-top: 3px;">${escapeHtml(params.propertyAddress)}</div>`
        : ''}
            </td>
            <td valign="middle" align="right">
              <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #B85C3E; font-weight: 600; background-color: #FAF4EF; padding: 4px 10px; border-radius: 4px; display: inline-block;">
                Official Stay Folio
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}
/**
 * Standard Sena Platform Footer
 */
function renderSenaEmailFooter(options) {
    const { showSupportLink = true, unsubscribeUrl } = options;
    return `
    <tr>
      <td class="mobile-padding" style="padding: 28px 40px; background-color: #FAF7F2; border-top: 1px solid #E8E1D5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="left" style="font-size: 12px; color: #8C8275; line-height: 1.6;">
              <div style="font-weight: 600; color: #5C564D; margin-bottom: 4px;">Sena Operating System</div>
              <div>Modern hospitality infrastructure for high-performing hotels & serviced residences.</div>
              <div style="margin-top: 12px; font-size: 11px;">
                <a href="${brand_1.SENA_BRAND.websiteUrl}" style="color: #71382D; text-decoration: none; font-weight: 500;">sena.ng</a> &nbsp;·&nbsp;
                <a href="${brand_1.SENA_BRAND.appUrl}" style="color: #71382D; text-decoration: none; font-weight: 500;">Console</a> &nbsp;·&nbsp;
                <a href="${brand_1.SENA_BRAND.websiteUrl}/privacy" style="color: #71382D; text-decoration: none; font-weight: 500;">Privacy</a> &nbsp;·&nbsp;
                <a href="${brand_1.SENA_BRAND.websiteUrl}/terms" style="color: #71382D; text-decoration: none; font-weight: 500;">Terms</a>
                ${showSupportLink
        ? `&nbsp;·&nbsp; <a href="mailto:${brand_1.SENA_BRAND.supportEmail}" style="color: #71382D; text-decoration: none; font-weight: 500;">Support</a>`
        : ''}
                ${unsubscribeUrl
        ? `&nbsp;·&nbsp; <a href="${escapeHtml(unsubscribeUrl)}" style="color: #8C8275; text-decoration: underline;">Unsubscribe</a>`
        : ''}
              </div>
              <div style="margin-top: 12px; font-size: 10px; color: #A69E92;">
                This transactional notification was generated automatically by Sena for your property. All data is securely processed in accordance with the Nigeria Data Protection Act (NDPA).
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}
/**
 * Property Guest Email Footer
 */
function renderSenaPropertyFooter(params) {
    return `
    <tr>
      <td class="mobile-padding" style="padding: 24px 40px; background-color: #FAF7F2; border-top: 1px solid #E8E1D5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="left" style="font-size: 12px; color: #8C8275; line-height: 1.6;">
              <div style="font-weight: 600; color: #5C564D; margin-bottom: 2px;">${escapeHtml(params.propertyName)}</div>
              ${params.propertyAddress ? `<div>${escapeHtml(params.propertyAddress)}</div>` : ''}
              <div style="margin-top: 4px;">
                ${params.propertyPhone ? `<span>Tel: <strong>${escapeHtml(params.propertyPhone)}</strong></span>` : ''}
                ${params.propertyPhone && params.propertyEmail ? ` &nbsp;·&nbsp; ` : ''}
                ${params.propertyEmail ? `<span>Email: <strong>${escapeHtml(params.propertyEmail)}</strong></span>` : ''}
              </div>
              <div style="margin-top: 14px; font-size: 11px; color: #A69E92; border-top: 1px solid #EAE3D9; padding-top: 10px;">
                Powered by <a href="${brand_1.SENA_BRAND.websiteUrl}" style="color: #71382D; font-weight: 600; text-decoration: none;">Sena</a> · hospitality, simplified.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}
/**
 * Editorial Product Email Footer
 */
function renderSenaEditorialFooter(options) {
    const { unsubscribeUrl = 'https://app.sena.ng/settings/notifications' } = options;
    return `
    <tr>
      <td class="mobile-padding" style="padding: 28px 40px; background-color: #FAF7F2; border-top: 1px solid #E8E1D5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center" style="font-size: 12px; color: #8C8275; line-height: 1.6;">
              <div style="font-weight: 600; color: #5C564D; margin-bottom: 4px;">Sena Dispatch · Hospitality Operating Notes</div>
              <div>Practical perspectives on luxury hospitality operations, rate yield, and guest retention.</div>
              <div style="margin-top: 10px; font-size: 11px;">
                <a href="${brand_1.SENA_BRAND.websiteUrl}" style="color: #71382D; text-decoration: none; font-weight: 500;">sena.ng</a> &nbsp;·&nbsp;
                <a href="${escapeHtml(unsubscribeUrl)}" style="color: #8C8275; text-decoration: underline;">Manage newsletter preferences</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Robust HTML to Plain Text converter
 */
function htmlToPlainText(html) {
    let text = html;
    // Strip head, style, script tags
    text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    // Links: replace <a href="url">text</a> with text (url)
    text = text.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)');
    // Convert line breaks and paragraph closings to newlines
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = text.replace(/<\/li>/gi, '\n');
    // Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Unescape HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&zwnj;/g, '');
    // Clean up excessive blank lines
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    return text;
}
