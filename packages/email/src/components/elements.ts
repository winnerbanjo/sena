import { SENA_BRAND } from './brand';

export function renderHeading(
  title: string,
  subtitle?: string,
  level: 1 | 2 | 3 = 1
): string {
  const fontSize = level === 1 ? '24px' : level === 2 ? '18px' : '15px';
  const color = level === 1 ? SENA_BRAND.colors.deepClay : SENA_BRAND.colors.ink;
  const letterSpacing = level === 1 ? '-0.4px' : '-0.2px';

  return `
    <div style="margin-bottom: 20px;">
      <h${level} style="margin: 0; font-size: ${fontSize}; font-weight: 600; line-height: 1.3; color: ${color}; letter-spacing: ${letterSpacing};">
        ${escapeHtml(title)}
      </h${level}>
      ${
        subtitle
          ? `<p style="margin: 6px 0 0 0; font-size: 14px; line-height: 1.5; color: ${SENA_BRAND.colors.inkMuted};">
              ${escapeHtml(subtitle)}
            </p>`
          : ''
      }
    </div>
  `;
}

export function renderParagraph(text: string, muted = false): string {
  const color = muted ? SENA_BRAND.colors.inkMuted : SENA_BRAND.colors.ink;
  return `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: ${color};">${text}</p>`;
}

