/**
 * Endpoint-level coverage for guest editing through the real PATCH/GET handlers.
 *
 *   SENA_TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/sena_test \
 *     TSX_TSCONFIG_PATH=apps/dashboard/tsconfig.json \
 *     pnpm exec tsx scripts/test-guest-edit-route.ts
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { requireIsolatedTestDatabase } from './require-isolated-test-database';

const testUrl = process.env.SENA_TEST_DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:55432/sena_test';
process.env.SENA_TEST_DATABASE_URL = testUrl;
process.env.SENA_PRODUCTION_DATABASE_URL ||= 'postgresql://production-placeholder.invalid/sena_prod';
requireIsolatedTestDatabase();
process.env.AUTH_SECRET ||= 'local-guest-edit-test-secret';
process.env.AUTH_TRUST_HOST ||= 'true';
process.env.SENA_TEST_ROUTE_AUTH = '1';
process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'production' : 'test';

const sql = postgres(testUrl, { max: 1, onnotice: () => {} });

const ORG = '00000000-0000-4000-8000-0000000000f0';
const USER_A = '00000000-0000-4000-8000-0000000000f1';
const USER_B = '00000000-0000-4000-8000-0000000000f2';
const PROP_A = '20000000-0000-4000-8000-0000000000f1';
const PROP_B = '20000000-0000-4000-8000-0000000000f2';
const GUEST_A = '22000000-0000-4000-8000-0000000000f1';
const GUEST_B = '22000000-0000-4000-8000-0000000000f2';

async function reset() {
  await sql`delete from organizations where id = ${ORG}::uuid`;
  await sql`delete from users where id in (${USER_A}::uuid, ${USER_B}::uuid)`;
}

async function seed() {
  await reset();
  await sql`insert into organizations (id, name, slug) values (${ORG}::uuid, 'Guest Edit Test', 'guest-edit-test')`;
  await sql`
    insert into users (id, email, full_name, is_active)
    values
      (${USER_A}::uuid, 'guest-edit-a@example.test', 'Guest Edit Owner A', true),
      (${USER_B}::uuid, 'guest-edit-b@example.test', 'Guest Edit Owner B', true)
  `;
  await sql`
    insert into properties (id, organization_id, name, slug, code, industry, property_type, address, phone, email)
    values
      (${PROP_A}::uuid, ${ORG}::uuid, 'Guest Edit Property A', 'guest-edit-a', 'GEA', 'hotel', 'hotel', '1 Test Way', '08000000001', 'a@example.test'),
      (${PROP_B}::uuid, ${ORG}::uuid, 'Guest Edit Property B', 'guest-edit-b', 'GEB', 'hotel', 'hotel', '2 Test Way', '08000000002', 'b@example.test')
  `;
  await sql`
    insert into property_members (property_id, user_id, role, permissions)
    values
      (${PROP_A}::uuid, ${USER_A}::uuid, 'owner', '[]'::jsonb),
      (${PROP_B}::uuid, ${USER_B}::uuid, 'owner', '[]'::jsonb)
  `;
  await sql`
    insert into guests (id, organization_id, property_id, full_name, email, phone)
    values
      (${GUEST_A}::uuid, ${ORG}::uuid, ${PROP_A}::uuid, 'Guest A', 'guest-a@example.test', '08010000001'),
      (${GUEST_B}::uuid, ${ORG}::uuid, ${PROP_B}::uuid, 'Guest B', 'guest-b@example.test', '08010000002')
  `;
}

async function main() {
  await seed();
  const { setMerchantSessionForTests } = await import('../apps/dashboard/src/lib/merchant-route');
  const guestRoute = await import('../apps/dashboard/src/app/api/guests/[id]/route');

  const session = {
    user: { id: USER_A, name: 'Guest Edit Owner A', email: 'guest-edit-a@example.test' },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  setMerchantSessionForTests(session);

  /** Minimal NextRequest stand-in: the handlers read url, method, headers and cookies. */
  function request(path: string, propertyId: string, method = 'GET', body: Record<string, unknown> = {}) {
    const url = new URL(`http://localhost${path}`);
    const headers = new Headers({ cookie: `sena_property_id=${propertyId}` });
    if (method !== 'GET') headers.set('content-type', 'application/json');
    return {
      url: url.toString(),
      method,
      nextUrl: url,
      headers,
      cookies: { get: (name: string) => (name === 'sena_property_id' ? { value: propertyId } : undefined) },
      clone() {
        return { json: async () => body };
      },
      async json() {
        return body;
      },
    };
  }

  const contextFor = (id: string) => ({ params: Promise.resolve({ id }) });

  async function getGuest(id: string, propertyId = PROP_A) {
    const response = await guestRoute.GET(request(`/api/guests/${id}`, propertyId) as never, contextFor(id));
    return { status: response.status, body: await response.json() };
  }

  async function patchGuest(id: string, body: Record<string, unknown>, propertyId = PROP_A) {
    const response = await guestRoute.PATCH(request(`/api/guests/${id}`, propertyId, 'PATCH', body) as never, contextFor(id));
    return { status: response.status, body: await response.json() };
  }

  try {
    const patch = {
      fullName: 'Updated Guest A',
      email: 'updated-guest-a@example.test',
      phone: '+2348098765432',
      identificationType: 'passport',
      identificationNumber: 'P12345678',
      notes: 'Updated from guest edit route test',
    };

    const updated = await patchGuest(GUEST_A, patch);
    assert.equal(updated.status, 200, 'valid guest edit must succeed');
    assert.equal(updated.body.guest.fullName, patch.fullName);

    const persisted = await getGuest(GUEST_A);
    assert.equal(persisted.status, 200);
    for (const [field, value] of Object.entries(patch)) {
      assert.equal(persisted.body.guest[field], value, `GET must return persisted guest ${field}`);
    }

    const blankName = await patchGuest(GUEST_A, { fullName: '   ' });
    assert.equal(blankName.status, 400, 'blank name must be rejected');
    const invalidEmail = await patchGuest(GUEST_A, { email: 'not-an-email' });
    assert.equal(invalidEmail.status, 400, 'invalid email must be rejected');

    const unchanged = await patchGuest(GUEST_A, patch);
    assert.equal(unchanged.status, 200);
    assert.equal(unchanged.body.message, 'No changes made.');

    const otherBefore = await sql`select full_name, email, phone, identification_number, notes from guests where id = ${GUEST_B}::uuid`;
    const crossProperty = await patchGuest(GUEST_B, { fullName: 'Tampered Tenant B Guest' });
    assert.equal(crossProperty.status, 404, 'other property guest must be invisible');
    const otherAfter = await sql`select full_name, email, phone, identification_number, notes from guests where id = ${GUEST_B}::uuid`;
    assert.deepEqual(otherAfter, otherBefore, 'foreign-property guest must remain unchanged');

    const activities = await sql`
      select action, resource_id from activity_logs
      where property_id = ${PROP_A}::uuid and action = 'guest.updated' and resource_id = ${GUEST_A}
    `;
    assert.equal(activities.length, 1, 'one guest.updated activity row is written for the successful edit');

    console.log('PASS guest edit route: persistence, validation, tenant isolation, no-op, and guest.updated audit');
  } finally {
    setMerchantSessionForTests(null);
    await reset();
    await sql.end();
  }
}

main().catch(async (error) => {
  console.error('FAIL guest edit route suite:', error);
  await sql.end();
  process.exitCode = 1;
});
