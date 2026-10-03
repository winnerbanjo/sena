/**
 * SENA DATABASE SAFETY GUARD
 *
 * Prevents accidental connection to or mutation of production/remote databases during local development.
 */

export function isLocalDatabaseHost(host: string): boolean {
  const normalized = host.toLowerCase().trim();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized.endsWith('.localhost')
  );
}

export function assertLocalDatabase(
  connectionString: string,
  operationName: string = 'database operation'
): { host: string; database: string } {
  if (!connectionString) {
    throw new Error(`[SENA DB SAFETY GUARD FATAL] No connection string provided for ${operationName}.`);
  }

  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    const database = url.pathname.replace(/^\//, '');

    if (!isLocalDatabaseHost(host)) {
      throw new Error(
        `[SENA DB SAFETY GUARD FATAL] Refusing to execute ${operationName} against non-local database host '${host}'. ` +
          `Local development and seed/reset operations MUST only target '127.0.0.1' or 'localhost'.`
      );
    }

    if (host.includes('ondigitalocean.com') || database.toLowerCase().includes('prod')) {
      throw new Error(
        `[SENA DB SAFETY GUARD FATAL] Refusing to execute ${operationName} against detected production database ('${host}/${database}').`
      );
    }

    return { host, database };
  } catch (err: any) {
    if (err.message.includes('SENA DB SAFETY GUARD FATAL')) {
      throw err;
    }
    throw new Error(
      `[SENA DB SAFETY GUARD FATAL] Invalid database URL: ${err.message}`
    );
  }
}
