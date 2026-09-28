import { db, websiteConfigs, properties, eq } from '@sena/database';
import { revalidatePath } from 'next/cache';
import { normalizeHexColor } from './hex-color';

const ALLOWED_THEMES = new Set(['sena_one', 'sena_two', 'sena_three']);
const ALLOWED_BUTTON_STYLES = new Set(['square', 'soft', 'rounded']);
const ALLOWED_HEADING_FONTS = new Set(['serif', 'sans']);

const PUBLISHABLE_KEYS = [
  'theme',
  'brandColors',
  'typography',
  'buttonStyle',
  'logoUrl',
  'faviconUrl',
  'heroHeadline',
  'heroSubheading',
  'heroImageUrl',
  'heroCtaLabel',
  'welcomeEyebrow',
  'welcomeTitle',
  'welcomeBody',
  'welcomeImageUrl',
  'highlights',
  'aboutStory',
  'aboutImageUrl',
  'galleryImages',
  'nearbyPlaces',
  'amenities',
  'policies',
  'contactPhone',
  'contactEmail',
  'contactWhatsapp',
  'whatsappEnabled',
  'socialLinks',
  'seoTitle',
  'seoDescription',
  'seoOgImage',
  'enabledSections',
  'sectionOrder',
] as const;

export type WebsitePublishable = Partial<{
  [K in (typeof PUBLISHABLE_KEYS)[number]]: unknown;
}>;

function sanitizeString(val: unknown, maxLen = 500): string | null {
  if (typeof val !== 'string') return null;
  const cleaned = val.replace(/<[^>]*>?/gm, '').trim();
  return cleaned ? cleaned.slice(0, maxLen) : null;
}

export function sanitizeWebsiteConfig(input: Record<string, unknown>): WebsitePublishable {
  const sanitized: WebsitePublishable = {};

  if (input.theme && ALLOWED_THEMES.has(String(input.theme))) {
    sanitized.theme = input.theme;
  }

  if (input.brandColors && typeof input.brandColors === 'object') {
    const colors = input.brandColors as Record<string, unknown>;
    sanitized.brandColors = {
      primaryColor: normalizeHexColor(typeof colors.primaryColor === 'string' ? colors.primaryColor : null, '#71382D'),
      accentColor: normalizeHexColor(typeof colors.accentColor === 'string' ? colors.accentColor : null, '#B85C3E'),
      bgStyle: sanitizeString(colors.bgStyle, 50) || '#FAF7F2',
      textDark: sanitizeString(colors.textDark, 50) || '#191816',
      navStyle: ['transparent', 'solid_light', 'solid_dark'].includes(String(colors.navStyle))
        ? colors.navStyle
        : 'transparent',
    };
  }

  if (input.typography && typeof input.typography === 'object') {
    const typography = input.typography as Record<string, unknown>;
    sanitized.typography = {
      headingFont: ALLOWED_HEADING_FONTS.has(String(typography.headingFont))
        ? typography.headingFont
        : 'serif',
      bodyFont: typography.bodyFont === 'serif' ? 'serif' : 'sans',
    };
  }

  if (input.buttonStyle && ALLOWED_BUTTON_STYLES.has(String(input.buttonStyle))) {
    sanitized.buttonStyle = input.buttonStyle;
  }

  if ('logoUrl' in input) sanitized.logoUrl = sanitizeString(input.logoUrl, 1000);
  if ('faviconUrl' in input) sanitized.faviconUrl = sanitizeString(input.faviconUrl, 1000);
  if ('heroHeadline' in input) sanitized.heroHeadline = sanitizeString(input.heroHeadline, 255);
  if ('heroSubheading' in input) sanitized.heroSubheading = sanitizeString(input.heroSubheading, 1000);
  if ('heroImageUrl' in input) sanitized.heroImageUrl = sanitizeString(input.heroImageUrl, 1000);
  if ('heroCtaLabel' in input) sanitized.heroCtaLabel = sanitizeString(input.heroCtaLabel, 100) || 'Reserve Your Stay';

  if ('welcomeEyebrow' in input) sanitized.welcomeEyebrow = sanitizeString(input.welcomeEyebrow, 100);
  if ('welcomeTitle' in input) sanitized.welcomeTitle = sanitizeString(input.welcomeTitle, 255);
  if ('welcomeBody' in input) sanitized.welcomeBody = sanitizeString(input.welcomeBody, 2000);
  if ('welcomeImageUrl' in input) sanitized.welcomeImageUrl = sanitizeString(input.welcomeImageUrl, 1000);

  if ('aboutStory' in input) sanitized.aboutStory = sanitizeString(input.aboutStory, 2500);
  if ('aboutImageUrl' in input) sanitized.aboutImageUrl = sanitizeString(input.aboutImageUrl, 1000);

  if (Array.isArray(input.galleryImages)) {
    sanitized.galleryImages = input.galleryImages
      .filter((img: any) => img && typeof img.url === 'string' && img.url.trim().length > 0)
      .map((img: any) => ({
        url: sanitizeString(img.url, 1000) || '',
        caption: sanitizeString(img.caption, 200) || undefined,
        category: sanitizeString(img.category, 50) || 'Property',
      }));
  }

  if ('contactPhone' in input) sanitized.contactPhone = sanitizeString(input.contactPhone, 50);
  if ('contactEmail' in input) sanitized.contactEmail = sanitizeString(input.contactEmail, 255);
  if ('contactWhatsapp' in input) sanitized.contactWhatsapp = sanitizeString(input.contactWhatsapp, 50);
  if ('whatsappEnabled' in input) sanitized.whatsappEnabled = Boolean(input.whatsappEnabled);

  if ('seoTitle' in input) sanitized.seoTitle = sanitizeString(input.seoTitle, 255);
  if ('seoDescription' in input) sanitized.seoDescription = sanitizeString(input.seoDescription, 500);
  if ('seoOgImage' in input) sanitized.seoOgImage = sanitizeString(input.seoOgImage, 1000);

  if (input.enabledSections && typeof input.enabledSections === 'object') {
    sanitized.enabledSections = input.enabledSections;
  }
  if (Array.isArray(input.sectionOrder)) {
    sanitized.sectionOrder = input.sectionOrder;
  }

  return sanitized;
}

