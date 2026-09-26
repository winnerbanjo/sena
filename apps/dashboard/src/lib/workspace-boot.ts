export type WorkspaceBootState =
  | 'checking_auth'
  | 'unauthenticated'
  | 'authenticated_resolving_property'
  | 'authenticated_ready'
  | 'authenticated_no_property'
  | 'authenticated_no_access'
  | 'network_error'
  | 'server_error';

export function classifyWorkspaceResponse(
  status: number,
  hasProperty: boolean,
): WorkspaceBootState {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'authenticated_no_access';
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'server_error';
  return hasProperty ? 'authenticated_ready' : 'authenticated_no_property';
}

export function classifyWorkspaceFailure(): WorkspaceBootState {
  return 'network_error';
}
