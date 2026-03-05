import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeJackpot } from '@/lib/collections/jackpot';
import type { JackpotResponse } from '@/lib/collections/jackpot';
import {
  JACKPOT_ID,
  MAIN_WINNER_PERCENT,
  ROLLOVER_PERCENT,
  DEV_PERCENT,
  SECONDARY_WINNER_PERCENT,
  LOTTERY_PROGRAM_ID,
  LOTTERY_PDA,
} from '@/lib/constants';
import React, { useMemo, useState, useEffect } from 'react';
import WalletButton from './WalletButton';

const LAMPORTS_PER_SOL = 1e9;

function formatCountdownFull(nextDrawingAt: number): { hours: number; mins: number; secs: number } {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, nextDrawingAt - now);
  const hours = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  return { hours, mins, secs };
}

function formatCountdownShort(nextDrawingAt: number): string {
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

  const countdown = useMemo(() => {
    if (!jackpot?.nextDrawingAt) return null;
    return formatCountdownFull(jackpot.nextDrawingAt);
  }, [jackpot?.nextDrawingAt, tick]);

  const nextDrawLabel = useMemo(() => {
    if (!jackpot?.nextDrawingAt) return '—';
    return formatCountdownShort(jackpot.nextDrawingAt);
  }, [jackpot?.nextDrawingAt, tick]);

  // OG terminal theme from app/index.html — anon green
  const terminal = {
    bg: '#0d1117',
    panel: '#161b22',
    card: '#1c2128',
    border: '#30363d',
    text: '#c9d1d9',
    dim: '#8b949e',
    accent: '#00ff41',
    accentAlt: '#58a6ff',
    gold: '#d4a520',
    red: '#f85149',
  };

  const pepeBallSrc = '/pepe-ball.png';

  return (
    <div className="min-h-screen" style={{ background: terminal.bg, color: terminal.text, fontFamily: "'Courier New', Consolas, Monaco, monospace" }}>
      {/* Header — OG style: centered, Pepe ball guy, green glow */}
      <header
        className="border-b-2 sticky top-0 z-10 text-center"
        style={{
          borderColor: terminal.accent,
          background: terminal.panel,
          padding: '24px 16px',
          boxShadow: '0 0 20px rgba(0, 255, 65, 0.1)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center pepe-float">
            <img
              src={pepeBallSrc}
              alt="Pepe Ball"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold tracking-wide"
              style={{ color: terminal.accent, textShadow: '0 0 10px rgba(0, 255, 65, 0.5)', letterSpacing: '2px' }}
            >
              PEPEBALL
            </h1>
            <p className="text-sm mt-1" style={{ color: terminal.dim }}>Solana Powerball Lottery</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3">
          <WalletButton variant="dark" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Tagline */}
        <p className="text-center text-sm uppercase tracking-widest mb-8" style={{ color: terminal.dim }}>
          SPIN_YOUR_DESTINY // PROVABLY_FAIR
        </p>

        {/* Jackpot + countdown row */}
        <section className="mb-8">
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>JACKPOT_BALANCE</div>
          <div className="text-4xl font-bold tabular-nums mb-6 jackpot-glow" style={{ color: terminal.accent }}>
            {loading ? '...' : error ? '—' : jackpotSol != null ? `${jackpotSol} SOL` : '—'}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-xs uppercase mr-2" style={{ color: terminal.dim }}>DRAW_{jackpot?.drawingNumber ?? '?'}</span>
              <span className="text-xs uppercase" style={{ color: terminal.dim }}>NEXT_DRAW_IN</span>
            </div>
            {countdown != null ? (
              <span className="tabular-nums font-mono countdown-pulse" style={{ color: terminal.gold }}>
                {String(countdown.hours).padStart(2, '0')}HRS : {String(countdown.mins).padStart(2, '0')}MIN : {String(countdown.secs).padStart(2, '0')}SEC
              </span>
            ) : (
              <span style={{ color: terminal.dim }}>{nextDrawLabel}</span>
            )}
            <span className="text-xs" style={{ color: terminal.dim }}>0 ENTRIES</span>
            <span className="text-xs uppercase" style={{ color: terminal.dim }}>CONNECT_WALLET_TO_ENTER</span>
          </div>
        </section>

        {/* Fortune spin section */}
        <section
          className="rounded-xl border p-6 mb-8"
          style={{ borderColor: terminal.border, background: terminal.card }}
        >
          <h2 className="text-lg font-bold uppercase tracking-wider mb-2" style={{ color: terminal.accent }}>
            FORTUNE_SPIN 🐸
          </h2>
          <p className="text-sm mb-6" style={{ color: terminal.dim }}>
            5 BALLS + PEPE // SUM EVEN = PAYOUT // SUM ODD = ROLLOVER
          </p>
          <div className="text-xs uppercase mb-4" style={{ color: terminal.dim }}>FORTUNE_REVEALED</div>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="ball-hover w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center text-xl font-bold"
                style={{
                  borderColor: terminal.accent,
                  background: terminal.bg,
                  color: terminal.accent,
                  boxShadow: '0 0 10px rgba(0, 255, 65, 0.3)',
                }}
              >
                ?
              </div>
            ))}
            <div
              className="pepe-ball-ball w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center flex-shrink-0 p-0.5"
              style={{
                borderColor: terminal.accent,
                background: terminal.bg,
                boxShadow: '0 0 15px rgba(0, 255, 65, 0.5)',
              }}
            >
              <img src={pepeBallSrc} alt="PEPE" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm ml-1" style={{ color: terminal.dim }}>PEPE</span>
          </div>
          <p className="text-xs uppercase text-center mb-4" style={{ color: terminal.dim }}>
            FORTUNE_SPINS_WHEN_COUNTDOWN_ENDS
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              className="px-6 py-2 rounded border-2 font-semibold uppercase text-sm transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,65,0.4)]"
              style={{
                borderColor: terminal.accent,
                color: terminal.accent,
                background: 'transparent',
              }}
            >
              ENTER_DRAWING
            </button>
            <span className="text-xs self-center uppercase" style={{ color: terminal.dim }}>CONNECT_WALLET_TO_ENTER</span>
          </div>
        </section>

        {/* Entry registry */}
        <section
          className="rounded-xl border p-4 mb-8"
          style={{ borderColor: terminal.border, background: terminal.card }}
        >
          <div className="text-xs uppercase tracking-wider" style={{ color: terminal.dim }}>ENTRY_REGISTRY</div>
          <div className="text-xs mt-1" style={{ color: terminal.dim }}>ENTRY_LOG.SYS[0 REGISTERED]</div>
          <div className="text-sm mt-2" style={{ color: terminal.dim }}>$ NO_ENTRIES_YET_</div>
        </section>

        {/* Payout structure */}
        <section
          className="rounded-xl border p-6 mb-8"
          style={{ borderColor: terminal.border, background: terminal.card }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: terminal.accent }}>
            PAYOUT_STRUCTURE
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>MAIN_WINNER</span>
              <span style={{ color: terminal.gold }}>{MAIN_WINNER_PERCENT}%</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>SECONDARY_x8</span>
              <span style={{ color: terminal.dim }}>{SECONDARY_WINNER_PERCENT}% each</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>ROLLOVER</span>
              <span style={{ color: terminal.accent }}>{ROLLOVER_PERCENT}%</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>DEV_FEE</span>
              <span style={{ color: terminal.dim }}>{DEV_PERCENT}%</span>
            </li>
          </ul>
        </section>

        {/* Fortune guarantee */}
        <section className="mb-8 text-sm" style={{ color: terminal.dim }}>
          <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: terminal.accent }}>FORTUNE_GUARANTEE:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>No way to predict or manipulate winner</li>
            <li>Result verified onchain before payout</li>
            <li>Your fortune is sealed by VRF on Solana</li>
          </ul>
        </section>

        {/* Current round info */}
        <section
          className="rounded-xl border p-6 mb-8"
          style={{ borderColor: terminal.border, background: terminal.card }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: terminal.accent }}>
            CURRENT_ROUND_INFO
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase mb-1" style={{ color: terminal.dim }}>CURRENT_JACKPOT</div>
              <div className="font-mono tabular-nums" style={{ color: terminal.gold }}>
                {loading ? '...' : jackpotSol != null ? `${jackpotSol} SOL` : '0.00 SOL'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase mb-1" style={{ color: terminal.dim }}>ENTRIES_REGISTERED</div>
              <div className="font-mono">0</div>
            </div>
            <div>
              <div className="text-xs uppercase mb-1" style={{ color: terminal.dim }}>NEXT_DRAWING</div>
              <div className="font-mono">{nextDrawLabel || 'TBD'}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: terminal.border }}>
            <div className="text-xs uppercase mb-1" style={{ color: terminal.dim }}>TO_BE_ELIGIBLE</div>
            <p style={{ color: terminal.text }}>Hold 0.1+ $PBALL</p>
            <p className="text-xs mt-2" style={{ color: terminal.dim }}>
              How it works: Hold at least 0.1 $PBALL tokens, register for the spin, and let fate decide. VRF-powered randomness, winners paid automatically on-chain. Your fortune awaits, fren.
            </p>
          </div>
        </section>

        {/* Winners history */}
        <section
          className="rounded-xl border p-6 mb-8"
          style={{ borderColor: terminal.border, background: terminal.card }}
        >
          <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: terminal.accent }}>
            WINNERS_HISTORY
          </h3>
          <p className="text-xs mb-4" style={{ color: terminal.dim }}>ALL_TX_VERIFIABLE_ON_SOLSCAN</p>
          <div className="text-center py-8" style={{ color: terminal.dim }}>
            NO_DRAWINGS_YET
          </div>
          <p className="text-xs text-center" style={{ color: terminal.dim }}>
            Be the first winner, fren!
          </p>
        </section>

        {/* Game snapshot / test addresses — verify on Solscan */}
        <section
          className="rounded-xl border p-4 mb-6"
          style={{ borderColor: terminal.border, background: terminal.card }}
        >
          <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: terminal.accent }}>
            VERIFY_ON_CHAIN (DEVNET)
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href={`https://solscan.io/account/${LOTTERY_PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate max-w-full"
              style={{ color: terminal.accentAlt }}
            >
              🔗 Lottery Program
            </a>
            <a
              href={`https://solscan.io/account/${LOTTERY_PDA}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate max-w-full"
              style={{ color: terminal.accentAlt }}
            >
              🔗 Game Snapshot (PDA)
            </a>
          </div>
          <p className="text-xs mt-2 font-mono break-all" style={{ color: terminal.dim }}>
            Program: {LOTTERY_PROGRAM_ID}
          </p>
          <p className="text-xs font-mono break-all" style={{ color: terminal.dim }}>
            PDA: {LOTTERY_PDA}
          </p>
        </section>

        <footer className="text-center text-xs py-6" style={{ color: terminal.dim }}>
          WE_HAVE_NOTHING_TO_HIDE // All transactions are public and verifiable on Solana blockchain
        </footer>
      </main>
    </div>
  );
};

export default HomePage;
