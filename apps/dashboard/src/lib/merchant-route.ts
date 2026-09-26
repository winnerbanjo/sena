import { ROLE_PERMISSIONS } from '@sena/config';
import type { Role, Permission } from '@sena/types';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from './tenant';
import { db, reservations, rooms, roomTypes, guests, propertyInvoices, reviews, apiKeys, webhookEndpoints, housekeepingTasks, propertyMembers, eq, and } from '@sena/database';

type Handler = (req: NextRequest, context: any) => Promise<Response>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tables = { reservationId: reservations, roomId: rooms, roomTypeId: roomTypes, guestId: guests, invoiceId: propertyInvoices, reviewId: reviews, keyId: apiKeys, webhookId: webhookEndpoints, taskId: housekeepingTasks, memberId: propertyMembers };

/** A common boundary for merchant APIs. Public booking and signed webhooks are separate. */
export function withMerchant(handler: Handler, scope: string): Handler {
  return async (req, context) => {
    try {
      const session = await auth();
      if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401 });
      const tenant = await resolveTenantForRequest(session, req);
      if (!tenant) return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
      const aliases: Record<string, Role> = { 'general manager': 'manager', 'property manager': 'manager', 'front desk lead': 'front_desk', 'front desk': 'front_desk', 'front desk agent': 'front_desk', receptionist: 'front_desk', staff: 'front_desk', housekeeper: 'housekeeping', 'housekeeping lead': 'housekeeping', 'housekeeping supervisor': 'housekeeping', 'room attendant': 'housekeeping', finance: 'accountant' };
      const rawRole = tenant.role.trim().toLowerCase();
      const role = aliases[rawRole] || rawRole as Role;
      const permissions = ROLE_PERMISSIONS[role] || [];
      const read = req.method === 'GET';
      const required: Record<string, Permission> = { settings: 'room.edit', calendar: 'reservation.read', reservations: read ? 'reservation.read' : 'reservation.create', guests: read ? 'guest.read' : 'guest.edit', rooms: read ? 'room.read' : 'room.edit', housekeeping: 'housekeeping.update', payments: read ? 'payment.read' : 'payment.record', invoices: read ? 'payment.read' : 'payment.record', staff: 'staff.invite', subscription: 'billing.manage', website: 'website.edit', reviews: 'website.edit', upload: 'website.edit', connect: 'billing.manage' };
      if (!required[scope] || !permissions.includes(required[scope])) return NextResponse.json({ error: 'Your role does not allow this action. Contact your property manager.' }, { status: 403 });

      let body: Record<string, unknown> = {};
      if (req.headers.get('content-type')?.includes('application/json') && !['GET', 'HEAD'].includes(req.method)) {
        try { body = await req.clone().json(); } catch { return NextResponse.json({ error: 'Please check the information and try again.' }, { status: 400 }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Please check the information and try again.' }, { status: 400 });
      }
      if (body.propertyId && body.propertyId !== tenant.propertyId) return NextResponse.json({ error: 'This item is not available in your property.' }, { status: 404 });
      const references: Record<string, unknown> = { ...body };
      const params = context?.params ? await context.params : {};
      const id = params.id || req.nextUrl.searchParams.get('id') || body.id;
      if (id) {
        const key = scope === 'reservations' ? 'reservationId' : scope === 'invoices' ? 'invoiceId' : scope === 'reviews' ? 'reviewId'
          : scope === 'rooms' ? (req.nextUrl.searchParams.get('type') === 'category' ? 'roomTypeId' : 'roomId')
          : req.nextUrl.pathname.includes('/keys') ? 'keyId' : req.nextUrl.pathname.includes('/webhooks') ? 'webhookId' : undefined;
        if (key) references[key] = id;
      }
      for (const [key, table] of Object.entries(tables)) {
        const value = references[key];
        if (value === undefined || value === null || value === '') continue;
        if (typeof value !== 'string' || !uuid.test(value)) return NextResponse.json({ error: 'Please select a valid item.' }, { status: 400 });
        const [record] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, value), eq(table.propertyId, tenant.propertyId))).limit(1);
        if (!record) return NextResponse.json({ error: 'This item is not available in your property.' }, { status: 404 });
      }
      const response = await handler(req, context);
      if (response.status >= 500) return NextResponse.json({ error: 'We could not complete this request. Please try again.' }, { status: response.status });
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    } catch {
      return NextResponse.json({ error: 'We could not complete this request. Please try again.' }, { status: 500 });
    }
  };
}
