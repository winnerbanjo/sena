import { EmailRenderResult } from './account';
export interface StaffInvitationParams {
    invitedEmail: string;
    inviterName: string;
    propertyName: string;
    roleName: string;
    inviteUrl: string;
    expiresInDays?: number;
}
export declare function renderStaffInvitationEmail(params: StaffInvitationParams): EmailRenderResult;
export interface StaffInvitationAcceptedParams {
    managerName: string;
    staffName: string;
    staffEmail: string;
    roleName: string;
    propertyName: string;
    dashboardStaffUrl?: string;
}
export declare function renderStaffInvitationAcceptedEmail(params: StaffInvitationAcceptedParams): EmailRenderResult;
export interface StaffAccessRemovedParams {
    staffName: string;
    propertyName: string;
    supportEmail?: string;
}
export declare function renderStaffAccessRemovedEmail(params: StaffAccessRemovedParams): EmailRenderResult;
//# sourceMappingURL=staff.d.ts.map