import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const defaultSender = process.env.EMAIL_FROM || 'Sena <notifications@sena.ng>';

// Initialize Resend client safely
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export interface BookingConfirmationEmailParams {
  guestEmail: string;
  guestName: string;
  reference: string;
  propertyName: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmountFormatted: string;
}

export interface BankTransferInstructionsParams {
  guestEmail: string;
  guestName: string;
  reference: string;
  propertyName: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amountFormatted: string;
  whatsappContact?: string;
}

export interface PaymentReceiptParams {
  guestEmail: string;
  guestName: string;
  reference: string;
  propertyName: string;
  amountFormatted: string;
  paidAt: string;
}

/**
 * Send an official booking confirmation email to the guest
 */
export async function sendBookingConfirmationEmail(params: BookingConfirmationEmailParams) {
  if (!resend) {
    console.log('[DEV EMAIL - Booking Confirmation]', params);
    return { success: true, simulated: true };
  }

  try {
    const response = await resend.emails.send({
      from: defaultSender,
      to: params.guestEmail,
      subject: `Reservation Confirmed: ${params.reference} at ${params.propertyName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #191816; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #E8E2DA; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="color: #71382D; margin: 0; font-size: 24px; font-weight: 500;">${params.propertyName}</h1>
            <p style="color: #7A7267; margin: 4px 0 0 0; font-size: 13px;">Reservation Confirmation · ${params.reference}</p>
          </div>

          <p style="font-size: 15px; line-height: 1.5;">Dear ${params.guestName},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #3A352F;">
            Your stay at <strong>${params.propertyName}</strong> has been successfully confirmed. We look forward to welcoming you.
          </p>

          <div style="background-color: #FAF9F7; border: 1px solid #E8E2DA; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #7A7267;">Booking Reference:</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #71382D;">${params.reference}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #7A7267;">Room Category:</td>
                <td style="padding: 6px 0; font-weight: 600; text-align: right;">${params.roomType}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #7A7267;">Check-in Date:</td>
                <td style="padding: 6px 0; text-align: right;">${params.checkInDate} (From 2:00 PM)</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #7A7267;">Check-out Date:</td>
                <td style="padding: 6px 0; text-align: right;">${params.checkOutDate} (By 11:00 AM)</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #7A7267;">Duration:</td>
                <td style="padding: 6px 0; text-align: right;">${params.nights} ${params.nights === 1 ? 'night' : 'nights'}</td>
              </tr>
              <tr style="border-top: 1px solid #E8E2DA;">
                <td style="padding: 10px 0 4px 0; font-weight: bold; color: #191816;">Total Amount:</td>
                <td style="padding: 10px 0 4px 0; font-weight: bold; font-size: 16px; color: #B85C3E; text-align: right;">${params.totalAmountFormatted}</td>
              </tr>
            </table>
          </div>

          <p style="font-size: 12px; color: #7A7267; margin-top: 24px;">
            If you need to modify your stay dates or arrange airport pickup, please reply directly to this email or message our front desk.
          </p>

          <div style="border-top: 1px solid #E8E2DA; padding-top: 16px; margin-top: 32px; font-size: 11px; color: #9A9287; text-align: center;">
            Powered by Sena Hospitality Operating System · sena.ng
          </div>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error('[RESEND ERROR]', error);
    return { success: false, error };
  }
}

/**
 * Send direct bank transfer instructions for reservation settlement
 */
export async function sendBankTransferInstructionsEmail(params: BankTransferInstructionsParams) {
  if (!resend) {
    console.log('[DEV EMAIL - Bank Transfer Instructions]', params);
    return { success: true, simulated: true };
  }

  try {
    const response = await resend.emails.send({
      from: defaultSender,
      to: params.guestEmail,
      subject: `Payment Instructions for Booking ${params.reference} at ${params.propertyName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #191816; background-color: #ffffff;">
          <h2 style="color: #71382D; margin-top: 0;">Direct Bank Transfer Instructions</h2>
          <p style="font-size: 14px; line-height: 1.5;">Dear ${params.guestName},</p>
          <p style="font-size: 14px; line-height: 1.5;">
            Thank you for booking with <strong>${params.propertyName}</strong>. Please transfer the reservation total of <strong>${params.amountFormatted}</strong> to the property's official bank account:
          </p>

          <div style="background-color: #FAF9F7; border: 1px solid #E8E2DA; border-radius: 6px; padding: 18px; margin: 20px 0;">
            <div style="margin-bottom: 10px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #7A7267; display: block;">Bank Name</span>
              <strong style="font-size: 15px; color: #191816;">${params.bankName}</strong>
            </div>
            <div style="margin-bottom: 10px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #7A7267; display: block;">Account Number</span>
              <strong style="font-size: 18px; font-family: monospace; letter-spacing: 1px; color: #B85C3E;">${params.accountNumber}</strong>
            </div>
            <div style="margin-bottom: 10px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #7A7267; display: block;">Account Name (Beneficiary)</span>
              <strong style="font-size: 13px; color: #191816;">${params.accountName}</strong>
            </div>
            <div style="border-top: 1px solid #E8E2DA; padding-top: 10px; margin-top: 10px;">
              <span style="font-size: 11px; text-transform: uppercase; color: #7A7267; display: block;">Payment Narration / Reference</span>
              <strong style="font-size: 14px; font-family: monospace; color: #71382D;">${params.reference}</strong>
            </div>
          </div>

          <p style="font-size: 13px; color: #3A352F; line-height: 1.5;">
            After making the transfer, please send your transaction receipt to our front desk via WhatsApp${params.whatsappContact ? ` at <strong>${params.whatsappContact}</strong>` : ''} for instant check-in clearance.
          </p>

          <div style="border-top: 1px solid #E8E2DA; padding-top: 16px; margin-top: 32px; font-size: 11px; color: #9A9287; text-align: center;">
            Sena Hospitality Operating System · Secure Direct Payouts
          </div>
        </div>
      `,
    });
    return { success: true, data: response };
  } catch (error) {
    console.error('[RESEND ERROR]', error);
    return { success: false, error };
  }
}
