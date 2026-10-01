import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  canDeleteStoredRoomImage,
  categoryUpdateFields,
  coverAfterRemoval,
  displayImage,
  galleryBelongsToProperty,
  galleryDisplayUrls,
  inspectRoomImage,
  moveGalleryItem,
  ROOM_IMAGE_MAX_BYTES,
  type GalleryPhoto,
} from '../apps/dashboard/src/lib/room-gallery';
import {
  mergeRoomNotes,
  roomDescriptionFromNotes,
  roomUpdateFields,
} from '../apps/dashboard/src/lib/room-edit';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

assert.equal(inspectRoomImage({ filename: 'a.jpg', mimeType: 'image/jpeg', byteSize: jpeg.length, bytes: jpeg }).ok, true);
assert.equal(inspectRoomImage({ filename: 'a.png', mimeType: 'image/png', byteSize: png.length, bytes: png }).ok, true);
assert.equal(inspectRoomImage({ filename: 'a.webp', mimeType: 'image/webp', byteSize: webp.length, bytes: webp }).ok, true);
assert.equal(inspectRoomImage({ filename: 'a.jpg', mimeType: 'image/jpeg', byteSize: png.length, bytes: png }).ok, false);
assert.equal(inspectRoomImage({ filename: 'a.txt', mimeType: 'text/plain', byteSize: 4, bytes: jpeg }).ok, false);
assert.equal(
  inspectRoomImage({ filename: 'big.jpg', mimeType: 'image/jpeg', byteSize: ROOM_IMAGE_MAX_BYTES + 1, bytes: jpeg }).ok,
  false
);

const photos: GalleryPhoto[] = [
  { id: 'b', url: 'https://cdn/b.jpg', isCover: false, sortOrder: 1 },
  { id: 'a', url: 'https://cdn/a.jpg', isCover: true, sortOrder: 0 },
  { id: 'c', url: 'https://cdn/c.jpg', isCover: false, sortOrder: 2 },
];
assert.deepEqual(galleryDisplayUrls(photos), ['https://cdn/a.jpg', 'https://cdn/b.jpg', 'https://cdn/c.jpg']);
assert.deepEqual(galleryDisplayUrls([{ id: 'only', url: 'https://cdn/old.jpg', isCover: true, sortOrder: 0 }]), ['https://cdn/old.jpg']);

const moved = moveGalleryItem(photos, 'c', 'earlier');
assert.deepEqual(moved.map((photo) => photo.id), ['a', 'c', 'b']);
assert.deepEqual(moved.map((photo) => photo.sortOrder), [0, 1, 2]);

assert.equal(coverAfterRemoval(photos, 'a'), 'b');
assert.equal(coverAfterRemoval(photos, 'b'), 'a');
assert.equal(coverAfterRemoval([{ id: 'a', url: 'x', isCover: true, sortOrder: 0 }], 'a'), null);

assert.equal(
  displayImage({
    roomGallery: [],
    roomLegacyUrl: 'https://cdn/legacy-room.jpg',
    categoryGallery: photos,
    categoryLegacyUrls: ['https://cdn/category.jpg'],
  }),
  'https://cdn/legacy-room.jpg'
);
assert.equal(
  displayImage({ roomGallery: [], categoryGallery: [], categoryLegacyUrls: ['https://cdn/category.jpg'] }),
  'https://cdn/category.jpg'
);
assert.equal(
  displayImage({ roomGallery: [], categoryGallery: photos, categoryLegacyUrls: ['https://cdn/category.jpg'] }),
  'https://cdn/a.jpg'
);

const otherProperty = '33000000-0000-4000-8000-000000000099';
const property = '33000000-0000-4000-8000-000000000003';
assert.equal(galleryBelongsToProperty(otherProperty, property), false);
assert.equal(galleryBelongsToProperty(property, property), true);
assert.equal(canDeleteStoredRoomImage(`rooms/${property}/categories/cat/photo.jpg`, property), true);
assert.equal(canDeleteStoredRoomImage('https://images.unsplash.com/photo', property), false);

const update = categoryUpdateFields({
  name: 'Deluxe',
  bedType: '1 King Bed',
  basePriceMinorUnits: 8_000_000,
  description: 'Quiet room',
  capacity: 2,
  amenities: ['Wi-Fi'],
});
assert.equal(update.ok, true);
if (update.ok) {
  assert.deepEqual(Object.keys(update.fields).sort(), ['amenities', 'basePriceMinorUnits', 'bedType', 'capacity', 'description', 'name']);
  assert.equal('totalAmountMinorUnits' in update.fields, false);
  assert.equal('id' in update.fields, false);
}
assert.equal(categoryUpdateFields({ name: '', basePriceMinorUnits: 1, capacity: 2 }).ok, false);
assert.equal(categoryUpdateFields({ name: 'Deluxe', basePriceMinorUnits: -1, capacity: 2 }).ok, false);
assert.equal(categoryUpdateFields({ name: 'Deluxe', basePriceMinorUnits: 1, capacity: 0 }).ok, false);

