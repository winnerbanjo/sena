import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { db, guests, activityLogs, eq, and } from '@sena/database';

export const dynamic = 'force-dynamic';

async function handleGET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const merchant = getMerchantRequest(req);
    const tenant = merchant?.tenant;
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await context.params;
    const [guest] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, id), eq(guests.propertyId, tenant.propertyId)))
      .limit(1);

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    return NextResponse.json({ guest });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const merchant = getMerchantRequest(req);
    const tenant = merchant?.tenant;
    if (!tenant?.propertyId) {
      return NextResponse.json({ error: 'Your account does not have access to this property.' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = merchant?.body || {};

    const [existing] = await db
      .select()
      .from(guests)
      .where(and(eq(guests.id, id), eq(guests.propertyId, tenant.propertyId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Guest not found in this property' }, { status: 404 });
    }

    const patch: Partial<typeof guests.$inferInsert> = {
      updatedAt: new Date(),
    };

    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

    if (body.fullName !== undefined) {
      const name = String(body.fullName || '').trim();
      if (!name) return NextResponse.json({ error: 'Guest name is required.' }, { status: 400 });
      if (name !== existing.fullName) {
        changes.push({ field: 'fullName', from: existing.fullName, to: name });
        patch.fullName = name;
      }
    }

    if (body.email !== undefined) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (email && email !== existing.email) {
        changes.push({ field: 'email', from: existing.email, to: email });
        patch.email = email;
      }
    }

    if (body.phone !== undefined) {
      const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
      if (phone && phone !== existing.phone) {
        changes.push({ field: 'phone', from: existing.phone, to: phone });
        patch.phone = phone;
      }
    }

    if (body.identificationType !== undefined) {
      const idType = typeof body.identificationType === 'string' ? body.identificationType.trim() : null;
      if (idType !== existing.identificationType) {
        changes.push({ field: 'identificationType', from: existing.identificationType, to: idType });
        patch.identificationType = idType;
      }
    }

    if (body.identificationNumber !== undefined) {
      const idNum = typeof body.identificationNumber === 'string' ? body.identificationNumber.trim() : null;
      if (idNum !== existing.identificationNumber) {
        changes.push({ field: 'identificationNumber', from: existing.identificationNumber, to: idNum });
        patch.identificationNumber = idNum;
      }
    }

    if (body.preferences !== undefined && Array.isArray(body.preferences)) {
      patch.preferences = body.preferences.map((p: unknown) => String(p).trim()).filter(Boolean);
      changes.push({ field: 'preferences', from: existing.preferences, to: patch.preferences });
    }

    if (body.notes !== undefined) {
      const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
      if (notes !== existing.notes) {
        changes.push({ field: 'notes', from: existing.notes, to: notes });
        patch.notes = notes;
      }
    }

    if (changes.length === 0) {
      return NextResponse.json({ guest: existing, message: 'No changes made.' });
    }

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(guests)
        .set(patch)
        .where(and(eq(guests.id, id), eq(guests.propertyId, tenant.propertyId)))
        .returning();

      await tx.insert(activityLogs).values({
        organizationId: tenant.property.organizationId,
        propertyId: tenant.propertyId,
        actorId: tenant.userId,
        actorName: tenant.user.fullName || 'Staff',
        action: 'guest.updated',
        resource: 'guest',
        resourceId: id,
        previousValue: Object.fromEntries(changes.map((c) => [c.field, c.from])),
        newValue: Object.fromEntries(changes.map((c) => [c.field, c.to])),
      });

      return [row];
    });

    return NextResponse.json({ success: true, guest: updated });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'guests');
export const PATCH = withMerchant(handlePATCH, 'guests');
