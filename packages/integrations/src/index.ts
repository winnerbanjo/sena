import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
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

/**
 * Private media fallback for runs without Spaces credentials (local dev and
 * preview). Files never leave the machine and are only read through
 * authenticated API routes. Production must configure S3 credentials.
 */
const localMediaRoot = resolve(process.env.LOCAL_MEDIA_DIR || join(process.cwd(), '.local-media'));

const LOCAL_CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

function localMediaPath(key: string): string | null {
  if (!key || key.includes('\0') || key.startsWith('/') || key.startsWith('http')) return null;
  const target = resolve(localMediaRoot, key);
  if (!target.startsWith(localMediaRoot + sep)) return null;
  return target;
}

function localContentType(key: string): string | undefined {
  const extension = key.split('.').pop()?.toLowerCase() || '';
  return LOCAL_CONTENT_TYPES[extension];
}

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
    if (params.acl === 'private') {
      const target = localMediaPath(params.key);
      if (!target) throw new Error('Invalid media path.');
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, params.body);
      if (process.env.NODE_ENV === 'production') {
        console.warn('[STORAGE] Spaces credentials are not configured; private media is on local disk and will not survive a redeploy:', params.key);
      } else {
        console.log('[DEV STORAGE] Spaces S3 client not configured, stored private media locally:', params.key);
      }
      return { success: true, url: `/uploads/${params.key}`, local: true };
    }
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

export async function readPrivateMediaFromSpaces(key: string): Promise<{ body: Uint8Array; contentType?: string } | null> {
  if (!key || key.startsWith('http')) return null;
  if (!s3Client) {
    const target = localMediaPath(key);
    if (!target) return null;
    const body = await readFile(target).catch(() => null);
    if (!body) return null;
    return { body: new Uint8Array(body), contentType: localContentType(key) };
  }
  const result = await s3Client.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  if (!result.Body) return null;
  const body = await result.Body.transformToByteArray();
  return { body, contentType: result.ContentType };
}

export async function deleteMediaFromSpaces(key: string) {
  if (!key || key.startsWith('http')) return { success: true, skipped: true };
  if (!s3Client) {
    const target = localMediaPath(key);
    if (!target) return { success: true, skipped: true };
    await rm(target, { force: true });
    return { success: true, local: true };
  }
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  return { success: true };
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
