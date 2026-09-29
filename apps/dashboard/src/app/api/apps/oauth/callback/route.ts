import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import {
  consumeOAuthState,
  markIntegrationAuthorized,
  upsertOAuthTokens,
} from '@/lib/integrations/platform/oauth';
import { getProviderDefinition } from '@/lib/integrations/platform/registry';
import { writeIntegrationAudit } from '@/lib/integrations/platform/audit';
import { publicAppOrigin } from '@/lib/integrations/platform/access';

/**
 * OAuth callback — validates CSRF state bound to property+provider+user,
 * exchanges code server-side, stores encrypted tokens, never echoes secrets.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const rawState = url.searchParams.get('state') || '';
  const origin = publicAppOrigin(req);

  if (error) {
    return NextResponse.redirect(`${origin}/apps?oauth=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code || !rawState.includes('.')) {
    return NextResponse.redirect(`${origin}/apps?oauth=error&reason=invalid_callback`);
  }

  const [provider, ...stateParts] = rawState.split('.');
  const state = stateParts.join('.');
  if (!provider || !state) {
    return NextResponse.redirect(`${origin}/apps?oauth=error&reason=invalid_state`);
  }

  const session = await auth();
  const sessionUser = session?.user as { id?: string; propertyId?: string } | undefined;
  if (!sessionUser?.id || !sessionUser.propertyId) {
    return NextResponse.redirect(`${origin}/login?callbackUrl=${encodeURIComponent(`/apps?manage=${provider}`)}`);
  }

  const tenant = await resolveTenantForRequest(
    { user: { id: sessionUser.id, propertyId: sessionUser.propertyId } },
    req
  );
  if (!tenant || tenant.propertyId !== sessionUser.propertyId || tenant.role.toLowerCase() !== 'owner') {
    return NextResponse.redirect(`${origin}/apps?oauth=error&reason=forbidden`);
  }

  try {
    const consumed = await consumeOAuthState({
      state,
      propertyId: tenant.propertyId,
      provider,
      actorUserId: tenant.userId,
    });

    const definition = await getProviderDefinition(provider);
    if (!definition) throw new Error('PROVIDER_NOT_FOUND');

    const clientId =
      process.env[`SENA_${provider.toUpperCase()}_CLIENT_ID`] ||
      process.env[`${provider.toUpperCase()}_CLIENT_ID`] ||
      (provider === 'zoho_books'
        ? process.env.SENA_ZOHO_INVOICE_CLIENT_ID || process.env.ZOHO_INVOICE_CLIENT_ID
        : undefined);
    const clientSecret =
      process.env[`SENA_${provider.toUpperCase()}_CLIENT_SECRET`] ||
      process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] ||
      (provider === 'zoho_books'
        ? process.env.SENA_ZOHO_INVOICE_CLIENT_SECRET || process.env.ZOHO_INVOICE_CLIENT_SECRET
        : undefined);
    if (!clientId || !clientSecret) throw new Error('OAUTH_CLIENT_MISSING');

    const tokens = await exchangeAuthorizationCode(provider, {
      code,
      redirectUri: consumed.redirectUri,
      codeVerifier: consumed.codeVerifier,
      clientId,
      clientSecret,
      location: url.searchParams.get('location'),
      accountsServer: url.searchParams.get('accounts-server'),
    });

    const integration = await markIntegrationAuthorized({
      propertyId: tenant.propertyId,
      provider,
      category: definition.category,
      actorUserId: tenant.userId,
      accountLabel: tokens.accountLabel || null,
      environment: tokens.environment || null,
      accountMetadata: tokens.accountMetadata,
    });

    await upsertOAuthTokens({
      integrationId: integration.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes || consumed.scopes,
      accountMetadata: tokens.accountMetadata,
    });

    await writeIntegrationAudit({
      propertyId: tenant.propertyId,
      integrationId: integration.id,
      actorUserId: tenant.userId,
      action: `${provider}.oauth_completed`,
      details: { account: tokens.accountLabel || null },
    });

    const returnTo = typeof consumed.metadata.returnTo === 'string' ? consumed.metadata.returnTo : `/apps?manage=${provider}`;
    return NextResponse.redirect(`${origin}${returnTo.startsWith('/') ? returnTo : `/apps?manage=${provider}`}&oauth=connected`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'oauth_failed';
    // Never include tokens/code in redirect.
    const safe = ['OAUTH_STATE_INVALID', 'OAUTH_STATE_EXPIRED', 'OAUTH_PROPERTY_MISMATCH', 'OAUTH_PROVIDER_MISMATCH', 'OAUTH_ACTOR_MISMATCH', 'OAUTH_CLIENT_MISSING', 'TOKEN_EXCHANGE_FAILED'].includes(reason)
      ? reason
      : 'oauth_failed';
    try {
      await writeIntegrationAudit({
        propertyId: tenant.propertyId,
        actorUserId: tenant.userId,
        action: `${provider}.oauth_failed`,
        details: { reason: safe },
      });
    } catch {
      // Audit is best-effort; still redirect with safe reason.
    }
    return NextResponse.redirect(`${origin}/apps?oauth=error&reason=${encodeURIComponent(safe)}`);
  }
}

async function exchangeAuthorizationCode(
  provider: string,
  input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
    clientId: string;
    clientSecret: string;
    location?: string | null;
    accountsServer?: string | null;
  }
) {
  if (provider === 'zoho_invoice' || provider === 'zoho_books') {
    const { accountsBaseForLocation, buildZohoAuthorizationCodeTokenBody } = await import(
      '@/lib/integrations/zoho/invoice'
    );
    // Prefer explicit accounts-server from Zoho callback, then location DC, then env default.
    const accountsBase = (
      (typeof input.accountsServer === 'string' && input.accountsServer.startsWith('https://')
        ? input.accountsServer
        : accountsBaseForLocation(input.location)) || 'https://accounts.zoho.com'
    ).replace(/\/$/, '');
    const body = buildZohoAuthorizationCodeTokenBody({
      code: input.code,
      redirectUri: input.redirectUri,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      codeVerifier: input.codeVerifier,
    });
    const response = await fetch(`${accountsBase}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const json = (await response.json().catch(() => null)) as any;
    if (!response.ok || !json?.access_token) {
      // Sanitize provider error for ops — never log code/secret/tokens.
      const providerError =
        typeof json?.error === 'string'
          ? json.error
          : typeof json?.error_description === 'string'
            ? 'provider_error'
            : `http_${response.status}`;
      console.error('zoho_token_exchange_failed', {
        status: response.status,
        providerError,
        accountsBase,
        location: input.location || null,
        hasCodeVerifier: Boolean(input.codeVerifier),
        provider,
        redirectUriHost: (() => {
          try {
            return new URL(input.redirectUri).host;
          } catch {
            return 'invalid';
          }
        })(),
      });
      throw new Error('TOKEN_EXCHANGE_FAILED');
    }
    const apiDomain = typeof json.api_domain === 'string' ? json.api_domain : null;
    const location = typeof json.location === 'string' ? json.location.toLowerCase() : input.location?.toLowerCase() || null;
    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      expiresAt: typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: typeof json.scope === 'string' ? json.scope.split(' ') : undefined,
      accountLabel: apiDomain || (provider === 'zoho_books' ? 'Zoho Books' : 'Zoho Invoice'),
      environment: apiDomain,
      accountMetadata: {
        apiDomain,
        location,
        // Persist the accounts DC actually used for this exchange so refresh stays regional.
        accountsDomain: accountsBase,
      },
    };
  }

  if (provider === 'google_calendar') {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });
    if (input.codeVerifier) body.set('code_verifier', input.codeVerifier);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    const json = (await response.json().catch(() => null)) as any;
    if (!response.ok || !json?.access_token) throw new Error('TOKEN_EXCHANGE_FAILED');

    let accountEmail: string | null = null;
    let accountLabel = 'Google Calendar';
    try {
      const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${json.access_token}` },
        cache: 'no-store',
      });
      const profile = (await profileRes.json().catch(() => null)) as any;
      if (profileRes.ok && profile?.email) {
        accountEmail = String(profile.email);
        accountLabel = accountEmail;
      } else if (profile?.name) {
        accountLabel = String(profile.name);
      }
    } catch {
      // Account identity is best-effort; OAuth still succeeds.
    }

    return {
      accessToken: String(json.access_token),
      refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      expiresAt: typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null,
      scopes: typeof json.scope === 'string' ? json.scope.split(' ') : undefined,
      accountLabel,
      environment: 'google',
      accountMetadata: {
        accountEmail,
      },
    };
  }

  if (provider === 'whatsapp') {
    const body = new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });
    const response = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${body.toString()}`, {
      cache: 'no-store',
    });
    const json = (await response.json().catch(() => null)) as any;
    if (!response.ok || !json?.access_token) throw new Error('TOKEN_EXCHANGE_FAILED');
    return {
      accessToken: String(json.access_token),
      refreshToken: undefined,
      expiresAt: typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null,
      accountLabel: 'WhatsApp Business',
      environment: 'meta',
      accountMetadata: { actionRequired: 'Complete Meta Business / WhatsApp product setup and template approval.' },
    };
  }

  throw new Error('PROVIDER_NOT_FOUND');
}
