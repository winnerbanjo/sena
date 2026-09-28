/** Membership permission lists may be null, a string[], or a non-array JSON value. */
export function membershipPermissionsList(permissions: unknown): string[] {
  return Array.isArray(permissions) ? permissions.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function membershipIsUsable(permissions: unknown): boolean {
  const list = membershipPermissionsList(permissions);
  return !list.includes('status:invited') && !list.includes('status:revoked');
}
