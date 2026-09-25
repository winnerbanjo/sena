import * as React from 'react';
import { notFound } from 'next/navigation';
import { getWebsiteData } from '../../../lib/website-data';
import { ContactForm } from './ContactForm';
import { Phone, Mail, MessageCircle, MapPin } from 'lucide-react';

export default async function ContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWebsiteData(slug);
  if (!data) return notFound();

  const { property, config } = data;

  return (
    <div className="py-10 sm:py-16 bg-[#FAF7F2] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-2 border-b border-[#E8E2DA] pb-6">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#B85C3E]">
            Direct Guest Concierge
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#191816]">
            Get in Touch with {property.name}
          </h1>
          <p className="text-xs sm:text-sm text-[#7A7267]">
            Have a question about suite availability, special arrangements, or corporate bookings? We are here to assist.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct channels */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 space-y-5 shadow-2xs">
              <h2 className="font-serif text-lg text-[#191816]">Direct Channels</h2>

              <div className="space-y-4 text-xs">
                {config.contactPhone && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#71382D] flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[#7A7267] block">Phone / Front Desk</span>
                      <strong className="text-[#191816] text-sm">{config.contactPhone}</strong>
                    </div>
                  </div>
                )}

                {config.contactEmail && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#71382D] flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[#7A7267] block">Official Email</span>
                      <strong className="text-[#191816] text-sm">{config.contactEmail}</strong>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FAF7F2] text-[#71382D] flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[#7A7267] block">Physical Address</span>
                    <strong className="text-[#191816]">{property.address}, {property.country}</strong>
                  </div>
                </div>
              </div>

              {config.whatsappEnabled && config.contactWhatsapp && (
                <div className="pt-2 border-t border-[#F0ECE4]">
                  <a
                    href={`https://wa.me/${config.contactWhatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      `Hello, I would like to inquire about booking at ${property.name}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Chat on WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Contact form */}
          <div className="md:col-span-7">
            <div className="bg-white rounded-xl border border-[#E8E2DA] p-6 sm:p-8 space-y-5 shadow-2xs">
              <h2 className="font-serif text-lg text-[#191816]">Send an Inquiry</h2>
              <ContactForm propertyName={property.name} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
