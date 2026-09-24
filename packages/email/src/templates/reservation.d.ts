import { EmailRenderResult } from './account';
export interface BookingConfirmationParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    roomType: string;
    roomNumber?: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalAmountFormatted: string;
    checkInTime?: string;
    checkOutTime?: string;
    specialRequests?: string;
    manageBookingUrl?: string;
}
export declare function renderBookingConfirmationEmail(params: BookingConfirmationParams): EmailRenderResult;
export interface NewBookingHotelParams {
    propertyName: string;
    reference: string;
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    roomType: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalAmountFormatted: string;
    paymentStatus: string;
    channel: 'direct_engine' | 'front_desk' | 'ota' | 'corporate';
    dashboardUrl?: string;
}
export declare function renderNewBookingHotelEmail(params: NewBookingHotelParams): EmailRenderResult;
export interface BookingModifiedParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    roomType: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalAmountFormatted: string;
    modificationsSummary: string;
    manageBookingUrl?: string;
}
export declare function renderBookingModifiedEmail(params: BookingModifiedParams): EmailRenderResult;
export interface BookingCancelledParams {
    guestName: string;
    reference: string;
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    propertyLogoUrl?: string;
    roomType: string;
    checkInDate: string;
    checkOutDate: string;
    refundPolicyNotice?: string;
}
export declare function renderBookingCancelledEmail(params: BookingCancelledParams): EmailRenderResult;
//# sourceMappingURL=reservation.d.ts.map