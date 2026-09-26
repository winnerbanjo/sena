'use client';
import * as React from 'react';
import Link from 'next/link';

type Workspace = { user: { id: string; name: string; email: string; role: string }; property: { id: string; slug?: string; name: string; address: string; timezone: string; currency: string; checkInTime: string; checkOutTime: string } };
const WorkspaceContext = React.createContext<Workspace | null>(null);
export function useWorkspace() { return React.useContext(WorkspaceContext); }

export function WorkspaceAccess({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'signed-out' | 'setup' | 'error'>('loading');
  const check = React.useCallback(async () => {
    try {
      const response = await fetch('/api/me', {
        cache: 'no-store',
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 401) { setState('signed-out'); return; }
      if (!response.ok) throw new Error();
      const data = await response.json();
      setWorkspace(data);
      setState(data.property ? 'ready' : 'setup');
    } catch { setState('error'); }
  }, []);
  React.useEffect(() => {
    check();
    const onFocus = () => { check(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onFocus);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onFocus); };
  }, [check]);
  if (state === 'ready' && workspace) return <WorkspaceContext.Provider key={`${workspace.user.id}:${workspace.property.id}`} value={workspace}>{children}</WorkspaceContext.Provider>;
  return <main className="min-h-screen flex items-center justify-center bg-[#F7F1E8] p-6">
    <section className="w-full max-w-md rounded-xl border border-[#E5D4BC] bg-white p-6 space-y-4" aria-live="polite">
      <h1 className="text-xl font-serif">{state === 'loading' ? 'Opening your property…' : state === 'signed-out' ? 'Please sign in' : state === 'setup' ? 'Your property workspace' : 'Your property could not be loaded'}</h1>
      {state === 'loading' ? <div className="h-24 animate-pulse rounded bg-[#F7F1E8]" aria-label="Loading your account" /> : <>
        <p className="text-sm text-[#7A7267]">{state === 'signed-out' ? 'Sign in to securely access your property.' : state === 'setup' ? 'Set up your property to begin. If you joined an existing team, ask your manager to check your access.' : 'Check your connection and try again.'}</p>
        {state === 'error' ? <button onClick={check} className="min-h-11 px-4 rounded bg-[#71382D] text-white">Try again</button> : <Link className="inline-flex min-h-11 items-center px-4 rounded bg-[#71382D] text-white" href={state === 'setup' ? '/onboarding' : '/login'}>{state === 'setup' ? 'Set up property' : 'Sign in'}</Link>}
      </>}
    </section>
  </main>;
}
