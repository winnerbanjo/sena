import { apiError } from '@/lib/api-error';
import { withMerchant } from '@/lib/merchant-route';
import { NextRequest, NextResponse } from 'next/server';
import { uploadMediaToSpaces } from '@sena/integrations';

async function handlePOST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Choose a JPG, PNG or WebP image smaller than 10 MB.' }, { status: 422 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.name.split('.').pop() || 'jpg';
    const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;

    const result = await uploadMediaToSpaces({
      key,
      body: buffer,
      contentType: file.type || 'image/jpeg',
      acl: 'public-read',
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      key,
    });
  } catch (error: any) {
    console.error('Media upload error:', error);
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}

export const POST = withMerchant(handlePOST, 'upload');
