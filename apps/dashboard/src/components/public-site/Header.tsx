'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WebsiteData } from '../../lib/website-data';
import { Menu, X, ArrowRight } from 'lucide-react';

export function Header({ data, currentPath }: { data: WebsiteData; currentPath?: string }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const { property, config } = data;
  const slug = property.slug;

  const isSitePath = pathname?.startsWith('/site/');
  const base = isSitePath ? `/site/${slug}` : '';
  const homeHref = isSitePath ? `/site/${slug}` : '/';

  const navLinks = [
    { label: 'Home', href: homeHref },
    { label: 'Rooms', href: `${base}/rooms` },
    ...(config.enabledSections.gallery ? [{ label: 'Gallery', href: `${base}/gallery` }] : []),
    ...(config.enabledSections.reviews ? [{ label: 'Reviews', href: `${base}/reviews` }] : []),
    ...(config.enabledSections.intro ? [{ label: 'About', href: `${base}/about` }] : []),
    { label: 'Contact', href: `${base}/contact` },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E8E2DA] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
        {/* Brand Logo or Name */}
        <Link href={homeHref} className="flex items-center gap-3 group">
          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt={property.name}
              className="h-9 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col">
              <span className="font-serif text-xl sm:text-2xl text-[#191816] tracking-tight font-medium group-hover:text-[#71382D] transition-colors">
                {property.name}
              </span>
              <span className="text-[10px] tracking-widest uppercase font-mono text-[#7A7267] -mt-0.5">
                {property.propertyType} &middot; {property.address.split(',')[0]}
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 lg:gap-9">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs uppercase tracking-wider font-medium text-[#5C564D] hover:text-[#191816] transition-colors relative py-1"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Header Action: Book Now */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href={`${base}/rooms`}
            className="px-4.5 py-2.5 rounded text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] shadow-xs transition-all inline-flex items-center gap-1.5"
            style={{ borderRadius: 'var(--theme-radius, 6px)' }}
          >
            <span>{config.heroCtaLabel || 'Book Your Stay'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-md text-[#191816] hover:bg-[#FAF7F2] transition-colors"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E8E2DA] bg-white px-6 py-6 space-y-4 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-medium text-[#191816] hover:text-[#71382D] py-2 border-b border-[#F0ECE6]"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-2">
            <Link
              href={`${base}/rooms`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 rounded text-center text-xs font-semibold text-white bg-[#71382D] hover:bg-[#5A2C23] block shadow-xs"
              style={{ borderRadius: 'var(--theme-radius, 6px)' }}
            >
              {config.heroCtaLabel || 'Book Your Stay'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
