// Brand tokens & UI components
export * from './components/brand';
export * from './components/layout';
export * from './components/elements';

// Templates
export * from './templates/account';
export * from './templates/reservation';
export * from './templates/payment';
export * from './templates/stay';
export * from './templates/staff';
export * from './templates/operations';
export * from './templates/subscription';
export * from './templates/security';
export * from './templates/support';
export * from './templates/editorial';

// Registry & Sender Engine
export * from './registry';
export * from './sender';

// ----------------------------------------------------------------------
// Backward-Compatible Convenience Wrappers
// ----------------------------------------------------------------------
import {
  BookingConfirmationParams,
  NewBookingHotelParams,
} from './templates/reservation';
import {
  BankTransferInstructionsParams,
  PaymentReceivedParams,
} from './templates/payment';
import { sendSenaEmail } from './sender';

export async function sendBookingConfirmationEmail(params: {
  guestEmail: string;
  guestName: string;
  reference: string;
  propertyName: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmountFormatted: string;
  propertyAddress?: string;
  propertyPhone?: string;
}) {
  return sendSenaEmail(
    'reservation.booking_confirmation',
    {
      guestName: params.guestName,
      reference: params.reference,
      propertyName: params.propertyName,
      propertyAddress: params.propertyAddress,
      propertyPhone: params.propertyPhone,
      roomType: params.roomType,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      nights: params.nights,
      totalAmountFormatted: params.totalAmountFormatted,
    },
    {
      to: params.guestEmail,
      idempotencyKey: `booking_conf_${params.reference}`,
      relatedEntity: 'reservation',
      relatedId: params.reference,
    }
  );
}

export async function sendBankTransferInstructionsEmail(params: {
  guestEmail: string;
  guestName: string;
  reference: string;
  propertyName: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountFormatted: string;
  whatsappContact?: string;
  propertyPhone?: string;
}) {
  return sendSenaEmail(
    'payment.bank_transfer_instructions',
    {
      guestName: params.guestName,
      reference: params.reference,
      propertyName: params.propertyName,
      bankName: params.bankName,
      accountNumber: params.accountNumber,
      accountName: params.accountName,
      amountFormatted: params.amountFormatted,
      whatsappContact: params.whatsappContact,
      propertyPhone: params.propertyPhone,
    },
    {
      to: params.guestEmail,
      idempotencyKey: `bank_transfer_${params.reference}`,
      relatedEntity: 'reservation',
      relatedId: params.reference,
    }
  );
}

export async function sendPaymentReceiptEmail(params: {
  guestEmail: string;
  guestName: string;
  reference: string;
  paymentReference: string;
  propertyName: string;
  amountFormatted: string;
  paymentMethod: string;
  paidAt: string;
}) {
  return sendSenaEmail(
    'payment.payment_received',
    {
      guestName: params.guestName,
      reference: params.reference,
      paymentReference: params.paymentReference,
      propertyName: params.propertyName,
      amountFormatted: params.amountFormatted,
      paymentMethod: params.paymentMethod,
      paidAt: params.paidAt,
    },
    {
      to: params.guestEmail,
      idempotencyKey: `payment_receipt_${params.paymentReference}`,
      relatedEntity: 'payment',
      relatedId: params.paymentReference,
    }
  );
}
