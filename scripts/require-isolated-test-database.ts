/** Must run before any test imports a database client or sends external requests. */
export function requireIsolatedTestDatabase(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.SENA_TEST_DATABASE_URL;
  if (!raw) throw new Error('NOT TESTED - SAFETY BLOCK: set SENA_TEST_DATABASE_URL to a disposable local PostgreSQL database.');
  const productionRaw = env.SENA_PRODUCTION_DATABASE_URL || (env.DATABASE_URL && env.DATABASE_URL !== raw ? env.DATABASE_URL : undefined);
  if (!productionRaw) throw new Error('NOT TESTED - SAFETY BLOCK: set SENA_PRODUCTION_DATABASE_URL so the test runner can prove the test database differs from production.');

  const url = new URL(raw);
  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || !/^sena_(test|qa)(_|$)/.test(databaseName)) {
    throw new Error('NOT TESTED - SAFETY BLOCK: release tests require a local database named sena_test or sena_qa.');
  }
  if (databaseName === 'sena_prod' || databaseName.startsWith('sena_prod_')) {
    throw new Error('NOT TESTED - SAFETY BLOCK: destructive tests can never target sena_prod.');
  }

  const normalize = (value: string) => {
    const parsed = new URL(value);
    parsed.username = '';
    parsed.password = '';
    parsed.searchParams.sort();
    return parsed.toString();
  };
  if (normalize(raw) === normalize(productionRaw)) {
    throw new Error('NOT TESTED - SAFETY BLOCK: test and production database URLs are identical.');
  }
  if (env.PAYSTACK_SECRET_KEY?.startsWith('sk_live_')) throw new Error('NOT TESTED - SAFETY BLOCK: live payment credentials must not be present in release tests.');
  if (env.RESEND_API_KEY || env.SMTP_PASSWORD) throw new Error('NOT TESTED - SAFETY BLOCK: remove email delivery credentials before running synthetic tests.');
  if (env.REDIS_URL || env.S3_ACCESS_KEY_ID || env.S3_SECRET_ACCESS_KEY) throw new Error('NOT TESTED - SAFETY BLOCK: remove shared cache and storage credentials before synthetic tests.');
  env.DATABASE_URL = raw;
}
