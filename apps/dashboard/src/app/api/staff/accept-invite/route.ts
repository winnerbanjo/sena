import { NextRequest, NextResponse } from 'next/server';
import { db, users, properties, propertyMembers, eq, and } from '@sena/database';
import { auth } from '@/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, token } = await req.json();
    if (typeof email !== 'string' || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
      return NextResponse.json({ error: 'This invitation is invalid. Ask your manager for a new invitation.' }, { status: 400 });
    }
    const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
    if (!user) return NextResponse.json({ error: 'This invitation is no longer available.' }, { status: 400 });
    const invitationHash = crypto.createHash('sha256').update(token).digest('hex');
    const memberships = await db.query.propertyMembers.findMany({ where: eq(propertyMembers.userId, user.id) });
    const member = memberships.find(m => m.permissions?.includes(`inviteHash:${invitationHash}`) && m.permissions.includes('status:invited') && Number(m.permissions.find(p => p.startsWith('inviteExpires:'))?.split(':')[1]) > Date.now());
    if (!member) return NextResponse.json({ error: 'This invitation has expired or has already been accepted. Ask your manager for a new one.' }, { status: 400 });
    const existingAccount = user.passwordHash && user.passwordHash !== 'INVITED_PENDING_ACTIVATION';
    if (existingAccount && (await auth())?.user?.id !== user.id) {
      return NextResponse.json({ error: 'Sign in to your existing Sena account, then open this invitation again.' }, { status: 401 });
    }
    if (!existingAccount && (typeof password !== 'string' || password.length < 8)) return NextResponse.json({ error: 'Choose a password with at least 8 characters.' }, { status: 400 });
    const hash = existingAccount ? null : await bcrypt.hash(password, 12);
    await db.transaction(async tx => {
      const [locked] = await tx.select().from(propertyMembers).where(eq(propertyMembers.id, member.id)).for('update');
      if (!locked?.permissions?.includes(`inviteHash:${invitationHash}`)) throw new Error('Invitation already accepted');
      await tx.update(propertyMembers).set({ permissions: [...(locked.permissions || []).filter(p => !p.startsWith('invite') && !p.startsWith('status:')), 'status:active'] }).where(eq(propertyMembers.id, member.id));
      if (hash) await tx.update(users).set({ passwordHash: hash, isActive: true, emailVerified: new Date(), ...(typeof fullName === 'string' && fullName.trim() ? { fullName: fullName.trim() } : {}) }).where(eq(users.id, user.id));
    });
    return NextResponse.json({ success: true, message: 'Invitation accepted. Sign in to access your property.' });
  } catch {
    return NextResponse.json({ error: 'We could not accept this invitation. Please try again.' }, { status: 400 });
  }
}
