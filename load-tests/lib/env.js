/**
 * Shared configuration for the k6 load tests.
 *
 * Everything that identifies an environment or a load target comes from the
 * environment. Nothing here defaults to a real host, account, or credential.
 */

export function required(name) {
  const value = (__ENV[name] || '').trim();
  if (!value) throw new Error(`${name} is required. See load-tests/README.md.`);
  return value;
}

export function optional(name, fallback) {
  const value = (__ENV[name] || '').trim();
  return value || fallback;
}

function numberFromEnv(name, fallback) {
  const raw = optional(name, String(fallback));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number.`);
  return parsed;
}

/**
 * Refuses to run unless a deny pattern is configured and does not match the
 * target. This is deliberately fail-closed: a missing pattern is an error, not
 * permission to hit whatever BASE_URL happens to be set to.
 */
export function loadConfig() {
  const baseUrl = required('BASE_URL').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) throw new Error('BASE_URL must start with http:// or https://.');

  const forbiddenPattern = required('LOAD_TEST_FORBIDDEN_HOST_PATTERN');
  let forbidden;
  try {
    forbidden = new RegExp(forbiddenPattern, 'i');
  } catch (error) {
    throw new Error(`LOAD_TEST_FORBIDDEN_HOST_PATTERN is not a valid regular expression: ${error.message}`);
  }
  if (forbidden.test(baseUrl)) {
    throw new Error('Refusing to run: BASE_URL matches LOAD_TEST_FORBIDDEN_HOST_PATTERN. Point the load test at a disposable environment.');
  }

  const p95 = numberFromEnv('LOAD_TEST_P95_MS', 1000);
  const p99 = numberFromEnv('LOAD_TEST_P99_MS', 2500);
  const errorRate = numberFromEnv('LOAD_TEST_ERROR_RATE', 0.01);
  if (p99 < p95) throw new Error('LOAD_TEST_P99_MS must be greater than or equal to LOAD_TEST_P95_MS.');

  return {
    baseUrl,
    p95,
    p99,
    errorRate,
    vus: numberFromEnv('LOAD_TEST_VUS', 10),
    duration: optional('LOAD_TEST_DURATION', '1m'),
    thresholds: {
      http_req_duration: [`p(95)<${p95}`, `p(99)<${p99}`],
      http_req_failed: [`rate<${errorRate}`],
    },
  };
}

/** Bearer credentials for the public /api/v1 surface. */
export function apiKeyHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Dashboard requests need the NextAuth session cookie and the active property
 * cookie. Supply the Cookie header exactly as captured from a disposable
 * environment's browser session; do not commit it.
 */
export function dashboardHeaders(propertyId) {
  const cookie = required('LOAD_TEST_SESSION_COOKIE');
  const propertyCookie = /(?:^|;\s*)sena_property_id=/.test(cookie) ? cookie : `${cookie}; sena_property_id=${propertyId}`;
  return {
    Cookie: propertyCookie,
    'Content-Type': 'application/json',
  };
}

export function propertyId() {
  return required('LOAD_TEST_PROPERTY_ID');
}

export function uniqueKey(prefix) {
  return `${prefix}-${__VU}-${__ITER}-${Date.now()}`;
}
