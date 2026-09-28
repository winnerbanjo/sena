import crypto from 'node:crypto';

function encryptionKey() {
  const raw = process.env.SENA_INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_UNAVAILABLE');
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_UNAVAILABLE');
  return key;
}

export function encryptIntegrationSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptIntegrationSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('CREDENTIAL_UNREADABLE');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof Error && error.message === 'ENCRYPTION_UNAVAILABLE') throw error;
    throw new Error('CREDENTIAL_UNREADABLE');
  }
}

/** Returns null only when this runtime cannot read an existing ciphertext. */
export function readIntegrationSecret(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decryptIntegrationSecret(value);
  } catch (error) {
    if (error instanceof Error && error.message === 'CREDENTIAL_UNREADABLE') return null;
    throw error;
  }
}

export const maskSecret = (suffix: string) => `••••••••••••••${suffix}`;
