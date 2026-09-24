export interface EmailLayoutOptions {
    title: string;
    previewText?: string;
    headerType?: 'platform' | 'property' | 'none';
    propertyName?: string;
    propertyLogoUrl?: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
    footerType?: 'platform' | 'property' | 'editorial' | 'none';
    unsubscribeUrl?: string;
    showSupportLink?: boolean;
}
/**
 * Standard Sena Email Layout Wrapper
 * Built with bulletproof HTML tables compatible with Gmail, Apple Mail, Outlook, and mobile screens.
 */
export declare function renderSenaEmailLayout(contentHtml: string, options: EmailLayoutOptions): string;
/**
 * Standard Sena Platform Email Header
 */
export declare function renderSenaEmailHeader(): string;
/**
 * Guest-Facing Property Email Header
 */
export declare function renderSenaPropertyHeader(params: {
    propertyName: string;
    propertyLogoUrl?: string;
    propertyAddress?: string;
    propertyPhone?: string;
}): string;
/**
 * Standard Sena Platform Footer
 */
export declare function renderSenaEmailFooter(options: {
    showSupportLink?: boolean;
    unsubscribeUrl?: string;
}): string;
/**
 * Property Guest Email Footer
 */
export declare function renderSenaPropertyFooter(params: {
    propertyName: string;
    propertyAddress?: string;
    propertyPhone?: string;
    propertyEmail?: string;
}): string;
/**
 * Editorial Product Email Footer
 */
export declare function renderSenaEditorialFooter(options: {
    unsubscribeUrl?: string;
}): string;
/**
 * Robust HTML to Plain Text converter
 */
export declare function htmlToPlainText(html: string): string;
//# sourceMappingURL=layout.d.ts.map