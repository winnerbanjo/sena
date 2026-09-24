import { EmailRenderResult } from './account';
export interface SubscriptionActivatedParams {
    userName: string;
    organizationName: string;
    planName: string;
    billingCycle: 'monthly' | 'yearly';
    amountFormatted: string;
    roomLimit: number;
    nextBillingDate: string;
}
export declare function renderSubscriptionActivatedEmail(params: SubscriptionActivatedParams): EmailRenderResult;
export interface SubscriptionUpgradedParams {
    userName: string;
    organizationName: string;
    previousPlan: string;
    newPlan: string;
    newAmountFormatted: string;
    effectiveDate: string;
}
export declare function renderSubscriptionUpgradedEmail(params: SubscriptionUpgradedParams): EmailRenderResult;
export interface SubscriptionRenewalParams {
    userName: string;
    organizationName: string;
    planName: string;
    renewalDate: string;
    amountFormatted: string;
    paymentMethodLast4?: string;
}
export declare function renderSubscriptionRenewalEmail(params: SubscriptionRenewalParams): EmailRenderResult;
export interface SubscriptionInvoiceParams {
    userName: string;
    organizationName: string;
    invoiceNumber: string;
    billingPeriod: string;
    amountFormatted: string;
    planName: string;
    paidAt: string;
    downloadInvoiceUrl?: string;
}
export declare function renderSubscriptionInvoiceEmail(params: SubscriptionInvoiceParams): EmailRenderResult;
export interface SubscriptionPaymentFailedParams {
    userName: string;
    organizationName: string;
    planName: string;
    amountFormatted: string;
    nextRetryDate?: string;
    updateBillingUrl?: string;
}
export declare function renderSubscriptionPaymentFailedEmail(params: SubscriptionPaymentFailedParams): EmailRenderResult;
export interface SubscriptionLimitApproachingParams {
    userName: string;
    organizationName: string;
    planName: string;
    currentRoomCount: number;
    maxRoomLimit: number;
    upgradeUrl?: string;
}
export declare function renderSubscriptionLimitApproachingEmail(params: SubscriptionLimitApproachingParams): EmailRenderResult;
export interface SubscriptionCancelledParams {
    userName: string;
    organizationName: string;
    planName: string;
    accessEndDate: string;
}
export declare function renderSubscriptionCancelledEmail(params: SubscriptionCancelledParams): EmailRenderResult;
//# sourceMappingURL=subscription.d.ts.map