'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { Plus, Users, Utensils, CreditCard, Sparkles, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@sena/ui';
import { PageLoadState } from '../../../components/page-load-state';

export default function RestaurantFloorPlanPage() {
  const toast = useToast();
  const [tables, setTables] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  // Form inputs
  const [tableNumber, setTableNumber] = React.useState('');
  const [capacity, setCapacity] = React.useState('4');
  const [section, setSection] = React.useState('indoor');

  const fetchTables = React.useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/restaurant/tables');
      if (!res.ok) throw new Error('Could not load tables');
      const data = await res.json();
      setTables(data.tables || []);
    } catch (err: any) {
      setLoadError(true);
      toast.error('Floor Plan', err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!tableNumber.trim()) {
      toast.error('Validation', 'Table number or name is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/restaurant/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableNumber.trim(),
          capacity: Number(capacity) || 4,
          section: section.trim() || 'indoor',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add table');

      toast.success('Table Added', `Table ${data.table.tableNumber} added to floor plan`);
      setAddOpen(false);
      setTableNumber('');
      fetchTables();
    } catch (err: any) {
      toast.error('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Group tables by section
  const sections = Array.from(new Set(tables.map((t) => t.section || 'indoor')));

  if (loading && tables.length === 0) {
    return <PageLoadState title="Restaurant Floor Plan" failed={loadError} failureKind="error" retry={fetchTables} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Restaurant Floor Plan" />

      <main className={pageMain + ' max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-8'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-serif text-[#71382D]">Dining Room & Floor Plan</h1>
            <p className="text-xs text-[#7A7267] mt-0.5">
              Live table occupancy, seating layout, and fast POS order association.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/pos"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E8E1D5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#191816] transition-colors"
            >
              <CreditCard className="w-4 h-4 text-[#71382D]" />
              <span>Open POS Register</span>
            </Link>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Table</span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#7A7267] bg-white p-3 rounded-xl border border-[#E8E1D5]">
          <span className="font-mono text-[11px] text-[#8C8275] uppercase">Status Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-400" />
            <span>Needs Cleaning</span>
          </div>
        </div>

        {/* Section Blocks */}
        {sections.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-[#E8E1D5] text-xs text-[#7A7267] space-y-3">
            <Utensils className="w-10 h-10 text-[#D5CFC7] mx-auto" />
            <h3 className="text-base font-serif text-[#71382D]">No dining tables configured</h3>
            <p>Add your first table to start seating guests and assigning orders.</p>
          </div>
        ) : (
          sections.map((sec) => {
            const sectionTables = tables.filter((t) => (t.section || 'indoor') === sec);

            return (
              <div key={sec} className="space-y-3">
                <h2 className="text-xs font-mono uppercase tracking-wider text-[#8C8275] font-semibold">
                  Section: {sec} ({sectionTables.length} tables)
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {sectionTables.map((tbl) => {
                    const isOccupied = tbl.status === 'occupied';
                    const isReserved = tbl.status === 'reserved';

                    return (
                      <Link
                        key={tbl.id}
                        href="/pos"
                        className={`p-4 rounded-2xl border text-start flex flex-col justify-between h-36 transition-all shadow-xs hover:shadow-md cursor-pointer group ${
                          isOccupied
                            ? 'border-amber-300 bg-amber-50/70'
                            : isReserved
                            ? 'border-blue-300 bg-blue-50/70'
                            : 'border-[#E8E1D5] bg-white hover:border-[#71382D]'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-lg font-serif font-bold text-[#191816] group-hover:text-[#71382D]">
                            {tbl.tableNumber}
                          </span>
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isOccupied
                                ? 'bg-amber-500'
                                : isReserved
                                ? 'bg-blue-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-[#7A7267]">
                            <Users className="w-3.5 h-3.5" />
                            <span>{tbl.capacity} seats</span>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              isOccupied
                                ? 'bg-amber-100 text-amber-800'
                                : isReserved
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {tbl.status}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Add Table Dialog */}
      {addOpen && (
        <Dialog open={true} onOpenChange={() => setAddOpen(false)}>
          <DialogContent className="max-w-md bg-white border border-[#E8E1D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif text-[#71382D]">Add Dining Table</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAdd} className="space-y-4 pt-2 text-xs">
              <div>
                <label className="block font-semibold text-[#191816] mb-1">
                  Table Number / Name <span className="text-[#B85C3E]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 5, Booth 2, Patio 1"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] focus:outline-none focus:border-[#71382D]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#191816] mb-1">Dining Section</label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#E8E1D5] bg-white focus:outline-none focus:border-[#71382D]"
                  >
                    <option value="indoor">Indoor Dining Room</option>
                    <option value="patio">Outdoor Patio</option>
                    <option value="rooftop">Rooftop Lounge</option>
                    <option value="bar">Bar Counter</option>
                    <option value="private">Private Dining</option>
                  </select>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-4">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E1D5] text-xs font-medium text-[#191816]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-xs font-semibold shadow-xs"
                >
                  {submitting ? 'Saving…' : 'Add to Floor Plan'}
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
