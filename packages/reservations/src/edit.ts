import { calculateNights, formatNaira, getDatesBetween } from '@sena/config';
import {
  apartments,
  db,
  propertyInvoices,
  reservationEvents,
  reservations,
  rooms,
  roomTypes,
} from '@sena/database';
import { ensureOpenHousekeepingTask } from '@sena/housekeeping';
import { releaseInventoryInTransaction, reserveInventoryInTransaction } from '@sena/inventory';
import { and, eq } from 'drizzle-orm';
import { assertRoomEligible } from './assignment';
import { categoryNightsAvailable, categorySoldOutMessage, roomUnavailableForStay } from './category-availability';

const EDITABLE_STATUSES = new Set(['confirmed', 'checked_in']);

export type StayEditInput = {
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  roomId?: string | null;
  /** Operator-confirmed value of the added nights. Never replaces the existing stay value. */
  extensionAmountMinorUnits?: number | null;
  /** Operator-confirmed reduction when shortening. Never inferred from the existing total. */
  adjustmentAmountMinorUnits?: number | null;
  /** Kept on the audit row only; never rendered on the customer-facing timeline. */
  extensionReason?: string | null;
};

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
  invoicesUntouched: true;
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
  paid: number;
  invoiceCount: number;
}): StayEditQuote {
  const { previousTotal, previousNights, nextNights, paid, invoiceCount } = input;
  const additionalNights = nextNights - previousNights;
  const mode: StayEditMode = additionalNights > 0 ? 'extension' : additionalNights < 0 ? 'shortening' : 'unchanged';

  let appliedAmountMinorUnits = 0;
  let suggestedAmountMinorUnits: number | null = null;
  let requiresOperatorAction: string | null = null;

  if (mode === 'extension') {
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

  const nextTotal = Math.max(0, previousTotal + (mode === 'shortening' ? -appliedAmountMinorUnits : appliedAmountMinorUnits));
  const note =
    nextTotal === previousTotal
      ? null
      : `Accommodation value changes from ${formatNaira(previousTotal)} to ${formatNaira(nextTotal)}. Payments and invoices are not rewritten.`;

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
    invoicesUntouched: true,
    requiresOperatorAction,
    note,
  };
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
    if (!EDITABLE_STATUSES.has(res.status)) throw new Error('This reservation cannot be edited.');
    if (res.status === 'checked_in' && input.checkInDate !== res.checkInDate) {
      throw new Error('A checked-in stay keeps its arrival date. Change the departure date to extend or shorten the stay.');
    }

    const [invoiceRow] = await tx
      .select({ id: propertyInvoices.id })
      .from(propertyInvoices)
      .where(eq(propertyInvoices.reservationId, reservationId))
      .limit(1);
    const invoiceCount = invoiceRow ? (
      await tx.select({ id: propertyInvoices.id }).from(propertyInvoices).where(eq(propertyInvoices.reservationId, reservationId))
    ).length : 0;

    const configuredRate = await configuredNightlyRate(tx, res);
    const financial = buildQuote({
      previousTotal: res.totalAmountMinorUnits,
      previousNights: res.nights,
      nextNights: nights,
      configuredRateMinorUnits: configuredRate,
      requestedExtensionAmount: readMoney(input.extensionAmountMinorUnits, 'Extension amount'),
      requestedAdjustmentAmount: readMoney(input.adjustmentAmountMinorUnits, 'Shortening adjustment'),
      paid: res.paidAmountMinorUnits,
      invoiceCount,
    });
    const nextTotal = financial.nextTotalMinorUnits;

    if (res.apartmentId) {
      if (input.roomId) throw new Error('Apartments do not use a room number.');
      const [apartment] = await tx
        .select()
        .from(apartments)
        .where(and(eq(apartments.id, res.apartmentId), eq(apartments.propertyId, propertyId)))
        .limit(1)
        .for('update');
      if (!apartment) throw new Error('Apartment not found');
      if (input.numGuests > apartment.maxGuests) throw new Error('This apartment cannot take that many guests.');
    }

    return applyRoomOrApartmentEdit(tx, res, propertyId, input, nights, nextTotal, financial, actor, preview);
  });
}

