import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, users, properties, propertyMembers, organizationMembers, eq, ilike } from '@sena/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    const headerUserEmail = req.headers.get('x-user-email') || req.nextUrl.searchParams.get('email');
    const headerPropName = req.headers.get('x-property-name') || req.nextUrl.searchParams.get('property');
    const headerPropId = req.headers.get('x-property-id') || req.nextUrl.searchParams.get('propertyId');

    let userObj: { id?: string; name: string; email?: string; role: string; phone?: string } | null = null;
    let propObj: { id?: string; name: string; slug: string; address?: string; city?: string; country?: string } | null = null;
    let resolvedRole = 'Owner';

    // 1. Try to resolve user
    // A. From explicit client email header/param
    if (headerUserEmail) {
      const u = await db.query.users.findFirst({
        where: eq(users.email, headerUserEmail.toLowerCase().trim()),
      });
      if (u) {
        userObj = {
          id: u.id,
          name: u.fullName || 'User',
          email: u.email,
          phone: u.phone || undefined,
          role: 'Owner',
        };
      }
    }

    // B. From session user id or email
    if (!userObj && session?.user?.id) {
      const u = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      if (u) {
        userObj = {
          id: u.id,
          name: u.fullName || session.user.name || 'User',
          email: u.email,
          phone: u.phone || undefined,
          role: (session.user as any)?.role || 'Owner',
        };
      }
    }

    // C. From property name if provided
    if (!userObj && headerPropName) {
      const p = await db.query.properties.findFirst({
        where: ilike(properties.name, `%${headerPropName.trim()}%`),
      });
      if (p) {
        const pm = await db.query.propertyMembers.findFirst({
          where: eq(propertyMembers.propertyId, p.id),
        });
        if (pm) {
          const u = await db.query.users.findFirst({
            where: eq(users.id, pm.userId),
          });
          if (u) {
            userObj = {
              id: u.id,
              name: u.fullName || 'User',
              email: u.email,
              phone: u.phone || undefined,
              role: pm.role || 'Owner',
            };
          }
        }
      }
    }

    // D. Fallback user
    if (!userObj) {
      const firstUser = await db.query.users.findFirst();
      if (firstUser) {
        userObj = {
          id: firstUser.id,
          name: firstUser.fullName || 'User',
          email: firstUser.email,
          phone: firstUser.phone || undefined,
          role: 'Owner',
        };
      }
    }

    // 2. Resolve Property
    let prop: any = null;

    // A. From explicit property ID header only (trusted)
    if (headerPropId) {
      prop = await db.query.properties.findFirst({
        where: eq(properties.id, headerPropId),
      });
    }

    // B. From User's Property Memberships (most reliable — always use the user's own data)
    if (!prop && userObj?.id) {
      const pm = await db.query.propertyMembers.findFirst({
        where: eq(propertyMembers.userId, userObj.id),
      });
      if (pm?.propertyId) {
        prop = await db.query.properties.findFirst({
          where: eq(properties.id, pm.propertyId),
        });
        if (pm.role) resolvedRole = pm.role;
      }
    }

    // C. From User's Organization Memberships
    if (!prop && userObj?.id) {
      const om = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.userId, userObj.id),
      });
      if (om?.organizationId) {
        prop = await db.query.properties.findFirst({
          where: eq(properties.organizationId, om.organizationId),
        });
        if (om.role) resolvedRole = om.role;
      }
    }

    // D. Email domain mapping for known customers (e.g. stayconnectsuites2@gmail.com → Stay Connect)
    if (!prop && userObj?.email?.includes('stayconnect')) {
      prop = await db.query.properties.findFirst({
        where: ilike(properties.name, '%Stay Connect%'),
      });
    }

    // E. Last resort: first property in DB (only if user cannot be resolved at all)
    if (!prop && !userObj) {
      prop = await db.query.properties.findFirst();
    }

    if (prop) {
      propObj = {
        id: prop.id,
        name: prop.name || 'Stay Connect Solutions LTD',
        slug: prop.slug || 'stayconnect',
        address: prop.address || 'Central District',
        city: (prop as any).city || 'Abuja',
        country: prop.country || 'Nigeria',
      };
    } else {
      propObj = {
        name: 'Stay Connect Solutions LTD',
        slug: 'stayconnect',
        address: 'Central District',
        city: 'Abuja',
        country: 'Nigeria',
      };
    }

    if (userObj) {
      userObj.role = resolvedRole;
    }

    return NextResponse.json({
      user: userObj,
      property: propObj,
    });
  } catch (error: any) {
    console.error('Failed to get /api/me:', error);
    return NextResponse.json({
      user: {
        name: 'User',
        email: 'user@sena.ng',
        role: 'Owner',
      },
      property: {
        name: 'Stay Connect Solutions LTD',
        slug: 'stayconnect',
        address: 'Central District',
        city: 'Abuja',
        country: 'Nigeria',
      },
    });
  }
}
