import { EmailRenderResult } from './account';
export interface PaymentReceivedParams {
    guestName: string;
    reference: string;
    paymentReference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    amountFormatted: string;
    paymentMethod: string;
    paidAt: string;
    items?: Array<{
        label: string;
        amount: string;
    }>;
    receiptDownloadUrl?: string;
}
export declare function renderPaymentReceivedEmail(params: PaymentReceivedParams): EmailRenderResult;
export interface BankTransferInstructionsParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    amountFormatted: string;
    whatsappContact?: string;
    expiresInHours?: number;
}
export declare function renderBankTransferInstructionsEmail(params: BankTransferInstructionsParams): EmailRenderResult;
export interface PaymentPendingParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    amountFormatted: string;
    paymentMethod: string;
}
export declare function renderPaymentPendingEmail(params: PaymentPendingParams): EmailRenderResult;
export interface PaymentFailedParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    amountFormatted: string;
    retryPaymentUrl: string;
    reason?: string;
}
export declare function renderPaymentFailedEmail(params: PaymentFailedParams): EmailRenderResult;
export interface RefundConfirmationParams {
    guestName: string;
    reference: string;
    refundReference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    refundAmountFormatted: string;
    processedAt: string;
    reason?: string;
}
export declare function renderRefundConfirmationEmail(params: RefundConfirmationParams): EmailRenderResult;
//# sourceMappingURL=payment.d.ts.map