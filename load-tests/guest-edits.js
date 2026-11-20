/**
 * Guest detail reads and edits. Use a disposable guest; each iteration writes a
 * unique note so the no-op path is not measured by accident.
 *
 * Required env: BASE_URL, LOAD_TEST_FORBIDDEN_HOST_PATTERN,
 *               LOAD_TEST_SESSION_COOKIE, LOAD_TEST_PROPERTY_ID,
 *               LOAD_TEST_GUEST_ID
 * Optional:     LOAD_TEST_VUS, LOAD_TEST_DURATION, LOAD_TEST_P95_MS,
 *               LOAD_TEST_P99_MS, LOAD_TEST_ERROR_RATE
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { dashboardHeaders, loadConfig } from './lib/env.js';

const config = loadConfig();

const cookie = (__ENV.LOAD_TEST_SESSION_COOKIE || '').trim();
const propertyId = (__ENV.LOAD_TEST_PROPERTY_ID || '').trim();
const guestId = (__ENV.LOAD_TEST_GUEST_ID || '').trim();
if (!cookie) throw new Error('LOAD_TEST_SESSION_COOKIE is required. See load-tests/README.md.');
if (!propertyId) throw new Error('LOAD_TEST_PROPERTY_ID is required. See load-tests/README.md.');
if (!guestId) throw new Error('LOAD_TEST_GUEST_ID is required. See load-tests/README.md.');

const headers = { ...dashboardHeaders(propertyId), Accept: 'application/json' };

export const options = {
  scenarios: {
    guest_edits: {
      executor: 'constant-vus',
      vus: config.vus,
      duration: config.duration,
    },
  },
  thresholds: config.thresholds,
};

export default function () {
  const path = `${config.baseUrl}/api/guests/${guestId}`;
  const read = http.get(path, { headers, tags: { endpoint: 'guest_detail' } });
  check(read, { 'guest read is 200': (r) => r.status === 200 });

  const patch = http.patch(path, JSON.stringify({ notes: `load-test ${__VU}-${__ITER}-${Date.now()}` }), {
    headers,
    tags: { endpoint: 'guest_patch' },
  });
  check(patch, { 'guest patch is 200': (r) => r.status === 200 });
  sleep(0.2);
}
