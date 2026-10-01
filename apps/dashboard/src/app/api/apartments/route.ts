import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { galleryDisplayUrls, type GalleryPhoto } from '@/lib/room-gallery';
import { deleteMediaFromSpaces } from '@sena/integrations';
import {
  classifyApartmentRemoval,
  deriveApartmentBoardStatus,
  removeApartment,
  roleMayEditApartmentInventory,
} from '@sena/inventory';
import { apartmentInputSchema } from '@sena/validation';
import { apartments, bookingHolds, db, housekeepingTasks, properties, reservations, roomImages, and, asc, eq } from '@sena/database';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BLOCKING = ['pending', 'confirmed', 'checked_in'] as const;

function blank(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function canEdit(role: string) {
  return roleMayEditApartmentInventory(role);
}

async function handleGET(req: NextRequest) {
  const merchant = getMerchantRequest(req);
  const propertyId = merchant?.tenant.propertyId;
  if (!propertyId) return NextResponse.json({ apartments: [], canEdit: false });

  const [property] = await db
    .select({ address: properties.address, timezone: properties.timezone })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: property?.timezone || 'Africa/Lagos' }).format(new Date());

  const now = new Date();
  const [rows, stays, galleryRows, holdRows, taskRows] = await Promise.all([
    db.select().from(apartments).where(eq(apartments.propertyId, propertyId)).orderBy(asc(apartments.name)),
    db
      .select({
        apartmentId: reservations.apartmentId,
        status: reservations.status,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .where(eq(reservations.propertyId, propertyId)),
    db.select().from(roomImages).where(eq(roomImages.propertyId, propertyId)).orderBy(asc(roomImages.sortOrder)),
    db
      .select({
        apartmentId: bookingHolds.apartmentId,
        status: bookingHolds.status,
        expiresAt: bookingHolds.expiresAt,
      })
      .from(bookingHolds)
      .where(eq(bookingHolds.propertyId, propertyId)),
    db
      .select({
        apartmentId: housekeepingTasks.apartmentId,
        status: housekeepingTasks.status,
      })
      .from(housekeepingTasks)
      .where(eq(housekeepingTasks.propertyId, propertyId)),
  ]);

  const photos = galleryRows.filter((row) => row.apartmentId);
  const list = rows.map((row) => {
    const ownStays = stays.filter((stay) => stay.apartmentId === row.id);
    const blockingStays = ownStays.filter((stay) => BLOCKING.includes(stay.status as (typeof BLOCKING)[number]));
    const coversToday = (stay: (typeof blockingStays)[number]) => stay.checkInDate <= today && today < stay.checkOutDate;
    const gallery = photos
      .filter((image) => image.apartmentId === row.id)
      .map((image): GalleryPhoto => ({ id: image.id, url: image.url, isCover: image.isCover, sortOrder: image.sortOrder }));
    const boardStatus = deriveApartmentBoardStatus({
      operationalStatus: row.operationalStatus,
      housekeepingStatus: row.housekeepingStatus,
      inHouse: blockingStays.some((stay) => stay.status === 'checked_in' && coversToday(stay)),
      reservedToday: blockingStays.some((stay) => stay.status === 'confirmed' && coversToday(stay)),
    });
    const removal = row.archivedAt
      ? { action: 'archived' as const }
      : classifyApartmentRemoval({
          today,
          now,
          operationalStatus: row.operationalStatus,
          housekeepingStatus: row.housekeepingStatus,
          reservations: ownStays.map((stay) => ({
            status: stay.status,
            checkInDate: stay.checkInDate,
            checkOutDate: stay.checkOutDate,
          })),
          holds: holdRows
            .filter((hold) => hold.apartmentId === row.id)
            .map((hold) => ({ status: hold.status, expiresAt: hold.expiresAt })),
          tasks: taskRows.filter((task) => task.apartmentId === row.id).map((task) => ({ status: task.status })),
          paymentCount: 0,
          invoiceCount: 0,
        });
    const location = row.usePropertyAddress
      ? property?.address || ''
      : [row.address, row.area, row.city, row.state, row.country].filter(Boolean).join(', ');
    return {
      ...row,
      gallery,
      coverUrl: galleryDisplayUrls(gallery)[0] || '',
      location,
      boardStatus,
      availability: row.archivedAt || (boardStatus !== 'available' && boardStatus !== 'needs_cleaning') ? 0 : 1,
      removal,
    };
  });

  return NextResponse.json({ apartments: list, canEdit: canEdit(merchant?.tenant.role || ''), propertyAddress: property?.address || '' });
}

async function handlePOST(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    const parsed = apartmentInputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the apartment details.' }, { status: 400 });
    }
    const input = parsed.data;
    const [created] = await db
      .insert(apartments)
      .values({
        propertyId,
        name: input.name.trim(),
        description: blank(input.description),
        apartmentType: input.apartmentType,
        apartmentTypeCustom: input.apartmentType === 'other' ? blank(input.apartmentTypeCustom) : null,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        bedConfiguration: input.bedConfiguration.trim(),
        maxGuests: input.maxGuests,
        basePriceMinorUnits: input.basePriceMinorUnits,
        amenities: input.amenities,
        usePropertyAddress: input.usePropertyAddress,
        address: input.usePropertyAddress ? null : blank(input.address),
        area: input.usePropertyAddress ? null : blank(input.area),
        city: input.usePropertyAddress ? null : blank(input.city),
        state: input.usePropertyAddress ? null : blank(input.state),
        country: input.usePropertyAddress ? null : blank(input.country),
        websiteVisibility: input.websiteVisibility,
        bookingVisibility: input.bookingVisibility,
        notes: blank(input.notes),
      })
      .returning();
    return NextResponse.json({ apartment: created });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'An apartment with this name already exists.' }, { status: 409 });
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    const body = await req.json();
    const apartmentId = String(body.apartmentId || '');
    const parsed = apartmentInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the apartment details.' }, { status: 400 });
    }
    const input = parsed.data;
    const [updated] = await db
      .update(apartments)
      .set({
        name: input.name.trim(),
        description: blank(input.description),
        apartmentType: input.apartmentType,
        apartmentTypeCustom: input.apartmentType === 'other' ? blank(input.apartmentTypeCustom) : null,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        bedConfiguration: input.bedConfiguration.trim(),
        maxGuests: input.maxGuests,
        basePriceMinorUnits: input.basePriceMinorUnits,
        amenities: input.amenities,
        usePropertyAddress: input.usePropertyAddress,
        address: input.usePropertyAddress ? null : blank(input.address),
        area: input.usePropertyAddress ? null : blank(input.area),
        city: input.usePropertyAddress ? null : blank(input.city),
        state: input.usePropertyAddress ? null : blank(input.state),
        country: input.usePropertyAddress ? null : blank(input.country),
        websiteVisibility: input.websiteVisibility,
        bookingVisibility: input.bookingVisibility,
        notes: blank(input.notes),
        updatedAt: new Date(),
      })
      .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
      .returning();
    if (!updated) return NextResponse.json({ error: 'That apartment could not be found for this property.' }, { status: 404 });
    return NextResponse.json({ apartment: updated });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'An apartment with this name already exists.' }, { status: 409 });
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    if (!canEdit(merchant?.tenant.role || '')) {
      return NextResponse.json({ error: 'Your role does not allow this action. Contact your property manager.' }, { status: 403 });
    }
    const apartmentId = req.nextUrl.searchParams.get('id') || '';
    const [property] = await db
      .select({ timezone: properties.timezone, organizationId: properties.organizationId })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: property?.timezone || 'Africa/Lagos' }).format(new Date());
    const confirmName = typeof merchant?.body.confirmName === 'string' ? merchant.body.confirmName : '';
    const result = await removeApartment({
      propertyId,
      apartmentId,
      organizationId: property?.organizationId || merchant.tenant.property.organizationId,
      actor: { id: merchant.tenant.userId, name: merchant.tenant.user.fullName || 'Staff' },
      today,
      confirmName,
      deleteOwnedMedia: async (storageKey) => {
        await deleteMediaFromSpaces(storageKey);
      },
    });
    if (result.outcome === 'not_found') {
      return NextResponse.json({ error: 'That apartment could not be found for this property.' }, { status: 404 });
    }
    if (result.outcome === 'blocked' || result.outcome === 'confirmation_required') {
      return NextResponse.json({ error: result.message, code: result.code, outcome: result.outcome }, { status: 409 });
    }
    return NextResponse.json({ outcome: result.outcome, apartmentId: result.apartmentId });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'apartments');
export const POST = withMerchant(handlePOST, 'apartments');
export const PATCH = withMerchant(handlePATCH, 'apartments');
export const DELETE = withMerchant(handleDELETE, 'apartments');
