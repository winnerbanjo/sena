/** Must run before any test imports a database client or sends external requests. */
export function requireIsolatedTestDatabase(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.SENA_TEST_DATABASE_URL;
  if (!raw) throw new Error('NOT TESTED - SAFETY BLOCK: set SENA_TEST_DATABASE_URL to a disposable local PostgreSQL database.');
  const url = new URL(raw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^\/sena_(test|qa)(_|$)/.test(url.pathname)) {
    throw new Error('NOT TESTED - SAFETY BLOCK: release tests require a local database named sena_test or sena_qa.');
  }
  if (env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_')) throw new Error('NOT TESTED - SAFETY BLOCK: live payment credentials must not be present in release tests.');
  if (env.RESEND_API_KEY || env.SMTP_PASSWORD) throw new Error('NOT TESTED - SAFETY BLOCK: remove email delivery credentials before running synthetic tests.');
  if (env.REDIS_URL || env.S3_ACCESS_KEY_ID || env.S3_SECRET_ACCESS_KEY) throw new Error('NOT TESTED - SAFETY BLOCK: remove shared cache and storage credentials before synthetic tests.');
  env.DATABASE_URL = raw;
}
