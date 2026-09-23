'use client';

import * as React from 'react';
import { MetricCard } from '@sena/ui';
import { Topbar } from '../../components/topbar';

export default function AnalyticsPage() {
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <Topbar title="Analytics" onOpenNewReservation={() => {}} />

      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="border-b border-[#E2D8CC] pb-4">
          <h2 className="text-2xl font-serif font-normal text-[#191816]">
            Performance & Insights
          </h2>
          <p className="text-xs text-[#7A7267] mt-1">
            Understand the business behind your rooms with clear, restrained metrics.
          </p>
        </div>

        {/* 4 Restrained Cards (Section 65-66) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Occupancy Rate"
            value="84%"
            subtext="+6.2% vs previous 30 days"
            subValue="High"
          />
          <MetricCard
            label="Total Booking Value"
            value="₦8.42m"
            subtext="Across direct and OTA channels"
            subValue="Gross"
          />
          <MetricCard
            label="Average Length of Stay"
            value="3.2 nights"
            subtext="Consistent across business stays"
            subValue="Nights"
          />
          <MetricCard
            label="Direct Booking Share"
            value="42%"
            subtext="Zero commission direct reservations"
            subValue="Direct"
          />
        </div>

        {/* Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Booking Sources (Section 66) */}
          <div className="bg-white border border-[#E2D8CC] p-6 rounded-md space-y-4">
            <div>
              <strong className="text-base font-serif text-[#191816] block">
                Booking Sources
              </strong>
              <p className="text-xs text-[#7A7267]">
                Distribution of reservations by acquisition channel.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                { source: 'Direct Website', percentage: 41, color: 'bg-[#B85C3E]' },
                { source: 'Walk-in / Front Desk', percentage: 28, color: 'bg-[#71382D]' },
                { source: 'WhatsApp / Phone', percentage: 17, color: 'bg-[#E5D4BC]' },
                { source: 'Other (OTAs)', percentage: 14, color: 'bg-[#7A7267]' },
              ].map((item) => (
                <div key={item.source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#191816] font-medium">{item.source}</span>
                    <strong className="font-mono">{item.percentage}%</strong>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F7F1E8] overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Room Category Performance */}
          <div className="bg-white border border-[#E2D8CC] p-6 rounded-md space-y-4">
            <div>
              <strong className="text-base font-serif text-[#191816] block">
                Room Category Utilization
              </strong>
              <p className="text-xs text-[#7A7267]">
                Occupancy by room category for September 2026.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                { type: 'Executive Room (12 rooms)', occ: 92, rev: '₦4.32m' },
                { type: 'Deluxe Room (14 rooms)', occ: 81, rev: '₦2.88m' },
                { type: 'Saffron Suite (5 suites)', occ: 76, rev: '₦1.22m' },
              ].map((cat) => (
                <div
                  key={cat.type}
                  className="p-3 rounded border border-[#E2D8CC] bg-[#F7F1E8]/30 flex items-center justify-between"
                >
                  <div>
                    <strong className="text-xs font-serif text-[#191816] block">
                      {cat.type}
                    </strong>
                    <span className="text-[11px] text-[#7A7267]">
                      {cat.occ}% Occupancy
                    </span>
                  </div>
                  <strong className="text-sm font-serif text-[#B85C3E]">
                    {cat.rev}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
