/**
 * Seed a disposable local database for the pre-merge browser verification.
 * This script truncates application tables. It refuses non-local hosts.
 */
import { assertLocalDatabase } from '../packages/database/src/safety-guard';

assertLocalDatabase(process.env.DATABASE_URL || '', 'browser verification seed');

import {
  db, sql, organizations, properties, users, propertyMembers, roomTypes, rooms,
  apartments, guests, reservations, propertyInvoices, payments,
} from '../packages/database/src/index';

const PASSWORD_HASH = '$2b$10$INq1jJrpOq0k41rXvEoTbO8JT9NF4vipfD9c0YvFrmx.FIzB0TV2W';
const PASSWORD = 'Local-QA-Pass-2026!';

async function main() {
const tables = await db.execute(sql`
  select tablename from pg_tables where schemaname = 'public' order by tablename
`);
const names = (tables as unknown as Array<{ tablename: string }>).map((row) => `"public"."${row.tablename}"`);
if (names.length > 0) {
  await db.execute(sql.raw(`truncate table ${names.join(', ')} restart identity cascade`));
}

async function seedProperty(input: {
  orgName: string;
  orgSlug: string;
  propertyName: string;
  propertySlug: string;
  code: string;
  email: string;
  roomName: string;
  apartmentName: string;
  guestCount: number;
  invoiceCount: number;
}) {
  const [org] = await db.insert(organizations).values({ name: input.orgName, slug: input.orgSlug }).returning();
  const [property] = await db.insert(properties).values({
    organizationId: org.id,
    name: input.propertyName,
    slug: input.propertySlug,
    code: input.code,
    propertyType: 'boutique_hotel',
    country: 'Nigeria',
    address: '1 Local Verification Way, Lagos',
    phone: '+234 800 000 0000',
    email: input.email,
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    checkInPaymentPolicy: 'allow_outstanding',
    checkOutPaymentPolicy: 'require_full_payment',
    industry: 'hotel',
  }).returning();

  const [user] = await db.insert(users).values({
    email: input.email,
    fullName: `${input.propertyName} Owner`,
    passwordHash: PASSWORD_HASH,
    isActive: true,
    emailVerified: new Date(),
    locale: 'en',
  }).returning();
  await db.insert(propertyMembers).values({
    propertyId: property.id,
    userId: user.id,
    role: 'owner',
    permissions: ['status:active', 'all:manage'],
  });

  const [roomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: input.roomName,
    bedType: 'King Bed',
    capacity: 2,
    description: 'Local verification room category.',
    basePriceMinorUnits: 5000000,
    totalInventory: 3,
  }).returning();
  const [lastRoomType] = await db.insert(roomTypes).values({
    propertyId: property.id,
    name: 'Last Available Room',
    bedType: 'Queen Bed',
    capacity: 2,
    description: 'Single-unit category for contention checks.',
    basePriceMinorUnits: 4000000,
    totalInventory: 1,
  }).returning();
  await db.insert(rooms).values([
    { propertyId: property.id, roomTypeId: roomType.id, roomNumber: '101', floor: 'Floor 1', operationalStatus: 'available', housekeepingStatus: 'clean' },
    { propertyId: property.id, roomTypeId: roomType.id, roomNumber: '102', floor: 'Floor 1', operationalStatus: 'available', housekeepingStatus: 'clean' },
    { propertyId: property.id, roomTypeId: roomType.id, roomNumber: '103', floor: 'Floor 1', operationalStatus: 'available', housekeepingStatus: 'clean' },
    { propertyId: property.id, roomTypeId: lastRoomType.id, roomNumber: '901', floor: 'Floor 9', operationalStatus: 'available', housekeepingStatus: 'clean' },
  ]);
  const [apartment] = await db.insert(apartments).values({
    propertyId: property.id,
    name: input.apartmentName,
    apartmentType: 'one_bedroom',
    bedConfiguration: '1 King Bed',
    operationalStatus: 'available',
    housekeepingStatus: 'clean',
    bedrooms: 1,
    maxGuests: 2,
    basePriceMinorUnits: 9000000,
    description: 'Local verification apartment.',
  }).returning();

  const guestRows = await db.insert(guests).values(
    Array.from({ length: input.guestCount }, (_, index) => ({
      organizationId: org.id,
      propertyId: property.id,
      fullName: `Verification Guest ${String(index + 1).padStart(2, '0')}`,
      email: `guest-${index + 1}@${input.orgSlug}.invalid`,
      phone: `+234800000${String(index + 1).padStart(4, '0')}`,
      notes: index === 0 ? 'Original local note' : null,
      preferences: index === 0 ? ['High floor'] : [],
    })),
  ).returning();

  const reservationRows = await db.insert(reservations).values(
    guestRows.map((guest, index) => {
      const day = String((index % 20) + 1).padStart(2, '0');
      const cancelled = index > 0 && index % 11 === 0;
      const past = index % 3 === 0;
      return {
        propertyId: property.id,
        guestId: guest.id,
        roomTypeId: roomType.id,
        roomId: null,
        reference: `RES-${input.code}-${String(index + 1).padStart(3, '0')}`,
        status: cancelled ? 'cancelled' : past ? 'checked_out' : 'confirmed',
        paymentStatus: index % 3 === 0 ? 'paid' : index % 3 === 1 ? 'partially_paid' : 'unpaid',
        checkInDate: past ? `2026-10-${day}` : `2026-12-${day}`,
        checkOutDate: past ? `2026-10-${String((index % 20) + 3).padStart(2, '0')}` : `2026-12-${String((index % 20) + 3).padStart(2, '0')}`,
        nights: 2,
        numGuests: 1,
        source: 'walk_in',
        totalAmountMinorUnits: 10000000,
        paidAmountMinorUnits: index % 3 === 0 ? 10000000 : index % 3 === 1 ? 4000000 : 0,
        specialRequests: index === 0 ? 'Original special request' : null,
      };
    }),
  ).returning();

  const invoiceRows = await db.insert(propertyInvoices).values(
    Array.from({ length: input.invoiceCount }, (_, index) => {
      const paid = index % 3 === 0 ? 100000 : index % 3 === 1 ? 40000 : 0;
      return {
        propertyId: property.id,
        organizationId: org.id,
        reservationId: reservationRows[index % reservationRows.length]?.id ?? null,
        invoiceNumber: `INV-${input.code}-${String(index + 1).padStart(3, '0')}`,
        invoiceType: 'guest_folio',
        status: paid === 100000 ? 'paid' : paid > 0 ? 'partially_paid' : 'issued',
        recipientName: `Verification Guest ${String((index % input.guestCount) + 1).padStart(2, '0')}`,
        recipientEmail: `guest-${(index % input.guestCount) + 1}@${input.orgSlug}.invalid`,
        issueDate: '2026-11-01',
        dueDate: '2026-11-30',
        totalAmountMinorUnits: 100000,
        paidAmountMinorUnits: paid,
        items: [{ description: 'Verification stay', quantity: 1, unitPriceMinorUnits: 100000, amountMinorUnits: 100000 }],
      };
    }),
  ).returning();

  await db.insert(payments).values(
    invoiceRows.filter((invoice) => invoice.paidAmountMinorUnits > 0).map((invoice) => ({
      propertyId: property.id,
      invoiceId: invoice.id,
      amountMinorUnits: invoice.paidAmountMinorUnits,
      currency: 'NGN',
      provider: 'cash',
      providerReference: `PAY-${invoice.invoiceNumber}`,
      method: 'cash',
      status: 'successful',
      source: 'front_desk',
      paidAt: new Date('2026-11-02T10:00:00Z'),
      notes: 'Local verification payment',
    })),
  );

  return { org, property, user, roomType, lastRoomType, apartment, guest: guestRows[0], reservation: reservationRows[0], invoice: invoiceRows[0] };
}

