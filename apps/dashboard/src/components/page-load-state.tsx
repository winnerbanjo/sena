'use client';
import { Topbar } from './topbar';
import { Button, Skeleton } from '@sena/ui';
import { useTranslations } from 'next-intl';
import { HttpLoadError, type LoadFailureKind } from '../lib/page-load';
import { pageMain, pageStack } from './design';

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
    <div className={pageStack}>
      <Topbar title={title} />
      <main className={pageMain} aria-live="polite">
        {failed ? (
          <div className="max-w-lg space-y-2">
            <h2 className="text-base font-medium text-[#191816]">
              {offline ? t('pageLoadOfflineTitle') : t('pageLoadFailed', { title: title.toLowerCase() })}
            </h2>
            <p className="text-sm text-[#7A7267]">
              {offline ? t('pageLoadOfflineHint') : t('pageLoadServerHint')}
            </p>
            <Button onClick={retry || (() => window.location.reload())}>{t('retryConnection')}</Button>
          </div>
        ) : (
          <>
            <span className="sr-only">{t('loadingPage', { title: title.toLowerCase() })}</span>
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-72" />
          </>
        )}
      </main>
    </div>
  );
}
