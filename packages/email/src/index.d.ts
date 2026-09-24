import { Resend } from 'resend';
export declare const resend: Resend | null;
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
export declare function sendBookingConfirmationEmail(params: BookingConfirmationEmailParams): Promise<{
    success: boolean;
    simulated: boolean;
    data?: undefined;
    error?: undefined;
} | {
    success: boolean;
    data: import("resend").CreateEmailResponse;
    simulated?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: unknown;
    simulated?: undefined;
    data?: undefined;
}>;
/**
 * Send direct bank transfer instructions for reservation settlement
 */
export declare function sendBankTransferInstructionsEmail(params: BankTransferInstructionsParams): Promise<{
    success: boolean;
    simulated: boolean;
    data?: undefined;
    error?: undefined;
} | {
    success: boolean;
    data: import("resend").CreateEmailResponse;
    simulated?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: unknown;
    simulated?: undefined;
    data?: undefined;
}>;
//# sourceMappingURL=index.d.ts.map