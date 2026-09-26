import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveTenantForRequest } from '@/lib/tenant';
import { withMerchant } from '@/lib/merchant-route';
import { db, properties, eq } from '@sena/database';
import { z } from 'zod';

const settingsSchema = z.object({
  name: z.string().trim().min(2, 'Enter your property name.').max(255),
  propertyType: z.string().trim().min(1).max(50),
  address: z.string().trim().max(2000),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').or(z.literal('')),
  phone: z.string().trim().max(50),
  country: z.string().trim().min(1).max(100),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Choose a valid timezone.'),
  checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid check-in time.'),
  checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid check-out time.'),
});
async function handlePATCH(req: NextRequest) {
  const tenant = await resolveTenantForRequest(await auth(), req);
  if (!tenant) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const parsed = settingsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Check the highlighted fields.', fields: parsed.error.flatten().fieldErrors }, { status: 422 });
  const [property] = await db.update(properties).set({ ...parsed.data, updatedAt: new Date() }).where(eq(properties.id, tenant.propertyId)).returning();
  return NextResponse.json({ property });
}
export const PATCH = withMerchant(handlePATCH, 'settings');
