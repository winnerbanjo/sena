import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

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
  'apps',
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

export const middleware = auth((req) => {
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
    requestHeaders.set('x-sena-pathname', pathname);
    if (url.searchParams.get('preview') === '1') {
      requestHeaders.set('x-sena-preview', 'true');
    }
    const res = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
    res.headers.set('x-sena-slug', slug);
    res.headers.set('x-sena-is-tenant', 'true');
    if (url.searchParams.get('preview') === '1') {
      res.headers.set('x-sena-preview', 'true');
    }
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
    requestHeaders.set('x-sena-pathname', pathname);
    if (url.searchParams.get('preview') === '1') {
      requestHeaders.set('x-sena-preview', 'true');
    }
    const res = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
    res.headers.set('x-sena-slug', firstSegment);
    res.headers.set('x-sena-is-tenant', 'true');
    if (url.searchParams.get('preview') === '1') {
      res.headers.set('x-sena-preview', 'true');
    }
    return res;
  }

  if (pathname.startsWith('/site/')) {
    // Mark /site/[slug] as a public tenant surface so root layout does not
    // require a staff session or wrap the guest site in DashboardShell.
    const siteSlug = pathname.split('/')[2] || '';
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-sena-pathname', pathname);
    if (siteSlug) {
      requestHeaders.set('x-sena-slug', siteSlug);
      requestHeaders.set('x-sena-is-tenant', 'true');
    }
    if (url.searchParams.get('preview') === '1') {
      requestHeaders.set('x-sena-preview', 'true');
    }
    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    if (siteSlug) {
      res.headers.set('x-sena-slug', siteSlug);
      res.headers.set('x-sena-is-tenant', 'true');
    }
    return res;
  }

  const isPublicOrAuthPath =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/onboarding' ||
    pathname.startsWith('/onboarding/') ||
    pathname.startsWith('/site/') ||
    pathname.startsWith('/invoice/') ||
    pathname.startsWith('/embed/');

  if (!isPublicOrAuthPath && !req.auth?.user?.id) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-sena-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw\\.js|offline\\.html|manifest\\.json|manifest\\.webmanifest|icons/|assets/).*)',
  ],
};
