import { NextRequest, NextResponse } from 'next/server';
import { uploadMediaToSpaces } from '@sena/integrations';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
