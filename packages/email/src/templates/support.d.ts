import { EmailRenderResult } from './account';
export interface SupportRequestReceivedParams {
    userName: string;
    ticketId: string;
    subject: string;
    messageSnippet: string;
}
export declare function renderSupportRequestReceivedEmail(params: SupportRequestReceivedParams): EmailRenderResult;
export interface SupportStaffReplyParams {
    userName: string;
    agentName: string;
    ticketId: string;
    subject: string;
    replyContentHtml: string;
}
export declare function renderSupportStaffReplyEmail(params: SupportStaffReplyParams): EmailRenderResult;
export interface SupportTicketResolvedParams {
    userName: string;
    ticketId: string;
    subject: string;
    satisfactionSurveyUrl?: string;
}
export declare function renderSupportTicketResolvedEmail(params: SupportTicketResolvedParams): EmailRenderResult;
//# sourceMappingURL=support.d.ts.map