'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WebsiteData } from '../../lib/website-data';
import { useTheme } from '../../lib/theme-provider';
import { Phone, Mail, MessageCircle, MapPin, Heart } from 'lucide-react';

export function Footer({ data }: { data: WebsiteData }) {
  const pathname = usePathname();
  const themeContext = useTheme();
  const tokens = themeContext?.tokens;
  const headingStyle = themeContext?.headingStyle || {
    fontFamily: 'var(--theme-heading-font)',
  };

  const { property, config } = data;
  const slug = property.slug;

  const isSitePath = pathname?.startsWith('/site/');
  const base = isSitePath ? `/site/${slug}` : '';
  const homeHref = isSitePath ? `/site/${slug}` : '/';

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#191816] text-stone-300 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-4">
            <h3
              style={headingStyle}
              className="text-2xl text-white font-normal"
            >
              {property.name}
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed max-w-sm">
              {config.heroSubheading}
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-stone-400">
              <MapPin
                style={{ color: tokens?.accentColor || '#B85C3E' }}
                className="w-4 h-4"
              />
              <span>{property.address}, {property.country}</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3 space-y-3">
            <span className="text-[11px] uppercase font-mono tracking-wider text-stone-400 block font-semibold">
              Explore
            </span>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href={homeHref} className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href={`${base}/rooms`} className="hover:text-white transition-colors">
                  Rooms &amp; Suites
                </Link>
              </li>
              <li>
                <Link href={`${base}/gallery`} className="hover:text-white transition-colors">
                  Photo Gallery
                </Link>
              </li>
              <li>
                <Link href={`${base}/reviews`} className="hover:text-white transition-colors">
                  Guest Reviews
                </Link>
              </li>
              <li>
                <Link href={`${base}/about`} className="hover:text-white transition-colors">
                  About &amp; Policies
                </Link>
              </li>
              <li>
                <Link href={`${base}/contact`} className="hover:text-white transition-colors">
                  Contact &amp; Location
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Col */}
          <div className="md:col-span-4 space-y-3">
            <span className="text-[11px] uppercase font-mono tracking-wider text-stone-400 block font-semibold">
              Direct Inquiries
            </span>
            <div className="space-y-2 text-xs">
              {config.contactPhone && (
                <a
                  href={`tel:${config.contactPhone}`}
                  className="flex items-center gap-2 text-stone-300 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-stone-500" />
                  <span>{config.contactPhone}</span>
                </a>
              )}
              {config.contactEmail && (
                <a
                  href={`mailto:${config.contactEmail}`}
                  className="flex items-center gap-2 text-stone-300 hover:text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-stone-500" />
                  <span>{config.contactEmail}</span>
                </a>
              )}
              {config.contactWhatsapp && (
                <a
                  href={`https://wa.me/${config.contactWhatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-stone-300 hover:text-white transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>WhatsApp Concierge</span>
                </a>
              )}
            </div>

            <div className="pt-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 block">
                Direct Booking Guarantee
              </span>
              <p className="text-[11px] text-stone-400 mt-1">
                Zero booking fees, instant confirmation, secure payment powered by Sena.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>&copy; {currentYear} {property.name}. All rights reserved.</p>

          <div className="flex items-center gap-1 text-[11px]">
            <span>Powered by</span>
            <a
              href="https://sena.ng"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-300 font-medium hover:text-white underline underline-offset-4"
            >
              Sena Hospitality
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
