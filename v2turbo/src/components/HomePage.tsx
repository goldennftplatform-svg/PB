import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeJackpot } from '@/lib/collections/jackpot';
import type { JackpotResponse } from '@/lib/collections/jackpot';
import { JACKPOT_ID } from '@/lib/constants';
import { Clock, Trophy, Hash, Activity } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useEffect } from 'react';
import WalletButton from './WalletButton';

const LAMPORTS_PER_SOL = 1e9;

function formatCountdown(nextDrawingAt: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, nextDrawingAt - now);
  if (diff === 0) return 'Soon';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export const HomePage: React.FC = () => {
  const [tick, setTick] = useState(0);
  const { data: jackpot, loading, error } = useRealtimeData<JackpotResponse | null>(
    subscribeJackpot,
    true,
    JACKPOT_ID
  );

  useEffect(() => {
    if (!jackpot?.nextDrawingAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [jackpot?.nextDrawingAt]);

  const jackpotSol = useMemo(() => {
    if (!jackpot?.balance) return null;
    return (jackpot.balance / LAMPORTS_PER_SOL).toFixed(2);
  }, [jackpot?.balance]);

  const nextDrawLabel = useMemo(() => {
    if (!jackpot?.nextDrawingAt) return '—';
    return formatCountdown(jackpot.nextDrawingAt);
  }, [jackpot?.nextDrawingAt, tick]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header: title + wallet in corner (dashboard first, connect optional) */}
      <header className="border-b bg-card/50 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Token Powerball</h1>
            <p className="text-sm text-muted-foreground">LIVE DASHBOARD</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground">Admin</span>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats grid - no wallet required */}
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Trophy className="h-4 w-4" />
                <span className="text-sm font-medium">Current Jackpot</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? '…' : error ? '—' : jackpotSol != null ? `${jackpotSol} SOL` : '—'}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Next Draw</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? '…' : error ? '—' : nextDrawLabel}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Hash className="h-4 w-4" />
                <span className="text-sm font-medium">Drawing #</span>
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {loading ? '…' : error ? '—' : jackpot?.drawingNumber ?? '—'}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">Status</span>
              </div>
              <div className="text-2xl font-bold">
                {loading ? '…' : error ? 'Offline' : 'Live'}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Lottery dashboard</h2>
          <p className="text-muted-foreground text-sm">
            Jackpot and draw data update in real time. Connect wallet only for admin actions (drawings, settlements).
          </p>
        </section>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1.5" />
          LIVE — Updates in real time
        </footer>
      </main>
    </div>
  );
};

export default HomePage;
