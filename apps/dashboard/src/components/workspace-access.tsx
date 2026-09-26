'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ServerWorkspaceResult, Workspace } from '@/lib/workspace';

const WorkspaceContext = React.createContext<Workspace | null>(null);
export function useWorkspace() { return React.useContext(WorkspaceContext); }

export function WorkspaceAccess({
  children,
  result,
}: {
  children: React.ReactNode;
  result: ServerWorkspaceResult | null;
}) {
  if (result?.state === 'ready') {
    const workspace = result.workspace;
    return (
      <WorkspaceContext.Provider key={`${workspace.user.id}:${workspace.property.id}`} value={workspace}>
        {children}
      </WorkspaceContext.Provider>
    );
  }

  const noProperty = result?.state === 'no_property';
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F1E8] p-6">
      <section className="w-full max-w-md rounded-xl border border-[#E5D4BC] bg-white p-6 space-y-4" aria-live="polite">
        <h1 className="text-xl font-serif">{noProperty ? 'Your property workspace' : "We couldn't load your property right now"}</h1>
        <p className="text-sm text-[#7A7267]">
          {noProperty
            ? 'Set up your property to begin. If you joined an existing team, ask your manager to check your access.'
            : 'The service is temporarily unavailable. Please try again.'}
        </p>
        {noProperty ? (
          <Link className="inline-flex min-h-11 items-center px-4 rounded bg-[#71382D] text-white" href="/onboarding">Set up property</Link>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => window.location.reload()} className="min-h-11 px-4 rounded bg-[#71382D] text-white">Try again</button>
            <Link className="inline-flex min-h-11 items-center px-4 rounded border border-[#D5CFC7]" href="/login">Sign in again</Link>
          </div>
        )}
      </section>
    </main>
  );
}
