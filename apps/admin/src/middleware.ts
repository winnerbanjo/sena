import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const authCookie = req.cookies.get('sena_admin_auth');
  const url = req.nextUrl;

  // Allow next.js internal assets and images
  if (url.pathname.startsWith('/_next') || url.pathname.startsWith('/assets') || url.pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (url.pathname === '/login') {
    return NextResponse.next();
  }

  if (authCookie?.value !== 'authenticated') {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
