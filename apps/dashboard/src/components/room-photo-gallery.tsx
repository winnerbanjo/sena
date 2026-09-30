'use client';

import * as React from 'react';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80';

export function RoomPhotoGallery({ images, name }: { images: string[]; name: string }) {
  const photos = images.filter(Boolean);
  const list = photos.length > 0 ? photos : [PLACEHOLDER];
  const [index, setIndex] = React.useState(0);
  const startX = React.useRef<number | null>(null);
  const current = list[Math.min(index, list.length - 1)];

  function show(next: number) {
    setIndex((next + list.length) % list.length);
  }

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-[16/10] overflow-hidden rounded-xl bg-stone-100 shadow-md"
        onTouchStart={(event) => {
          startX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (startX.current == null || list.length < 2) return;
          const delta = (event.changedTouches[0]?.clientX ?? startX.current) - startX.current;
          if (delta > 40) show(index - 1);
          if (delta < -40) show(index + 1);
          startX.current = null;
        }}
      >
        <img
          src={current}
          alt={name}
          width={1200}
          height={750}
          sizes="(max-width: 640px) 100vw, 720px"
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover"
        />
        {list.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" className="absolute left-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-black/55 text-white" onClick={() => show(index - 1)}>
              ‹
            </button>
            <button type="button" aria-label="Next photo" className="absolute right-2 top-1/2 min-h-11 min-w-11 -translate-y-1/2 rounded-full bg-black/55 text-white" onClick={() => show(index + 1)}>
              ›
            </button>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1">
          {list.map((src, photoIndex) => (
            <button
              key={`${src}-${photoIndex}`}
              type="button"
              aria-label={`Show photo ${photoIndex + 1}`}
              onClick={() => show(photoIndex)}
              className={`h-16 w-24 shrink-0 snap-start overflow-hidden rounded-lg border ${photoIndex === index ? 'border-[#71382D]' : 'border-transparent'}`}
            >
              <img src={src} alt="" width={160} height={104} loading="lazy" decoding="async" sizes="96px" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
