import { db, sql } from '@sena/database';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function measure(query: ReturnType<typeof sql>) {
  const startedAt = performance.now();
  await db.execute(query);
  return Number((performance.now() - startedAt).toFixed(2));
}

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const coldMs = await measure(sql`select 1`);
  const warmMs = [];
  for (let index = 0; index < 10; index += 1) {
    warmMs.push(await measure(sql`select 1`));
  }

  const representativeReads = {
    propertyMs: await measure(sql`select 1 from properties limit 1`),
    membershipMs: await measure(sql`select 1 from property_members limit 1`),
    roomsMs: await measure(sql`select 1 from rooms limit 1`),
    reservationsMs: await measure(sql`select 1 from reservations limit 1`),
  };

  return NextResponse.json({
    region: process.env.VERCEL_REGION || 'unknown',
    coldMs,
    warmMs,
    representativeReads,
    roundTrips: 15,
  });
}
