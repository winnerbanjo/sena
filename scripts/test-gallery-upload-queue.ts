import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  GALLERY_REQUEST_SAFE_BYTES,
  GALLERY_UPLOAD_CONCURRENCY,
  classifyGalleryFile,
  closeNeedsUploadWarning,
  galleryQueueNotice,
  mapWithConcurrency,
  nextLaunchIds,
  planGalleryTransfer,
  retryGalleryTask,
  runCoverAwareQueue,
  saveBlockedWhileUploading,
  transferRequestCount,
  type GalleryTask,
} from '../apps/dashboard/src/lib/gallery-upload-queue';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

assert.equal(classifyGalleryFile({ name: 'one.jpg', mimeType: 'image/jpeg', byteSize: jpeg.length, header: jpeg }).ok, true);
assert.deepEqual(
  classifyGalleryFile({ name: 'notes.txt', mimeType: 'text/plain', byteSize: 20, header: jpeg }),
  { ok: false, code: 'unsupported' }
);
assert.deepEqual(
  classifyGalleryFile({ name: 'big.jpg', mimeType: 'image/jpeg', byteSize: 11 * 1024 * 1024, header: jpeg }),
  { ok: false, code: 'too_large' }
);
assert.deepEqual(
  classifyGalleryFile({ name: 'fake.jpg', mimeType: 'image/jpeg', byteSize: png.length, header: png }),
  { ok: false, code: 'invalid_signature' }
);

const one = classifyGalleryFile({ name: 'one.jpg', mimeType: 'image/jpeg', byteSize: 400_000, header: jpeg });
assert.equal(one.ok && one.partCount, 1);
const many = Array.from({ length: 26 }, () => transferRequestCount(400_000));
assert.equal(many.reduce((sum, count) => sum + count, 0), 26);
assert.ok(many.every((count) => count === 1));

const large = planGalleryTransfer(8_000_000);
assert.ok(large.partCount > 1);
assert.ok(large.partSize <= GALLERY_REQUEST_SAFE_BYTES);
assert.equal(transferRequestCount(8_000_000), large.partCount + 1);
assert.ok(GALLERY_UPLOAD_CONCURRENCY >= 3 && GALLERY_UPLOAD_CONCURRENCY <= 5);

async function main() {
let maxInflight = 0;
await mapWithConcurrency(Array.from({ length: 26 }, (_, index) => index), GALLERY_UPLOAD_CONCURRENCY, async () => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return true;
}, (count) => {
  maxInflight = Math.max(maxInflight, count);
});
assert.equal(maxInflight, GALLERY_UPLOAD_CONCURRENCY);
assert.ok(maxInflight < 26);

