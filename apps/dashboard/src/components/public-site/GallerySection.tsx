'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { X, ChevronLeft, ChevronRight, Camera, Maximize2 } from 'lucide-react';

export function GallerySection({ data }: { data: WebsiteData }) {
  const { config, property } = data;
  const images = config.galleryImages || [];
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const [activeCategory, setActiveCategory] = React.useState<string>('All');
  const [showAll, setShowAll] = React.useState<boolean>(false);

  // Keyboard navigation for lightbox
  React.useEffect(() => {
    if (selectedIdx === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIdx(null);
      if (e.key === 'ArrowLeft') {
        setSelectedIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : filtered.length - 1));
      }
      if (e.key === 'ArrowRight') {
        setSelectedIdx((prev) => (prev !== null && prev < filtered.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx]);

  if (images.length === 0) return null;

  const rawCategories = Array.from(new Set(images.map((img) => img.category || 'Property'))).filter(Boolean);
  const categories = ['All', ...rawCategories];
  const filtered =
    activeCategory === 'All'
      ? images
      : images.filter((img) => (img.category || 'Property') === activeCategory);

  const displayedImages = showAll ? filtered : filtered.slice(0, 8);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIdx === null) return;
    setSelectedIdx(selectedIdx > 0 ? selectedIdx - 1 : filtered.length - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIdx === null) return;
    setSelectedIdx(selectedIdx < filtered.length - 1 ? selectedIdx + 1 : 0);
  };

  return (
    <section className="py-14 sm:py-20 bg-[#FAF7F2] border-b border-[#E8E2DA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#B85C3E] block">
              Visual Tour
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-[#191816]">
              A Glimpse Inside {property.name}
            </h2>
          </div>

          {/* Category Tabs */}
          {categories.length > 2 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setShowAll(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-[#71382D] text-white shadow-xs'
                      : 'bg-white text-[#7A7267] border border-[#E8E2DA] hover:text-[#191816]'
                  }`}
                  style={{
                    backgroundColor: activeCategory === cat ? 'var(--theme-primary, #71382D)' : undefined,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Masonry / Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {displayedImages.map((img, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedIdx(idx)}
              className="relative aspect-square sm:aspect-[4/3] rounded-lg overflow-hidden bg-stone-200 cursor-pointer group shadow-2xs"
              style={{ borderRadius: 'var(--theme-radius, 8px)' }}
            >
              <img
                src={img.url}
                alt={img.caption || property.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="self-end">
                  <span className="p-1.5 rounded-full bg-black/40 text-white/90 backdrop-blur-xs inline-flex">
                    <Maximize2 className="w-3 h-3" />
                  </span>
                </div>
                <div className="space-y-0.5">
                  {img.category && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/80 block">
                      {img.category}
                    </span>
                  )}
                  <span className="text-white text-xs font-medium truncate block">
                    {img.caption || 'View Photo'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Show all photos button if more than 8 */}
        {filtered.length > 8 && (
          <div className="text-center pt-2">
            <button
              onClick={() => setShowAll(!showAll)}
              className="px-5 py-2 rounded-full border border-[#E8E2DA] bg-white text-xs font-semibold text-[#191816] hover:bg-[#FAF7F2] transition-colors"
            >
              {showAll ? 'Show Fewer Photos' : `View All ${filtered.length} Photos`}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedIdx !== null && filtered[selectedIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          onClick={() => setSelectedIdx(null)}
        >
          {/* Top Bar with Counter and Close */}
          <div className="absolute top-4 sm:top-6 inset-x-4 sm:inset-x-8 flex items-center justify-between pointer-events-none z-10">
            <span className="text-white/70 text-xs font-mono px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xs">
              {selectedIdx + 1} of {filtered.length}
            </span>
            <button
              onClick={() => setSelectedIdx(null)}
              className="text-white/80 hover:text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors pointer-events-auto"
              aria-label="Close photo preview"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Navigation Arrows */}
          {filtered.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-xs transition-colors z-10"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white backdrop-blur-xs transition-colors z-10"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </>
          )}

          {/* Image & Caption */}
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filtered[selectedIdx].url}
              alt={filtered[selectedIdx].caption || 'Preview'}
              className="max-w-full max-h-[75vh] object-contain rounded-lg mx-auto shadow-2xl"
            />
            {(filtered[selectedIdx].caption || filtered[selectedIdx].category) && (
              <div className="text-center mt-3 space-y-1 max-w-xl">
                {filtered[selectedIdx].category && (
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#E8DACB]">
                    {filtered[selectedIdx].category}
                  </span>
                )}
                {filtered[selectedIdx].caption && (
                  <p className="text-white text-xs sm:text-sm font-light">
                    {filtered[selectedIdx].caption}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

