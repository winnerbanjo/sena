"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resend = void 0;
exports.sendSenaEmail = sendSenaEmail;
const resend_1 = require("resend");
const database_1 = require("@sena/database");
const brand_1 = require("./components/brand");
const registry_1 = require("./registry");
const resendApiKey = process.env.RESEND_API_KEY;
exports.resend = resendApiKey ? new resend_1.Resend(resendApiKey) : null;
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
async function sendSenaEmail(type, params, options) {
    const recipient = Array.isArray(options.to) ? options.to[0] : options.to;
    try {
        // 1. Idempotency Check
        if (options.idempotencyKey) {
            try {
                const existing = await database_1.db
                    .select()
                    .from(database_1.emailLogs)
                    .where((0, database_1.eq)(database_1.emailLogs.idempotencyKey, options.idempotencyKey))
                    .limit(1);
                if (existing.length > 0 && existing[0].status === 'sent') {
                    return {
                        success: true,
                        messageId: existing[0].resendMessageId || undefined,
                        simulated: false,
                    };
                }
            }
            catch (idempErr) {
                console.warn('[EMAIL] Failed to check idempotency in db:', idempErr);
            }
        }
        // 2. Preferences Check (for marketing or non-critical operational briefs)
        if (!options.skipPreferencesCheck) {
            try {
                const prefs = await database_1.db
                    .select()
                    .from(database_1.emailPreferences)
                    .where((0, database_1.eq)(database_1.emailPreferences.email, recipient))
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
            }
            catch (prefErr) {
                console.warn('[EMAIL] Failed to check email preferences:', prefErr);
            }
        }
        // 3. Render Template
        const renderer = registry_1.EMAIL_RENDERERS[type];
        if (!renderer) {
            throw new Error(`Unrecognized email template type: ${type}`);
        }
        const { subject, html, text } = renderer(params);
        // 4. Resolve Sender & Reply-To
        let fromAddress = options.from || brand_1.SENA_BRAND.defaultFrom;
        let replyToAddress = options.replyTo;
        // Smart context headers for property guest emails
        const propertyParam = params;
        if (propertyParam.propertyName && !options.from) {
            fromAddress = `${propertyParam.propertyName} via Sena <notifications@sena.ng>`;
        }
        if (propertyParam.propertyEmail && !replyToAddress) {
            replyToAddress = propertyParam.propertyEmail;
        }
        else if (!replyToAddress) {
            replyToAddress = brand_1.SENA_BRAND.supportEmail;
        }
        // 5. Send Email via Resend
        let resendMessageId;
        if (!exports.resend) {
            console.log(`[DEV EMAIL] Simulated delivery for ${type} to ${recipient}`);
            resendMessageId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
        else {
            const resendRes = await exports.resend.emails.send({
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
            await database_1.db.insert(database_1.emailLogs).values({
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
        }
        catch (logErr) {
            console.warn('[EMAIL] Non-fatal error recording email log in database:', logErr);
        }
        return {
            success: true,
            messageId: resendMessageId,
            simulated: !exports.resend,
        };
    }
    catch (error) {
        console.error(`[EMAIL ERROR] Failed sending ${type} to ${recipient}:`, error);
        // Record failure in audit log if possible
        try {
            await database_1.db.insert(database_1.emailLogs).values({
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
        }
        catch (dbErr) {
            // Ignore database logging failure to avoid crashing caller
        }
        return {
            success: false,
            error: error.message || 'Unknown email delivery failure',
        };
    }
}
