import assert from 'node:assert/strict';

async function run() {
  const accounting = await import('../apps/dashboard/src/lib/integrations/accounting/adapters');

  assert.equal(accounting.quickbooksAdapter.availability, 'coming_soon');
  assert.equal(accounting.xeroAdapter.availability, 'coming_soon');
  assert.equal(accounting.zohoBooksAdapter.availability, 'coming_soon');
  await assert.rejects(accounting.quickbooksAdapter.upsertContact({} as any, {} as any), /COMING_SOON/);
  await assert.rejects(accounting.xeroAdapter.upsertInvoice({} as any, {} as any), /COMING_SOON/);
  await assert.rejects(accounting.zohoBooksAdapter.authenticate!({} as any), /COMING_SOON/);

  for (const provider of ['quickbooks', 'xero', 'zoho_books'] as const) {
    const state = accounting.accountingMarketplaceState(provider);
    assert.equal(state?.availability, 'coming_soon');
    assert.equal(state?.connectionStatus, 'coming_soon');
    assert.equal(state?.canConnect, false);
  }

  const channex = accounting.accountingMarketplaceState('channex');
  assert.equal(channex, null);
  console.log('PASS accounting adapters are Coming Soon (never fake connected)');
  console.log('ACCOUNTING ADAPTERS TESTS: PASS');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
