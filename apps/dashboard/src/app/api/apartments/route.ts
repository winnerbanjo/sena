import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import { galleryDisplayUrls, type GalleryPhoto } from '@/lib/room-gallery';
import { deriveApartmentBoardStatus } from '@sena/inventory';
import { apartmentInputSchema } from '@sena/validation';
import { apartments, db, properties, reservations, roomImages, and, asc, eq, inArray } from '@sena/database';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BLOCKING = ['pending', 'confirmed', 'checked_in'] as const;

function blank(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function canEdit(role: string) {
  const normalized = role.trim().toLowerCase();
  return ['owner', 'manager', 'general manager', 'property manager'].includes(normalized);
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

  const [rows, stays, galleryRows] = await Promise.all([
    db.select().from(apartments).where(eq(apartments.propertyId, propertyId)).orderBy(asc(apartments.name)),
    db
      .select({
        apartmentId: reservations.apartmentId,
        status: reservations.status,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .where(and(eq(reservations.propertyId, propertyId), inArray(reservations.status, [...BLOCKING]))),
    db.select().from(roomImages).where(eq(roomImages.propertyId, propertyId)).orderBy(asc(roomImages.sortOrder)),
  ]);

  const photos = galleryRows.filter((row) => row.apartmentId);
  const list = rows.map((row) => {
    const ownStays = stays.filter((stay) => stay.apartmentId === row.id);
    const coversToday = (stay: (typeof ownStays)[number]) => stay.checkInDate <= today && today < stay.checkOutDate;
    const gallery = photos
      .filter((image) => image.apartmentId === row.id)
      .map((image): GalleryPhoto => ({ id: image.id, url: image.url, isCover: image.isCover, sortOrder: image.sortOrder }));
    const boardStatus = deriveApartmentBoardStatus({
      operationalStatus: row.operationalStatus,
      housekeepingStatus: row.housekeepingStatus,
      inHouse: ownStays.some((stay) => stay.status === 'checked_in' && coversToday(stay)),
      reservedToday: ownStays.some((stay) => stay.status === 'confirmed' && coversToday(stay)),
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
      availability: boardStatus === 'available' || boardStatus === 'needs_cleaning' ? 1 : 0,
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
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    const apartmentId = req.nextUrl.searchParams.get('id') || '';
    const [stay] = await db
      .select({ id: reservations.id })
      .from(reservations)
      .where(and(eq(reservations.apartmentId, apartmentId), eq(reservations.propertyId, propertyId)))
      .limit(1);
    if (stay) return NextResponse.json({ error: 'This apartment has reservation history and cannot be deleted.' }, { status: 409 });
    const [removed] = await db
      .delete(apartments)
      .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
      .returning({ id: apartments.id });
    if (!removed) return NextResponse.json({ error: 'That apartment could not be found for this property.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: apiError(error) }, { status: 400 });
  }
}

export const GET = withMerchant(handleGET, 'apartments');
export const POST = withMerchant(handlePOST, 'apartments');
export const PATCH = withMerchant(handlePATCH, 'apartments');
export const DELETE = withMerchant(handleDELETE, 'apartments');