const order: string[] = [];
let active = 0;
let maxActive = 0;
await runCoverAwareQueue({
  items: ['a', 'b', 'c', 'd', 'e'],
  existingHasCover: false,
  concurrency: 4,
  run: async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push(`${item}:${active}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item !== 'a';
  },
});
assert.equal(order[0], 'a:1');
assert.equal(order[1].startsWith('b:'), true);
assert.ok(maxActive <= 4);
assert.ok(maxActive > 1);

const waiting = (count: number): GalleryTask[] =>
  Array.from({ length: count }, (_, index) => ({
    localId: `f${index}`,
    filename: `f${index}.jpg`,
    status: 'waiting',
    queued: true,
    retryable: true,
    partCount: 1,
  }));

assert.deepEqual(nextLaunchIds(waiting(26), 0, false), ['f0']);
assert.deepEqual(nextLaunchIds(waiting(26), 1, false), []);
assert.equal(nextLaunchIds(waiting(26), 0, true).length, GALLERY_UPLOAD_CONCURRENCY);
const failed = waiting(3).map((task, index) => (index === 1 ? { ...task, status: 'failed' as const, error: 'no' } : { ...task, status: 'uploaded' as const }));
assert.equal(galleryQueueNotice({ uploaded: 20, total: 26, active: 0, failed: 6 }).type, 'partial');
assert.deepEqual(galleryQueueNotice({ uploaded: 26, total: 26, active: 0, failed: 0 }), { type: 'done', count: 26 });
assert.equal(galleryQueueNotice({ uploaded: 8, total: 26, active: 1, failed: 0 }).type, 'progress');
const retried = retryGalleryTask([{ ...failed[1], status: 'failed', retryable: true }], 'f1');
assert.equal(retried[0].status, 'waiting');
assert.equal(retryGalleryTask([{ ...failed[1], retryable: false, status: 'failed' }], 'f1')[0].status, 'failed');

assert.equal(saveBlockedWhileUploading(true), true);
assert.equal(saveBlockedWhileUploading(false), false);
assert.equal(closeNeedsUploadWarning(true), true);
assert.equal(closeNeedsUploadWarning(false), false);

const editor = readFileSync('apps/dashboard/src/components/room-gallery-editor.tsx', 'utf8');
const route = readFileSync('apps/dashboard/src/app/api/rooms/gallery/route.ts', 'utf8');
const store = readFileSync('apps/dashboard/src/lib/gallery-upload-store.ts', 'utf8');
const apartments = readFileSync('apps/dashboard/src/app/apartments/page.tsx', 'utf8');
const rooms = readFileSync('apps/dashboard/src/app/rooms/page.tsx', 'utf8');
assert.doesNotMatch(editor, /photosUploading/);
assert.doesNotMatch(editor, /count:\s*1/);
assert.match(editor, /uploadProgress/);
assert.match(editor, /grid-cols-2/);
assert.doesNotMatch(editor, /readAsDataURL/);
assert.doesNotMatch(editor, /form\.append\('files'/);
assert.doesNotMatch(apartments, /form\.append\('files'/);
assert.doesNotMatch(rooms, /form\.append\('files'/);
assert.match(route, /phase === 'part'/);
assert.match(route, /storePersistedGalleryFile/);
assert.match(route, /eq\(apartments\.propertyId, propertyId\)/);
assert.match(route, /eq\(roomImages\.propertyId, propertyId\)/);
assert.match(store, /pg_advisory_xact_lock/);
assert.match(store, /uploadMediaToSpaces/);
assert.match(store, /inspectRoomImage/);
assert.match(store, /!existing\.some\(\(row\) => row\.isCover\)/);
assert.match(editor, /uploadWait/);
assert.match(editor, /GalleryCloseWarning/);
assert.match(readFileSync('apps/dashboard/src/components/add-apartment-dialog.tsx', 'utf8'), /saveBlockedWhileUploading/);
assert.match(readFileSync('apps/dashboard/src/components/edit-room-dialog.tsx', 'utf8'), /uploadCloseWarning|GalleryCloseWarning/);
assert.match(readFileSync('apps/dashboard/src/components/add-category-dialog.tsx', 'utf8'), /GalleryCloseWarning/);

const required = [
  'uploadWaiting',
  'uploadUploading',
  'uploadUploaded',
  'uploadFailedStatus',
  'uploadRetry',
  'uploadProgress',
  'uploadCount',
  'uploadAllDone',
  'uploadUnsupported',
  'uploadTooLarge',
  'uploadInvalid',
  'uploadWait',
  'uploadCloseWarning',
  'uploadKeep',
  'uploadCloseAnyway',
  'uploadPartial',
];
const english = JSON.parse(readFileSync('apps/dashboard/messages/en.json', 'utf8')).rooms;
assert.equal(english.uploadUnsupported, 'Unsupported format');
assert.equal(english.uploadTooLarge, 'File exceeds 10 MB');
assert.equal(english.uploadWait, 'Please wait for photo uploads to finish.');
assert.match(english.uploadCloseWarning, /Photos are still uploading\. Closing now may cancel unfinished uploads\./);
assert.match(english.uploadCloseWarning, /cannot continue after this dialog closes/);
assert.equal(english.uploadKeep, 'Keep uploading');
assert.equal(english.uploadCloseAnyway, 'Close anyway');
for (const file of readdirSync('apps/dashboard/messages').filter((name) => name.endsWith('.json'))) {
  const messages = JSON.parse(readFileSync(`apps/dashboard/messages/${file}`, 'utf8'));
  for (const key of required) {
    assert.equal(typeof messages.rooms[key], 'string', `${file} ${key}`);
    assert.ok(messages.rooms[key].length > 0, `${file} ${key}`);
    if (file !== 'en.json') assert.notEqual(messages.rooms[key], english[key], `${file} ${key} falls back to English`);
  }
}

console.log('PASS gallery upload queue, concurrency, partial success, cover, validation, and locales');
}

main();
