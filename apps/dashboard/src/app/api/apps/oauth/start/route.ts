import { NextRequest } from 'next/server';
import { createOAuthState } from '@/lib/integrations/platform/oauth';
import { getProviderDefinition } from '@/lib/integrations/platform/registry';
import { jsonNoStore, ownerOnly, publicAppOrigin, resolveAppsTenant } from '@/lib/integrations/platform/access';
import { writeIntegrationAudit } from '@/lib/integrations/platform/audit';

/**
 * Starts an OAuth authorization for a Connected App.
 * Returns the authorize URL — never returns client secrets.
 * Requires env-configured client IDs per provider (human action).
 */
export async function POST(req: NextRequest) {
  const result = await resolveAppsTenant(req);
  if ('error' in result) return result.error;
  if (!ownerOnly(result.resolved.role)) {
    return jsonNoStore({ error: 'Only a property owner can connect apps.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const provider = typeof body.provider === 'string' ? body.provider : '';
  const definition = await getProviderDefinition(provider);
  if (!definition) return jsonNoStore({ error: 'Provider not found.' }, { status: 404 });
  if (definition.availability === 'coming_soon') {
    return jsonNoStore({ error: 'This app is coming soon.' }, { status: 422 });
  }
  if (definition.authenticationType !== 'oauth2' && definition.authenticationType !== 'hybrid') {
    return jsonNoStore({ error: 'This provider does not use OAuth.' }, { status: 422 });
  }

  const clientId = process.env[`SENA_${provider.toUpperCase()}_CLIENT_ID` as keyof NodeJS.ProcessEnv] as string | undefined
    || process.env[`${provider.toUpperCase()}_CLIENT_ID`];
  if (!clientId) {
    return jsonNoStore({
      error: 'OAuth client is not configured yet.',
      actionRequired: true,
      code: 'OAUTH_CLIENT_MISSING',
      provider,
    }, { status: 503 });
  }

  if (provider === 'whatsapp' && process.env.SENA_WHATSAPP_META_APPROVED !== 'true') {
    return jsonNoStore({
      error: 'ACTION_REQUIRED: Complete Meta WhatsApp Business Platform approval before connecting.',
      actionRequired: true,
      code: 'WHATSAPP_META_APPROVAL_REQUIRED',
      provider,
    }, { status: 503 });
  }

  const origin = publicAppOrigin(req);
  const redirectUri = `${origin}/api/apps/oauth/callback`;
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((scope: unknown) => typeof scope === 'string')
    : defaultScopes(provider);

  const state = await createOAuthState({
    propertyId: result.resolved.propertyId,
    provider,
    actorUserId: result.resolved.userId,
    redirectUri,
    scopes,
    metadata: { returnTo: typeof body.returnTo === 'string' ? body.returnTo : `/apps?manage=${provider}` },
  });

  await writeIntegrationAudit({
    propertyId: result.resolved.propertyId,
    actorUserId: result.resolved.userId,
    action: `${provider}.oauth_started`,
    details: { scopes },
  });

  const authorizeUrl = buildAuthorizeUrl(provider, {
    clientId,
    redirectUri,
    state: state.state,
    scopes,
    codeChallenge: state.codeChallenge,
  });

  return jsonNoStore({
    authorizeUrl,
    expiresAt: state.expiresAt.toISOString(),
    provider,
  });
}

function defaultScopes(provider: string): string[] {
  switch (provider) {
    case 'zoho_invoice':
      return ['ZohoInvoice.contacts.READ', 'ZohoInvoice.contacts.CREATE', 'ZohoInvoice.contacts.UPDATE', 'ZohoInvoice.invoices.READ', 'ZohoInvoice.invoices.CREATE', 'ZohoInvoice.invoices.UPDATE', 'ZohoInvoice.customerpayments.CREATE', 'ZohoInvoice.customerpayments.READ', 'ZohoInvoice.settings.READ'];
    case 'google_calendar':
      return ['https://www.googleapis.com/auth/calendar.events'];
    case 'whatsapp':
      return ['whatsapp_business_management', 'whatsapp_business_messaging'];
    default:
      return [];
  }
}

function buildAuthorizeUrl(
  provider: string,
  input: { clientId: string; redirectUri: string; state: string; scopes: string[]; codeChallenge?: string }
) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    state: `${provider}.${input.state}`,
    access_type: 'offline',
    prompt: 'consent',
  });
  if (input.scopes.length) params.set('scope', input.scopes.join(' '));
  if (input.codeChallenge) {
    params.set('code_challenge', input.codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  switch (provider) {
    case 'zoho_invoice': {
      const accountsBase = process.env.SENA_ZOHO_ACCOUNTS_BASE || process.env.ZOHO_ACCOUNTS_BASE || 'https://accounts.zoho.com';
      return `${accountsBase.replace(/\/$/, '')}/oauth/v2/auth?${params.toString()}`;
    }
    case 'google_calendar':
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    case 'whatsapp':
      return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
    default:
      throw new Error('PROVIDER_AUTHORIZE_UNSUPPORTED');
  }
}
