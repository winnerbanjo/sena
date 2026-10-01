import { apiError } from '@/lib/api-error';
import { getMerchantRequest, withMerchant } from '@/lib/merchant-route';
import {
  canDeleteStoredRoomImage,
  coverAfterRemoval,
  galleryBelongsToProperty,
  galleryDisplayUrls,
  inspectRoomImage,
  moveGalleryItem,
  orderedGallery,
  storageKeyForRoomImage,
  type GalleryPhoto,
} from '@/lib/room-gallery';
import { deleteMediaFromSpaces, uploadMediaToSpaces } from '@sena/integrations';
import { abortGalleryUpload, finishGalleryUpload, saveGalleryPart, storePersistedGalleryFile } from '@/lib/gallery-upload-store';
import { and, asc, eq, apartments, roomImages, roomTypes, rooms, db } from '@sena/database';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

function photo(row: typeof roomImages.$inferSelect): GalleryPhoto {
  return { id: row.id, url: row.url, isCover: row.isCover, sortOrder: row.sortOrder };
}

async function loadTargetGallery(propertyId: string, target: { roomTypeId?: string | null; roomId?: string | null; apartmentId?: string | null }) {
  const rows = await db
    .select()
    .from(roomImages)
    .where(
      target.apartmentId
        ? and(eq(roomImages.propertyId, propertyId), eq(roomImages.apartmentId, target.apartmentId))
        : target.roomId
          ? and(eq(roomImages.propertyId, propertyId), eq(roomImages.roomId, target.roomId))
          : and(eq(roomImages.propertyId, propertyId), eq(roomImages.roomTypeId, target.roomTypeId!))
    )
    .orderBy(asc(roomImages.sortOrder));
  return rows;
}

async function syncLegacyImages(propertyId: string, target: { roomTypeId?: string | null; roomId?: string | null; apartmentId?: string | null }) {
  const rows = await loadTargetGallery(propertyId, target);
  const urls = galleryDisplayUrls(rows.map(photo));
  if (target.roomTypeId) {
    await db
      .update(roomTypes)
      .set({ images: urls, updatedAt: new Date() })
      .where(and(eq(roomTypes.id, target.roomTypeId), eq(roomTypes.propertyId, propertyId)));
  }
  return rows.map(photo);
}

function galleryWhere(propertyId: string, image: { roomId: string | null; roomTypeId: string | null; apartmentId: string | null }) {
  if (image.apartmentId) return and(eq(roomImages.propertyId, propertyId), eq(roomImages.apartmentId, image.apartmentId));
  if (image.roomId) return and(eq(roomImages.propertyId, propertyId), eq(roomImages.roomId, image.roomId));
  return and(eq(roomImages.propertyId, propertyId), eq(roomImages.roomTypeId, image.roomTypeId!));
}

async function ownedTarget(propertyId: string, roomTypeId?: string | null, roomId?: string | null, apartmentId?: string | null) {
  if (apartmentId) {
    const [apartment] = await db
      .select({ id: apartments.id })
      .from(apartments)
      .where(and(eq(apartments.id, apartmentId), eq(apartments.propertyId, propertyId)))
      .limit(1);
    return apartment ? { apartmentId: apartment.id } : null;
  }
  if (roomId) {
    const [room] = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.id, roomId), eq(rooms.propertyId, propertyId)))
      .limit(1);
    return room ? { roomId: room.id } : null;
  }
  if (roomTypeId) {
    const [category] = await db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(and(eq(roomTypes.id, roomTypeId), eq(roomTypes.propertyId, propertyId)))
      .limit(1);
    return category ? { roomTypeId: category.id } : null;
  }
  return { pending: true as const };
}

async function persistedOwner(target: { apartmentId?: string; roomId?: string; roomTypeId?: string; pending?: boolean }) {
  return {
    apartmentId: 'apartmentId' in target ? target.apartmentId || null : null,
    roomId: 'roomId' in target ? target.roomId || null : null,
    roomTypeId: 'roomTypeId' in target ? target.roomTypeId || null : null,
  };
}

