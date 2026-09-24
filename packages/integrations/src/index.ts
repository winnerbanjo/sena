import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Redis from 'ioredis';

// ==========================================
// 1. DigitalOcean Spaces (S3 Compatible Storage)
// ==========================================

const s3Endpoint = process.env.S3_ENDPOINT || 'https://lon1.digitaloceanspaces.com';
const s3Region = process.env.S3_REGION || 'lon1';
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
export const S3_BUCKET = process.env.S3_BUCKET || 'sena-prod-media';

export const s3Client =
  s3AccessKeyId && s3SecretAccessKey
    ? new S3Client({
        endpoint: s3Endpoint,
        region: s3Region,
        credentials: {
          accessKeyId: s3AccessKeyId,
          secretAccessKey: s3SecretAccessKey,
        },
      })
    : null;

export function getSpacesPublicUrl(key: string): string {
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  return `https://${S3_BUCKET}.${s3Region}.digitaloceanspaces.com/${cleanKey}`;
}

export async function uploadMediaToSpaces(params: {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  acl?: 'public-read' | 'private';
}) {
  if (!s3Client) {
    console.log('[DEV STORAGE] Spaces S3 client not configured, simulating upload:', params.key);
    return { success: true, url: `/uploads/${params.key}`, simulated: true };
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
    ACL: params.acl || 'public-read',
  });

  await s3Client.send(command);
  return {
    success: true,
    url: getSpacesPublicUrl(params.key),
  };
}

// ==========================================
// 2. DigitalOcean Valkey / Redis Cache
// ==========================================

const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl
  ? new Redis(redisUrl, {
      tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    })
  : null;

export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch (err) {
    console.error('[REDIS ERROR: get]', err);
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('[REDIS ERROR: set]', err);
  }
}