/** The configured sellable rate for this stay, used only to suggest an extension amount. */
async function configuredNightlyRate(tx: any, res: typeof reservations.$inferSelect) {
  if (res.apartmentId) {
    const [apartment] = await tx
      .select({ basePriceMinorUnits: apartments.basePriceMinorUnits })
      .from(apartments)
      .where(eq(apartments.id, res.apartmentId))
      .limit(1);
    return apartment?.basePriceMinorUnits ?? null;
  }
  if (!res.roomTypeId) return null;
  const [roomType] = await tx
    .select({ basePriceMinorUnits: roomTypes.basePriceMinorUnits })
    .from(roomTypes)
    .where(eq(roomTypes.id, res.roomTypeId))
    .limit(1);
  return roomType?.basePriceMinorUnits ?? null;
}

async function applyRoomOrApartmentEdit(
  tx: any,
  res: typeof reservations.$inferSelect,
  propertyId: string,
  input: StayEditInput,
  nights: number,
  nextTotal: number,
  financial: StayEditQuote,
  actor: { id: string; name: string },
  preview: boolean,
) {
  if (res.apartmentId) {
    const overlaps = await tx
      .select({
        id: reservations.id,
        reference: reservations.reference,
        status: reservations.status,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .where(and(eq(reservations.apartmentId, res.apartmentId), eq(reservations.propertyId, propertyId)));
    const blocking = overlaps.filter(
      (stay: { id: string; status: string; checkInDate: string; checkOutDate: string }) =>
        stay.id !== res.id &&
        ['pending', 'confirmed', 'checked_in'].includes(stay.status) &&
        input.checkInDate < stay.checkOutDate &&
        input.checkOutDate > stay.checkInDate,
    );
    if (blocking.length > 0) {
      throw new Error(
        `This apartment is unavailable for part of the new stay (${blocking[0].reference}, ${blocking[0].checkInDate} to ${blocking[0].checkOutDate}).`,
      );
    }
  } else if (res.roomTypeId) {
    const nextRoomId = input.roomId === undefined ? res.roomId : input.roomId;
    if (res.status === 'checked_in' && !nextRoomId) {
      throw new Error('A checked-in stay must keep a room assignment.');
    }
    if (nextRoomId) {
      try {
        await assertRoomEligible(
          tx,
          {
            propertyId,
            roomTypeId: res.roomTypeId,
            checkInDate: input.checkInDate,
            checkOutDate: input.checkOutDate,
            excludeReservationId: res.id,
            forCheckIn: res.status === 'checked_in' && nextRoomId !== res.roomId,
          },
          nextRoomId,
        );
      } catch (error) {
        if (error instanceof Error && /no longer available/i.test(error.message)) {
          const [room] = await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, nextRoomId)).limit(1);
          throw new Error(roomUnavailableForStay(room?.roomNumber || 'selected', 'Choose another room or cancel the edit.'));
        }
        throw error;
      }
    }

    const oldDates = getDatesBetween(res.checkInDate, res.checkOutDate);
    const newDates = getDatesBetween(input.checkInDate, input.checkOutDate);
    const toReserve = newDates.filter((date) => !oldDates.includes(date));
    if (toReserve.length > 0) {
      const category = await categoryNightsAvailable(
        tx,
        propertyId,
        res.roomTypeId,
        input.checkInDate,
        input.checkOutDate,
        res.id,
      );
      if (category.minAvailable < 1) {
        const [room] = res.roomId
          ? await tx.select({ roomNumber: rooms.roomNumber }).from(rooms).where(eq(rooms.id, res.roomId)).limit(1)
          : [{ roomNumber: null }];
        const detail = categorySoldOutMessage(category.blockers);
        throw new Error(room?.roomNumber ? roomUnavailableForStay(room.roomNumber, detail) : detail);
      }
    }
  }

  if (preview) {
    return { preview: true, financial, reservation: { ...res, checkInDate: input.checkInDate, checkOutDate: input.checkOutDate, nights, numGuests: input.numGuests, totalAmountMinorUnits: nextTotal } };
  }

  if (res.roomTypeId) {
    const oldDates = getDatesBetween(res.checkInDate, res.checkOutDate);
    const newDates = getDatesBetween(input.checkInDate, input.checkOutDate);
    const toRelease = oldDates.filter((date) => !newDates.includes(date));
    const toReserve = newDates.filter((date) => !oldDates.includes(date));
    if (toRelease.length > 0) await releaseInventoryInTransaction(tx, propertyId, res.roomTypeId, toRelease, 1);
    if (toReserve.length > 0) {
      try {
        await reserveInventoryInTransaction(tx, propertyId, res.roomTypeId, toReserve, 1);
      } catch (error) {
        if (error instanceof Error && /no longer available for date/i.test(error.message)) {
          const category = await categoryNightsAvailable(tx, propertyId, res.roomTypeId, input.checkInDate, input.checkOutDate, res.id);
          throw new Error(categorySoldOutMessage(category.blockers));
        }
        throw error;
      }
    }
  }

  const nextRoomId = res.apartmentId ? null : input.roomId === undefined ? res.roomId : input.roomId;
  const changes: string[] = [];
  if (input.checkInDate !== res.checkInDate) changes.push(`Check-in changed ${res.checkInDate} → ${input.checkInDate}`);
  if (input.checkOutDate !== res.checkOutDate) changes.push(`Checkout changed ${res.checkOutDate} → ${input.checkOutDate}`);
  if (input.numGuests !== res.numGuests) changes.push(`Guest count changed ${res.numGuests} → ${input.numGuests}`);
  if (financial.mode === 'extension') {
    changes.push(
      `${financial.additionalNights} extra night${financial.additionalNights === 1 ? '' : 's'} added for ${formatNaira(financial.appliedAmountMinorUnits)}`,
    );
  }
  if (financial.mode === 'shortening' && financial.appliedAmountMinorUnits > 0) {
    changes.push(`Accommodation reduced by ${formatNaira(financial.appliedAmountMinorUnits)}`);
  }

  let nextRoomNumber: string | null = null;
  if (!res.apartmentId && nextRoomId && nextRoomId !== res.roomId) {
    const [nextRoom] = await tx.select().from(rooms).where(eq(rooms.id, nextRoomId)).limit(1);
    const [previousRoom] = res.roomId ? await tx.select().from(rooms).where(eq(rooms.id, res.roomId)).limit(1) : [null];
    nextRoomNumber = nextRoom?.roomNumber || null;
    changes.push(`Room changed ${previousRoom?.roomNumber || 'Unassigned'} → ${nextRoom?.roomNumber || 'Unassigned'}`);
    if (res.status === 'checked_in') {
      if (previousRoom) {
        await tx.update(rooms).set({ operationalStatus: 'available', housekeepingStatus: 'dirty', updatedAt: new Date() }).where(eq(rooms.id, previousRoom.id));
        await ensureOpenHousekeepingTask(tx, { propertyId, roomId: previousRoom.id, notes: `Guest moved from room ${previousRoom.roomNumber}` });
      }
      await tx.update(rooms).set({ operationalStatus: 'occupied', updatedAt: new Date() }).where(eq(rooms.id, nextRoomId));
    }
  }

  const [updated] = await tx
    .update(reservations)
    .set({
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      nights,
      numGuests: input.numGuests,
      adults: input.numGuests,
      children: 0,
      roomId: res.apartmentId ? null : nextRoomId,
      totalAmountMinorUnits: nextTotal,
      paymentStatus: nextPaymentStatus(res.paymentStatus, res.paidAmountMinorUnits, nextTotal),
      updatedAt: new Date(),
    })
    .where(eq(reservations.id, res.id))
    .returning();

  if (changes.length > 0) {
    await tx.insert(reservationEvents).values({
      reservationId: res.id,
      actorId: actor.id || undefined,
      actorName: actor.name,
      eventType: 'reservation_edited',
      description: `${changes.join('. ')}. Edited by ${actor.name}.`,
      metadata: {
        changes,
        mode: financial.mode,
        previousCheckOutDate: res.checkOutDate,
        nextCheckOutDate: input.checkOutDate,
        previousNights: res.nights,
        additionalNights: financial.additionalNights,
        previousTotalMinorUnits: res.totalAmountMinorUnits,
        configuredNightlyRateMinorUnits: financial.configuredNightlyRateMinorUnits,
        suggestedAmountMinorUnits: financial.suggestedAmountMinorUnits,
        extensionAmountMinorUnits: financial.appliedAmountMinorUnits,
        nextTotalMinorUnits: nextTotal,
        paidAmountMinorUnits: res.paidAmountMinorUnits,
        reason: input.extensionReason?.trim() || null,
        actorName: actor.name,
        paymentsUntouched: true,
        invoicesUntouched: true,
      },
    });
  }

  return {
    preview: false,
    financial,
    roomNumber: nextRoomNumber,
    reservation: updated,
  };
}