async function handlePOST(req: NextRequest) {
  try {
    const merchant = getMerchantRequest(req);
    const propertyId = merchant?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });

    const form = await req.formData();
    const roomTypeId = String(form.get('roomTypeId') || '') || null;
    const roomId = String(form.get('roomId') || '') || null;
    const apartmentId = String(form.get('apartmentId') || '') || null;
    const target = await ownedTarget(propertyId, roomTypeId, roomId, apartmentId);
    if (!target) return NextResponse.json({ error: 'That room could not be found for this property.' }, { status: 404 });

    const phase = String(form.get('phase') || '');
    if (phase === 'part' || phase === 'finish' || phase === 'abort') {
      if ('pending' in target) return NextResponse.json({ error: 'Save the room before uploading photos.' }, { status: 400 });
      const owner = await persistedOwner(target);
      const result =
        phase === 'part'
          ? await saveGalleryPart({ propertyId, owner, form })
          : phase === 'abort'
            ? await abortGalleryUpload({ propertyId, owner, form })
            : await finishGalleryUpload({ propertyId, userId: merchant?.tenant.userId, owner, form });
      if (phase === 'finish' && result.status === 200) {
        const gallery = await syncLegacyImages(propertyId, owner);
        return NextResponse.json({ ...result.body, gallery: orderedGallery(gallery) }, { status: 200 });
      }
      return NextResponse.json(result.body, { status: result.status });
    }

    const files = form.getAll('files').filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return NextResponse.json({ error: 'Choose at least one photo.' }, { status: 400 });

    const existing = 'pending' in target ? [] : await loadTargetGallery(propertyId, target);
    let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const uploaded: GalleryPhoto[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const file of files) {
      const filename = file.name || 'photo.jpg';
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const decision = inspectRoomImage({
          filename,
          mimeType: file.type,
          byteSize: bytes.byteLength,
          bytes,
        });
        if (!decision.ok || !decision.contentType || !decision.extension) {
          errors.push({ filename, error: decision.error || 'This file is not a valid photo.' });
          continue;
        }
        const imageId = randomUUID();
        if ('pending' in target) {
          const storageKey = storageKeyForRoomImage({
            propertyId,
            imageId,
            extension: decision.extension,
          });
          const stored = await uploadMediaToSpaces({
            key: storageKey,
            body: bytes,
            contentType: decision.contentType,
            acl: 'public-read',
          });
          uploaded.push({
            id: imageId,
            url: stored.url,
            storageKey,
            isCover: existing.length + uploaded.length === 0,
            sortOrder,
          });
          sortOrder += 1;
          continue;
        }
        const stored = await storePersistedGalleryFile({
          propertyId,
          userId: merchant?.tenant.userId,
          owner: await persistedOwner(target),
          filename,
          bytes,
          contentType: decision.contentType,
          extension: decision.extension,
          imageId,
        });
        if (!stored.ok) {
          errors.push({ filename, error: stored.error });
          continue;
        }
        uploaded.push(stored.photo);
      } catch (fileError) {
        console.error('Gallery file upload failed:', fileError);
        errors.push({ filename, error: 'Could not store that photo.' });
      }
    }

    const gallery = 'pending' in target ? [...existing.map(photo), ...uploaded] : await syncLegacyImages(propertyId, await persistedOwner(target));
    const status = uploaded.length === 0 && errors.length > 0 ? 422 : 200;
    return NextResponse.json(
      { gallery: orderedGallery(gallery), uploaded, errors, error: errors[0]?.error },
      { status }
    );
  } catch (error: any) {
    console.error('Error uploading room photos:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handlePATCH(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    const body = await req.json();
    const imageId = String(body.imageId || '');
    const [image] = await db.select().from(roomImages).where(eq(roomImages.id, imageId)).limit(1);
    if (!image || !galleryBelongsToProperty(image.propertyId, propertyId)) {
      return NextResponse.json({ error: 'That photo could not be found for this property.' }, { status: 404 });
    }
    const target = { roomTypeId: image.roomTypeId, roomId: image.roomId, apartmentId: image.apartmentId };
    const current = (await loadTargetGallery(propertyId, target)).map(photo);

    if (body.action === 'cover') {
      await db.transaction(async (tx) => {
        await tx
          .update(roomImages)
          .set({ isCover: false })
          .where(galleryWhere(propertyId, image));
        await tx.update(roomImages).set({ isCover: true }).where(and(eq(roomImages.id, image.id), eq(roomImages.propertyId, propertyId)));
      });
    } else if (body.action === 'move' && (body.direction === 'earlier' || body.direction === 'later')) {
      const next = moveGalleryItem(current, image.id, body.direction);
      await db.transaction(async (tx) => {
        for (const item of next) {
          await tx
            .update(roomImages)
            .set({ sortOrder: item.sortOrder })
            .where(and(eq(roomImages.id, item.id), eq(roomImages.propertyId, propertyId)));
        }
      });
    } else {
      return NextResponse.json({ error: 'Unknown photo action' }, { status: 400 });
    }

    return NextResponse.json({ gallery: await syncLegacyImages(propertyId, target) });
  } catch (error: any) {
    console.error('Error updating room photo:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  try {
    const propertyId = getMerchantRequest(req)?.tenant.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property not found' }, { status: 400 });
    const imageId = new URL(req.url).searchParams.get('id') || '';
    const [image] = await db.select().from(roomImages).where(eq(roomImages.id, imageId)).limit(1);
    if (!image || !galleryBelongsToProperty(image.propertyId, propertyId)) {
      return NextResponse.json({ error: 'That photo could not be found for this property.' }, { status: 404 });
    }
    const target = { roomTypeId: image.roomTypeId, roomId: image.roomId, apartmentId: image.apartmentId };
    const current = (await loadTargetGallery(propertyId, target)).map(photo);
    const nextCoverId = coverAfterRemoval(current, image.id);

    await db.transaction(async (tx) => {
      await tx.delete(roomImages).where(and(eq(roomImages.id, image.id), eq(roomImages.propertyId, propertyId)));
      if (nextCoverId) {
        await tx
          .update(roomImages)
          .set({ isCover: false })
          .where(galleryWhere(propertyId, image));
        await tx
          .update(roomImages)
          .set({ isCover: true })
          .where(and(eq(roomImages.id, nextCoverId), eq(roomImages.propertyId, propertyId)));
      }
    });

    if (canDeleteStoredRoomImage(image.storageKey, propertyId)) {
      await deleteMediaFromSpaces(image.storageKey).catch((error) => console.error('Room photo storage delete failed:', error));
    }

    return NextResponse.json({ gallery: await syncLegacyImages(propertyId, target) });
  } catch (error: any) {
    console.error('Error removing room photo:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'rooms');
export const PATCH = withMerchant(handlePATCH, 'rooms');
export const DELETE = withMerchant(handleDELETE, 'rooms');
