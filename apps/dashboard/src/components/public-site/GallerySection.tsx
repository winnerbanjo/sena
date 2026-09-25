'use client';

import * as React from 'react';
import { WebsiteData } from '../../lib/website-data';
import { X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';

export function GallerySection({ data }: { data: WebsiteData }) {
  const { config, property } = data;
  const images = config.galleryImages || [];
  const [selectedIdx, setSelectedIdx] = React.useState<number | null>(null);
  const [activeCategory, setActiveCategory] = React.useState<string>('All');

  if (images.length === 0) return null;

  const categories = ['All', ...Array.from(new Set(images.map((img) => img.category || 'Property')))];
  const filtered =
    activeCategory === 'All'
      ? images
      : images.filter((img) => (img.category || 'Property') === activeCategory);

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
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-[#71382D] text-white shadow-xs'
                      : 'bg-white text-[#7A7267] border border-[#E8E2DA] hover:text-[#191816]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Masonry / Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {filtered.slice(0, 8).map((img, idx) => (
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
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <span className="text-white text-xs font-medium truncate">
                  {img.caption || img.category || 'View Photo'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedIdx !== null && filtered[selectedIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedIdx(null)}
        >
          <button
            onClick={() => setSelectedIdx(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full bg-white/10"
            aria-label="Close photo preview"
          >
            <X className="w-6 h-6" />
          </button>

          <div
            className="relative max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={filtered[selectedIdx].url}
              alt="Preview"
              className="max-w-full max-h-[80vh] object-contain rounded-lg mx-auto"
            />
            {filtered[selectedIdx].caption && (
              <p className="text-center text-white text-xs mt-3 font-light">
                {filtered[selectedIdx].caption}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
