/**
 * Availability + reservation creation against the public API.
 *
 * The target room type should have deliberately small inventory so the create
 * leg exercises contention. Every request uses a unique idempotency key, so a
 * successful create is counted once and a sold-out response is an expected
 * outcome rather than a test failure.
 *
 * Required env: BASE_URL, LOAD_TEST_FORBIDDEN_HOST_PATTERN, LOAD_TEST_API_KEY,
 *               LOAD_TEST_PROPERTY_ID, LOAD_TEST_ROOM_TYPE_ID
 * Optional:     LOAD_TEST_CHECK_IN, LOAD_TEST_CHECK_OUT, LOAD_TEST_VUS,
 *               LOAD_TEST_DURATION, LOAD_TEST_P95_MS, LOAD_TEST_P99_MS,
 *               LOAD_TEST_ERROR_RATE
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { apiKeyHeaders, loadConfig, optional, required, uniqueKey } from './lib/env.js';

const config = loadConfig();
const apiKey = required('LOAD_TEST_API_KEY');
const propertyId = required('LOAD_TEST_PROPERTY_ID');
const roomTypeId = required('LOAD_TEST_ROOM_TYPE_ID');
const checkIn = optional('LOAD_TEST_CHECK_IN', '2035-06-01');
const checkOut = optional('LOAD_TEST_CHECK_OUT', '2035-06-03');

const createsAccepted = new Counter('reservation_creates_accepted');
const createsSoldOut = new Counter('reservation_creates_sold_out');
const unexpectedCreateFailure = new Rate('reservation_create_unexpected_failure');

export const options = {
  scenarios: {
    availability: {
      executor: 'constant-vus',
      exec: 'availability',
      vus: Math.max(1, Math.floor(config.vus / 2)),
      duration: config.duration,
    },
    create: {
      executor: 'constant-vus',
      exec: 'create',
      vus: Math.max(1, Math.ceil(config.vus / 2)),
      duration: config.duration,
    },
  },
  thresholds: {
    ...config.thresholds,
    reservation_create_unexpected_failure: [`rate<${config.errorRate}`],
  },
};

export function availability() {
  const url = `${config.baseUrl}/api/v1/properties/${propertyId}/availability?check_in=${checkIn}&check_out=${checkOut}`;
  const response = http.get(url, { headers: apiKeyHeaders(apiKey), tags: { endpoint: 'availability' } });
  check(response, {
    'availability is 200': (r) => r.status === 200,
    'availability body has room types': (r) => {
      try {
        return Array.isArray(r.json('data.room_types'));
      } catch {
        return false;
      }
    },
  });
  sleep(0.2);
}

export function create() {
  const body = {
    property_id: propertyId,
    room_type_id: roomTypeId,
    check_in: checkIn,
    check_out: checkOut,
    num_guests: 1,
    source: 'api',
    guest: {
      name: `Load Test ${__VU}-${__ITER}`,
      email: `load-${__VU}-${__ITER}@example.invalid`,
      phone: '+2348000000000',
    },
  };
  const response = http.post(`${config.baseUrl}/api/v1/reservations`, JSON.stringify(body), {
    headers: { ...apiKeyHeaders(apiKey), 'Idempotency-Key': uniqueKey('load-create') },
    tags: { endpoint: 'reservation_create' },
  });

  if (response.status === 201) {
    createsAccepted.add(1);
  } else if (response.status === 409) {
    createsSoldOut.add(1);
  } else {
    unexpectedCreateFailure.add(true);
  }

  check(response, {
    'create is accepted or cleanly sold out': (r) => r.status === 201 || r.status === 409,
  });
  sleep(0.2);
}
