import { Resend } from 'resend';
import { db, emailLogs, emailPreferences, eq, and } from '@sena/database';
import { SENA_BRAND } from './components/brand';
import { EMAIL_RENDERERS, EmailParamMap, SenaEmailType } from './registry';

const resendApiKey = process.env.RESEND_API_KEY;
export const resend = resendApiKey ? new Resend(resendApiKey) : null;

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
export async function sendSenaEmail<K extends SenaEmailType>(
  type: K,
  params: EmailParamMap[K],
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const recipient = Array.isArray(options.to) ? options.to[0] : options.to;

  try {
    // 1. Idempotency Check
    if (options.idempotencyKey) {
      try {
        const existing = await db
          .select()
          .from(emailLogs)
          .where(eq(emailLogs.idempotencyKey, options.idempotencyKey))
          .limit(1);

        if (existing.length > 0 && existing[0].status === 'sent') {
          return {
            success: true,
            messageId: existing[0].resendMessageId || undefined,
            simulated: false,
          };
        }
      } catch (idempErr) {
        console.warn('[EMAIL] Failed to check idempotency in db:', idempErr);
      }
    }

    // 2. Preferences Check (for marketing or non-critical operational briefs)
    if (!options.skipPreferencesCheck) {
      try {
        const prefs = await db
          .select()
          .from(emailPreferences)
          .where(eq(emailPreferences.email, recipient))
          .limit(1);

        if (prefs.length > 0) {
          const pref = prefs[0];
          if (type === 'editorial.product_update' && pref.marketingUnsubscribed) {
            console.log(`[EMAIL] Suppressed ${type} to ${recipient} (unsubscribed from editorial)`);
            return { success: true, suppressed: true };
          }
          if (type.startsWith('operations.') && pref.operationalDisabled) {
            console.log(`[EMAIL] Suppressed ${type} to ${recipient} (operational briefs disabled)`);
            return { success: true, suppressed: true };
          }
        }
      } catch (prefErr) {
        console.warn('[EMAIL] Failed to check email preferences:', prefErr);
      }
    }

    // 3. Render Template
    const renderer = EMAIL_RENDERERS[type] as (p: EmailParamMap[K]) => {
      subject: string;
      html: string;
      text: string;
    };

    if (!renderer) {
      throw new Error(`Unrecognized email template type: ${type}`);
    }

    const { subject, html, text } = renderer(params);

    // 4. Resolve Sender & Reply-To
    let fromAddress = options.from || SENA_BRAND.defaultFrom;
    let replyToAddress = options.replyTo;

    // Smart context headers for property guest emails
    const propertyParam = params as any;
    if (propertyParam.propertyName && !options.from) {
      fromAddress = `${propertyParam.propertyName} via Sena <notifications@sena.ng>`;
    }
    if (propertyParam.propertyEmail && !replyToAddress) {
      replyToAddress = propertyParam.propertyEmail;
    } else if (!replyToAddress) {
      replyToAddress = SENA_BRAND.supportEmail;
    }

    // 5. Send Email via Resend
    let resendMessageId: string | undefined;

    if (!resend) {
      console.log(`[DEV EMAIL] Simulated delivery for ${type} to ${recipient}`);
      resendMessageId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    } else {
      const resendRes = await resend.emails.send({
        from: fromAddress,
        to: options.to,
        replyTo: replyToAddress,
        subject,
        html,
        text,
      });

      if (resendRes.error) {
        throw new Error(`Resend Error: ${resendRes.error.message || JSON.stringify(resendRes.error)}`);
      }

      resendMessageId = resendRes.data?.id;
    }

    // 6. Audit Log to Database
    try {
      await db.insert(emailLogs).values({
        organizationId: options.organizationId || null,
        propertyId: options.propertyId || null,
        recipient,
        emailType: type,
        subject,
        idempotencyKey: options.idempotencyKey || null,
        resendMessageId: resendMessageId || null,
        status: 'sent',
        relatedEntity: options.relatedEntity || null,
        relatedId: options.relatedId || null,
        metadata: options.metadata || null,
      });
    } catch (logErr) {
      console.warn('[EMAIL] Non-fatal error recording email log in database:', logErr);
    }

    return {
      success: true,
      messageId: resendMessageId,
      simulated: !resend,
    };
  } catch (error: any) {
    console.error(`[EMAIL ERROR] Failed sending ${type} to ${recipient}:`, error);

    // Record failure in audit log if possible
    try {
      await db.insert(emailLogs).values({
        organizationId: options.organizationId || null,
        propertyId: options.propertyId || null,
        recipient,
        emailType: type,
        subject: `[Failed Send] ${type}`,
        idempotencyKey: options.idempotencyKey || null,
        status: 'failed',
        error: error.message || String(error),
        relatedEntity: options.relatedEntity || null,
        relatedId: options.relatedId || null,
        metadata: options.metadata || null,
      });
    } catch (dbErr) {
      // Ignore database logging failure to avoid crashing caller
    }

    return {
      success: false,
      error: error.message || 'Unknown email delivery failure',
    };
  }
}
