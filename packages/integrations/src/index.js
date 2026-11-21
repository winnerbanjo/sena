"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.s3Client = exports.S3_BUCKET = void 0;
exports.getSpacesPublicUrl = getSpacesPublicUrl;
exports.uploadMediaToSpaces = uploadMediaToSpaces;
exports.readPrivateMediaFromSpaces = readPrivateMediaFromSpaces;
exports.deleteMediaFromSpaces = deleteMediaFromSpaces;
exports.getCache = getCache;
exports.setCache = setCache;
const client_s3_1 = require("@aws-sdk/client-s3");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const ioredis_1 = __importDefault(require("ioredis"));
// ==========================================
// 1. DigitalOcean Spaces (S3 Compatible Storage)
// ==========================================
const s3Endpoint = process.env.S3_ENDPOINT || 'https://lon1.digitaloceanspaces.com';
const s3Region = process.env.S3_REGION || 'lon1';
const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID;
const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
exports.S3_BUCKET = process.env.S3_BUCKET || 'sena-prod-media';
exports.s3Client = s3AccessKeyId && s3SecretAccessKey
    ? new client_s3_1.S3Client({
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
const localMediaRoot = (0, node_path_1.resolve)(process.env.LOCAL_MEDIA_DIR || (0, node_path_1.join)(process.cwd(), '.local-media'));
const LOCAL_CONTENT_TYPES = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
};
function localMediaPath(key) {
    if (!key || key.includes('\0') || key.startsWith('/') || key.startsWith('http'))
        return null;
    const target = (0, node_path_1.resolve)(localMediaRoot, key);
    if (!target.startsWith(localMediaRoot + node_path_1.sep))
        return null;
    return target;
}
function localContentType(key) {
    const extension = key.split('.').pop()?.toLowerCase() || '';
    return LOCAL_CONTENT_TYPES[extension];
}
function getSpacesPublicUrl(key) {
    const cleanKey = key.startsWith('/') ? key.slice(1) : key;
    return `https://${exports.S3_BUCKET}.${s3Region}.digitaloceanspaces.com/${cleanKey}`;
}
async function uploadMediaToSpaces(params) {
    if (!exports.s3Client) {
        if (params.acl === 'private') {
            const target = localMediaPath(params.key);
            if (!target)
                throw new Error('Invalid media path.');
            await (0, promises_1.mkdir)((0, node_path_1.dirname)(target), { recursive: true });
            await (0, promises_1.writeFile)(target, params.body);
            if (process.env.NODE_ENV === 'production') {
                console.warn('[STORAGE] Spaces credentials are not configured; private media is on local disk and will not survive a redeploy:', params.key);
            }
            else {
                console.log('[DEV STORAGE] Spaces S3 client not configured, stored private media locally:', params.key);
            }
            return { success: true, url: `/uploads/${params.key}`, local: true };
        }
        console.log('[DEV STORAGE] Spaces S3 client not configured, simulating upload:', params.key);
        return { success: true, url: `/uploads/${params.key}`, simulated: true };
    }
    const command = new client_s3_1.PutObjectCommand({
        Bucket: exports.S3_BUCKET,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        ACL: params.acl || 'public-read',
    });
    await exports.s3Client.send(command);
    return {
        success: true,
        url: getSpacesPublicUrl(params.key),
    };
}
async function readPrivateMediaFromSpaces(key) {
    if (!key || key.startsWith('http'))
        return null;
    if (!exports.s3Client) {
        const target = localMediaPath(key);
        if (!target)
            return null;
        const body = await (0, promises_1.readFile)(target).catch(() => null);
        if (!body)
            return null;
        return { body: new Uint8Array(body), contentType: localContentType(key) };
    }
    const result = await exports.s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: exports.S3_BUCKET, Key: key }));
    if (!result.Body)
        return null;
    const body = await result.Body.transformToByteArray();
    return { body, contentType: result.ContentType };
}
async function deleteMediaFromSpaces(key) {
    if (!key || key.startsWith('http'))
        return { success: true, skipped: true };
    if (!exports.s3Client) {
        const target = localMediaPath(key);
        if (!target)
            return { success: true, skipped: true };
        await (0, promises_1.rm)(target, { force: true });
        return { success: true, local: true };
    }
    await exports.s3Client.send(new client_s3_1.DeleteObjectCommand({ Bucket: exports.S3_BUCKET, Key: key }));
    return { success: true };
}
// ==========================================
// 2. DigitalOcean Valkey / Redis Cache
// ==========================================
const redisUrl = process.env.REDIS_URL;
exports.redis = redisUrl
    ? new ioredis_1.default(redisUrl, {
        tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
    })
    : null;
async function getCache(key) {
    if (!exports.redis)
        return null;
    try {
        const val = await exports.redis.get(key);
        return val ? JSON.parse(val) : null;
    }
    catch (err) {
        console.error('[REDIS ERROR: get]', err);
        return null;
    }
}
async function setCache(key, value, ttlSeconds = 300) {
    if (!exports.redis)
        return;
    try {
        await exports.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
    catch (err) {
        console.error('[REDIS ERROR: set]', err);
    }
}
