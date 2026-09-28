'use client';
import { Topbar } from './topbar';
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
  const offline = failed && failureKind === 'offline';
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Topbar title={title} />
      <main className="p-4 sm:p-6 lg:p-8 space-y-5" aria-live="polite">
        {failed ? (
          <>
            <h2 className="text-xl font-serif">
              {offline ? 'You appear to be offline' : `We could not load ${title.toLowerCase()}`}
            </h2>
            <p className="text-sm text-[#7A7267]">
              {offline
                ? 'Connect to the internet and try again. Your saved information has not changed.'
                : 'Sena could not complete this request. This is not a problem with your internet connection. Try again in a moment. Your saved information has not changed.'}
            </p>
            <button
              onClick={retry || (() => window.location.reload())}
              className="min-h-11 rounded bg-[#71382D] px-4 text-sm text-white"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <span className="sr-only">Loading {title.toLowerCase()}</span>
            <div className="h-24 rounded-lg bg-[#F7F1E8] animate-pulse" />
            <div className="h-80 rounded-lg bg-[#F7F1E8] animate-pulse" />
          </>
        )}
      </main>
    </div>
  );
}
