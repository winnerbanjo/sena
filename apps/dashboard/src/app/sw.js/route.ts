import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-static';
export const revalidate = 0;

export async function GET() {
  try {
    const swPath = path.join(process.cwd(), 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      const content = fs.readFileSync(swPath, 'utf8');
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'application/javascript; charset=UTF-8',
          'Service-Worker-Allowed': '/',
          'Cache-Control': 'public, max-age=0, must-revalidate',
        },
      });
    }
  } catch (err) {
    console.error('Error serving sw.js:', err);
  }

  return new NextResponse('// Service Worker\nself.addEventListener("install", () => self.skipWaiting());', {
    headers: {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Service-Worker-Allowed': '/',
    },
  });
}
