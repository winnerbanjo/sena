'use client';

import * as React from 'react';
import Link from 'next/link';
import { Topbar } from '../../../components/topbar';
import { pageMain, pageStack } from '../../../components/design';
import { useToast } from '../../../components/toast-notification';
import { QrCode, CheckCircle2, XCircle, ArrowLeft, RefreshCw, UserCheck } from 'lucide-react';

export default function GymAccessTerminalPage() {
  const toast = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [tokenInput, setTokenInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<any>(null);
  const [scanHistory, setScanHistory] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Keep focus on scan input for hardware barcode/QR scanners
    inputRef.current?.focus();
  }, [lastResult]);

  async function handleVerify(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch('/api/gym/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accessPoint: 'front_turnstile' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify member');

      setLastResult(data);
      setScanHistory((prev) => [
        {
          ...data,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev.slice(0, 9),
      ]);
      setTokenInput('');
    } catch (err: any) {
      toast.error('Scan Error', err.message || 'Verification failed');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className={pageStack + ' min-h-screen bg-[#FAF9F7]'}>
      <Topbar title="Gym Access Terminal" />

      <main className={pageMain + ' max-w-5xl mx-auto w-full p-4 sm:p-6 space-y-6'}>
        <div className="flex items-center justify-between">
          <Link
            href="/gym"
            className="inline-flex items-center gap-2 text-xs text-[#7A7267] hover:text-[#191816] font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Gym Command</span>
          </Link>
          <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Terminal Live & Ready for Scans
          </span>
        </div>

        {/* Big Terminal Card */}
        <div className="bg-white border border-[#E8E1D5] rounded-2xl p-6 sm:p-10 shadow-sm text-center space-y-6">
          <form onSubmit={handleVerify} className="max-w-xl mx-auto space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-[#8C8275] block">
                QR Scanner & Member Number Input
              </label>
              <p className="text-xs text-[#7A7267]">
                Scan digital pass, badge barcode, or type Member ID / Phone number
              </p>
            </div>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                placeholder="Scan QR or enter GYM-XXXXXX..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                disabled={loading}
                className="w-full h-14 text-center font-mono text-lg tracking-wider px-4 rounded-xl border-2 border-[#71382D]/40 focus:border-[#71382D] focus:outline-none focus:ring-4 focus:ring-[#71382D]/10 bg-[#FAF9F7] text-[#191816] transition-all"
              />
              <button
                type="submit"
                disabled={loading || !tokenInput.trim()}
                className="mt-3 w-full h-11 rounded-lg bg-[#71382D] hover:bg-[#5A2C23] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                <span>Verify Access Entry</span>
              </button>
            </div>
          </form>

          {/* Decision Feedback Display */}
          {lastResult && (
            <div
              className={`max-w-xl mx-auto p-6 rounded-2xl border transition-all animate-in fade-in zoom-in-95 duration-200 ${
                lastResult.accessResult === 'granted'
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-red-50/80 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                {lastResult.accessResult === 'granted' ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                ) : (
                  <XCircle className="w-12 h-12 text-red-600" />
                )}
                <div className="text-start">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {lastResult.accessResult === 'granted' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                  </h3>
                  {lastResult.member && (
                    <p className="text-sm font-semibold">
                      {lastResult.member.fullName} ({lastResult.member.memberNumber})
                    </p>
                  )}
                  {lastResult.subscription && (
                    <p className="text-xs text-[#555] font-mono mt-0.5">
                      Plan: {lastResult.subscription.planName} · Expires: {lastResult.subscription.expiresOn || lastResult.subscription.endDate}
                    </p>
                  )}
                  {lastResult.denialReason && (
                    <p className="text-xs font-semibold text-red-700 mt-1">
                      Reason: {lastResult.denialReason}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scan Log Table */}
        <div className="bg-white border border-[#E8E1D5] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E8E1D5] bg-[#FAF7F2]/60">
            <h2 className="text-xs font-mono uppercase tracking-wider text-[#8C8275]">Session Scan History</h2>
          </div>
          <div className="divide-y divide-[#E8E1D5]">
            {scanHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7A7267]">
                Scans from this session will appear here in real time.
              </div>
            ) : (
              scanHistory.map((item, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {item.accessResult === 'granted' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    )}
                    <div>
                      <strong className="text-[#191816] font-medium">
                        {item.member?.fullName || 'Unknown Member'}
                      </strong>
                      <span className="text-[11px] text-[#8C8275] ml-2 font-mono">
                        {item.member?.memberNumber || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.accessResult === 'granted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.accessResult}
                    </span>
                    <span className="text-[11px] font-mono text-[#8C8275]">{item.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
