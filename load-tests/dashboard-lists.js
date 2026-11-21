/**
 * Dashboard list reads: reservations, invoices, payments, guests, front desk.
 *
 * Required env: BASE_URL, LOAD_TEST_FORBIDDEN_HOST_PATTERN,
 *               LOAD_TEST_SESSION_COOKIE, LOAD_TEST_PROPERTY_ID
 * Optional:     LOAD_TEST_VUS, LOAD_TEST_DURATION, LOAD_TEST_P95_MS,
 *               LOAD_TEST_P99_MS, LOAD_TEST_ERROR_RATE
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { dashboardHeaders, loadConfig } from './lib/env.js';

const config = loadConfig();

const cookie = (__ENV.LOAD_TEST_SESSION_COOKIE || '').trim();
const propertyId = (__ENV.LOAD_TEST_PROPERTY_ID || '').trim();
if (!cookie) throw new Error('LOAD_TEST_SESSION_COOKIE is required. See load-tests/README.md.');
if (!propertyId) throw new Error('LOAD_TEST_PROPERTY_ID is required. See load-tests/README.md.');

const headers = { ...dashboardHeaders(propertyId), Accept: 'application/json' };

const endpoints = [
  '/api/reservations?limit=25',
  '/api/invoices?limit=25',
  '/api/payments?limit=25',
  '/api/guests?limit=25',
  '/api/front-desk',
];

export const options = {
  scenarios: {
    lists: {
      executor: 'constant-vus',
      vus: config.vus,
      duration: config.duration,
    },
  },
  thresholds: config.thresholds,
};

export default function () {
  const path = endpoints[__ITER % endpoints.length];
  const response = http.get(`${config.baseUrl}${path}`, { headers, tags: { endpoint: path.split('?')[0] } });
  check(response, {
    'list request is 200': (r) => r.status === 200,
    'list response is JSON': (r) => String(r.headers['Content-Type'] || '').includes('application/json'),
  });
  sleep(0.2);
}
