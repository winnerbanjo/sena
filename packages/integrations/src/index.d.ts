import { S3Client } from '@aws-sdk/client-s3';
import Redis from 'ioredis';
export declare const S3_BUCKET: string;
export declare const s3Client: S3Client | null;
export declare function getSpacesPublicUrl(key: string): string;
export declare function uploadMediaToSpaces(params: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
    acl?: 'public-read' | 'private';
}): Promise<{
    success: boolean;
    url: string;
    simulated: boolean;
} | {
    success: boolean;
    url: string;
    simulated?: undefined;
}>;
export declare const redis: Redis | null;
export declare function getCache<T>(key: string): Promise<T | null>;
export declare function setCache(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
//# sourceMappingURL=index.d.ts.map