'use client';

import * as React from 'react';
import Image from 'next/image';
import { Badge, Button, MetricCard, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@sena/ui';
import { Activity, AlertTriangle, CheckCircle2, Eye, Lock, Search, Server, Shield } from 'lucide-react';

interface ManagedProperty {
  id: string;
  name: string;
  location: string;
  plan: 'Essential' | 'Growth' | 'Pro';
  rooms: number;
  monthlyNaira: number;
  status: 'active' | 'trial' | 'suspended';
  lastActive: string;
}

const MANAGED_PROPERTIES: ManagedProperty[] = [
  {
    id: 'p-1',
    name: 'Stay Connect Lekki',
    location: 'Lagos, Nigeria',
    plan: 'Growth',
    rooms: 31,
    monthlyNaira: 50000,
    status: 'active',
    lastActive: '2 min ago',
  },
  {
    id: 'p-2',
    name: 'Stay Connect Abuja',
    location: 'Maitama, Abuja',
    plan: 'Growth',
    rooms: 24,
    monthlyNaira: 50000,
    status: 'active',
    lastActive: '14 min ago',
  },
  {
    id: 'p-3',
    name: 'The Still House Boutique',
    location: 'Victoria Island, Lagos',
    plan: 'Pro',
    rooms: 48,
    monthlyNaira: 100000,
    status: 'active',
    lastActive: '1 hour ago',
  },
  {
    id: 'p-4',
    name: 'Grand Horizon Suites',
    location: 'Ikeja, Lagos',
    plan: 'Essential',
    rooms: 10,
    monthlyNaira: 25000,
    status: 'trial',
    lastActive: '3 hours ago',
  },
];

export default function AdminDashboardPage() {
  const [impersonatingProperty, setImpersonatingProperty] = React.useState<ManagedProperty | null>(null);
  const [search, setSearch] = React.useState('');

  const filtered = MANAGED_PROPERTIES.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Permanent Section 84 Support Mode Banner */}
      {impersonatingProperty && (
        <div className="bg-[#71382D] text-white px-6 py-2.5 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-[#E5D4BC]" />
            <strong className="tracking-wide">
              SENA SUPPORT MODE: Viewing {impersonatingProperty.name}
            </strong>
            <span className="opacity-75">
              (Audit ID: SUP-{Date.now().toString().slice(-4)} · Read-only audit session)
            </span>
          </div>
          <button
            onClick={() => setImpersonatingProperty(null)}
            className="text-[11px] font-semibold underline hover:text-[#E5D4BC]"
          >
            Exit Support Mode
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#E8E2DA] bg-white py-3.5 px-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <Image
              src="/assets/sena-logo.png"
              alt="Sena"
              width={90}
              height={28}
              priority
              className="h-7 w-auto object-contain"
            />
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#71382D] text-white uppercase tracking-wider">
            Internal Platform Admin
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#7A7267]">
          <span>Logged in as: <strong>winner@sena.ng</strong> (Superadmin)</span>
        </div>
      </header>

      {/* Main Admin Area */}
      <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full space-y-6 sm:space-y-8 flex-1">
        {/* Section 82: High-Level Platform Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            label="Active Properties"
            value="14"
            subtext="12 paying · 2 on trial"
            subValue="Growth"
          />
          <MetricCard
            label="Monthly Recurring Revenue"
            value="₦875,000"
            subtext="+18% month-over-month"
            subValue="MRR"
          />
          <MetricCard
            label="Reservations Processed"
            value="438"
            subtext="₦34.2m processed volume"
            subValue="Sep 2026"
          />
          <MetricCard
            label="System Health"
            value="100%"
            subtext="All 7 core services operational"
            subValue="Optimal"
          />
        </div>

        {/* Section 88: System Health Panel */}
        <div className="bg-white border border-[#E8E2DA] p-6 rounded-md space-y-4">
          <div className="flex items-center justify-between border-b border-[#E8E2DA] pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-[#2E6B4F]" />
              <strong className="text-sm font-serif text-[#191816]">
                Infrastructure & System Health
              </strong>
            </div>
            <span className="text-xs text-[#2E6B4F] font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> All systems nominal
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
            {[
              { name: 'Core API', status: 'Operational', latency: '42ms' },
              { name: 'PostgreSQL', status: 'Operational', latency: '12ms' },
              { name: 'Redis Cache', status: 'Operational', latency: '2ms' },
              { name: 'Paystack Webhooks', status: 'Operational', latency: '98ms' },
              { name: 'DO Spaces', status: 'Operational', latency: '65ms' },
              { name: 'Fluid Compute', status: 'Operational', latency: '18ms' },
              { name: 'Realtime SSE', status: 'Operational', latency: '5ms' },
            ].map((srv) => (
              <div key={srv.name} className="p-3 rounded border border-[#E8E2DA] bg-[#FAFAFA]">
                <span className="text-[10px] text-[#7A7267] font-mono uppercase block">
                  {srv.name}
                </span>
                <strong className="text-xs text-[#2E6B4F] block mt-1">
                  {srv.status}
                </strong>
                <span className="text-[10px] text-[#7A7267] font-mono">
                  {srv.latency}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 83: Property Management */}
        <div className="bg-white border border-[#E8E2DA] rounded-md overflow-hidden">
          <div className="p-4 border-b border-[#E8E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAFAFA]">
            <div>
              <strong className="text-base font-serif text-[#191816]">
                Managed Properties
              </strong>
              <p className="text-xs text-[#7A7267]">
                Live customer properties, subscription tiers, and administrative audit access.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#7A7267]" />
              <input
                type="text"
                placeholder="Search property or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded border border-[#E8E2DA] bg-white text-xs text-[#191816] w-full sm:w-64 focus:outline-none focus:ring-1 focus:ring-[#B85C3E]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Monthly Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Support Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((prop) => (
                <TableRow key={prop.id}>
                  <TableCell>
                    <strong className="text-sm font-serif text-[#191816] block">
                      {prop.name}
                    </strong>
                    <span className="text-[10px] font-mono text-[#7A7267]">
                      {prop.id}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{prop.location}</TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#FAFAFA] border border-[#E8E2DA]">
                      {prop.plan}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{prop.rooms} rooms</TableCell>
                  <TableCell className="text-xs font-serif font-medium">
                    ₦{prop.monthlyNaira.toLocaleString('en-NG')}/mo
                  </TableCell>
                  <TableCell>
                    <Badge variant={prop.status === 'active' ? 'clean' : 'pending'}>
                      {prop.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[#7A7267]">{prop.lastActive}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setImpersonatingProperty(prop)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View as Property
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#E8E2DA] py-4 px-8 text-center text-xs text-[#7A7267]">
        Sena Internal Admin Console · admin.sena.ng · Authorized Personnel Only
      </footer>
    </div>
  );
}
