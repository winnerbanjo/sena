import { Resend } from 'resend';
import { EmailParamMap, SenaEmailType } from './registry';
export declare const resend: Resend | null;
export interface SendEmailOptions {
    to: string | string[];
    replyTo?: string;
    from?: string;
    idempotencyKey?: string;
    organizationId?: string;
    propertyId?: string;
    relatedEntity?: string;
    relatedId?: string;
    metadata?: Record<string, any>;
    skipPreferencesCheck?: boolean;
}
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    simulated?: boolean;
    suppressed?: boolean;
}
/**
 * Universal Sena Transactional Email Dispatcher
 *
 * Guarantees:
 * 1. Resend transactional delivery with clean plain-text fallback.
 * 2. Automatic audit logging to `email_logs` table.
 * 3. Idempotency protection against duplicate sends.
 * 4. Compliance with user email preferences.
 * 5. Non-blocking error containment (never crashes parent transaction).
 */
export declare function sendSenaEmail<K extends SenaEmailType>(type: K, params: EmailParamMap[K], options: SendEmailOptions): Promise<SendEmailResult>;
//# sourceMappingURL=sender.d.ts.map