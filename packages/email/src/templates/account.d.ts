export interface EmailRenderResult {
    subject: string;
    html: string;
    text: string;
}
export interface WelcomeEmailParams {
    userName: string;
    organizationName: string;
    propertyName?: string;
    setupUrl?: string;
}
export declare function renderWelcomeEmail(params: WelcomeEmailParams): EmailRenderResult;
export interface VerifyEmailParams {
    userName: string;
    verificationUrl?: string;
    otpCode?: string;
    expiresInMinutes?: number;
}
export declare function renderVerifyEmail(params: VerifyEmailParams): EmailRenderResult;
export interface PropertySetupCompleteParams {
    userName: string;
    propertyName: string;
    propertyCode: string;
    bookingUrl: string;
    roomCount: number;
}
export declare function renderPropertySetupCompleteEmail(params: PropertySetupCompleteParams): EmailRenderResult;
export interface SignInAlertParams {
    userName: string;
    userEmail: string;
    ipAddress?: string;
    device?: string;
    location?: string;
    timestamp?: string;
}
export declare function renderSignInAlertEmail(params: SignInAlertParams): EmailRenderResult;
export interface PasswordResetParams {
    userName: string;
    resetUrl: string;
    expiresInMinutes?: number;
}
export declare function renderPasswordResetEmail(params: PasswordResetParams): EmailRenderResult;
export interface PasswordChangedParams {
    userName: string;
    timestamp?: string;
    ipAddress?: string;
}
export declare function renderPasswordChangedEmail(params: PasswordChangedParams): EmailRenderResult;
//# sourceMappingURL=account.d.ts.map