import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db, users, propertyMembers, properties } from '@sena/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { membershipIsUsable } from './lib/membership-access';

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        property: { label: 'Property', type: 'text' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);
        const propertySlug = typeof credentials.property === 'string' ? credentials.property.trim().toLowerCase() : '';

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user?.isActive || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Optional property slug selects an authorized membership only. Never invent access.
        const memberships = await db
          .select({
            propertyId: propertyMembers.propertyId,
            role: propertyMembers.role,
            permissions: propertyMembers.permissions,
            propertyName: properties.name,
            propertySlug: properties.slug,
          })
          .from(propertyMembers)
          .innerJoin(properties, eq(propertyMembers.propertyId, properties.id))
          .where(eq(propertyMembers.userId, user.id));

        const usable = memberships.filter((row) => membershipIsUsable(row.permissions));

        const selected = propertySlug
          ? usable.find((row) => row.propertySlug === propertySlug)
          : usable[0];
        if (propertySlug && !selected) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.avatarUrl,
          propertyId: selected?.propertyId || undefined,
          propertyName: selected?.propertyName || undefined,
          role: selected?.role || 'owner',
        };
      },
    }),
  ],
});

export const { handlers, signIn, signOut, auth } = nextAuth;
