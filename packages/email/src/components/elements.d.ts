export declare function renderHeading(title: string, subtitle?: string, level?: 1 | 2 | 3): string;
export declare function renderParagraph(text: string, muted?: boolean): string;
export declare function renderButton(label: string, url: string, align?: 'left' | 'center' | 'right', secondary?: boolean): string;
export declare function renderCard(contentHtml: string, title?: string, badge?: {
    text: string;
    variant?: 'terracotta' | 'success' | 'warning' | 'neutral';
}): string;
export declare function renderDetailRow(label: string, value: string, isLast?: boolean, isBold?: boolean, highlightColor?: string): string;
export declare function renderDivider(): string;
export declare function renderReservationSummary(params: {
    reference: string;
    roomType: string;
    roomNumber?: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    guestName: string;
    totalAmountFormatted: string;
    statusBadge?: string;
}): string;
export declare function renderAmountSummary(params: {
    lines: Array<{
        label: string;
        amount: string;
        isBold?: boolean;
    }>;
    total: string;
    balanceDue?: string;
    isPaid?: boolean;
}): string;
/**
 * Restrained commission banner for direct bookings
 */
export declare function renderCommissionZeroBadge(): string;
export declare function renderSecurityBox(params: {
    ip?: string;
    device?: string;
    location?: string;
    time?: string;
}): string;
export declare function renderAlertCallout(message: string, variant?: 'warning' | 'info' | 'danger'): string;
//# sourceMappingURL=elements.d.ts.map