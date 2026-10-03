import type { NextAuthConfig } from 'next-auth';

const isProductionHttps =
  process.env.NODE_ENV === 'production' &&
  !process.env.AUTH_URL?.startsWith('http://') &&
  !process.env.NEXTAUTH_URL?.startsWith('http://') &&
  !process.env.NEXTAUTH_URL?.includes('localhost');

export const authConfig = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  useSecureCookies: isProductionHttps,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [],
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
} satisfies NextAuthConfig;
