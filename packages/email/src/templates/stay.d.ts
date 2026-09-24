import { EmailRenderResult } from './account';
export interface UpcomingStayParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    roomType: string;
    checkInDate: string;
    checkInTime?: string;
    directionsOrTips?: string;
    manageBookingUrl?: string;
}
export declare function renderUpcomingStayEmail(params: UpcomingStayParams): EmailRenderResult;
export interface CheckinConfirmationParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    roomNumber: string;
    roomType: string;
    wifiNetwork?: string;
    wifiPassword?: string;
    breakfastTimes?: string;
    checkoutDate: string;
    checkoutTime?: string;
}
export declare function renderCheckinConfirmationEmail(params: CheckinConfirmationParams): EmailRenderResult;
export interface CheckoutThankYouParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    reviewUrl?: string;
    bookAgainUrl?: string;
}
export declare function renderCheckoutThankYouEmail(params: CheckoutThankYouParams): EmailRenderResult;
export interface StayReceiptParams {
    guestName: string;
    reference: string;
    folioNumber: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    checkInDate: string;
    checkOutDate: string;
    folioItems: Array<{
        label: string;
        amount: string;
    }>;
    totalAmountFormatted: string;
    downloadUrl?: string;
}
export declare function renderStayReceiptEmail(params: StayReceiptParams): EmailRenderResult;
//# sourceMappingURL=stay.d.ts.map