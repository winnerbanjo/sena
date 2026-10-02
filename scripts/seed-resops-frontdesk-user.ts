/**
 * Local review helper: a front-desk member on the QA property, so destructive
 * permission gating can be verified over HTTP the way a receptionist sees it.
 */
import { requireIsolatedTestDatabase } from './require-isolated-test-database';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';

process.env.SENA_TEST_DATABASE_URL =
  process.env.SENA_TEST_DATABASE_URL || `postgresql://${process.env.USER || 'oyekunle'}@127.0.0.1:5432/sena_test`;
process.env.SENA_PRODUCTION_DATABASE_URL =
  process.env.SENA_PRODUCTION_DATABASE_URL || 'postgresql://placeholder-prod-url-for-safety-check:5432/sena_prod_remote';
requireIsolatedTestDatabase();

const QA_PROPERTY = '6a6a4880-ae96-4b1e-91bd-0ac422382f56';
const EMAIL = 'qa-resops-frontdesk@example.invalid';
const PASSWORD = 'Local-QA-ResOps-FrontDesk-1!';

async function run() {
  const { db, users, propertyMembers, eq, and } = await import('../packages/database/src/index');

  const [existing] = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
  const user =
    existing ||
    (await db
      .insert(users)
      .values({ email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 10), fullName: 'QA Front Desk', isActive: true })
      .returning())[0];

  const [membership] = await db
    .select()
    .from(propertyMembers)
    .where(and(eq(propertyMembers.userId, user.id), eq(propertyMembers.propertyId, QA_PROPERTY)))
    .limit(1);

  if (!membership) {
    await db.insert(propertyMembers).values({ userId: user.id, propertyId: QA_PROPERTY, role: 'front_desk' });
  } else if (membership.role !== 'front_desk') {
    await db.update(propertyMembers).set({ role: 'front_desk' }).where(eq(propertyMembers.id, membership.id));
  }

  assert.ok(user.id);
  console.log(`front desk user: ${EMAIL} / ${PASSWORD}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});