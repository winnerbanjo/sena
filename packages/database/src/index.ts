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
  max: process.env.DB_MAX_CONNECTIONS ? Number(process.env.DB_MAX_CONNECTIONS) : 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false, // Required for transaction connection poolers like PgBouncer
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
