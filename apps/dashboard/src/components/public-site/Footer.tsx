'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WebsiteData } from '../../lib/website-data';
import { Phone, Mail, MessageCircle, MapPin, Heart } from 'lucide-react';

export function Footer({ data }: { data: WebsiteData }) {
  const pathname = usePathname();
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
            <h3 className="font-serif text-2xl text-white font-normal">
              {property.name}
            </h3>
            <p className="text-xs text-stone-400 leading-relaxed max-w-sm">
              {config.heroSubheading}
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-stone-400">
              <MapPin className="w-4 h-4 text-[#B85C3E]" />
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
                  Our Story
                </Link>
              </li>
              <li>
                <Link href={`${base}/contact`} className="hover:text-white transition-colors">
                  Contact &amp; Location
                </Link>
              </li>
            </ul>
          </div>

          {/* Direct Support & Inquiries */}
          <div className="md:col-span-4 space-y-3">
            <span className="text-[11px] uppercase font-mono tracking-wider text-stone-400 block font-semibold">
              Direct Contact
            </span>
            <div className="space-y-2.5 text-xs">
              {config.contactPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#B85C3E]" />
                  <span>{config.contactPhone}</span>
                </div>
              )}
              {config.contactEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[#B85C3E]" />
                  <span>{config.contactEmail}</span>
                </div>
              )}
              {config.whatsappEnabled && config.contactWhatsapp && (
                <div className="pt-1">
                  <a
                    href={`https://wa.me/${config.contactWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hello, I would like to inquire about booking at ${property.name}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp Concierge</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar with subtle "Powered by Sena" */}
        <div className="pt-8 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <p>
            &copy; {currentYear} {property.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>Powered by</span>
            <span className="font-serif font-medium text-stone-300 tracking-wide">
              Sena
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