const a = await seedProperty({
  orgName: 'Verification Harbour Group',
  orgSlug: 'verify-harbour-group',
  propertyName: 'Verification Harbour Hotel',
  propertySlug: 'verify-harbour',
  code: 'VH',
  email: 'owner-a@verify.local',
  roomName: 'Harbour Deluxe',
  apartmentName: 'Harbour Residence',
  guestCount: 65,
  invoiceCount: 65,
});
const b = await seedProperty({
  orgName: 'Verification North Group',
  orgSlug: 'verify-north-group',
  propertyName: 'Verification North Lodge',
  propertySlug: 'verify-north',
  code: 'VN',
  email: 'owner-b@verify.local',
  roomName: 'North Deluxe',
  apartmentName: 'North Residence',
  guestCount: 3,
  invoiceCount: 3,
});

console.log(JSON.stringify({
  password: PASSWORD,
  propertyA: { id: a.property.id, slug: a.property.slug, email: a.user.email, roomTypeId: a.roomType.id, lastRoomTypeId: a.lastRoomType.id, apartmentId: a.apartment.id, guestId: a.guest.id, reservationId: a.reservation.id, invoiceId: a.invoice.id },
  propertyB: { id: b.property.id, slug: b.property.slug, email: b.user.email, guestId: b.guest.id, reservationId: b.reservation.id, invoiceId: b.invoice.id },
}, null, 2));
process.exit(0);
}

main().catch((error) => {
  console.error('Browser verification seed failed:', error);
  process.exit(1);
});
