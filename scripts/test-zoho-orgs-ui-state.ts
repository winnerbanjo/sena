import assert from 'node:assert/strict';
import {
  organizationsFromManagePayload,
  resolveZohoOrgsView,
} from '../apps/dashboard/src/lib/integrations/zoho/orgs-ui-state';

function run() {
  assert.equal(resolveZohoOrgsView({ connected: false, fetchStatus: 'ready', organizations: [], errorMessage: null }).kind, 'hidden');

  // Critical: idle+connected must NOT look like an empty Zoho account.
  assert.equal(
    resolveZohoOrgsView({ connected: true, fetchStatus: 'idle', organizations: [], errorMessage: null }).kind,
    'loading'
  );
  assert.equal(
    resolveZohoOrgsView({ connected: true, fetchStatus: 'loading', organizations: [], errorMessage: null }).kind,
    'loading'
  );

  assert.equal(
    resolveZohoOrgsView({
      connected: true,
      fetchStatus: 'error',
      organizations: [],
      errorMessage: 'Could not load Zoho organizations.',
    }).kind,
    'error'
  );

  const withObiren = resolveZohoOrgsView({
    connected: true,
    fetchStatus: 'ready',
    organizations: [{ organizationId: 'org-1', name: 'Acme Stays' }],
    errorMessage: null,
  });
  assert.equal(withObiren.kind, 'list');
  if (withObiren.kind === 'list') {
    assert.equal(withObiren.organizations[0]?.name, 'Acme Stays');
  }

  assert.equal(
    resolveZohoOrgsView({ connected: true, fetchStatus: 'ready', organizations: [], errorMessage: null }).kind,
    'empty'
  );

  const fromPayload = organizationsFromManagePayload({
    code: 0,
    message: 'success',
    connectionStatus: 'connected',
    organizations: [
      { organization_id: 'z-1', name: 'Acme Stays', currency_code: 'NGN' },
      { organizationId: 'z-2', name: 'Other', currencyCode: 'USD' },
      { name: 'Missing id should drop' },
    ],
  });
  assert.equal(fromPayload.length, 2);
  assert.equal(fromPayload[0]?.organizationId, 'z-1');
  assert.equal(fromPayload[0]?.name, 'Acme Stays');
  assert.equal(fromPayload[1]?.organizationId, 'z-2');

  assert.deepEqual(organizationsFromManagePayload({ organizations: null }), []);
  assert.deepEqual(organizationsFromManagePayload({}), []);

  console.log('PASS zoho orgs UI state — idle is loading, ready empty is empty, payload parse keeps named orgs');
}

run();
