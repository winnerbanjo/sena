import { EmailRenderResult } from './account';
export interface EditorialProductEmailParams {
    editionNumber: number;
    issueTitle: string;
    leadArticle: {
        title: string;
        subheading: string;
        author: string;
        contentHtml: string;
    };
    productNotes?: Array<{
        feature: string;
        description: string;
        impact: string;
    }>;
    curatedLink?: {
        title: string;
        summary: string;
        url: string;
    };
    unsubscribeUrl?: string;
}
export declare function renderEditorialProductEmail(params: EditorialProductEmailParams): EmailRenderResult;
//# sourceMappingURL=editorial.d.ts.map