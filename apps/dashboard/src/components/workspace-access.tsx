'use client';

import * as React from 'react';
import Link from 'next/link';
import type { ServerWorkspaceResult, Workspace } from '@/lib/workspace';
import { useTranslations } from 'next-intl';

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
  return <WorkspaceError noProperty={noProperty} />;
}

function WorkspaceError({ noProperty }: { noProperty: boolean }) {
  const t = useTranslations('setup');
  const tCommon = useTranslations('common');
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F1E8] p-6">
      <section className="w-full max-w-md rounded-xl border border-[#E5D4BC] bg-white p-6 space-y-4" aria-live="polite">
        <h1 className="text-xl font-serif">{noProperty ? t('workspaceTitle') : t('workspaceErrorTitle')}</h1>
        <p className="text-sm text-[#7A7267]">{noProperty ? t('workspaceBody') : t('workspaceErrorBody')}</p>
        {noProperty ? (
          <Link className="inline-flex min-h-11 items-center px-4 rounded bg-[#71382D] text-white" href="/onboarding">{t('setUpProperty')}</Link>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => window.location.reload()} className="min-h-11 px-4 rounded bg-[#71382D] text-white">{t('retryConnection')}</button>
            <Link className="inline-flex min-h-11 items-center px-4 rounded border border-[#D5CFC7]" href="/login">{tCommon('signInAgain')}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
