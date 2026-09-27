import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, operationalNotifications } from '@sena/database';
import { withMerchant } from '@/lib/merchant-route';
import { resolveTenantForRequest } from '@/lib/tenant';

async function handleGET(req: NextRequest) {
  const session = await auth();
  const tenant = await resolveTenantForRequest(session, req);
  if (!tenant?.propertyId) return NextResponse.json({ notifications: [], unread: 0 });
  const rows = await db.select().from(operationalNotifications).where(eq(operationalNotifications.propertyId, tenant.propertyId)).orderBy(desc(operationalNotifications.createdAt)).limit(20);
  return NextResponse.json({
    unread: rows.filter((row) => !row.readAt).length,
    notifications: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.body,
      time: row.createdAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
      unread: !row.readAt,
      type: row.kind === 'invoice' ? 'payment' : 'payment',
      href: row.href || '/payments',
    })),
  });
}

async function handlePATCH(req: NextRequest) {
  const session = await auth();
  const tenant = await resolveTenantForRequest(session, req);
  if (!tenant?.propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.all) {
    await db.update(operationalNotifications).set({ readAt: new Date() }).where(and(eq(operationalNotifications.propertyId, tenant.propertyId), isNull(operationalNotifications.readAt)));
  } else if (typeof body.id === 'string') {
    await db.update(operationalNotifications).set({ readAt: new Date() }).where(and(eq(operationalNotifications.id, body.id), eq(operationalNotifications.propertyId, tenant.propertyId)));
  }
  return NextResponse.json({ success: true });
}

export const GET = withMerchant(handleGET, 'payments');
export const PATCH = withMerchant(handlePATCH, 'payments');
