import {
  and,
  apartments,
  db,
  eq,
  guests,
  inArray,
  paymentReceipts,
  payments,
  properties,
  propertyInvoices,
  reservations,
  roomTypes,
  websiteConfigs,
} from '@sena/database';
import { presentInvoiceDocument } from './invoice-document';

export async function loadInvoicePresentation(invoiceId: string, audience: 'staff' | 'public') {
  const invoice = await db.query.propertyInvoices.findFirst({
    where: eq(propertyInvoices.id, invoiceId),
  });
  if (!invoice) return null;

  const [property] = await db
    .select({
      name: properties.name,
      address: properties.address,
      phone: properties.phone,
      email: properties.email,
    })
    .from(properties)
    .where(eq(properties.id, invoice.propertyId))
    .limit(1);

  const [branding] = await db
    .select({ logoUrl: websiteConfigs.logoUrl })
    .from(websiteConfigs)
    .where(eq(websiteConfigs.propertyId, invoice.propertyId))
    .limit(1);

  let reservation: {
    reference: string;
    guestName: string;
    accommodation: string;
    checkInDate: string;
    checkOutDate: string;
  } | null = null;
  if (invoice.reservationId) {
    const [row] = await db
      .select({
        reference: reservations.reference,
        guestName: guests.fullName,
        roomTypeName: roomTypes.name,
        apartmentName: apartments.name,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
      })
      .from(reservations)
      .leftJoin(guests, eq(reservations.guestId, guests.id))
      .leftJoin(roomTypes, eq(reservations.roomTypeId, roomTypes.id))
      .leftJoin(apartments, eq(reservations.apartmentId, apartments.id))
      .where(and(eq(reservations.id, invoice.reservationId), eq(reservations.propertyId, invoice.propertyId)))
      .limit(1);
    if (row) {
      reservation = {
        reference: row.reference,
        guestName: row.guestName || invoice.recipientName,
        accommodation: row.apartmentName || row.roomTypeName || '',
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
      };
    }
  }

  const paymentRows = await db
    .select({
      id: payments.id,
      amountMinorUnits: payments.amountMinorUnits,
      method: payments.method,
      providerReference: payments.providerReference,
      paidAt: payments.paidAt,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .where(and(
      eq(payments.invoiceId, invoice.id),
      eq(payments.propertyId, invoice.propertyId),
      eq(payments.status, 'successful'),
    ))
    .orderBy(payments.createdAt);

  const paymentIds = paymentRows.map((payment) => payment.id);
  const receiptRows = paymentIds.length
    ? await db
        .select({ paymentId: paymentReceipts.paymentId })
        .from(paymentReceipts)
        .where(and(eq(paymentReceipts.propertyId, invoice.propertyId), inArray(paymentReceipts.paymentId, paymentIds)))
    : [];
  const receipts = new Set(receiptRows.map((row) => row.paymentId));

  const document = presentInvoiceDocument({
    property,
    logoUrl: branding?.logoUrl || null,
    reservation,
    payments: paymentRows.map((payment) => ({
      id: payment.id,
      paidAt: (payment.paidAt || payment.createdAt).toISOString(),
      method: payment.method,
      reference: payment.providerReference || '',
      amountMinorUnits: payment.amountMinorUnits,
      hasReceipt: receipts.has(payment.id),
    })),
    audience,
  });

  return { invoice, ...document };
}
