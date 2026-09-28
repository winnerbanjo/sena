import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { db, properties, eq } from '@sena/database';
import { PaymentService } from '@sena/payments';
import { z } from 'zod';

const settingsSchema = z.object({
  name: z.string().trim().min(2, 'Enter your property name.').max(255).optional(),
  propertyType: z.string().trim().min(1).max(50).optional(),
  address: z.string().trim().max(2000).optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').or(z.literal('')).optional(),
  phone: z.string().trim().max(50).optional(),
  country: z.string().trim().min(1).max(100).optional(),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Choose a valid timezone.').optional(),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid check-in time.').optional(),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid check-out time.').optional(),
  checkInPaymentPolicy: z.enum(['require_full', 'allow_outstanding']).optional(),
  checkOutPaymentPolicy: z.enum(['require_settlement', 'allow_outstanding']).optional(),
  directBookingPayAtProperty: z.boolean().optional(),
  directBookingBankTransfer: z.boolean().optional(),
});

async function handleGET(req: NextRequest) {
  const tenant = await resolveTenantForRequest(await auth(), req);
  if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const bankAccounts = await PaymentService.listBankAccounts(tenant.propertyId);
  return NextResponse.json({
    property: tenant.property,
    bankAccounts,
    paymentPolicies: {
      checkInPaymentPolicy: tenant.property.checkInPaymentPolicy || 'allow_outstanding',
      checkOutPaymentPolicy: tenant.property.checkOutPaymentPolicy || 'allow_outstanding',
      directBookingPayAtProperty: tenant.property.directBookingPayAtProperty !== false,
      directBookingBankTransfer: tenant.property.directBookingBankTransfer !== false,
    },
  });
}

async function handlePATCH(req: NextRequest) {
  const tenant = await resolveTenantForRequest(await auth(), req);
  if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Check the highlighted fields.', fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  const [property] = await db.update(properties).set({ ...parsed.data, updatedAt: new Date() }).where(eq(properties.id, tenant.propertyId)).returning();
  return NextResponse.json({ property });
}
export const GET = withMerchant(handleGET, 'settings');
export const PATCH = withMerchant(handlePATCH, 'settings');