const roomsRoute = readFileSync('apps/dashboard/src/app/api/rooms/route.ts', 'utf8');
assert.match(roomsRoute, /action === 'update_category'/);
assert.doesNotMatch(roomsRoute.slice(roomsRoute.indexOf("action === 'update_category'"), roomsRoute.indexOf("action === 'update_room'")), /reservations|totalAmountMinorUnits|totalInventory/);
assert.match(roomsRoute, /roomList\.length === 1 && Array\.isArray\(body\.images\)/);
assert.match(roomsRoute, /room_category\.updated/);

const galleryRoute = readFileSync('apps/dashboard/src/app/api/rooms/gallery/route.ts', 'utf8');
assert.match(galleryRoute, /form\.getAll\('files'\)/);
assert.match(galleryRoute, /withMerchant\(handlePOST, 'rooms'\)/);
assert.match(galleryRoute, /withMerchant\(handleDELETE, 'rooms'\)/);
assert.match(readFileSync('apps/dashboard/src/lib/merchant-route.ts', 'utf8'), /rooms: read \? 'room\.read' : 'room\.edit'/);

const categoryDialog = readFileSync('apps/dashboard/src/components/add-category-dialog.tsx', 'utf8');
const roomDialog = readFileSync('apps/dashboard/src/components/add-room-dialog.tsx', 'utf8');
const editor = readFileSync('apps/dashboard/src/components/room-gallery-editor.tsx', 'utf8');
const roomsPage = readFileSync('apps/dashboard/src/app/rooms/page.tsx', 'utf8');
assert.match(editor, /multiple/);
assert.match(editor, /grid-cols-2/);
assert.doesNotMatch(editor, /photosUploading/);
assert.doesNotMatch(editor, /overflow-x-auto/);
assert.match(editor, /min-h-11/);
assert.match(categoryDialog, /editCategory/);
assert.match(roomsPage, /editCategory/);
assert.match(roomsPage, /editRoom/);
assert.match(roomDialog, /batchPhotosHelp/);
assert.doesNotMatch(roomDialog, /readAsDataURL/);

for (const app of ['apps/dashboard/src/components/room-photo-gallery.tsx', 'apps/booking/src/components/room-photo-gallery.tsx']) {
  const gallery = readFileSync(app, 'utf8');
  assert.match(gallery, /Previous photo/);
  assert.match(gallery, /Next photo/);
  assert.match(gallery, /loading="lazy"/);
  assert.match(gallery, /onTouchEnd/);
  assert.match(gallery, /loading="lazy"/);
  assert.match(gallery, /sizes=/);
}

const required = ['roomPhotos', 'categoryGalleryHelp', 'editCategory', 'editRoom', 'saveChanges', 'setAsCover', 'moveLeft', 'batchPhotosHelp'];
for (const file of readdirSync('apps/dashboard/messages').filter((name) => name.endsWith('.json'))) {
  const messages = JSON.parse(readFileSync(`apps/dashboard/messages/${file}`, 'utf8'));
  for (const key of required) assert.equal(typeof messages.rooms[key], 'string', `${file} ${key}`);
}

const roomId = '33000000-0000-4000-8000-000000000011';
const categoryId = '33000000-0000-4000-8000-000000000022';
const roomUpdate = roomUpdateFields({
  roomNumber: '204',
  roomTypeId: categoryId,
  floor: 'Floor 2',
  operationalStatus: 'available',
  housekeepingStatus: 'clean',
  description: 'Quiet side',
});
assert.equal(roomUpdate.ok, true);
if (roomUpdate.ok) {
  assert.equal(roomUpdate.fields.roomNumber, '204');
  assert.equal('id' in roomUpdate.fields, false);
  assert.equal('totalAmountMinorUnits' in roomUpdate.fields, false);
}
assert.equal(roomUpdateFields({ roomNumber: '', roomTypeId: categoryId }).ok, false);
assert.equal(roomUpdateFields({ roomNumber: '1', roomTypeId: 'not-a-uuid' }).ok, false);
assert.equal(roomUpdateFields({ roomNumber: '1', roomTypeId: categoryId, operationalStatus: 'deleted' }).ok, false);

const legacyNotes = JSON.stringify({ imageUrl: 'https://cdn/legacy-room.jpg' });
const merged = mergeRoomNotes(legacyNotes, 'Quiet side');
assert.equal(JSON.parse(merged || '{}').imageUrl, 'https://cdn/legacy-room.jpg');
assert.equal(roomDescriptionFromNotes(merged), 'Quiet side');
assert.equal(mergeRoomNotes(legacyNotes, ''), legacyNotes);

const updateRoomBlock = roomsRoute.slice(roomsRoute.indexOf("action === 'update_room'"), roomsRoute.indexOf("action === 'create_room'"));
assert.match(updateRoomBlock, /eq\(rooms\.id, current\.id\)/);
assert.match(updateRoomBlock, /eq\(rooms\.propertyId, propertyId\)/);
assert.doesNotMatch(updateRoomBlock, /insert\(rooms\)|delete\(rooms\)|reservations|totalAmountMinorUnits/);
assert.equal(roomId.length > 0, true);

console.log('PASS room gallery validation, cover, order, fallback, category edit, room edit, and locale keys');
