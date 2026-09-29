export type ZohoOrgsFetchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ZohoOrgsView =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'list'; organizations: Array<{ organizationId: string; name: string }> }
  | { kind: 'empty' }
  | { kind: 'hidden' };

/**
 * Connected-apps Zoho org panel view model.
 * Never treat pre-fetch idle as "empty organizations" — that falsely shows
 * empty-org copy before manage responds. Empty copy is provider-specific in the UI.
 */
export function resolveZohoOrgsView(input: {
  connected: boolean;
  fetchStatus: ZohoOrgsFetchStatus;
  organizations: Array<{ organizationId: string; name: string }>;
  errorMessage: string | null;
}): ZohoOrgsView {
  if (!input.connected) return { kind: 'hidden' };
  if (input.fetchStatus === 'idle' || input.fetchStatus === 'loading') return { kind: 'loading' };
  if (input.fetchStatus === 'error') {
    return { kind: 'error', message: input.errorMessage || 'Could not load Zoho organizations.' };
  }
  if (input.organizations.length > 0) return { kind: 'list', organizations: input.organizations };
  return { kind: 'empty' };
}

/** Apply a manage payload into org list state. Ignores non-array organizations. */
export function organizationsFromManagePayload(payload: unknown): Array<{ organizationId: string; name: string }> {
  if (!payload || typeof payload !== 'object') return [];
  const organizations = (payload as { organizations?: unknown }).organizations;
  if (!Array.isArray(organizations)) return [];
  return organizations
    .map((org) => {
      if (!org || typeof org !== 'object') return null;
      const record = org as Record<string, unknown>;
      const organizationId = record.organizationId ?? record.organization_id ?? record.id;
      if (organizationId == null || organizationId === '') return null;
      const name = record.name;
      return {
        organizationId: String(organizationId),
        name: String(typeof name === 'string' && name ? name : organizationId),
      };
    })
    .filter(Boolean) as Array<{ organizationId: string; name: string }>;
}
