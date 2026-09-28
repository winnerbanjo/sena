import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, eq } from '@sena/database';
import { resolveTenantForRequest } from '@/lib/tenant';
import { isAppLocale, parseLocale } from '@/i18n/config';
import { localeCookieHeader } from '@/i18n/cookie';

export const dynamic = 'force-dynamic';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

function cookieHeaders(locale: string, req: NextRequest) {
  const secure = req.nextUrl.protocol === 'https:' || process.env.NODE_ENV === 'production';
  return {
    ...privateHeaders,
    'Set-Cookie': localeCookieHeader(parseLocale(locale), secure),
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401, headers: privateHeaders });
    const tenant = await resolveTenantForRequest(session, req);
    const user = tenant?.user || await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!user?.isActive) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401, headers: privateHeaders });
    const locale = parseLocale(user.locale);
    return NextResponse.json({
      user: { id: user.id, name: user.fullName, email: user.email, phone: user.phone, role: tenant?.role || null, locale },
      property: tenant?.property || null,
    }, { headers: cookieHeaders(locale, req) });
  } catch (error) {
    console.error('[workspace-boot] account or property resolution failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'We could not load your account. Please try again.' }, { status: 500, headers: privateHeaders });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      const body = await req.json().catch(() => ({}));
      if (!isAppLocale(body.locale)) {
        return NextResponse.json({ error: 'Choose a supported language.', code: 'INVALID_LOCALE' }, { status: 422, headers: privateHeaders });
      }
      return NextResponse.json({ locale: body.locale, persisted: false }, { headers: cookieHeaders(body.locale, req) });
    }
    const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
    if (!user?.isActive) return NextResponse.json({ error: 'Please sign in to continue.' }, { status: 401, headers: privateHeaders });
    const body = await req.json().catch(() => ({}));
    if (!isAppLocale(body.locale)) {
      return NextResponse.json({ error: 'Choose a supported language.', code: 'INVALID_LOCALE' }, { status: 422, headers: privateHeaders });
    }
    const [updated] = await db
      .update(users)
      .set({ locale: body.locale, updatedAt: new Date() })
      .where(eq(users.id, session.user.id))
      .returning({ id: users.id, locale: users.locale });
    return NextResponse.json({ user: { id: updated.id, locale: parseLocale(updated.locale) }, persisted: true }, { headers: cookieHeaders(updated.locale, req) });
  } catch (error) {
    console.error('[locale] persist failed', { error: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ error: 'We could not save your language. Try again.' }, { status: 500, headers: privateHeaders });
  }
}
