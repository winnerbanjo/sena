import { EmailRenderResult } from './account';
export interface SecurityEmailChangedParams {
    userName: string;
    oldEmail: string;
    newEmail: string;
    timestamp?: string;
    ipAddress?: string;
}
export declare function renderSecurityEmailChangedEmail(params: SecurityEmailChangedParams): EmailRenderResult;
export interface SecurityNewDeviceParams {
    userName: string;
    device: string;
    browser: string;
    ipAddress: string;
    approxLocation?: string;
    timestamp?: string;
}
export declare function renderSecurityNewDeviceEmail(params: SecurityNewDeviceParams): EmailRenderResult;
export interface SecuritySuspiciousLoginParams {
    userName: string;
    ipAddress: string;
    attemptLocation?: string;
    device?: string;
    timestamp?: string;
}
export declare function renderSecuritySuspiciousLoginEmail(params: SecuritySuspiciousLoginParams): EmailRenderResult;
export interface SecurityMfaEnabledParams {
    userName: string;
    timestamp?: string;
}
export declare function renderSecurityMfaEnabledEmail(params: SecurityMfaEnabledParams): EmailRenderResult;
export interface SecurityMfaDisabledParams {
    userName: string;
    timestamp?: string;
    ipAddress?: string;
}
export declare function renderSecurityMfaDisabledEmail(params: SecurityMfaDisabledParams): EmailRenderResult;
//# sourceMappingURL=security.d.ts.map