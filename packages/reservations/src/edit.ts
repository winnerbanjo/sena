import { calculateNights, formatNaira, getDatesBetween } from '@sena/config';
import {
  activityLogs,
  apartments,
  bookingHolds,
  db,
  propertyInvoices,
  reservationEvents,
  reservations,
  rooms,
  roomTypes,
} from '@sena/database';
import { ensureOpenHousekeepingTask } from '@sena/housekeeping';
import {
  APARTMENT_BLOCKING_STATUSES,
  releaseInventoryInTransaction,
  reserveInventoryInTransaction,
} from '@sena/inventory';
import { and, eq, gt, inArray, ne, notInArray, or, sql } from 'drizzle-orm';
import { assertRoomEligible } from './assignment';
import { categoryNightsAvailable, categorySoldOutMessage, roomUnavailableForStay } from './category-availability';

const EDITABLE_STATUSES = new Set(['confirmed', 'checked_in']);

export type StayEditMode = 'unchanged' | 'extension' | 'shortening';

export type StayEditQuote = {
  mode: StayEditMode;
  previousTotalMinorUnits: number;
  additionalNights: number;
  configuredNightlyRateMinorUnits: number | null;
  suggestedAmountMinorUnits: number | null;
  appliedAmountMinorUnits: number;
  nextTotalMinorUnits: number;
  paidAmountMinorUnits: number;
  previousBalanceMinorUnits: number;
  nextBalanceMinorUnits: number;
  invoiceCount: number;
  paymentsUntouched: true;
  invoicesUntouched: boolean;
  requiresOperatorAction: string | null;
  note: string | null;
};

function nextPaymentStatus(current: string, paid: number, total: number) {
  if (current === 'refunded') return current;
  if (paid <= 0) return 'pay_later';
  if (paid >= total) return 'paid';
  return 'part_payment';
}

function readMoney(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error(`${label} must be a whole amount in kobo.`);
  return amount;
}

/**
 * Extending never reprices nights that already existed, and shortening never
 * silently reduces settled financial history. The server owns the arithmetic:
 * new total = the reservation's existing authoritative total +/- an operator
 * amount, never a rate divided back out of a negotiated total.
 */
function buildQuote(input: {
  previousTotal: number;
  previousNights: number;
  nextNights: number;
  configuredRateMinorUnits: number | null;
  requestedExtensionAmount: number | null;
  requestedAdjustmentAmount: number | null;
  requestedCustomTotal: number | null;
  paid: number;
  invoiceCount: number;
}): StayEditQuote {
  const { previousTotal, previousNights, nextNights, paid, invoiceCount, requestedCustomTotal } = input;
  const additionalNights = nextNights - previousNights;
  const mode: StayEditMode = additionalNights > 0 ? 'extension' : additionalNights < 0 ? 'shortening' : 'unchanged';

  let appliedAmountMinorUnits = 0;
  let suggestedAmountMinorUnits: number | null = null;
  let requiresOperatorAction: string | null = null;

  if (requestedCustomTotal != null) {
    appliedAmountMinorUnits = Math.abs(requestedCustomTotal - previousTotal);
  } else if (mode === 'extension') {
    if (input.configuredRateMinorUnits != null) {
      suggestedAmountMinorUnits = input.configuredRateMinorUnits * additionalNights;
    }
    const amount = input.requestedExtensionAmount ?? suggestedAmountMinorUnits;
    if (amount == null) {
      throw new Error('This room has no configured nightly rate. Enter the amount for the additional nights.');
    }
    if (amount < 0) throw new Error('The extension amount cannot be negative.');
    appliedAmountMinorUnits = amount;
  } else if (mode === 'shortening') {
    // Conservative: dates may shorten operationally, but money is only reduced
    // when an operator states the reduction explicitly.
    const reduction = input.requestedAdjustmentAmount ?? 0;
    if (reduction < 0) throw new Error('The shortening adjustment cannot be negative.');
    if (reduction > previousTotal) throw new Error('The shortening adjustment is larger than the stay value.');
    appliedAmountMinorUnits = reduction;
    if (reduction === 0) {
      requiresOperatorAction =
        'Dates were shortened but the accommodation value was left unchanged. Record any refund or credit through the usual payment or invoice process.';
    }
  }

  const nextTotal = requestedCustomTotal != null
    ? Math.max(0, requestedCustomTotal)
    : Math.max(0, previousTotal + (mode === 'shortening' ? -appliedAmountMinorUnits : appliedAmountMinorUnits));

  const note =
    nextTotal === previousTotal
      ? null
      : `Accommodation value changes from ${formatNaira(previousTotal)} to ${formatNaira(nextTotal)}.`;

  return {
    mode,
    previousTotalMinorUnits: previousTotal,
    additionalNights,
    configuredNightlyRateMinorUnits: input.configuredRateMinorUnits,
    suggestedAmountMinorUnits,
    appliedAmountMinorUnits,
    nextTotalMinorUnits: nextTotal,
    paidAmountMinorUnits: paid,
    previousBalanceMinorUnits: Math.max(0, previousTotal - paid),
    nextBalanceMinorUnits: Math.max(0, nextTotal - paid),
    invoiceCount,
    paymentsUntouched: true,
    invoicesUntouched: invoiceCount === 0,
    requiresOperatorAction,
    note,
  };
}

