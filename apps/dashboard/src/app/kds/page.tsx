'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../components/topbar';
import { pageMain, pageStack } from '../../components/design';
import { useToast } from '../../components/toast-notification';
import { CheckCircle2, Clock, Utensils, RefreshCw, ArrowLeft } from 'lucide-react';
import { PageLoadState } from '../../components/page-load-state';

export default function KitchenDisplayPage() {
  const toast = useToast();
  const [station, setStation] = React.useState('all');
  const [tickets, setTickets] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchTickets = React.useCallback(async () => {
    setLoadError(false);
    try {
      const q = station !== 'all' ? `?station=${station}` : '';
      const res = await fetch(`/api/restaurant/kds${q}`);
      if (!res.ok) throw new Error('Failed to load kitchen tickets');
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err: any) {
      setLoadError(true);
      toast.error('KDS', err.message);
    } finally {
      setLoading(false);
    }
  }, [station, toast]);

  React.useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 10000); // Polling every 10 seconds for live orders
    return () => clearInterval(interval);
  }, [fetchTickets]);

  async function handleMarkOrderReady(orderId: string) {
    setProcessingId(orderId);
    try {
      const res = await fetch('/api/restaurant/kds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'mark_order_ready' }),
      });
      if (!res.ok) throw new Error('Failed to complete ticket');
      toast.success('Kitchen', 'Ticket marked ready for pickup');
      fetchTickets();
    } catch (err: any) {
      toast.error('KDS Error', err.message);
    } finally {
      setProcessingId(null);
    }
  }

  function getElapsedMinutes(openedAt: string) {
    const diffMs = Date.now() - new Date(openedAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  if (loading && tickets.length === 0) {
    return <PageLoadState title="Kitchen Display System" failed={loadError} failureKind="error" retry={fetchTickets} />;
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#191816] text-white'}>
      <Topbar title="Kitchen Display (KDS)" />

      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
        {/* KDS Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-4">
            <Link
              href="/pos"
              className="text-stone-400 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to POS</span>
            </Link>
            <div>
              <h1 className="text-xl font-bold font-mono tracking-wider text-amber-400 flex items-center gap-2">
                <Utensils className="w-5 h-5" />
                <span>KITCHEN ORDERS · LIVE FEED</span>
              </h1>
            </div>
          </div>

          {/* Station Filter Tabs */}
          <div className="flex items-center gap-2">
            {['all', 'kitchen', 'bar', 'grill', 'dessert'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStation(st)}
                className={`px-3 py-1 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                  station === st
                    ? 'bg-amber-400 text-stone-950 font-bold'
                    : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tickets.length === 0 ? (
            <div className="col-span-full py-24 text-center text-stone-500 font-mono text-sm">
              ALL CAUGHT UP · NO PENDING TICKETS IN QUEUE
            </div>
          ) : (
            tickets.map((t) => {
              const elapsed = getElapsedMinutes(t.openedAt);
              const isUrgent = elapsed >= 15;
              const isWarning = elapsed >= 10 && elapsed < 15;

              return (
                <div
                  key={t.id}
                  className={`rounded-xl border flex flex-col justify-between overflow-hidden transition-all shadow-md ${
                    isUrgent
                      ? 'border-red-500 bg-stone-900 ring-2 ring-red-500/50'
                      : isWarning
                      ? 'border-amber-500 bg-stone-900'
                      : 'border-stone-800 bg-stone-900/90'
                  }`}
                >
                  {/* Ticket Header */}
                  <div
                    className={`p-3.5 flex items-center justify-between border-b ${
                      isUrgent
                        ? 'bg-red-950/80 border-red-800 text-red-200'
                        : isWarning
                        ? 'bg-amber-950/80 border-amber-800 text-amber-200'
                        : 'bg-stone-800/80 border-stone-700 text-stone-200'
                    }`}
                  >
                    <div>
                      <span className="font-mono font-bold text-sm block tracking-wider">
                        {t.orderNumber}
                      </span>
                      <span className="text-[11px] font-mono text-stone-400 uppercase">
                        {t.tableNumber ? `Table ${t.tableNumber}` : t.orderType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono font-bold text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{elapsed}m</span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="p-3.5 space-y-2 flex-1 divide-y divide-stone-800/60">
                    {t.items.map((it: any) => (
                      <div key={it.id} className="pt-2 first:pt-0 flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-amber-400 text-sm">
                            {it.quantity}x
                          </span>
                          <div>
                            <span className="text-xs font-medium text-stone-100 block">
                              {it.itemName}
                            </span>
                            {it.notes && (
                              <span className="text-[11px] font-mono text-amber-300 block">
                                &quot;{it.notes}&quot;
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                          {it.preparationStation}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Ticket Footer Action */}
                  <div className="p-3 border-t border-stone-800 bg-stone-950/60">
                    <button
                      type="button"
                      disabled={processingId === t.id}
                      onClick={() => handleMarkOrderReady(t.id)}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {processingId === t.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>MARK ORDER READY</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
