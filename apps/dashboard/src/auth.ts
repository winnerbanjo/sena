import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db, users, propertyMembers, properties } from '@sena/database';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const nextAuth = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'sena-production-auth-session-key',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
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

        // Fetch user from PostgreSQL
        const userResults = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (userResults.length === 0) {
          return null;
        }

        const user = userResults[0];
        if (!user.isActive || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Fetch property association if available
        const memberResults = await db
          .select({
            propertyId: propertyMembers.propertyId,
            role: propertyMembers.role,
            propertyName: properties.name,
          })
          .from(propertyMembers)
          .innerJoin(properties, eq(propertyMembers.propertyId, properties.id))
          .where(eq(propertyMembers.userId, user.id))
          .limit(1);

        const property = memberResults[0];

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          image: user.avatarUrl,
          propertyId: property?.propertyId,
          propertyName: property?.propertyName,
          role: property?.role || 'owner',
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.propertyId = (user as any).propertyId;
        token.propertyName = (user as any).propertyName;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        (session.user as any).propertyId = token.propertyId;
        (session.user as any).propertyName = token.propertyName;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut, auth } = nextAuth;