export function renderButton(
  label: string,
  url: string,
  align: 'left' | 'center' | 'right' = 'left',
  secondary = false
): string {
  const bgColor = secondary ? '#FFFFFF' : SENA_BRAND.colors.terracotta;
  const textColor = secondary ? SENA_BRAND.colors.deepClay : '#FFFFFF';
  const border = secondary ? `1px solid ${SENA_BRAND.colors.sand}` : 'none';

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0; ${align === 'center' ? 'margin-left: auto; margin-right: auto;' : ''}">
      <tr>
        <td align="${align}">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" bgcolor="${bgColor}" style="border-radius: 6px; ${border};">
                <a href="${escapeHtml(url)}" target="_blank" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${textColor}; text-decoration: none; padding: 13px 26px; border-radius: 6px; display: inline-block; letter-spacing: 0.2px;">
                  ${escapeHtml(label)}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function renderCard(
  contentHtml: string,
  title?: string,
  badge?: { text: string; variant?: 'terracotta' | 'success' | 'warning' | 'neutral' }
): string {
  let badgeHtml = '';
  if (badge) {
    let bg = '#FAF4EF';
    let color = SENA_BRAND.colors.terracotta;
    if (badge.variant === 'success') {
      bg = '#EFF7F2';
      color = SENA_BRAND.colors.success;
    } else if (badge.variant === 'warning') {
      bg = '#FEF8EE';
      color = SENA_BRAND.colors.warning;
    } else if (badge.variant === 'neutral') {
      bg = '#F2EFE9';
      color = SENA_BRAND.colors.inkMuted;
    }

    badgeHtml = `
      <span style="font-size: 11px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.8px; padding: 3px 8px; border-radius: 4px; background-color: ${bg}; color: ${color};">
        ${escapeHtml(badge.text)}
      </span>
    `;
  }

  const titleRow =
    title || badgeHtml
      ? `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ECE7DE; padding-bottom: 12px; margin-bottom: 14px;">
        <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: ${SENA_BRAND.colors.deepClay};">
          ${escapeHtml(title || '')}
        </span>
        ${badgeHtml}
      </div>
    `
      : '';

  return `
    <div style="background-color: ${SENA_BRAND.colors.cardBg}; border: 1px solid ${SENA_BRAND.colors.border}; border-radius: 8px; padding: 20px; margin: 24px 0;">
      ${titleRow}
      ${contentHtml}
    </div>
  `;
}

export function renderDetailRow(
  label: string,
  value: string,
  isLast = false,
  isBold = false,
  highlightColor?: string
): string {
  const borderBottom = isLast ? 'none' : '1px solid #ECE7DE';
  const valWeight = isBold ? '600' : '400';
  const valColor = highlightColor || SENA_BRAND.colors.ink;

  return `
    <tr>
      <td style="padding: 9px 0; font-size: 13px; color: ${SENA_BRAND.colors.inkMuted}; border-bottom: ${borderBottom};">
        ${escapeHtml(label)}
      </td>
      <td align="right" style="padding: 9px 0; font-size: 14px; font-weight: ${valWeight}; color: ${valColor}; border-bottom: ${borderBottom};">
        ${value}
      </td>
    </tr>
  `;
}

export function renderDivider(): string {
  return `<hr style="border: 0; border-top: 1px solid #EAE3D9; margin: 28px 0;" />`;
}

export function renderReservationSummary(params: {
  reference: string;
  roomType: string;
  roomNumber?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  totalAmountFormatted: string;
  statusBadge?: string;
}): string {
  return renderCard(
    `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${renderDetailRow('Booking Reference', `<strong style="font-family: monospace; letter-spacing: 0.5px; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.reference)}</strong>`)}
      ${renderDetailRow('Primary Guest', escapeHtml(params.guestName))}
      ${renderDetailRow('Room Category', escapeHtml(params.roomType))}
      ${params.roomNumber ? renderDetailRow('Room Number', escapeHtml(params.roomNumber)) : ''}
      ${renderDetailRow('Check-in', escapeHtml(params.checkIn))}
      ${renderDetailRow('Check-out', escapeHtml(params.checkOut))}
      ${renderDetailRow('Length of Stay', `${params.nights} ${params.nights === 1 ? 'Night' : 'Nights'}`)}
      ${renderDetailRow(
        'Total Confirmed',
        `<strong style="font-size: 16px; color: ${SENA_BRAND.colors.terracotta};">${escapeHtml(params.totalAmountFormatted)}</strong>`,
        true,
        true
      )}
    </table>
  `,
    'Reservation Details',
    params.statusBadge ? { text: params.statusBadge, variant: 'terracotta' } : undefined
  );
}

export function renderAmountSummary(params: {
  lines: Array<{ label: string; amount: string; isBold?: boolean }>;
  total: string;
  balanceDue?: string;
  isPaid?: boolean;
}): string {
  const rows = params.lines
    .map((l) => renderDetailRow(l.label, l.amount, false, l.isBold))
    .join('');

  return renderCard(
    `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${rows}
      ${renderDetailRow('Total Amount', `<strong style="font-size: 16px; color: ${SENA_BRAND.colors.deepClay};">${escapeHtml(params.total)}</strong>`, !params.balanceDue, true)}
      ${
        params.balanceDue
          ? renderDetailRow('Balance Due', `<strong style="font-size: 16px; color: ${SENA_BRAND.colors.terracotta};">${escapeHtml(params.balanceDue)}</strong>`, true, true)
          : ''
      }
    </table>
  `,
    'Payment Summary',
    params.isPaid ? { text: 'Paid in Full', variant: 'success' } : undefined
  );
}

/**
 * Restrained commission banner for direct bookings
 */
export function renderCommissionZeroBadge(): string {
  return `
    <div style="background-color: #FAF4EF; border: 1px dashed ${SENA_BRAND.colors.sand}; border-radius: 6px; padding: 12px 16px; margin: 18px 0; text-align: center;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="left" style="font-size: 13px; color: ${SENA_BRAND.colors.deepClay}; font-weight: 500;">
            Direct Guest Reservation
          </td>
          <td align="right" style="font-size: 13px; color: ${SENA_BRAND.colors.terracotta}; font-weight: 600;">
            Sena Commission: ₦0 (100% Direct)
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function renderSecurityBox(params: {
  ip?: string;
  device?: string;
  location?: string;
  time?: string;
}): string {
  return renderCard(
    `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${params.time ? renderDetailRow('Date & Time', escapeHtml(params.time)) : ''}
      ${params.device ? renderDetailRow('Device / Browser', escapeHtml(params.device)) : ''}
      ${params.location ? renderDetailRow('Approximate Location', escapeHtml(params.location)) : ''}
      ${params.ip ? renderDetailRow('IP Address', `<code style="font-family: monospace; font-size: 12px; color: #5C564D;">${escapeHtml(params.ip)}</code>`, true) : ''}
    </table>
  `,
    'Security & Session Context'
  );
}

export function renderAlertCallout(
  message: string,
  variant: 'warning' | 'info' | 'danger' = 'info'
): string {
  let bg = '#FAF7F2';
  let border = SENA_BRAND.colors.sand;
  let textCol = SENA_BRAND.colors.ink;

  if (variant === 'warning') {
    bg = '#FEF8EE';
    border = '#EAD2A8';
    textCol = '#7A4B0C';
  } else if (variant === 'danger') {
    bg = '#FDF2F2';
    border = '#F2B8B8';
    textCol = '#8A2424';
  }

  return `
    <div style="background-color: ${bg}; border-left: 4px solid ${border}; padding: 14px 18px; margin: 20px 0; border-radius: 4px; font-size: 14px; line-height: 1.5; color: ${textCol};">
      ${message}
    </div>
  `;
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
