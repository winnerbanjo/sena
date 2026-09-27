import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db, users, propertyMembers, properties } from '@sena/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        // Resolve the account and its property in one database round trip.
        const userResults = await db
          .select({ user: users, propertyId: propertyMembers.propertyId, role: propertyMembers.role, propertyName: properties.name })
          .from(users)
          .leftJoin(propertyMembers, eq(propertyMembers.userId, users.id))
          .leftJoin(properties, eq(propertyMembers.propertyId, properties.id))
          .where(eq(users.email, email))
          .limit(1);

        if (userResults.length === 0) {
          return null;
        }

        const account = userResults[0];
        const user = account.user;
        if (!user.isActive || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.avatarUrl,
          propertyId: account.propertyId || undefined,
          propertyName: account.propertyName || undefined,
          role: account.role || 'owner',
        };
      },
    }),
  ],
});

export const { handlers, signIn, signOut, auth } = nextAuth;