export function pickPublishable(source: Record<string, unknown> | null | undefined): WebsitePublishable {
  const out: WebsitePublishable = {};
  if (!source) return out;
  for (const key of PUBLISHABLE_KEYS) {
    if (key in source && source[key] !== undefined) {
      (out as Record<string, unknown>)[key] = source[key];
    }
  }
  return out;
}

async function revalidatePropertySite(propertyId: string) {
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, propertyId),
  });
  if (!property?.slug) return;
  try {
    revalidatePath(`/site/${property.slug}`, 'layout');
    revalidatePath(`/site/${property.slug}`);
  } catch (err) {
    console.warn('[website.revalidate]', { slug: property.slug, stage: 'revalidatePath' });
  }
}

export async function saveWebsiteDraft(propertyId: string, rawUpdates: Record<string, unknown>) {
  const sanitizedUpdates = sanitizeWebsiteConfig(rawUpdates);
  const existing = await db.query.websiteConfigs.findFirst({
    where: eq(websiteConfigs.propertyId, propertyId),
  });

  const mergedDraft = {
    ...((existing?.draftConfig as Record<string, unknown>) || {}),
    ...sanitizedUpdates,
  };

  if (existing) {
    const [updated] = await db
      .update(websiteConfigs)
      .set({
        draftConfig: mergedDraft,
        updatedAt: new Date(),
      })
      .where(eq(websiteConfigs.id, existing.id))
      .returning();
    return { config: updated, created: false };
  }

  const [created] = await db
    .insert(websiteConfigs)
    .values({
      propertyId,
      draftConfig: mergedDraft,
      isPublished: false,
    })
    .returning();
  return { config: created, created: true };
}

export async function publishWebsiteConfig(
  propertyId: string,
  rawUpdates: Record<string, unknown> = {}
) {
  const sanitizedDirectUpdates = sanitizeWebsiteConfig(rawUpdates);
  const existing = await db.query.websiteConfigs.findFirst({
    where: eq(websiteConfigs.propertyId, propertyId),
  });

  const existingDraft = ((existing?.draftConfig as Record<string, unknown>) || {});
  const promotedConfig = pickPublishable({
    ...existingDraft,
    ...sanitizedDirectUpdates,
  });

  let published;
  if (existing) {
    [published] = await db
      .update(websiteConfigs)
      .set({
        ...(promotedConfig as Record<string, never>),
        draftConfig: null,
        isPublished: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(websiteConfigs.id, existing.id))
      .returning();
  } else {
    [published] = await db
      .insert(websiteConfigs)
      .values({
        propertyId,
        ...promotedConfig,
        isPublished: true,
        publishedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning();
  }

  await revalidatePropertySite(propertyId);
  return published;
}