export type AccommodationKind = 'room' | 'apartment';

export type StayEditInput = {
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  roomId?: string | null;
  /** Which type of accommodation this stay should use. Omit to keep the current one. */
  accommodationType?: AccommodationKind | null;
  /** Target room category when the stay uses a room. Omit to keep the current one. */
  roomTypeId?: string | null;
  /** Target apartment when the stay uses an apartment. Omit to keep the current one. */
  apartmentId?: string | null;
  /** Operator-confirmed value of the added nights. Never replaces the existing stay value. */
  extensionAmountMinorUnits?: number | null;
  /** Operator-confirmed reduction when shortening. Never inferred from the existing total. */
  adjustmentAmountMinorUnits?: number | null;
  /** Direct override of the total stay amount (agreed / negotiated pricing). */
  customTotalAmountMinorUnits?: number | null;
  /** Explicit discount amount on the standard total. */
  discountAmountMinorUnits?: number | null;
  /** Kept on the audit row only; never rendered on the customer-facing timeline. */
  extensionReason?: string | null;
};

type AccommodationTarget =
  | { kind: 'room'; roomTypeId: string; roomId: string | null }
  | { kind: 'apartment'; apartmentId: string };

async function unitLabel(
  tx: any,
  res: typeof reservations.$inferSelect,
): Promise<string> {
  if (res.apartmentId) {
    const [apartment] = await tx.select({ name: apartments.name }).from(apartments).where(eq(apartments.id, res.apartmentId)).limit(1);
    return `${apartment?.name || 'Unnamed'} Apartment`;
  }
  if (res.roomId) {
    const [room] = await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, res.roomId)).limit(1);
    return room?.roomNumber ? `Room ${room.roomNumber}` : 'Room unassigned';
  }
  return res.roomTypeId ? 'Room unassigned' : 'No accommodation assigned';
}

async function targetLabel(tx: any, target: AccommodationTarget): Promise<string> {
  if (target.kind === 'apartment') {
    const [apartment] = await tx.select({ name: apartments.name }).from(apartments).where(eq(apartments.id, target.apartmentId)).limit(1);
    return `${apartment?.name || 'Unnamed'} Apartment`;
  }
  if (!target.roomId) return 'Room unassigned';
  const [room] = await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, target.roomId)).limit(1);
  return room?.roomNumber ? `Room ${room.roomNumber}` : 'Room unassigned';
}

/**
 * Resolves the single accommodation a stay must end up with. A reservation
 * always targets exactly one type: never both a room and an apartment, never
 * neither. Identifiers are validated against this property, so a unit from
 * another tenant can never be attached.
 */
