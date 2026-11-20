import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export * from './safety-guard';
export * from 'drizzle-orm';

/**
 * Sena PostgreSQL Connection with Connection Pooling
 * Compatible with Vercel serverless / Fluid Compute & DigitalOcean managed PostgreSQL
 */
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sena';

// Pool configuration is per process/instance. Keep these defaults stable unless
// a deployment explicitly sets the corresponding DB_* variable.
function positiveIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

const poolMax = positiveIntegerEnv('DB_POOL_MAX', 10);
const poolIdleTimeout = positiveIntegerEnv('DB_IDLE_TIMEOUT', 20);
const poolConnectTimeout = positiveIntegerEnv('DB_CONNECT_TIMEOUT', 10);
const prepareStatements = booleanEnv('DB_PREPARE', false);

// For queries that use connection pooling
const isRemoteDb =
  connectionString.includes('ondigitalocean.com') ||
  connectionString.includes('sslmode=require');

if (process.env.NODE_ENV !== 'production' && isRemoteDb) {
  console.warn(
    '⚠️ [SENA DB WARNING] Development process is connected to a remote database host. Use a local PostgreSQL instance for development.'
  );
}

const client = postgres(connectionString, {
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
  max: poolMax,
  idle_timeout: poolIdleTimeout,
  connect_timeout: poolConnectTimeout,
  prepare: prepareStatements, // Disable for transaction-mode poolers such as PgBouncer
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
