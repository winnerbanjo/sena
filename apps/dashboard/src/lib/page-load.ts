export type LoadFailureKind = 'offline' | 'error';

export function isNetworkFailure(error: unknown): boolean {
  if (!error) return false;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'TypeError') return true;
  return /Failed to fetch|Load failed|NetworkError|network error|ERR_INTERNET_DISCONNECTED/i.test(message);
}

export function classifyLoadFailure(error: unknown, online = true): LoadFailureKind {
  if (!online) return 'offline';
  if (isNetworkFailure(error)) return 'offline';
  return 'error';
}

export class HttpLoadError extends Error {
  status: number;
  constructor(status: number, message = 'Unable to load this page') {
    super(message);
    this.name = 'HttpLoadError';
    this.status = status;
  }
}
