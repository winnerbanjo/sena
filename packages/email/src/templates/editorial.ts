import { SENA_BRAND } from '../components/brand';
import {
  renderSenaEmailLayout,
  htmlToPlainText,
} from '../components/layout';
import {
  renderButton,
  renderDivider,
} from '../components/elements';
import { EmailRenderResult } from './account';

// ----------------------------------------------------------------------
// 41. editorial.product_update (Sena Dispatch)
// ----------------------------------------------------------------------
export interface EditorialProductEmailParams {
  editionNumber: number;
  issueTitle: string;
  leadArticle: {
    title: string;
    subheading: string;
    author: string;
    contentHtml: string;
  };
  productNotes?: Array<{
    feature: string;
    description: string;
    impact: string;
  }>;
  curatedLink?: {
    title: string;
    summary: string;
    url: string;
  };
  unsubscribeUrl?: string;
}

export function renderEditorialProductEmail(
  params: EditorialProductEmailParams
): EmailRenderResult {
  const subject = `Sena Dispatch #${params.editionNumber} · ${params.issueTitle}`;

  const notesHtml =
    params.productNotes && params.productNotes.length > 0
      ? `
      <div style="margin: 32px 0 24px 0;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; color: ${SENA_BRAND.colors.deepClay}; margin-bottom: 16px;">
          Product & Infrastructure Updates
        </div>
        ${params.productNotes
          .map(
            (note) => `
          <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #ECE7DE;">
            <div style="font-size: 15px; font-weight: 600; color: ${SENA_BRAND.colors.ink};">
              ${escapeHtml(note.feature)}
            </div>
            <div style="font-size: 14px; line-height: 1.6; color: ${SENA_BRAND.colors.inkMuted}; margin-top: 4px;">
              ${escapeHtml(note.description)}
            </div>
            <div style="font-size: 12px; font-weight: 500; color: ${SENA_BRAND.colors.terracotta}; margin-top: 6px;">
              Impact: ${escapeHtml(note.impact)}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `
      : '';

  const linkHtml = params.curatedLink
    ? `
      <div style="background-color: #FAF7F2; border-left: 3px solid ${SENA_BRAND.colors.sand}; padding: 18px; margin: 28px 0; border-radius: 0 6px 6px 0;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${SENA_BRAND.colors.deepClay}; font-weight: 600;">
          Further Reading
        </div>
        <div style="font-size: 15px; font-weight: 600; color: ${SENA_BRAND.colors.ink}; margin-top: 4px;">
          <a href="${escapeHtml(params.curatedLink.url)}" target="_blank" style="color: ${SENA_BRAND.colors.ink}; text-decoration: none;">
            ${escapeHtml(params.curatedLink.title)} &rarr;
          </a>
        </div>
        <div style="font-size: 13px; color: ${SENA_BRAND.colors.inkMuted}; margin-top: 4px; line-height: 1.5;">
          ${escapeHtml(params.curatedLink.summary)}
        </div>
      </div>
    `
    : '';

  const content = `
    <!-- Editorial Masthead -->
    <div style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #EAE3D9; margin-bottom: 28px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; color: ${SENA_BRAND.colors.terracotta};">
        Sena Dispatch · Issue #${params.editionNumber}
      </div>
      <h1 style="font-size: 26px; font-weight: 600; color: ${SENA_BRAND.colors.deepClay}; margin: 10px 0 6px 0; letter-spacing: -0.4px; line-height: 1.25;">
        ${escapeHtml(params.leadArticle.title)}
      </h1>
      <div style="font-size: 14px; color: ${SENA_BRAND.colors.inkMuted}; font-style: italic;">
        ${escapeHtml(params.leadArticle.subheading)}
      </div>
      <div style="font-size: 12px; color: ${SENA_BRAND.colors.inkLight}; margin-top: 10px;">
        By ${escapeHtml(params.leadArticle.author)} · Hospitality Operations Practice
      </div>
    </div>

    <!-- Editorial Lead Article -->
    <div style="font-size: 15px; line-height: 1.7; color: ${SENA_BRAND.colors.ink};">
      ${params.leadArticle.contentHtml}
    </div>

    ${renderDivider()}
    ${notesHtml}
    ${linkHtml}

    <div style="text-align: center; margin-top: 32px;">
      ${renderButton('Explore the Sena Console', `${SENA_BRAND.appUrl}`, 'center')}
    </div>
  `;

  const html = renderSenaEmailLayout(content, {
    title: subject,
    previewText: `Sena Dispatch #${params.editionNumber}: ${params.leadArticle.title}`,
    headerType: 'platform',
    footerType: 'editorial',
    unsubscribeUrl: params.unsubscribeUrl,
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
