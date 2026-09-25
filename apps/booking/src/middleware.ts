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

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Skip internal nextjs paths, api routes, and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.') // static files like favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }

  const host = req.headers.get('host') || '';
  const cleanHost = host.split(':')[0].toLowerCase();

  let slug: string | null = null;

  // Case 1: *.sena.ng (e.g. amami.sena.ng)
  if (cleanHost.endsWith('.sena.ng')) {
    const sub = cleanHost.replace('.sena.ng', '');
    if (!RESERVED_SUBDOMAINS.has(sub)) {
      slug = sub;
    }
  }

  // Case 2: *.localhost (e.g. amami.localhost)
  else if (cleanHost.endsWith('.localhost')) {
    const sub = cleanHost.replace('.localhost', '');
    if (!RESERVED_SUBDOMAINS.has(sub)) {
      slug = sub;
    }
  }

  // If a slug was determined from subdomain, rewrite to /[slug]/... unless already prefixed
  if (slug) {
    if (!pathname.startsWith(`/${slug}`)) {
      const rewriteUrl = new URL(`/${slug}${pathname === '/' ? '' : pathname}`, req.url);
      rewriteUrl.search = url.search;
      const res = NextResponse.rewrite(rewriteUrl);
      res.headers.set('x-sena-slug', slug);
      return res;
    }
  }

  // Case 3: Root on localhost:3002 or book.sena.ng without slug in path
  // If someone visits '/', default to 'amami' so preview immediately renders
  if (pathname === '/') {
    const defaultSlug = url.searchParams.get('slug') || 'amami';
    const rewriteUrl = new URL(`/${defaultSlug}`, req.url);
    rewriteUrl.search = url.search;
    return NextResponse.rewrite(rewriteUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
