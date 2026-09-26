import { apiError } from '@/lib/api-error';
import { NextRequest, NextResponse } from 'next/server';
import { db, verificationTokens, users, organizations, organizationMembers, eq, and, gt, sql } from '@sena/database';
import { sendSenaEmail } from '@sena/email';

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (typeof email !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code.trim()) || email.length > 255) {
      return NextResponse.json({ error: 'Email and 6-digit code are required.' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();
    const result = await db.transaction(async (tx) => {
      // Verification, attempt counting and account creation share one lock and commit.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`otp:${cleanEmail}`}))`);
      const [record] = await tx.select().from(verificationTokens).where(and(eq(verificationTokens.identifier, cleanEmail), gt(verificationTokens.expires, new Date()))).for('update');
      if (!record) return { error: 'Invalid or expired verification code. Please request a fresh code.', status: 400 };
      const [storedCode, payload, attemptsText] = record.token.split('|');
      const attempts = Number(attemptsText || 0);
      if (!Number.isInteger(attempts) || attempts >= 5) return { error: 'Too many incorrect attempts. Please request a fresh code.', status: 429 };
      if (storedCode !== code.trim()) {
        await tx.update(verificationTokens).set({ token: `${storedCode}|${payload || ''}|${attempts + 1}` }).where(and(eq(verificationTokens.identifier, cleanEmail), eq(verificationTokens.token, record.token)));
        return { error: 'Incorrect verification code. Please try again.', status: 400 };
      }
      if (payload) {
        const pending = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
        if (pending.email !== cleanEmail || !pending.passwordHash || !pending.orgSlug) return { error: 'Please restart signup.', status: 400 };
        const [user] = await tx.insert(users).values({ fullName: pending.fullName, email: cleanEmail, passwordHash: pending.passwordHash, phone: pending.phone, emailVerified: new Date(), isActive: true }).returning({ id: users.id, email: users.email, fullName: users.fullName });
        const [organization] = await tx.insert(organizations).values({ name: pending.propertyName, slug: pending.orgSlug }).returning({ id: organizations.id, name: organizations.name });
        await tx.insert(organizationMembers).values({ organizationId: organization.id, userId: user.id, role: 'owner' });
        await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));
        return { user, organization, status: 200 };
      }
      await tx.update(users).set({ emailVerified: new Date(), updatedAt: new Date() }).where(eq(users.email, cleanEmail));
      await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, cleanEmail));
      return { status: 200 };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    if (result.user && result.organization) {
      await sendSenaEmail('account.welcome', { userName: result.user.fullName, organizationName: result.organization.name, propertyName: result.organization.name }, { to: result.user.email, organizationId: result.organization.id, idempotencyKey: `welcome_${result.user.id}`, skipPreferencesCheck: true }).catch(() => undefined);
      return NextResponse.json({ success: true, message: 'Email verified. Account created successfully.', accountCreated: true, user: { id: result.user.id, email: result.user.email, name: result.user.fullName }, organization: result.organization });
    }
    return NextResponse.json({ success: true, message: 'Email address successfully verified.', accountCreated: false });
  } catch (error) {
    console.error('OTP verification failed');
    return NextResponse.json({ error: apiError(error) }, { status: 500 });
  }
}
