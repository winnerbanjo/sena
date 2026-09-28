import assert from 'node:assert/strict';
import fs from 'node:fs';
import { membershipIsUsable, membershipPermissionsList } from '../apps/dashboard/src/lib/membership-access';

assert.deepEqual(membershipPermissionsList(null), []);
assert.deepEqual(membershipPermissionsList(undefined), []);
assert.deepEqual(membershipPermissionsList({}), []);
assert.deepEqual(membershipPermissionsList('status:active'), []);
assert.deepEqual(membershipPermissionsList(['status:active', 1 as unknown as string]), ['status:active']);

assert.equal(membershipIsUsable(null), true);
assert.equal(membershipIsUsable({}), true);
assert.equal(membershipIsUsable(['status:active']), true);
assert.equal(membershipIsUsable(['status:invited']), false);
assert.equal(membershipIsUsable(['status:revoked']), false);

const memberships = [
  { propertySlug: 'stayconnect', propertyId: 'stay', permissions: ['status:active'] },
  { propertySlug: 'amami', propertyId: 'amami', permissions: ['status:invited'] },
  { propertySlug: 'sena-fw-test-cert', propertyId: '31000000-0000-4000-8000-000000000003', permissions: {} },
];
const usable = memberships.filter((row) => membershipIsUsable(row.permissions));
assert.deepEqual(
  usable.map((row) => row.propertySlug),
  ['stayconnect', 'sena-fw-test-cert'],
);
const selected = usable.find((row) => row.propertySlug === 'sena-fw-test-cert');
assert.equal(selected?.propertyId, '31000000-0000-4000-8000-000000000003');

const authSource = fs.readFileSync('apps/dashboard/src/auth.ts', 'utf8');
assert.match(authSource, /membershipIsUsable/);
assert.doesNotMatch(authSource, /permissions\.includes\('status:invited'\)/);
const loginSource = fs.readFileSync('apps/dashboard/src/app/login/page.tsx', 'utf8');
assert.match(loginSource, /propertySlug \? \{ property: propertySlug \}/);
assert.match(loginSource, /\/apps\?manage=flutterwave/);

console.log('PASS membership access treats non-array permissions as empty and property login wiring remains intact');
