import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Opaque, authenticated share references keep database identifiers out of public URLs.
// This reuses the application's existing server secret and requires no schema changes.
function key() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('Invoice sharing is unavailable');
  return createHash('sha256').update('sena-public-invoice-v1:').update(secret).digest();
}
export function createPublicInvoiceToken(invoiceId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(invoiceId, 'utf8'), cipher.final()]);
  return 'v1_' + Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function resolvePublicInvoiceToken(token: string): string | null {
  if (!/^v1_[A-Za-z0-9_-]{86}$/.test(token)) return null;
  try {
    const bytes = Buffer.from(token.slice(3), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const id = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
  } catch { return null; }
}
