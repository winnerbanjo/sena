/**
 * Local review fixtures for the reservation operations environment.
 * Synthetic only: the QA property created by the earlier switching work.
 */
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const QA_PROPERTY = '6a6a4880-ae96-4b1e-91bd-0ac422382f56';

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

async function run() {
  const { db, reservations, rooms, apartments, payments, guests, eq } =
    await import('../packages/database/src/index');
  const { ReservationService } = await import('../packages/reservations/src/index');

  const today = new Date().toISOString().slice(0, 10);
  const actor = { id: '', name: 'Local Review' };
  const property = await db.query.properties.findFirst({ where: (t, { eq: e }) => e(t.id, QA_PROPERTY) });
  assert.ok(property, 'QA property is missing; run the accommodation-switching fixtures first');

  const executiveRoom = await db.query.rooms.findFirst({ where: (t, { and, eq: e }) => and(e(t.propertyId, QA_PROPERTY), e(t.roomNumber, '3022')) });
  const secondRoom = await db.query.rooms.findFirst({ where: (t, { and, eq: e }) => and(e(t.propertyId, QA_PROPERTY), e(t.roomNumber, '3023')) });
  const executiveType = executiveRoom?.roomTypeId;
  const almond = await db.query.apartments.findFirst({ where: (t, { eq: e }) => e(t.propertyId, QA_PROPERTY) });

  const guest = (label: string) => ({
    fullName: label,
    email: `${label.toLowerCase().replace(/\s+/g, '.')}@example.invalid`,
    phone: '+2348000000000',
    preferences: [] as string[],
  });

  // 1. A clean stay: Delete reservation will hard delete it.
  const clean = await ReservationService.create({
    propertyId: QA_PROPERTY,
    roomTypeId: executiveType!,
    roomId: executiveRoom!.id,
    checkInDate: addDays(today, 45),
    checkOutDate: addDays(today, 48),
    numGuests: 2,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Review Clean Stay'),
  }, actor);

  // 2. A paid stay: Delete reservation will void it and keep the payment.
  const paid = await ReservationService.create({
    propertyId: QA_PROPERTY,
    apartmentId: almond!.id,
    checkInDate: addDays(today, 50),
    checkOutDate: addDays(today, 53),
    numGuests: 2,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Review Paid Stay'),
  }, actor);
  await db.insert(payments).values({
    propertyId: QA_PROPERTY,
    reservationId: paid.id,
    amountMinorUnits: 5_000_000,
    currency: 'NGN',
    provider: 'manual',
    method: 'cash',
    status: 'successful',
    source: 'front_desk',
    notes: 'Local review fixture payment',
  });

  // 3. A stay for the accommodation switch itself.
  const switchable = await ReservationService.create({
    propertyId: QA_PROPERTY,
    roomTypeId: executiveType!,
    roomId: secondRoom!.id,
    checkInDate: addDays(today, 55),
    checkOutDate: addDays(today, 58),
    numGuests: 2,
    source: 'walk_in',
    paymentStatus: 'pay_later',
    paidAmountMinorUnits: 0,
    guest: guest('Review Switch Stay'),
  }, actor);

  const rows = await db.select().from(reservations).where(eq(reservations.propertyId, QA_PROPERTY));
  const paidGuest = rows.find((row: never) => (row as { id: string }).id === paid.id);
  const paidGuestRow = paidGuest ? await db.select().from(guests).where(eq(guests.id, (paidGuest as { guestId: string }).guestId)) : [];

  console.log(`clean    ${clean.reference}  room 3022 -> hard delete`);
  console.log(`paid     ${paid.reference}  ${almond!.name} apartment, one payment -> void`);
  console.log(`switch   ${switchable.reference}  room 3023 -> switch to ${almond!.name} or a room`);
  console.log(`paid guest ${paidGuestRow?.[0]?.fullName || ''}`);
  void rooms;
  void apartments;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});