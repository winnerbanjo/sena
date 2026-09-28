'use client';
import { Topbar } from './topbar';
import { useTranslations } from 'next-intl';
import { HttpLoadError, type LoadFailureKind } from '../lib/page-load';

export async function readJsonResponse(response: Response) {
  if (!response.ok) throw new HttpLoadError(response.status);
  return response.json();
}

export function PageLoadState({
  title,
  failed,
  failureKind = 'error',
  retry,
}: {
  title: string;
  failed?: boolean;
  failureKind?: LoadFailureKind;
  retry?: () => void;
}) {
  const t = useTranslations('setup');
  const offline = failed && failureKind === 'offline';
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title={title} />
      <main className="p-4 sm:p-6 lg:p-8 space-y-5" aria-live="polite">
        {failed ? (
          <>
            <h2 className="text-xl font-serif">
              {offline ? t('pageLoadOfflineTitle') : t('pageLoadFailed', { title: title.toLowerCase() })}
            </h2>
            <p className="text-sm text-[#7A7267]">
              {offline ? t('pageLoadOfflineHint') : t('pageLoadServerHint')}
            </p>
            <button
              onClick={retry || (() => window.location.reload())}
              className="min-h-11 rounded bg-[#71382D] px-4 text-sm text-white"
            >
              {t('retryConnection')}
            </button>
          </>
        ) : (
          <>
            <span className="sr-only">{t('loadingPage', { title: title.toLowerCase() })}</span>
            <div className="h-24 rounded-lg bg-[#F7F1E8] animate-pulse" />
            <div className="h-80 rounded-lg bg-[#F7F1E8] animate-pulse" />
          </>
        )}
      </main>
    </div>
  );
}
