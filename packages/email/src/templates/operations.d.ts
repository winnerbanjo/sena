import { EmailRenderResult } from './account';
export interface DailyBriefParams {
    recipientName: string;
    propertyName: string;
    dateFormatted: string;
    arrivalsCount: number;
    departuresCount: number;
    inHouseGuestsCount: number;
    occupancyPercentage: number;
    dirtyRoomsCount: number;
    revenueExpectedTodayFormatted: string;
    vipArrivals?: string[];
    dashboardUrl?: string;
}
export declare function renderDailyBriefEmail(params: DailyBriefParams): EmailRenderResult;
export interface EndOfDaySummaryParams {
    recipientName: string;
    propertyName: string;
    auditDateFormatted: string;
    totalRoomsSold: number;
    occupancyPercentage: number;
    adrFormatted: string;
    revParFormatted: string;
    totalDailyRevenueFormatted: string;
    directBookingSharePercentage: number;
    commissionSavedFormatted: string;
    dashboardReportsUrl?: string;
}
export declare function renderEndOfDaySummaryEmail(params: EndOfDaySummaryParams): EmailRenderResult;
export interface DirectBookingAlertParams {
    recipientName: string;
    propertyName: string;
    reference: string;
    guestName: string;
    roomType: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalAmountFormatted: string;
    bookingUrl?: string;
}
export declare function renderDirectBookingAlertEmail(params: DirectBookingAlertParams): EmailRenderResult;
//# sourceMappingURL=operations.d.ts.map