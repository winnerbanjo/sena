import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, properties, propertyMembers, eq } from '@sena/database';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    let userObj: { id?: string; name: string; email?: string; role: string; phone?: string } | null = null;
    let propObj: { id?: string; name: string; slug: string; address?: string; city?: string; country?: string } | null = null;

    // 1. Try to resolve user from session
    if (session?.user?.id) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      if (u) {
        userObj = {
          id: u.id,
          name: u.fullName || session.user.name || 'Winner',
          email: u.email,
          phone: u.phone || undefined,
          role: (session.user as any)?.role || 'Owner',
        };
      }
    }

    // 2. If no session user found, look up primary user in DB
    if (!userObj) {
      const firstUser = await db.query.users.findFirst();
      if (firstUser) {
        userObj = {
          id: firstUser.id,
          name: firstUser.fullName || 'Winner',
          email: firstUser.email,
          phone: firstUser.phone || undefined,
          role: 'Owner',
        };
      } else {
        userObj = {
          name: 'Winner',
          email: 'technile0@gmail.com',
          role: 'Owner',
        };
      }
    }

    // 3. Resolve primary property
    const prop = await db.query.properties.findFirst();
    if (prop) {
      propObj = {
        id: prop.id,
        name: prop.name || 'Amami',
        slug: prop.slug || 'amami',
        address: prop.address || 'Central District',
        city: (prop as any).city || 'Abuja',
        country: prop.country || 'Nigeria',
      };
    } else {
      propObj = {
        name: 'Amami',
        slug: 'amami',
        address: 'Central District',
        city: 'Abuja',
        country: 'Nigeria',
      };
    }

    return NextResponse.json({
      user: userObj,
      property: propObj,
    });
  } catch (error: any) {
    console.error('Failed to get /api/me:', error);
    return NextResponse.json({
      user: {
        name: 'Winner',
        email: 'technile0@gmail.com',
        role: 'Owner',
      },
      property: {
        name: 'Amami',
        slug: 'amami',
        address: 'Central District',
        city: 'Abuja',
        country: 'Nigeria',
      },
    });
  }
}
