/**
 * Invoice read, edit, and payment.
 *
 * Point this at a disposable invoice with a large outstanding balance: each
 * iteration records a real payment and will eventually settle it. Payments use
 * a unique idempotency key per iteration so retries cannot double-charge.
 *
 * Required env: BASE_URL, LOAD_TEST_FORBIDDEN_HOST_PATTERN,
 *               LOAD_TEST_SESSION_COOKIE, LOAD_TEST_PROPERTY_ID,
 *               LOAD_TEST_INVOICE_ID
 * Optional:     LOAD_TEST_PAYMENT_AMOUNT_MINOR_UNITS (default 100),
 *               LOAD_TEST_VUS, LOAD_TEST_DURATION, LOAD_TEST_P95_MS,
 *               LOAD_TEST_P99_MS, LOAD_TEST_ERROR_RATE
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { dashboardHeaders, loadConfig, uniqueKey } from './lib/env.js';

const config = loadConfig();

const cookie = (__ENV.LOAD_TEST_SESSION_COOKIE || '').trim();
const propertyId = (__ENV.LOAD_TEST_PROPERTY_ID || '').trim();
const invoiceId = (__ENV.LOAD_TEST_INVOICE_ID || '').trim();
const paymentAmount = Number((__ENV.LOAD_TEST_PAYMENT_AMOUNT_MINOR_UNITS || '100').trim());
if (!cookie) throw new Error('LOAD_TEST_SESSION_COOKIE is required. See load-tests/README.md.');
if (!propertyId) throw new Error('LOAD_TEST_PROPERTY_ID is required. See load-tests/README.md.');
if (!invoiceId) throw new Error('LOAD_TEST_INVOICE_ID is required. See load-tests/README.md.');
if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0) {
  throw new Error('LOAD_TEST_PAYMENT_AMOUNT_MINOR_UNITS must be a positive integer.');
}

const headers = { ...dashboardHeaders(propertyId), Accept: 'application/json' };

export const options = {
  scenarios: {
    invoice_flow: {
      executor: 'constant-vus',
      vus: config.vus,
      duration: config.duration,
    },
  },
  thresholds: config.thresholds,
};

export default function () {
  const invoicePath = `${config.baseUrl}/api/invoices/${invoiceId}`;

  const read = http.get(invoicePath, { headers, tags: { endpoint: 'invoice_read' } });
  check(read, { 'invoice read is 200': (r) => r.status === 200 });

  const edit = http.patch(
    invoicePath,
    JSON.stringify({ notes: `load-test ${__VU}-${__ITER}-${Date.now()}` }),
    { headers, tags: { endpoint: 'invoice_edit' } }
  );
  check(edit, { 'invoice edit is 200': (r) => r.status === 200 });

  const payment = http.post(
    `${invoicePath}/payments`,
    JSON.stringify({ amountMinorUnits: paymentAmount, method: 'cash' }),
    {
      headers: { ...headers, 'Idempotency-Key': uniqueKey('load-payment') },
      tags: { endpoint: 'invoice_payment' },
    }
  );
  // A settled invoice returns a 4xx; that is an expected end state for a
  // disposable invoice, not a transport failure.
  check(payment, { 'invoice payment is accepted or invoice settled': (r) => r.status === 200 || r.status === 409 || r.status === 422 });
  sleep(0.2);
}
