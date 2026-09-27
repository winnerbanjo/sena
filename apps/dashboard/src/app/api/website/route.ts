import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  properties,
  websiteConfigs,
  websiteDomains,
  eq,
} from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { normalizeHexColor } from '@/lib/theme-provider';

export const dynamic = 'force-dynamic';

const ALLOWED_THEMES = new Set(['sena_one', 'sena_two', 'sena_three']);
const ALLOWED_BUTTON_STYLES = new Set(['square', 'soft', 'rounded']);
const ALLOWED_HEADING_FONTS = new Set(['serif', 'sans']);

function sanitizeString(val: unknown, maxLen = 500): string | null {
  if (typeof val !== 'string') return null;
  const cleaned = val.replace(/<[^>]*>?/gm, '').trim();
  return cleaned ? cleaned.slice(0, maxLen) : null;
}

function sanitizeWebsiteConfig(input: any) {
  const sanitized: Record<string, any> = {};

  if (input.theme && ALLOWED_THEMES.has(input.theme)) {
    sanitized.theme = input.theme;
  }

  if (input.brandColors && typeof input.brandColors === 'object') {
    sanitized.brandColors = {
      primaryColor: normalizeHexColor(input.brandColors.primaryColor, '#71382D'),
      accentColor: normalizeHexColor(input.brandColors.accentColor, '#B85C3E'),
      bgStyle: sanitizeString(input.brandColors.bgStyle, 50) || '#FAF7F2',
      textDark: sanitizeString(input.brandColors.textDark, 50) || '#191816',
      navStyle: ['transparent', 'solid_light', 'solid_dark'].includes(input.brandColors.navStyle)
        ? input.brandColors.navStyle
        : 'transparent',
    };
  }

  if (input.typography && typeof input.typography === 'object') {
    sanitized.typography = {
      headingFont: ALLOWED_HEADING_FONTS.has(input.typography.headingFont)
        ? input.typography.headingFont
        : 'serif',
      bodyFont: input.typography.bodyFont === 'serif' ? 'serif' : 'sans',
    };
  }

  if (input.buttonStyle && ALLOWED_BUTTON_STYLES.has(input.buttonStyle)) {
    sanitized.buttonStyle = input.buttonStyle;
  }

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

async function handleGET(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });

    const config = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, propertyId),
    });

    const domains = await db
      .select()
      .from(websiteDomains)
      .where(eq(websiteDomains.propertyId, propertyId));

    const draftConfig = (config?.draftConfig as Record<string, any>) || null;
    const hasDraftChanges = Boolean(draftConfig && Object.keys(draftConfig).length > 0);

    return NextResponse.json({
      property,
      config,
      draftConfig,
      hasDraftChanges,
      isPublished: Boolean(config?.isPublished),
      publishedAt: config?.publishedAt || null,
      domains,
    });
  } catch (error: any) {
    console.error('Error fetching website config:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

// Save draft (draftOnly: true) or direct update
async function handlePUT(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const canManage = ['owner', 'gm', 'general_manager', 'admin', 'manager'].includes(
      (tenant.role || '').toLowerCase()
    );
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to edit website' }, { status: 403 });
    }

    const body = await req.json();
    const { draftOnly = true, ...rawUpdates } = body;
    const sanitizedUpdates = sanitizeWebsiteConfig(rawUpdates);

    const existing = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, propertyId),
    });

    let updated;
    if (draftOnly) {
      // Store purely in draftConfig column without altering published columns
      const mergedDraft = {
        ...((existing?.draftConfig as Record<string, any>) || {}),
        ...sanitizedUpdates,
      };

      if (existing) {
        [updated] = await db
          .update(websiteConfigs)
          .set({
            draftConfig: mergedDraft,
            updatedAt: new Date(),
          })
          .where(eq(websiteConfigs.id, existing.id))
          .returning();
      } else {
        [updated] = await db
          .insert(websiteConfigs)
          .values({
            propertyId,
            draftConfig: mergedDraft,
            isPublished: false,
          })
          .returning();
      }

      return NextResponse.json({
        success: true,
        isDraft: true,
        message: 'Draft saved successfully.',
        config: updated,
      });
    }

    // Direct update: update published columns directly
    if (existing) {
      [updated] = await db
        .update(websiteConfigs)
        .set({
          ...sanitizedUpdates,
          draftConfig: null, // cleared
          updatedAt: new Date(),
        })
        .where(eq(websiteConfigs.id, existing.id))
        .returning();
    } else {
      [updated] = await db
        .insert(websiteConfigs)
        .values({
          propertyId,
          ...sanitizedUpdates,
          isPublished: true,
          publishedAt: new Date(),
        })
        .returning();
    }

    // Invalidate Next.js cache for the property's public site
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });
    if (property?.slug) {
      try {
        revalidatePath(`/site/${property.slug}`, 'layout');
        revalidatePath(`/site/${property.slug}`);
      } catch (err) {
        console.warn('revalidatePath error on PUT:', err);
      }
    }

    return NextResponse.json({
      success: true,
      isDraft: false,
      message: 'Website configuration updated.',
      config: updated,
    });
  } catch (error: any) {
    console.error('Error saving website config:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

// Publish changes to live website (atomically promotes draftConfig to published columns)
async function handlePATCH(req: NextRequest) {
  try {
    const session = await auth();
    const tenant = await resolveTenantForRequest(session, req);
    const propertyId = tenant?.propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const canManage = ['owner', 'gm', 'general_manager', 'admin', 'manager'].includes(
      (tenant.role || '').toLowerCase()
    );
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to publish website' }, { status: 403 });
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const sanitizedDirectUpdates = sanitizeWebsiteConfig(payload);

    const property = await db.query.properties.findFirst({
      where: eq(properties.id, propertyId),
    });

    const existing = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, propertyId),
    });

    const existingDraft = (existing?.draftConfig as Record<string, any>) || {};
    // Merge existing draft with any direct updates supplied in the publish request
    const promotedConfig = {
      ...existingDraft,
      ...sanitizedDirectUpdates,
    };

    let published;
    if (existing) {
      [published] = await db
        .update(websiteConfigs)
        .set({
          ...promotedConfig,
          draftConfig: null, // draft is cleared upon publish
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
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
        })
        .returning();
    }

    // Atomically invalidate Next.js cache for the property's public site
    if (property?.slug) {
      try {
        revalidatePath(`/site/${property.slug}`, 'layout');
        revalidatePath(`/site/${property.slug}`);
      } catch (err) {
        console.warn('revalidatePath error on PATCH:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Website published successfully!',
      publishedAt: published.publishedAt,
      config: published,
    });
  } catch (error: any) {
    console.error('Error publishing website:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'website');
export const PUT = withMerchant(handlePUT, 'website');
export const PATCH = withMerchant(handlePATCH, 'website');
