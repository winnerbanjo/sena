'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { classifyWorkspaceFailure, classifyWorkspaceResponse, type WorkspaceBootState } from '@/lib/workspace-boot';

type Workspace = { user: { id: string; name: string; email: string; role: string }; property: { id: string; slug?: string; name: string; address: string; timezone: string; currency: string; checkInTime: string; checkOutTime: string } };
const WorkspaceContext = React.createContext<Workspace | null>(null);
export function useWorkspace() { return React.useContext(WorkspaceContext); }

export function WorkspaceAccess({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [state, setState] = React.useState<WorkspaceBootState>('checking_auth');

  const clearStaleClientState = React.useCallback(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.controller?.postMessage({ type: 'PURGE_ALL_DATA' });
      }
      if ('caches' in window) {
        void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
    } catch {
      // Storage cleanup must never prevent the sign-in redirect.
    }
  }, []);

  const check = React.useCallback(async () => {
    setState('checking_auth');
    try {
      const response = await fetch('/api/me', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 401) {
        setWorkspace(null);
        setState('unauthenticated');
        clearStaleClientState();
        router.replace('/login');
        return;
      }
      if (response.status === 403) {
        setWorkspace(null);
        setState('authenticated_no_access');
        return;
      }
      if (!response.ok) {
        setWorkspace(null);
        setState(classifyWorkspaceResponse(response.status, false));
        return;
      }

      setState('authenticated_resolving_property');
      const data = await response.json();
      setWorkspace(data.property ? data : null);
      setState(classifyWorkspaceResponse(response.status, Boolean(data.property)));
    } catch {
      setWorkspace(null);
      setState(classifyWorkspaceFailure());
    }
  }, [clearStaleClientState, router]);

  const signOutSafely = React.useCallback(async () => {
    const { signOut } = await import('next-auth/react');
    await signOut({ redirect: false });
    clearStaleClientState();
    router.replace('/login');
  }, [clearStaleClientState, router]);

  React.useEffect(() => {
    check();
  }, [check]);

  if (state === 'authenticated_ready' && workspace) return <WorkspaceContext.Provider key={`${workspace.user.id}:${workspace.property.id}`} value={workspace}>{children}</WorkspaceContext.Provider>;

  if (state === 'unauthenticated') {
    return <main className="min-h-screen bg-white" aria-live="polite"><span className="sr-only">Taking you to sign in</span></main>;
  }

  const isChecking = state === 'checking_auth' || state === 'authenticated_resolving_property';
  const title = state === 'checking_auth'
    ? 'Checking your session…'
    : state === 'authenticated_resolving_property'
      ? 'Opening your property…'
      : state === 'authenticated_no_property'
        ? 'Your property workspace'
        : state === 'authenticated_no_access'
          ? 'Property access unavailable'
          : state === 'network_error'
            ? "We couldn't connect to Sena"
            : "We couldn't load your property right now";

  return <main className="min-h-screen flex items-center justify-center bg-[#F7F1E8] p-6">
    <section className="w-full max-w-md rounded-xl border border-[#E5D4BC] bg-white p-6 space-y-4" aria-live="polite">
      <h1 className="text-xl font-serif">{title}</h1>
      {isChecking ? <div className="h-24 animate-pulse rounded bg-[#F7F1E8]" aria-label={state === 'checking_auth' ? 'Checking your session' : 'Loading your authorized property'} /> : <>
        <p className="text-sm text-[#7A7267]">{state === 'authenticated_no_property'
          ? 'Set up your property to begin. If you joined an existing team, ask your manager to check your access.'
          : state === 'authenticated_no_access'
            ? 'Your account is signed in, but it does not currently have access to a property. Ask the property owner or Sena support to check your membership.'
            : state === 'network_error'
              ? 'Check your connection and try again.'
              : 'The service is temporarily unavailable. Please try again.'}</p>
        {state === 'authenticated_no_property'
          ? <Link className="inline-flex min-h-11 items-center px-4 rounded bg-[#71382D] text-white" href="/onboarding">Set up property</Link>
          : <div className="flex flex-wrap gap-3"><button onClick={check} className="min-h-11 px-4 rounded bg-[#71382D] text-white">Try again</button><button onClick={signOutSafely} className="min-h-11 px-4 rounded border border-[#D5CFC7]">Sign out</button></div>}
      </>}
    </section>
  </main>;
}
