import { db, users, organizations, organizationMembers, properties, propertyMembers, roomTypes, rooms } from './index';
import bcrypt from 'bcryptjs';

export async function seedDemoData() {
  console.log('Seeding initial demo data to PostgreSQL...');

  const email = 'amara@stayconnect.ng';
  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const [user] = await db
    .insert(users)
    .values({
      email,
      fullName: 'Amara Okafor',
      passwordHash,
      phone: '+234 803 123 4567',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        passwordHash,
        fullName: 'Amara Okafor',
        isActive: true,
      },
    })
    .returning();

  console.log('Demo user ready:', user.email);

  // Organization
  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Stay Connect Hospitality Ltd',
      slug: 'stay-connect-group',
    })
    .onConflictDoNothing()
    .returning();

  const orgId = org ? org.id : (await db.query.organizations.findFirst())!.id;

  // Org member
  await db
    .insert(organizationMembers)
    .values({
      organizationId: orgId,
      userId: user.id,
      role: 'owner',
    })
    .onConflictDoNothing();

  // Property: Stay Connect Lekki
  const [prop] = await db
    .insert(properties)
    .values({
      organizationId: orgId,
      name: 'Stay Connect Lekki',
      code: 'SCL',
      propertyType: 'serviced_apartment',
      country: 'Nigeria',
      address: 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos',
      phone: '+234 803 123 4567',
      email: 'concierge@stayconnect.ng',
      currency: 'NGN',
    })
    .onConflictDoNothing()
    .returning();

  const propId = prop ? prop.id : (await db.query.properties.findFirst())!.id;

  // Property member
  await db
    .insert(propertyMembers)
    .values({
      propertyId: propId,
      userId: user.id,
      role: 'general_manager',
    })
    .onConflictDoNothing();

  console.log('Demo property ready:', propId);
  return { userId: user.id, propertyId: propId };
}

if (require.main === module) {
  seedDemoData()
    .then(() => {
      console.log('Seed completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
