import assert from 'node:assert/strict';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@localhost:55432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://production.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.SENA_INTEGRATION_ENCRYPTION_KEY ||= '22'.repeat(32);

async function run() {
  const database = await import('../packages/database/src/index');
  const {
    db,
    organizations,
    properties,
    users,
    integrations,
    integrationOauthTokens,
    integrationExternalObjects,
    integrationSyncJobs,
    integrationAuditLogs,
    eq,
    sql,
  } = database;

  const platform = await import('../apps/dashboard/src/lib/integrations/platform/index');
  const cryptoModule = await import('../apps/dashboard/src/lib/integrations/crypto');

  const ids = {
    organization: '20000000-0000-4000-8000-000000000001',
    user: '20000000-0000-4000-8000-000000000002',
    property: '20000000-0000-4000-8000-000000000003',
    otherProperty: '20000000-0000-4000-8000-000000000004',
  };

  await platform.ensureConnectedAppsPlatformSchema();

  await db.execute(sql`delete from integration_sync_jobs where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_external_objects where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_webhook_events where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from payment_attempts where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from payments where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_credentials where integration_id in (select id from integrations where property_id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from integration_oauth_tokens where integration_id in (select id from integrations where property_id in (${ids.property}, ${ids.otherProperty}))`);
  await db.execute(sql`delete from integration_oauth_states where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integration_audit_logs where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.execute(sql`delete from integrations where property_id in (${ids.property}, ${ids.otherProperty})`);
  await db.delete(organizations).where(eq(organizations.id, ids.organization));
  await db.delete(users).where(eq(users.id, ids.user));

  await db.insert(users).values({ id: ids.user, email: 'apps-owner@qa.invalid', fullName: 'Apps QA Owner' });
  await db.insert(organizations).values({ id: ids.organization, name: 'Apps QA Org', slug: 'apps-qa-org' });
  await db.insert(properties).values([
    { id: ids.property, organizationId: ids.organization, name: 'Apps QA One', slug: 'apps-qa-one', code: 'AQ1', address: 'QA', phone: '+2340000000101', email: 'one@apps-qa.invalid' },
    { id: ids.otherProperty, organizationId: ids.organization, name: 'Apps QA Two', slug: 'apps-qa-two', code: 'AQ2', address: 'QA', phone: '+2340000000102', email: 'two@apps-qa.invalid' },
  ]);

  // Encryption
  const secret = 'oauth-access-token-synthetic';
  const encrypted = cryptoModule.encryptIntegrationSecret(secret);
  assert(!encrypted.includes(secret));
  assert.equal(cryptoModule.decryptIntegrationSecret(encrypted), secret);
  console.log('PASS credential encryption round-trip');

  // Status truthfulness
  const disconnected = platform.deriveConnectionAndHealth({
    availability: 'available',
    integration: { status: 'disconnected' },
    hasCredentials: false,
    authType: 'oauth2',
  });
  assert.equal(disconnected.connectionStatus, 'disconnected');
  const rowOnly = platform.deriveConnectionAndHealth({
    availability: 'available',
    integration: { status: 'connected', connectedAt: new Date(), verifiedAt: new Date() },
    hasCredentials: false,
    authType: 'oauth2',
  });
  assert.equal(rowOnly.connectionStatus, 'disconnected');
  const comingSoon = platform.deriveConnectionAndHealth({
    availability: 'coming_soon',
    integration: null,
    hasCredentials: false,
    authType: 'oauth2',
  });
  assert.equal(comingSoon.connectionStatus, 'coming_soon');
  console.log('PASS truthful connection status (row alone is not connected)');

  // OAuth state CSRF + tenant binding
  const started = await platform.createOAuthState({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    actorUserId: ids.user,
    redirectUri: 'https://preview.invalid/api/apps/oauth/callback',
    scopes: ['ZohoInvoice.contacts.READ'],
  });
  await assert.rejects(
    platform.consumeOAuthState({
      state: started.state,
      propertyId: ids.otherProperty,
      provider: 'zoho_invoice',
      actorUserId: ids.user,
    }),
    /OAUTH_PROPERTY_MISMATCH/
  );
  const consumed = await platform.consumeOAuthState({
    state: started.state,
    propertyId: ids.property,
    provider: 'zoho_invoice',
    actorUserId: ids.user,
  });
  assert.equal(consumed.propertyId, ids.property);
  await assert.rejects(
    platform.consumeOAuthState({
      state: started.state,
      propertyId: ids.property,
      provider: 'zoho_invoice',
      actorUserId: ids.user,
    }),
    /OAUTH_STATE_INVALID/
  );
  console.log('PASS OAuth state CSRF, property binding, single-use');

  const integration = await platform.markIntegrationAuthorized({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    category: 'accounting',
    actorUserId: ids.user,
    accountLabel: 'Zoho QA Org',
    environment: 'https://www.zohoapis.com',
  });
  await platform.upsertOAuthTokens({
    integrationId: integration.id,
    accessToken: 'access-token-qa',
    refreshToken: 'refresh-token-qa',
    expiresAt: new Date(Date.now() + 3600_000),
    scopes: ['ZohoInvoice.contacts.READ'],
  });
  const tokens = await platform.readOAuthTokens(integration.id);
  assert.equal(tokens?.accessToken, 'access-token-qa');
  assert.equal(tokens?.refreshToken, 'refresh-token-qa');
  const stored = await db.query.integrationOauthTokens.findFirst({ where: eq(integrationOauthTokens.integrationId, integration.id) });
  assert(stored && !stored.accessTokenEncrypted.includes('access-token-qa'));
  console.log('PASS OAuth token encrypt/store/read');

  // Tenant isolation on mappings
  await platform.upsertExternalObjectMapping({
    propertyId: ids.property,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    senaObjectType: 'guest',
    senaObjectId: '20000000-0000-4000-8000-000000000010',
    externalObjectType: 'contact',
    externalObjectId: 'zoho-contact-1',
  });
  await assert.rejects(
    platform.upsertExternalObjectMapping({
      propertyId: ids.property,
      integrationId: integration.id,
      provider: 'zoho_invoice',
      senaObjectType: 'guest',
      senaObjectId: '20000000-0000-4000-8000-000000000010',
      externalObjectType: 'contact',
      externalObjectId: 'zoho-contact-OTHER',
    }),
    /MAPPING_CONFLICT/
  );
  console.log('PASS external object mapping authority + conflict guard');

  // Sync engine enqueue + idempotency + backoff processing
  const job1 = await platform.enqueueSyncJob({
    propertyId: ids.property,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    direction: 'outbound',
    trigger: 'manual',
    jobType: 'platform_ping',
    idempotencyKey: 'qa-sync-1',
  });
  const job2 = await platform.enqueueSyncJob({
    propertyId: ids.property,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    direction: 'outbound',
    trigger: 'manual',
    jobType: 'platform_ping',
    idempotencyKey: 'qa-sync-1',
  });
  assert.equal(job1.id, job2.id);
  assert.equal(job2.status, 'queued');
  const processed = await platform.processSyncQueue(async () => ({}), 5);
  assert.equal(processed.some((row) => row?.status === 'completed'), true);
  const job3 = await platform.enqueueSyncJob({
    propertyId: ids.property,
    integrationId: integration.id,
    provider: 'zoho_invoice',
    direction: 'outbound',
    trigger: 'event',
    jobType: 'platform_ping',
    idempotencyKey: 'qa-sync-1',
    payload: { reason: 'mutation' },
  });
  assert.equal(job3.id, job1.id);
  assert.equal(job3.status, 'queued');
  const processedAgain = await platform.processSyncQueue(async () => ({}), 5);
  assert.equal(processedAgain.some((row) => row?.status === 'completed'), true);
  console.log('PASS sync enqueue idempotency + terminal re-queue + worker completion');

  // Audit scrubbing
  const scrubbed = platform.scrubAuditDetails({ account: 'Zoho QA', access_token: 'leak', secretKey: 'sk_test_leak' });
  assert.equal(scrubbed?.access_token, '[redacted]');
  assert.equal(scrubbed?.secretKey, '[redacted]');
  assert.equal(scrubbed?.account, 'Zoho QA');
  await platform.writeIntegrationAudit({
    propertyId: ids.property,
    integrationId: integration.id,
    actorUserId: ids.user,
    action: 'zoho_invoice.test_audit',
    details: { refresh_token: 'should-not-persist-raw', ok: true },
  });
  const audits = await platform.listIntegrationAudit(ids.property, 10);
  assert(audits.some((row) => row.action === 'zoho_invoice.test_audit' && row.details?.refresh_token === '[redacted]'));
  console.log('PASS audit log secret scrubbing');

  // Disconnect preserves mappings, clears tokens
  const mappingCountBefore = (
    await db.select().from(integrationExternalObjects).where(eq(integrationExternalObjects.propertyId, ids.property))
  ).length;
  await platform.disconnectOAuthIntegration({
    propertyId: ids.property,
    provider: 'zoho_invoice',
    actorUserId: ids.user,
  });
  const after = await db.query.integrations.findFirst({ where: eq(integrations.propertyId, ids.property) });
  assert.equal(after?.status, 'disconnected');
  assert.equal(await platform.readOAuthTokens(integration.id), null);
  const mappingCountAfter = (
    await db.select().from(integrationExternalObjects).where(eq(integrationExternalObjects.propertyId, ids.property))
  ).length;
  assert.equal(mappingCountAfter, mappingCountBefore);
  console.log('PASS disconnect clears secrets, preserves mappings');

  // Marketplace catalog never marks coming soon as connected
  const catalog = await platform.buildMarketplaceCatalog({ propertyId: ids.property, canManage: true });
  const channex = catalog.find((app) => app.provider === 'channex');
  assert(channex);
  assert.equal(channex.connectionStatus, 'coming_soon');
  const zoho = catalog.find((app) => app.provider === 'zoho_invoice');
  assert(zoho);
  assert.equal(zoho.connectionStatus, 'disconnected');
  console.log('PASS marketplace catalog truthful statuses');

  // Admin health has no credential fields
  const health = await platform.listAdminIntegrationHealth({ propertyId: ids.property });
  assert(health.every((row) => !('accessToken' in row) && !('encryptedValue' in row) && !('secret' in row)));
  console.log('PASS admin observability excludes credentials');

  // Webhook event idempotency helper
  const event1 = await platform.recordInboundWebhookEvent({
    integrationId: integration.id,
    propertyId: ids.property,
    providerEventId: 'evt-1',
    eventType: 'test.ping',
  });
  const event2 = await platform.recordInboundWebhookEvent({
    integrationId: integration.id,
    propertyId: ids.property,
    providerEventId: 'evt-1',
    eventType: 'test.ping',
  });
  assert.equal(event1.duplicate, false);
  assert.equal(event2.duplicate, true);
  assert.equal(event1.event.id, event2.event.id);
  console.log('PASS webhook event idempotency helper');

  console.log('CONNECTED APPS PLATFORM TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
