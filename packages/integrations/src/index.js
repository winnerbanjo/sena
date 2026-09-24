"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.s3Client = exports.S3_BUCKET = void 0;
exports.getSpacesPublicUrl = getSpacesPublicUrl;
exports.uploadMediaToSpaces = uploadMediaToSpaces;
exports.getCache = getCache;
exports.setCache = setCache;
const client_s3_1 = require("@aws-sdk/client-s3");
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
function getSpacesPublicUrl(key) {
    const cleanKey = key.startsWith('/') ? key.slice(1) : key;
    return `https://${exports.S3_BUCKET}.${s3Region}.digitaloceanspaces.com/${cleanKey}`;
}
async function uploadMediaToSpaces(params) {
    if (!exports.s3Client) {
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