async function resolveAccommodationTarget(
  tx: any,
  res: typeof reservations.$inferSelect,
  propertyId: string,
  input: StayEditInput,
): Promise<AccommodationTarget> {
  const currentKind: AccommodationKind = res.apartmentId ? 'apartment' : 'room';
  const kind: AccommodationKind = input.accommodationType ?? currentKind;

  if (kind === 'apartment') {
    if (input.roomId) throw new Error('Apartments do not use a room number.');
    const apartmentId =
      input.apartmentId === undefined ? (currentKind === 'apartment' ? res.apartmentId : null) : input.apartmentId;
    if (!apartmentId) throw new Error('Select an apartment for this stay.');
    const [apartment] = await tx
      .select()
      .from(apartments)
      .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
      .limit(1);
    if (!apartment) throw new Error('That apartment is not in this property.');
    return { kind: 'apartment', apartmentId };
  }

  const roomTypeId =
    input.roomTypeId === undefined ? (currentKind === 'room' ? res.roomTypeId : null) : input.roomTypeId;
  if (!roomTypeId) throw new Error('Select a room category for this stay.');
  const [roomType] = await tx
    .select()
    .from(roomTypes)
    .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
    .limit(1);
  if (!roomType) throw new Error('That room category is not in this property.');

  const roomId = input.roomId === undefined ? (currentKind === 'room' ? res.roomId : null) : input.roomId;
  if (roomId) {
    const [room] = await tx
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
      .limit(1);
    if (!room) throw new Error('That room is not in this property.');
    if (room.roomTypeId !== roomTypeId) throw new Error('That room is not in the selected category.');
  }
  return { kind: 'room', roomTypeId, roomId };
}

/** Apartment availability, excluding the stay being edited, reusing existing semantics. */
async function assertApartmentAvailable(
  tx: any,
  propertyId: string,
  apartmentId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeReservationId: string,
) {
  const [apartment] = await tx
    .select()
    .from(apartments)
    .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
    .limit(1)
    .for('update');
  if (!apartment) throw new Error('That apartment is not in this property.');
  if (apartment.archivedAt) throw new Error('This apartment is archived and cannot take this reservation.');
  if (apartment.operationalStatus === 'blocked' || apartment.operationalStatus === 'maintenance') {
    throw new Error('This apartment is out of service.');
  }

  const blocking = await tx
    .select({ reference: reservations.reference, checkInDate: reservations.checkInDate, checkOutDate: reservations.checkOutDate })
    .from(reservations)
    .where(
      and(
        eq(reservations.apartmentId, apartmentId),
        eq(reservations.propertyId, propertyId),
        ne(reservations.id, excludeReservationId),
        inArray(reservations.status, [...APARTMENT_BLOCKING_STATUSES]),
        sql`${reservations.checkInDate} < ${checkOutDate}`,
        sql`${reservations.checkOutDate} > ${checkInDate}`,
      ),
    );
  if (blocking.length > 0) {
    throw new Error(
      `This apartment is unavailable for part of the new stay (${blocking[0].reference}, ${blocking[0].checkInDate} to ${blocking[0].checkOutDate}).`,
    );
  }

  const held = await tx
    .select({ checkInDate: bookingHolds.checkInDate, checkOutDate: bookingHolds.checkOutDate })
    .from(bookingHolds)
    .where(
      and(
        eq(bookingHolds.apartmentId, apartmentId),
        eq(bookingHolds.propertyId, propertyId),
        eq(bookingHolds.status, 'active'),
        gt(bookingHolds.expiresAt, new Date()),
      ),
    );
  const clash = held.find((hold: any) => checkInDate < hold.checkOutDate && checkOutDate > hold.checkInDate);
  if (clash) {
    throw new Error(`This apartment is currently held for ${clash.checkInDate} to ${clash.checkOutDate}.`);
  }
}

async function assertRoomTargetAvailable(
  tx: any,
  propertyId: string,
  target: { roomTypeId: string; roomId: string | null },
  checkInDate: string,
  checkOutDate: string,
  excludeReservationId: string,
  forCheckIn: boolean,
) {
  if (target.roomId) {
    try {
      await assertRoomEligible(
        tx,
        { propertyId, roomTypeId: target.roomTypeId, checkInDate, checkOutDate, excludeReservationId, forCheckIn },
        target.roomId,
      );
    } catch (error) {
      if (error instanceof Error && /no longer available/i.test(error.message)) {
        const [room] = await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, target.roomId)).limit(1);
        throw new Error(roomUnavailableForStay(room?.roomNumber || 'selected', 'Choose another room or cancel the edit.'));
      }
      throw error;
    }
  }
  const category = await categoryNightsAvailable(tx, propertyId, target.roomTypeId, checkInDate, checkOutDate, excludeReservationId);
  if (category.minAvailable < 1) {
    const detail = categorySoldOutMessage(category.blockers);
    if (target.roomId) {
      const [room] = await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, target.roomId)).limit(1);
      throw new Error(roomUnavailableForStay(room?.roomNumber || 'selected', detail));
    }
    throw new Error(detail);
  }
}

