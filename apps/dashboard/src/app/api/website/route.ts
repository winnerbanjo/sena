import { apiError } from '@/lib/api-error';
import { withMerchant, getMerchantRequest } from '@/lib/merchant-route';
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
import { publishWebsiteConfig, saveWebsiteDraft } from '@/lib/website-config-ops';

export const dynamic = 'force-dynamic';

async function resolvePropertyId(req: NextRequest) {
  const merchant = getMerchantRequest(req);
  if (merchant?.tenant.propertyId) return merchant.tenant.propertyId;
  const session = await auth();
  const tenant = await resolveTenantForRequest(session, req);
  return tenant?.propertyId || null;
}

async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  const merchant = getMerchantRequest(req);
  if (merchant && (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST')) {
    return merchant.body || {};
  }
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function handleGET(req: NextRequest) {
  try {
    const propertyId = await resolvePropertyId(req);
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

    const draftConfig = (config?.draftConfig as Record<string, unknown>) || null;
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
    console.error('[website.get]', { stage: 'load', name: error?.name });
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePUT(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId || (await resolvePropertyId(req));
    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const role = (merchant?.tenant.role || '').toLowerCase();
    const canManage = ['owner', 'gm', 'general_manager', 'admin', 'manager'].includes(role);
    if (merchant && !canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to edit website' }, { status: 403 });
    }

    const body = await readJsonBody(req);
    const rawUpdates = { ...body };
    delete rawUpdates.draftOnly;

    const saved = await saveWebsiteDraft(propertyId, rawUpdates as Record<string, unknown>);
    return NextResponse.json({
      success: true,
      isDraft: true,
      message: 'Draft saved successfully.',
      config: saved.config,
    });
  } catch (error: any) {
    console.error('[website.put]', { stage: 'save_draft', name: error?.name, code: error?.code });
    return NextResponse.json({
      error: 'Your website draft could not be saved. Your live website has not been changed.',
    }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId || (await resolvePropertyId(req));
    if (!propertyId) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const role = (merchant?.tenant.role || '').toLowerCase();
    const canManage = ['owner', 'gm', 'general_manager', 'admin', 'manager'].includes(role);
    if (merchant && !canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to publish website' }, { status: 403 });
    }

    const payload = await readJsonBody(req);
    const published = await publishWebsiteConfig(propertyId, payload);
    return NextResponse.json({
      success: true,
      message: 'Website published',
      publishedAt: published.publishedAt,
      config: published,
    });
  } catch (error: any) {
    console.error('[website.patch]', { stage: 'publish', name: error?.name, code: error?.code });
    return NextResponse.json({
      error: 'Your website could not be published. Your live website has not been changed.',
    }, { status: 500 });
  }
}

export const GET = withMerchant(handleGET, 'website');
export const PUT = withMerchant(handlePUT, 'website');
export const PATCH = withMerchant(handlePATCH, 'website');
