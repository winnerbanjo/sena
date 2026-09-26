import { NextRequest, NextResponse } from 'next/server';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'mail',
  'support',
  'help',
  'status',
  'blog',
  'static',
  'assets',
  'cdn',
  'booking',
  'book',
]);

const DASHBOARD_ROUTES = new Set([
  '',
  'overview',
  'reservations',
  'calendar',
  'front-desk',
  'rooms',
  'housekeeping',
  'guests',
  'website',
  'booking-preview',
  'payments',
  'invoices',
  'invoice',
  'offers',
  'channels',
  'connect',
  'analytics',
  'reports',
  'staff',
  'billing',
  'settings',
  'onboarding',
  'login',
  'signup',
  'register',
  'auth',
  'site',
]);

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Skip internal Next.js assets, api routes, and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const host = req.headers.get('host') || '';
  const cleanHost = host.split(':')[0].toLowerCase();

  let slug: string | null = null;

  // Case 1: Subdomain on *.sena.ng (e.g. sena-grand.sena.ng)
  if (cleanHost.endsWith('.sena.ng') && cleanHost !== 'sena.ng') {
    const sub = cleanHost.slice(0, -'.sena.ng'.length);
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      slug = sub;
    }
  }

  // Case 2: Subdomain on *.localhost (e.g. sena-grand.localhost:3000)
  else if (cleanHost.endsWith('.localhost') && cleanHost !== 'localhost') {
    const sub = cleanHost.slice(0, -'.localhost'.length);
    if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
      slug = sub;
    }
  }

  // If a tenant subdomain is detected, rewrite to /site/[slug]...
  if (slug) {
    let cleanPath = pathname;
    if (cleanPath.startsWith(`/site/${slug}`)) {
      cleanPath = cleanPath.slice(`/site/${slug}`.length) || '/';
    } else if (cleanPath.startsWith(`/${slug}`)) {
      cleanPath = cleanPath.slice(`/${slug}`.length) || '/';
    }
    const rewriteUrl = new URL(`/site/${slug}${cleanPath === '/' ? '' : cleanPath}`, req.url);
    rewriteUrl.search = url.search;
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-sena-slug', slug);
    requestHeaders.set('x-sena-is-tenant', 'true');
    const res = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
    res.headers.set('x-sena-slug', slug);
    res.headers.set('x-sena-is-tenant', 'true');
    return res;
  }

  // Case 3: Direct slug accessed on dashboard domain (e.g. app.sena.ng/sena-grand)
  const firstSegment = pathname.split('/')[1] || '';
  if (firstSegment && !DASHBOARD_ROUTES.has(firstSegment)) {
    const rewriteUrl = new URL(`/site${pathname}`, req.url);
    rewriteUrl.search = url.search;
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-sena-slug', firstSegment);
    requestHeaders.set('x-sena-is-tenant', 'true');
    const res = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
    res.headers.set('x-sena-slug', firstSegment);
    res.headers.set('x-sena-is-tenant', 'true');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