export async function updateStay(
  reservationId: string,
  propertyId: string,
  input: StayEditInput,
  actor = { id: '', name: 'Front Desk Staff' },
  preview = false,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.checkOutDate)) {
    throw new Error('Check-out must be after check-in.');
  }
  if (!Number.isInteger(input.numGuests) || input.numGuests < 1) throw new Error('Enter the number of guests.');
  const nights = calculateNights(input.checkInDate, input.checkOutDate);

  return db.transaction(async (tx) => {
    const [res] = await tx.select().from(reservations).where(eq(reservations.id, reservationId)).limit(1).for('update');
    if (!res || res.propertyId !== propertyId) throw new Error('Reservation not found');
    if (res.status === 'checked_out') throw new Error('Checked-out reservations cannot be edited.');
    if (res.status === 'cancelled') throw new Error('Cancelled reservations cannot be edited.');
    if (res.status === 'no_show') throw new Error('No-show reservations cannot be edited.');
    if (res.status === 'voided') throw new Error('Voided reservations cannot be edited.');
    if (!EDITABLE_STATUSES.has(res.status)) throw new Error('This reservation cannot be edited.');
    if (res.status === 'checked_in' && input.checkInDate !== res.checkInDate) {
      throw new Error('A checked-in stay keeps its arrival date. Change the departure date to extend or shorten the stay.');
    }

    const target = await resolveAccommodationTarget(tx, res, propertyId, input);

    // Revalidated inside the transaction so a competing booking between opening
    // the editor and saving blocks the save instead of half-applying it.
    if (target.kind === 'apartment') {
      await assertApartmentAvailable(tx, propertyId, target.apartmentId, input.checkInDate, input.checkOutDate, res.id);
      const [apartment] = await tx.select({ maxGuests: apartments.maxGuests }).from(apartments).where(eq(apartments.id, target.apartmentId)).limit(1);
      if (input.numGuests > (apartment?.maxGuests ?? 0)) throw new Error('This apartment cannot take that many guests.');
    } else {
      if (res.status === 'checked_in' && !target.roomId) {
        throw new Error('A checked-in stay must keep a room assignment.');
      }
      await assertRoomTargetAvailable(
        tx,
        propertyId,
        target,
        input.checkInDate,
        input.checkOutDate,
        res.id,
        res.status === 'checked_in' && target.roomId !== res.roomId,
      );
    }

    const existingInvoices = await tx
      .select({ id: propertyInvoices.id })
      .from(propertyInvoices)
      .where(
        and(
          eq(propertyInvoices.propertyId, propertyId),
          res.bookingGroupId
            ? or(
                eq(propertyInvoices.bookingGroupId, res.bookingGroupId),
                eq(propertyInvoices.reservationId, reservationId)
              )
            : eq(propertyInvoices.reservationId, reservationId),
          notInArray(propertyInvoices.status, ['void', 'cancelled'])
        )
      );
    const invoiceCount = existingInvoices.length;

    const configuredRate = await configuredNightlyRate(tx, target);
    const requestedCustomTotal = readMoney(input.customTotalAmountMinorUnits, 'Custom total amount');
    const requestedDiscount = readMoney(input.discountAmountMinorUnits, 'Discount amount');

    let customTotal: number | null = requestedCustomTotal;
    if (customTotal == null && requestedDiscount != null && configuredRate != null) {
      customTotal = Math.max(0, (configuredRate * nights) - requestedDiscount);
    }

    const financial = buildQuote({
      previousTotal: res.totalAmountMinorUnits,
      previousNights: res.nights,
      nextNights: nights,
      configuredRateMinorUnits: configuredRate,
      requestedExtensionAmount: readMoney(input.extensionAmountMinorUnits, 'Extension amount'),
      requestedAdjustmentAmount: readMoney(input.adjustmentAmountMinorUnits, 'Shortening adjustment'),
      requestedCustomTotal: customTotal,
      paid: res.paidAmountMinorUnits,
      invoiceCount,
    });
    const nextTotal = financial.nextTotalMinorUnits;

    // Strict commercial invariant: Non-negotiable paid amount floor.
    if (nextTotal < res.paidAmountMinorUnits) {
      throw new Error(
        `New total amount (${formatNaira(nextTotal)}) cannot be lower than the amount already paid (${formatNaira(res.paidAmountMinorUnits)}). Process a refund first if needed.`,
      );
    }

    const previousLabel = await unitLabel(tx, res);
    const nextLabel = await targetLabel(tx, target);
    const typeChanged = (res.apartmentId ? 'apartment' : 'room') !== target.kind;
    const accommodationChanged =
      typeChanged ||
      (res.roomTypeId ?? null) !== (target.kind === 'room' ? target.roomTypeId : null) ||
      (res.roomId ?? null) !== (target.kind === 'room' ? target.roomId : null) ||
      (res.apartmentId ?? null) !== (target.kind === 'apartment' ? target.apartmentId : null);

    if (preview) {
      return {
        preview: true,
        financial,
        accommodation: { type: target.kind, roomTypeId: target.kind === 'room' ? target.roomTypeId : null, roomId: target.kind === 'room' ? target.roomId : null, apartmentId: target.kind === 'apartment' ? target.apartmentId : null, label: nextLabel },
        reservation: { ...res, checkInDate: input.checkInDate, checkOutDate: input.checkOutDate, nights, numGuests: input.numGuests, totalAmountMinorUnits: nextTotal },
      };
    }

    // Inventory follows the category actually holding the stay.
    const oldDates = res.roomTypeId ? getDatesBetween(res.checkInDate, res.checkOutDate) : [];
    const newDates = target.kind === 'room' ? getDatesBetween(input.checkInDate, input.checkOutDate) : [];
    const categoryChanged = (res.roomTypeId ?? null) !== (target.kind === 'room' ? target.roomTypeId : null);
    if (res.roomTypeId && categoryChanged) {
      await releaseInventoryInTransaction(tx, propertyId, res.roomTypeId, oldDates, 1);
    }
    if (target.kind === 'room') {
      const toReserve = categoryChanged ? newDates : newDates.filter((date) => !oldDates.includes(date));
      if (toReserve.length > 0) {
        try {
          await reserveInventoryInTransaction(tx, propertyId, target.roomTypeId, toReserve, 1);
        } catch (error) {
          if (error instanceof Error && /no longer available for date/i.test(error.message)) {
            const category = await categoryNightsAvailable(tx, propertyId, target.roomTypeId, input.checkInDate, input.checkOutDate, res.id);
            throw new Error(categorySoldOutMessage(category.blockers));
          }
          throw error;
        }
      }
    }

    const changes: string[] = [];
    if (accommodationChanged) changes.push(`Accommodation changed from ${previousLabel} to ${nextLabel}`);
    if (input.checkInDate !== res.checkInDate) changes.push(`Check-in changed ${res.checkInDate} → ${input.checkInDate}`);
    if (input.checkOutDate !== res.checkOutDate) changes.push(`Checkout changed ${res.checkOutDate} → ${input.checkOutDate}`);
    if (input.numGuests !== res.numGuests) changes.push(`Guest count changed ${res.numGuests} → ${input.numGuests}`);
    if (customTotal != null && customTotal !== res.totalAmountMinorUnits) {
      changes.push(`Total stay rate agreed at ${formatNaira(customTotal)}`);
    } else if (financial.mode === 'extension') {
      changes.push(
        `${financial.additionalNights} extra night${financial.additionalNights === 1 ? '' : 's'} added for ${formatNaira(financial.appliedAmountMinorUnits)}`,
      );
    } else if (financial.mode === 'shortening' && financial.appliedAmountMinorUnits > 0) {
      changes.push(`Accommodation reduced by ${formatNaira(financial.appliedAmountMinorUnits)}`);
    }

    // An in-house move mirrors the existing checkout convention for the unit
    // being vacated: made available, marked dirty, and given a cleaning task.
    if (res.status === 'checked_in' && accommodationChanged) {
      if (res.roomId && res.roomId !== (target.kind === 'room' ? target.roomId : null)) {
        await tx.update(rooms).set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() }).where(eq(rooms.id, res.roomId));
        await ensureOpenHousekeepingTask(tx, { propertyId, roomId: res.roomId, notes: `Guest moved from room to ${nextLabel}` });
      }
      if (res.apartmentId && res.apartmentId !== (target.kind === 'apartment' ? target.apartmentId : null)) {
        await tx.update(apartments).set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() }).where(and(eq(apartments.id, res.apartmentId), eq(apartments.propertyId, propertyId)));
        await ensureOpenHousekeepingTask(tx, { propertyId, apartmentId: res.apartmentId, notes: `Guest moved from apartment to ${nextLabel}` });
      }
      if (target.kind === 'room' && target.roomId && target.roomId !== res.roomId) {
        await tx.update(rooms).set({ operationalStatus: 'occupied', updatedAt: new Date() }).where(eq(rooms.id, target.roomId));
      }
      if (target.kind === 'apartment' && target.apartmentId !== res.apartmentId) {
        await tx.update(apartments).set({ operationalStatus: 'occupied', updatedAt: new Date() }).where(and(eq(apartments.id, target.apartmentId), eq(apartments.propertyId, propertyId)));
      }
    }

    const standardTotal = (configuredRate ? configuredRate * nights : res.standardAmountMinorUnits) || nextTotal;
    const discountAmount = Math.max(0, standardTotal - nextTotal);

    const [updated] = await tx
      .update(reservations)
      .set({
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nights,
        numGuests: input.numGuests,
        adults: input.numGuests,
        children: 0,
        roomTypeId: target.kind === 'room' ? target.roomTypeId : null,
        roomId: target.kind === 'room' ? target.roomId : null,
        apartmentId: target.kind === 'apartment' ? target.apartmentId : null,
        standardAmountMinorUnits: standardTotal,
        discountAmountMinorUnits: discountAmount,
        totalAmountMinorUnits: nextTotal,
        paymentStatus: nextPaymentStatus(res.paymentStatus, res.paidAmountMinorUnits, nextTotal),
        updatedAt: new Date(),
      })
      .where(eq(reservations.id, res.id))
      .returning();

    // Financial consistency: Synchronize active invoices with the updated reservation amount.
    if (nextTotal !== res.totalAmountMinorUnits || accommodationChanged || input.checkInDate !== res.checkInDate || input.checkOutDate !== res.checkOutDate) {
      const activeInvoices = await tx
        .select()
        .from(propertyInvoices)
        .where(
          and(
            eq(propertyInvoices.propertyId, propertyId),
            res.bookingGroupId
              ? or(
                  eq(propertyInvoices.bookingGroupId, res.bookingGroupId),
                  eq(propertyInvoices.reservationId, res.id)
                )
              : eq(propertyInvoices.reservationId, res.id),
            notInArray(propertyInvoices.status, ['void', 'cancelled'])
          )
        )
        .for('update');

      const [resRoom] = res.roomId
        ? await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, res.roomId)).limit(1)
        : [null];
      const resRoomNumber = resRoom?.roomNumber || '';

      const today = new Date().toISOString().slice(0, 10);

      for (const inv of activeInvoices) {
        const lineItems = Array.isArray(inv.items) ? [...(inv.items as any[])] : [];
        let targetIndex = -1;

        if (res.bookingGroupId) {
          // 1. Primary: Deterministic matching using stable reservationId tag
          const matchingByResId = lineItems
            .map((item, idx) => (item.category === 'room' && item.reservationId === res.id ? idx : -1))
            .filter((idx) => idx !== -1);

          if (matchingByResId.length === 1) {
            targetIndex = matchingByResId[0];
          } else if (matchingByResId.length > 1) {
            throw new Error(
              `Ambiguous line item matching: multiple line items found with reservationId ${res.id} on invoice ${inv.invoiceNumber}. Preserving invoice without modification.`
            );
          }

          // 2. Fallback for legacy invoice items without reservationId
          if (targetIndex === -1) {
            const roomIndices = lineItems
              .map((item, idx) => (item.category === 'room' ? idx : -1))
              .filter((idx) => idx !== -1);

            if (roomIndices.length === 1 && (inv.reservationId === res.id || !inv.reservationId)) {
              targetIndex = roomIndices[0];
            } else if (roomIndices.length > 1) {
              // Match by unique reservation reference
              const matchesByRef = lineItems
                .map((item, idx) =>
                  item.category === 'room' && res.reference && String(item.description || '').includes(res.reference) ? idx : -1
                )
                .filter((idx) => idx !== -1);

              if (matchesByRef.length === 1) {
                targetIndex = matchesByRef[0];
              } else if (matchesByRef.length > 1) {
                throw new Error(
                  `Ambiguous line item matching: multiple room line items match reference ${res.reference} on invoice ${inv.invoiceNumber}. Preserving invoice.`
                );
              } else {
                // Match by unique unit or room number
                const matchesByUnit = lineItems
                  .map((item, idx) => {
                    if (item.category !== 'room') return -1;
                    const desc = String(item.description || '');
                    const matchRoom = resRoomNumber && (desc.includes(`Room ${resRoomNumber}`) || desc.includes(`(${resRoomNumber})`));
                    const matchPrevLabel = previousLabel && desc.includes(previousLabel);
                    return matchRoom || matchPrevLabel ? idx : -1;
                  })
                  .filter((idx) => idx !== -1);

                if (matchesByUnit.length === 1) {
                  targetIndex = matchesByUnit[0];
                } else if (matchesByUnit.length > 1) {
                  throw new Error(
                    `Ambiguous line item matching: multiple room line items match unit on invoice ${inv.invoiceNumber}. Preserving invoice.`
                  );
                } else if (inv.reservationId === res.id && roomIndices.length > 0) {
                  // Fallback: match by previous room amount if unique
                  const matchesByAmount = lineItems
                    .map((item, idx) =>
                      item.category === 'room' && item.unitPriceMinorUnits === res.totalAmountMinorUnits ? idx : -1
                    )
                    .filter((idx) => idx !== -1);
                  if (matchesByAmount.length === 1) {
                    targetIndex = matchesByAmount[0];
                  } else {
                    throw new Error(
                      `Ambiguous line item matching: cannot uniquely identify accommodation line item for reservation ${res.reference} on group invoice ${inv.invoiceNumber}. Preserving invoice without guessing.`
                    );
                  }
                } else {
                  throw new Error(
                    `Ambiguous line item matching: cannot uniquely identify accommodation line item for reservation ${res.reference} on group invoice ${inv.invoiceNumber}. Preserving invoice without guessing.`
                  );
                }
              }
            }
          }
        } else {
          // Single reservation invoice: first room item or first item
          targetIndex = lineItems.findIndex((item) => item.category === 'room');
          if (targetIndex === -1 && lineItems.length === 1) targetIndex = 0;
        }

        const updatedRoomItem = {
          id: targetIndex >= 0 && lineItems[targetIndex]?.id ? lineItems[targetIndex].id : crypto.randomUUID(),
          description: `${res.reference ? `${res.reference} · ` : ''}${nextLabel} · ${nights} night stay (${input.checkInDate} to ${input.checkOutDate})`,
          category: 'room' as const,
          quantity: 1,
          unitPriceMinorUnits: nextTotal,
          totalMinorUnits: nextTotal,
          reservationId: res.id,
        };

        let updatedItems: any[];
        if (targetIndex >= 0) {
          updatedItems = lineItems.map((item, idx) => (idx === targetIndex ? updatedRoomItem : item));
        } else {
          updatedItems = [...lineItems, updatedRoomItem];
        }

        const newSubtotal = updatedItems.reduce((sum, item) => sum + Number(item.totalMinorUnits || 0), 0);
        const oldSubtotal = Number(inv.subtotalMinorUnits || 0);
        const hadVat = Number(inv.taxVatMinorUnits || 0) > 0;
        const newTaxVat = hadVat && oldSubtotal > 0
          ? Math.round(newSubtotal * (Number(inv.taxVatMinorUnits) / oldSubtotal))
          : (hadVat ? Math.round(newSubtotal * 0.075) : 0);
        const hadConsumption = Number(inv.taxConsumptionMinorUnits || 0) > 0;
        const newTaxConsumption = hadConsumption && oldSubtotal > 0
          ? Math.round(newSubtotal * (Number(inv.taxConsumptionMinorUnits) / oldSubtotal))
          : (hadConsumption ? Math.round(newSubtotal * 0.05) : 0);
        const hadService = Number(inv.serviceChargeMinorUnits || 0) > 0;
        const newServiceCharge = hadService && oldSubtotal > 0
          ? Math.round(newSubtotal * (Number(inv.serviceChargeMinorUnits) / oldSubtotal))
          : (hadService ? Math.round(newSubtotal * 0.1) : 0);
        const newDiscount = Math.min(newSubtotal, Number(inv.discountMinorUnits || 0));
        const newTotalAmount = Math.max(
          0,
          newSubtotal + newTaxVat + newTaxConsumption + newServiceCharge - newDiscount
        );

        const paid = Number(inv.paidAmountMinorUnits || 0);
        const newDueDate = input.checkOutDate > inv.dueDate ? input.checkOutDate : inv.dueDate;

        let newStatus = inv.status;
        if (inv.status !== 'draft') {
          if (paid >= newTotalAmount && newTotalAmount > 0) {
            newStatus = 'paid';
          } else if (paid > 0) {
            newStatus = 'partially_paid';
          } else if (inv.status === 'overdue' && newDueDate < today) {
            newStatus = 'overdue';
          } else {
            newStatus = 'issued';
          }
        }

        await tx
          .update(propertyInvoices)
          .set({
            items: updatedItems,
            subtotalMinorUnits: newSubtotal,
            discountMinorUnits: newDiscount,
            taxVatMinorUnits: newTaxVat,
            taxConsumptionMinorUnits: newTaxConsumption,
            serviceChargeMinorUnits: newServiceCharge,
            totalAmountMinorUnits: newTotalAmount,
            status: newStatus,
            dueDate: newDueDate,
            updatedAt: new Date(),
          })
          .where(eq(propertyInvoices.id, inv.id));

        await tx.insert(activityLogs).values({
          organizationId: inv.organizationId,
          propertyId: inv.propertyId,
          actorId: actor.id || null,
          actorName: actor.name,
          action: 'invoice.synced_from_reservation',
          resource: 'invoice',
          resourceId: inv.id,
          previousValue: {
            totalAmountMinorUnits: inv.totalAmountMinorUnits,
            subtotalMinorUnits: inv.subtotalMinorUnits,
            status: inv.status,
          },
          newValue: {
            totalAmountMinorUnits: newTotalAmount,
            subtotalMinorUnits: newSubtotal,
            status: newStatus,
            reason: 'Stay rate/dates synchronized',
          },
        });
      }
    }

    if (changes.length > 0) {
      await tx.insert(reservationEvents).values({
        reservationId: res.id,
        actorId: actor.id || null,
        actorName: actor.name,
        eventType: accommodationChanged ? 'reservation_accommodation_changed' : 'reservation_edited',
        description: `${changes.join('. ')}. Edited by ${actor.name}.`,
        metadata: {
          changes,
          accommodationChanged,
          previousAccommodation: { type: res.apartmentId ? 'apartment' : 'room', roomTypeId: res.roomTypeId, roomId: res.roomId, apartmentId: res.apartmentId, label: previousLabel },
          nextAccommodation: { type: target.kind, roomTypeId: target.kind === 'room' ? target.roomTypeId : null, roomId: target.kind === 'room' ? target.roomId : null, apartmentId: target.kind === 'apartment' ? target.apartmentId : null, label: nextLabel },
          mode: financial.mode,
          previousCheckOutDate: res.checkOutDate,
          nextCheckOutDate: input.checkOutDate,
          previousNights: res.nights,
          additionalNights: financial.additionalNights,
          previousTotalMinorUnits: res.totalAmountMinorUnits,
          extensionAmountMinorUnits: financial.appliedAmountMinorUnits,
          nextTotalMinorUnits: nextTotal,
          paidAmountMinorUnits: res.paidAmountMinorUnits,
          bookingGroupId: res.bookingGroupId,
          reason: input.extensionReason?.trim() || null,
          actorName: actor.name,
          paymentsUntouched: true,
          invoicesSynced: invoiceCount > 0,
        },
      });
    }

    return {
      preview: false,
      financial,
      accommodationChanged,
      accommodation: { type: target.kind, roomTypeId: target.kind === 'room' ? target.roomTypeId : null, roomId: target.kind === 'room' ? target.roomId : null, apartmentId: target.kind === 'apartment' ? target.apartmentId : null, label: nextLabel },
      roomNumber: target.kind === 'room' && target.roomId ? (await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, target.roomId)).limit(1))[0]?.roomNumber ?? null : null,
      reservation: updated,
    };
  });
}

/** The configured sellable rate for the stay's accommodation, used only to suggest an extension amount. */
async function configuredNightlyRate(tx: any, target: AccommodationTarget) {
  if (target.kind === 'apartment') {
    const [apartment] = await tx
      .select({ basePriceMinorUnits: apartments.basePriceMinorUnits })
      .from(apartments)
      .where(eq(apartments.id, target.apartmentId))
      .limit(1);
    return apartment?.basePriceMinorUnits ?? null;
  }
  const [roomType] = await tx
    .select({ basePriceMinorUnits: roomTypes.basePriceMinorUnits })
    .from(roomTypes)
    .where(eq(roomTypes.id, target.roomTypeId))
    .limit(1);
  return roomType?.basePriceMinorUnits ?? null;
}
