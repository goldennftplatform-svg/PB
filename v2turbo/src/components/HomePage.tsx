import { AuthContextType } from '@/components/types';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { subscribeJackpot } from '@/lib/collections/jackpot';
import type { JackpotResponse } from '@/lib/collections/jackpot';
import {
  ADMIN_ADDRESS,
  JACKPOT_ID,
  LOTTERY_PDA,
  LOTTERY_PROGRAM_ID,
  MAIN_WINNER_PERCENT,
  PEPEBALL_MINT,
  PROOF_MINT,
  ROLLOVER_PERCENT,
  DEV_PERCENT,
  SECONDARY_WINNER_PERCENT,
  TAROBASE_ENV,
  USDC,
} from '@/lib/constants';
import { TAROBASE_CONFIG } from '@/lib/config';
import { buildTakeSnapshotTx, buildSetWinnersTx, buildPayoutWinnersTx } from '@/lib/lottery-actions';
import { usePhantomFallback } from '@/contexts/PhantomFallbackContext';
import { useTokenPrice } from '@/contexts/TokenPriceContext';
import { useAuth } from '@pooflabs/web';
import { Connection, Transaction } from '@solana/web3.js';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import WalletButton from './WalletButton';
import MatrixRain from './MatrixRain';
import SwapCarousel from './SwapCarousel';

const LAMPORTS_PER_SOL = 1e9;

const ON_RAMP_LINKS = [
  { name: 'Coinbase', url: 'https://www.coinbase.com/how-to-buy/solana', desc: 'Buy SOL' },
  { name: 'OKX', url: 'https://www.okx.com/en-us/buy-sol', desc: 'Buy SOL' },
  { name: 'Gemini', url: 'https://www.gemini.com/how-to-buy/solana', desc: 'Buy SOL' },
] as const;

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

const SPIN_DURATION_MS = 2800;
const BALL_TICK_MS = 80;
const AUTO_PLAY_DELAY_MS = 700;
export const HomePage: React.FC = () => {
  const hasAutoPlayedRef = useRef(false);
  const swapWidgetRef = useRef<HTMLDivElement>(null);
  const jupiterInitializedRef = useRef(false);
  const [tick, setTick] = useState(0);
  const [drawPhase, setDrawPhase] = useState<'idle' | 'spinning' | 'revealed'>('idle');
  const [ballValues, setBallValues] = useState<number[]>([0, 0, 0, 0, 0]);
  const [drawResult, setDrawResult] = useState<{ sum: number; isEven: boolean; winnerIndex: number } | null>(null);
  const auth = useAuth() as AuthContextType;
  const phantom = usePhantomFallback();
  const user = auth.user ?? (phantom.address ? { address: phantom.address, provider: null } : null);
  const isAdmin = user?.address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  const tokenPrice = useTokenPrice();
  const [overrideInput, setOverrideInput] = useState('');
  const [rawUnitsInput, setRawUnitsInput] = useState('1000000');
  const [usdInput, setUsdInput] = useState('5');
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [setWinnersLoading, setSetWinnersLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [winnersInput, setWinnersInput] = useState('');
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


  const runDrawingAnimation = React.useCallback(() => {
    if (drawPhase === 'spinning') return;
    setDrawPhase('spinning');
    setDrawResult(null);
    setBallValues([0, 0, 0, 0, 0]);
    const start = Date.now();
    const spinInterval = setInterval(() => {
      setBallValues(() => Array.from({ length: 5 }, () => Math.floor(Math.random() * 100)));
    }, BALL_TICK_MS);
    const stopAt = start + SPIN_DURATION_MS;
    const stopInterval = setInterval(() => {
      if (Date.now() < stopAt) return;
      clearInterval(spinInterval);
      clearInterval(stopInterval);
      const final = Array.from({ length: 5 }, () => Math.floor(Math.random() * 100));
      setBallValues(final);
      const sum = final.reduce((a, b) => a + b, 0);
      const isEven = sum % 2 === 0;
      setDrawResult({ sum, isEven, winnerIndex: Math.floor(Math.random() * 50) + 1 });
      setDrawPhase('revealed');
    }, 100);
    return () => { clearInterval(spinInterval); clearInterval(stopInterval); };
  }, [drawPhase]);

  // Auto-play the spin once when user lands on the site (one time per page load)
  useEffect(() => {
    if (drawPhase !== 'idle' || hasAutoPlayedRef.current) return;
    hasAutoPlayedRef.current = true;
    const t = setTimeout(runDrawingAnimation, AUTO_PLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, [drawPhase, runDrawingAnimation]);

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

  // Data-driven matrix: display font for hero/titles, mono for data
  const theme = {
    bg: 'rgba(2, 8, 6, 0.5)',
    panel: 'rgba(4, 14, 10, 0.6)',
    card: 'rgba(2, 10, 7, 0.45)',
    cardBorder: 'rgba(0, 255, 65, 0.18)',
    border: 'rgba(0, 255, 65, 0.12)',
    text: '#e8f2ee',
    dim: '#6b8a7a',
    accent: '#00ff41',
    accentDim: 'rgba(0, 255, 65, 0.7)',
    accentAlt: '#5ce1e6',
    gold: '#e5b84a',
    red: '#f85149',
    fontDisplay: "'Orbitron', 'Syne', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', 'Courier New', Consolas, monospace",
  };
  const terminal = theme;

  const networkLabel = TAROBASE_ENV === 'mainnet' ? 'Mainnet' : 'Devnet';
  const lastUpdatedLabel = jackpot?.lastUpdatedAt
    ? new Date(jackpot.lastUpdatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const pepeBallSrc = '/pepe-ball.png';

  // Inline animation CSS so it cannot be stripped by build — guaranteed to run
  const animationStyles = `
    @keyframes pepball-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-14px); }
    }
    @keyframes pepball-hero-float {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(4px, -12px) scale(1.01); }
      50% { transform: translate(-3px, -22px) scale(1.02); }
      75% { transform: translate(-5px, -10px) scale(1.01); }
    }
    @keyframes pepball-hero-glow {
      0%, 100% { box-shadow: 0 0 28px rgba(0,255,65,0.4), 0 0 56px rgba(0,255,65,0.12); }
      50% { box-shadow: 0 0 48px rgba(0,255,65,0.55), 0 0 88px rgba(0,255,65,0.2); }
    }
    @keyframes pepball-glow {
      0%, 100% { text-shadow: 0 0 14px rgba(0,255,65,0.7), 0 0 28px rgba(0,255,65,0.4); }
      50% { text-shadow: 0 0 28px rgba(0,255,65,1), 0 0 56px rgba(0,255,65,0.6); }
    }
    @keyframes pepball-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.75; }
    }
    .pepball-float { animation: pepball-float 2.2s ease-in-out infinite; }
    .pepball-hero-float { animation: pepball-hero-float 4s ease-in-out infinite; }
    .pepball-hero-glow { animation: pepball-hero-glow 3s ease-in-out infinite; }
    .pepball-glow { animation: pepball-glow 1.4s ease-in-out infinite; }
    .pepball-pulse { animation: pepball-pulse 0.9s ease-in-out infinite; }
    .pepball-ball-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
    .pepball-ball-hover:hover { transform: scale(1.12); box-shadow: 0 0 24px rgba(0,255,65,0.6); }
  `;

  return (
    <div className="matrix-page matrix-page__bg relative" style={{ color: terminal.text, fontFamily: terminal.fontMono }}>
      <MatrixRain />
      <div className="matrix-scanline" aria-hidden />
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      {/* Header — glass, one line, mobile-first */}
      <header
        className="matrix-glass-strong sticky top-0 z-10 border-b px-3 py-2.5 sm:px-4 sm:py-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.625rem,env(safe-area-inset-top))]"
        style={{ borderColor: 'rgba(0,255,65,0.18)', boxShadow: 'inset 0 1px 0 rgba(0,255,65,0.08), 0 1px 0 rgba(0,0,0,0.2)' }}
      >
        <div className="container mx-auto max-w-4xl flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex-shrink-0 rounded-full overflow-hidden ring-2"
              style={{
                width: 40,
                height: 40,
                boxShadow: '0 0 0 1px rgba(0, 255, 65, 0.2), 0 0 20px rgba(0, 255, 65, 0.12)',
                border: '2px solid rgba(0, 255, 65, 0.35)',
              }}
            >
              <img
                src={pepeBallSrc}
                alt=""
                className="w-full h-full object-cover scale-110"
              />
            </div>
            <h1
              className="text-sm sm:text-xl font-extrabold tracking-tight whitespace-nowrap"
              style={{
                fontFamily: terminal.fontDisplay,
                letterSpacing: '-0.02em',
              }}
            >
              <span style={{ color: terminal.accent, textShadow: '0 0 12px rgba(0, 255, 65, 0.3)' }}>PEPE</span>
              <span style={{ color: terminal.gold, textShadow: '0 0 10px rgba(229, 184, 74, 0.4)' }}>BALL</span>
            </h1>
          </div>
          <div className="flex-shrink-0">
            <WalletButton variant="dark" />
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-5 sm:py-8 max-w-4xl safe-area-pad">
        {/* Live data ticker — elevated terminal strip */}
        <div
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-3.5 px-5 mb-5 rounded-xl border backdrop-blur-md"
          style={{
            background: 'linear-gradient(180deg, rgba(4, 14, 11, 0.5) 0%, rgba(2, 10, 8, 0.4) 100%)',
            borderColor: 'rgba(0, 255, 65, 0.24)',
            boxShadow: 'inset 0 1px 0 rgba(0, 255, 65, 0.1), 0 0 0 1px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.25)',
          }}
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: terminal.accent, boxShadow: `0 0 8px ${terminal.accent}` }} />
            Live
          </span>
          <span className="text-xs font-mono" style={{ color: terminal.dim }}>
            <span className="uppercase tracking-wider mr-1" style={{ color: terminal.accentDim }}>Network</span>
            <span style={{ color: terminal.text }}>{networkLabel}</span>
          </span>
          <span className="text-xs font-mono" style={{ color: terminal.dim }}>
            <span className="uppercase tracking-wider mr-1" style={{ color: terminal.accentDim }}>Jackpot</span>
            <span className="tabular-nums font-medium" style={{ color: terminal.gold }}>{loading ? '…' : jackpotSol != null ? `${jackpotSol} SOL` : '—'}</span>
          </span>
          <span className="text-xs font-mono" style={{ color: terminal.dim }}>
            <span className="uppercase tracking-wider mr-1" style={{ color: terminal.accentDim }}>Draw</span>
            <span style={{ color: terminal.text }}>#{jackpot?.drawingNumber ?? '—'}</span>
          </span>
          <span className="text-xs font-mono" style={{ color: terminal.dim }}>
            <span className="uppercase tracking-wider mr-1" style={{ color: terminal.accentDim }}>Next</span>
            <span className="tabular-nums" style={{ color: terminal.text }}>{nextDrawLabel}</span>
          </span>
          {lastUpdatedLabel && (
            <span className="text-xs font-mono" style={{ color: terminal.dim }}>
              <span className="uppercase tracking-wider mr-1" style={{ color: terminal.accentDim }}>Updated</span>
              <span style={{ color: terminal.text }}>{lastUpdatedLabel}</span>
            </span>
          )}
        </div>

        {/* How to play — Powerball-simple: 3 steps + tools */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-center">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0" style={{ background: 'rgba(0,255,65,0.2)', color: terminal.accent }}>1</span>
              <span className="text-sm font-medium" style={{ color: terminal.text }}>Get SOL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0" style={{ background: 'rgba(0,255,65,0.2)', color: terminal.accent }}>2</span>
              <span className="text-sm font-medium" style={{ color: terminal.text }}>Buy $20+ $PBALL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0" style={{ background: 'rgba(0,255,65,0.2)', color: terminal.accent }}>3</span>
              <span className="text-sm font-medium" style={{ color: terminal.text }}>You're in. We draw. Even = payout.</span>
            </div>
          </div>
          {/* Tool strip: on-ramp + CTA */}
          <div className="flex flex-wrap justify-center items-center gap-3 text-sm">
            <span className="text-xs uppercase tracking-wider" style={{ color: terminal.dim }}>No SOL?</span>
            {ON_RAMP_LINKS.map(({ name, url }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg font-medium transition-all hover:opacity-90"
                style={{ background: 'rgba(0,255,65,0.08)', color: terminal.accentDim, border: `1px solid ${terminal.border}` }}
              >
                {name}
              </a>
            ))}
          </div>
        </div>

        {/* Jackpot + countdown — hero ball inside box, right-aligned */}
        <section
          className="matrix-data-panel rounded-2xl p-5 sm:p-7 lg:p-9 mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
        >
          <div className="min-w-0 flex-1">
            <div className="matrix-data-label mb-2 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>Jackpot</div>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-bold matrix-hero-value pepball-glow mb-3 sm:mb-4 tracking-tight" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
              {loading ? '...' : error ? '—' : jackpotSol != null ? `${jackpotSol} SOL` : '—'}
            </div>
            <p className="text-sm font-medium mb-4" style={{ color: terminal.gold }}>
              {countdown != null ? (
                <>Next draw in <span className="tabular-nums pepball-pulse">{String(countdown.hours).padStart(2, '0')}:{String(countdown.mins).padStart(2, '0')}:{String(countdown.secs).padStart(2, '0')}</span> — don't miss it.</>
              ) : (
                <>Next draw: {nextDrawLabel}</>
              )}
            </p>
            <p className="text-xs sm:text-sm font-mono" style={{ color: terminal.dim }}>Hold $20+ $PBALL to be in. Swap below or get SOL above.</p>
          </div>
          <div className="flex justify-center sm:justify-end flex-shrink-0" aria-hidden>
            <div
              className="pepball-hero-float pepball-hero-glow rounded-full overflow-hidden ring-2 w-[100px] h-[100px] sm:w-[140px] sm:h-[140px] lg:w-[180px] lg:h-[180px]"
              style={{
                border: `3px solid ${terminal.accentDim}`,
              }}
            >
              <img
                src={pepeBallSrc}
                alt=""
                className="w-full h-full object-cover scale-110 pointer-events-none select-none"
              />
            </div>
          </div>
        </section>

        {/* The draw — same vibe as Powerball: one draw, one result */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
          <div className="matrix-data-label mb-1 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>The draw</div>
          <p className="text-sm font-medium mb-4 sm:mb-6" style={{ color: terminal.text }}>
            One draw for everyone. Even sum = payout. Odd = rollover.
          </p>
          <div className="matrix-data-label mb-3 sm:mb-4">Balls</div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center text-base sm:text-xl font-bold tabular-nums transition-colors"
                  style={{
                    borderColor: terminal.accentDim,
                    background: drawPhase === 'spinning' ? terminal.panel : terminal.bg,
                    color: terminal.accent,
                    boxShadow: '0 0 12px rgba(0, 255, 65, 0.2)',
                  }}
                >
                  {drawPhase === 'idle' ? '?' : String(ballValues[i] ?? 0).padStart(2, '0')}
                </div>
                <span className="text-xs mt-1" style={{ color: terminal.dim }}>#{i + 1}</span>
              </div>
            ))}
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                <div
                  className="pepball-ball-hover w-full h-full rounded-full overflow-hidden ring-2"
                  style={{
                    boxShadow: '0 0 20px rgba(0, 255, 65, 0.25), inset 0 0 10px rgba(0, 0, 0, 0.2)',
                    border: `2px solid ${terminal.accentDim}`,
                  }}
                >
                  <img src={pepeBallSrc} alt="PEPE" className="w-full h-full object-cover scale-110" />
                </div>
                {drawPhase === 'revealed' && drawResult && !drawResult.isEven && (
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none z-10"
                    style={{
                      background: 'rgba(200, 30, 30, 0.92)',
                      boxShadow: 'inset 0 0 0 4px rgba(248, 81, 73, 0.95), 0 0 24px rgba(248, 81, 73, 0.5)',
                    }}
                    aria-hidden
                  />
                )}
              </div>
              <span className="text-xs mt-1" style={{ color: terminal.dim }}>Pepe</span>
            </div>
          </div>
          {drawPhase === 'revealed' && drawResult && (
            <div className="mb-4 sm:mb-6 p-4 sm:p-6 rounded-xl border text-center matrix-glass" style={{ borderColor: terminal.cardBorder }}>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: terminal.dim }}>Final sum</div>
              <div className="text-3xl font-bold tabular-nums pepball-glow mb-2" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>{drawResult.sum}</div>
              <div className="text-sm font-semibold mb-2" style={{ color: terminal.accent }}>
                {drawResult.isEven ? 'Even — Payout' : 'Odd — Rollover'}
              </div>
              <div className="text-base font-semibold py-2.5 px-5 rounded-xl inline-block mb-2" style={{ color: terminal.accent, border: `2px solid ${terminal.accentDim}` }}>
                {drawResult.sum} · {drawResult.isEven ? 'Even payout' : 'Odd rollover'}
              </div>
              {drawResult.isEven && <p className="text-sm" style={{ color: terminal.gold }}>Winners paid out on-chain.</p>}
              <div className="mt-3 py-2.5 px-4 rounded-xl font-semibold" style={{ background: 'rgba(229, 184, 74, 0.12)', color: terminal.gold, border: `1px solid ${terminal.gold}` }}>
                Winner index #{drawResult.winnerIndex}
              </div>
            </div>
          )}
          <p className="text-xs text-center mb-4" style={{ color: terminal.dim }}>
            {drawPhase === 'spinning' ? 'Spinning…' : 'Try it below — same idea as the real draw.'}
          </p>
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <button
              type="button"
              onClick={runDrawingAnimation}
              className="min-h-[44px] px-5 sm:px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] touch-manipulation"
              style={{
                border: 'none',
                color: terminal.bg,
                background: terminal.accent,
                boxShadow: '0 0 20px rgba(0, 255, 65, 0.3), 0 4px 14px rgba(0, 0, 0, 0.2)',
              }}
            >
              {drawPhase === 'revealed' ? 'Spin again' : 'Simulate draw'}
            </button>
          </div>
        </section>

        <SwapCarousel
          theme={{
            accent: terminal.accent,
            accentDim: terminal.accentDim,
            border: terminal.border,
            dim: terminal.dim,
            text: terminal.text,
            bg: terminal.bg,
            fontDisplay: terminal.fontDisplay,
          }}
          swapWidgetRef={swapWidgetRef}
          userAddress={user?.address}
          jupiterInitializedRef={jupiterInitializedRef}
        />

        {/* Get $PBALL — funnel: chart, buy, copy CA (no connect required) */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="matrix-data-label mb-3 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>Get $PBALL</div>
          <p className="text-sm mb-4" style={{ color: terminal.text }}>Or open chart, Jupiter in new tab, or copy the token address.</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`https://dextools.io/app/solana/token/${PEPEBALL_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'rgba(0,255,65,0.15)', color: terminal.accent, border: `1px solid ${terminal.accentDim}` }}
            >
              Chart (DexTools)
            </a>
            <a
              href={`https://jup.ag/swap/SOL-${PEPEBALL_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: terminal.accent, color: terminal.bg, border: 'none', boxShadow: '0 0 16px rgba(0,255,65,0.25)' }}
            >
              Buy (Jupiter)
            </a>
            <a
              href={`https://birdeye.so/token/${PEPEBALL_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'rgba(0,255,65,0.1)', color: terminal.text, border: `1px solid ${terminal.border}` }}
            >
              Birdeye
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(PEPEBALL_MINT);
                toast.success('Contract address copied');
              }}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'rgba(0,255,65,0.08)', color: terminal.dim, border: `1px solid ${terminal.border}` }}
            >
              Copy CA
            </button>
          </div>
        </section>

        {/* Who's in — one line */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="matrix-data-label mb-2">Who’s in the draw</div>
          <p className="text-sm font-medium" style={{ color: terminal.text }}>Hold $20+ $PBALL = you're in. Get it above.</p>
        </section>

        {/* Payout structure */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
          <div className="matrix-data-label mb-3 sm:mb-4 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>Payout structure</div>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>Main winner</span>
              <span style={{ color: terminal.gold }}>{MAIN_WINNER_PERCENT}%</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>Secondary (×8)</span>
              <span style={{ color: terminal.dim }}>{SECONDARY_WINNER_PERCENT}% each</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>Rollover</span>
              <span style={{ color: terminal.accent }}>{ROLLOVER_PERCENT}%</span>
            </li>
            <li className="flex justify-between">
              <span style={{ color: terminal.text }}>Dev fee</span>
              <span style={{ color: terminal.dim }}>{DEV_PERCENT}%</span>
            </li>
          </ul>
        </section>

        {/* Fortune guarantee */}
        <section className="matrix-data-panel mb-6 sm:mb-8 text-xs sm:text-sm rounded-2xl p-4 sm:p-6" style={{ color: terminal.dim }}>
          <div className="matrix-data-label mb-2 sm:mb-3 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>Provably fair</div>
          <ul className="space-y-2">
            <li>· No way to predict or manipulate the winner</li>
            <li>· Result verified on-chain before payout</li>
            <li>· Sealed by VRF on Solana</li>
          </ul>
        </section>

        {/* Current round info — live data ready for onchain (entries from lottery state when wired) */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
          <div className="matrix-data-label mb-3 sm:mb-4 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>Current round</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 text-xs sm:text-sm">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(0,255,65,0.04)', border: '1px solid rgba(0,255,65,0.12)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Jackpot (live)</div>
              <div className="font-mono tabular-nums font-semibold text-base" style={{ color: terminal.gold }}>
                {loading ? '…' : jackpotSol != null ? `${jackpotSol} SOL` : '0.00 SOL'}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(0,255,65,0.04)', border: '1px solid rgba(0,255,65,0.12)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Entries (on-chain)</div>
              <div className="font-mono tabular-nums font-semibold" style={{ color: terminal.text }}>—</div>
              <p className="text-[10px] mt-1" style={{ color: terminal.dim }}>From lottery snapshot when on-chain</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(0,255,65,0.04)', border: '1px solid rgba(0,255,65,0.12)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Next drawing</div>
              <div className="font-mono tabular-nums" style={{ color: terminal.text }}>{nextDrawLabel || 'TBD'}</div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(0,255,65,0.04)', border: '1px solid rgba(0,255,65,0.12)' }}>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Data updated</div>
              <div className="font-mono text-xs" style={{ color: terminal.text }}>{lastUpdatedLabel ?? '—'}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: terminal.cardBorder }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Eligibility</div>
            <p style={{ color: terminal.text }}>Hold $20 worth of $PBALL at draw time</p>
            <p className="text-xs mt-1" style={{ color: terminal.dim }}>
              At current price: $20 ≈ {(20 / tokenPrice.effectiveUsdPerToken).toFixed(2)} tokens (1 token = ${tokenPrice.effectiveUsdPerToken.toFixed(6)})
            </p>
            <p className="text-xs mt-2" style={{ color: terminal.dim }}>
              How it works: Hold at least $20 worth of $PBALL at snapshot time — you’re automatically in the draw. One draw for everyone; VRF-powered randomness; winners paid on-chain.
            </p>
          </div>
        </section>

        {/* Winners history */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
          <div className="matrix-data-label mb-2 font-semibold tracking-[0.2em]" style={{ fontFamily: terminal.fontDisplay }}>Winners</div>
          <p className="text-xs mb-4" style={{ color: terminal.dim }}>All transactions verifiable on Solscan</p>
          <div className="text-center py-10" style={{ color: terminal.dim }}>
            No drawings yet
          </div>
          <p className="text-sm text-center" style={{ color: terminal.accentDim }}>
            Be the first winner.
          </p>
        </section>

        {/* Game snapshot — verify on Solscan; program is live on Devnet; mainnet after deploy */}
        <section className="matrix-data-panel rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8">
          <h3 className="text-sm font-bold tracking-tight mb-3" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            Verify on-chain
          </h3>
          <p className="text-xs mb-3" style={{ color: terminal.dim }}>
            Program is deployed on <strong>Devnet</strong>. For mainnet, deploy the program first (see docs/MAINNET_DEPLOY_AND_SOL.md).
          </p>
          <div className="flex flex-wrap gap-4 text-sm mb-2">
            <a
              href={`https://solscan.io/account/${LOTTERY_PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate max-w-full"
              style={{ color: terminal.accentAlt }}
            >
              🔗 Lottery Program (Devnet)
            </a>
            <a
              href={`https://solscan.io/account/${LOTTERY_PDA}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate max-w-full"
              style={{ color: terminal.accentAlt }}
            >
              🔗 Game Snapshot PDA (Devnet)
            </a>
            <a
              href={`https://solscan.io/account/${LOTTERY_PROGRAM_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate max-w-full opacity-70"
              style={{ color: terminal.accentAlt }}
            >
              🔗 Lottery Program (Mainnet)
            </a>
            <a
              href={`https://solscan.io/account/${LOTTERY_PDA}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono truncate max-w-full opacity-70"
              style={{ color: terminal.accentAlt }}
            >
              🔗 Game Snapshot PDA (Mainnet)
            </a>
          </div>
          <p className="text-xs mt-2 font-mono break-all" style={{ color: terminal.dim }}>
            Program: {LOTTERY_PROGRAM_ID}
          </p>
          <p className="text-xs font-mono break-all" style={{ color: terminal.dim }}>
            PDA: {LOTTERY_PDA}
          </p>
        </section>

        {/* Admin: token price sniffer + manual override */}
        {isAdmin && (
          <section
            className="matrix-glass-strong rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border-2"
            style={{ borderColor: terminal.gold }}
          >
            <h3 className="text-base font-bold tracking-tight mb-4" style={{ color: terminal.gold, fontFamily: terminal.fontDisplay }}>
              Admin — Token price
            </h3>
            <div className="mb-4">
              <p className="text-xs font-mono break-all" style={{ color: terminal.dim }}>
                Mint: {PEPEBALL_MINT}
              </p>
              <p className="text-xs mt-1" style={{ color: terminal.dim }}>
                Phase: {PEPEBALL_MINT === PROOF_MINT ? 'Proof (low stakes)' : 'Production (locked)'}
              </p>
            </div>
            <div className="border-t pt-4 mb-4" style={{ borderColor: terminal.border }}>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: terminal.gold }}>Lock production token (one-way)</div>
              <p className="text-xs mb-2" style={{ color: terminal.dim }}>
                Once locked, the app uses only your final/production mint — no going back (provably). No second test coin: proof = 3X36…, production = your new mint. See <a href="https://github.com/goldennftplatform-svg/PB/blob/main/docs/PROOF_THEN_PRODUCTION.md" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>docs/PROOF_THEN_PRODUCTION.md</a>.
              </p>
              <p className="text-xs" style={{ color: terminal.dim }}>
                To lock on-chain: deploy a mint-lock program and wire the button here. Until then: set VITE_PEPEBALL_MINT to your production mint and redeploy (one-way by discipline).
              </p>
            </div>
            <div className="grid gap-4 text-sm mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs uppercase" style={{ color: terminal.dim }}>Effective (used):</span>
                <span className="font-mono font-bold" style={{ color: terminal.accent }}>
                  ${tokenPrice.effectiveUsdPerToken.toFixed(6)} per token
                </span>
                {tokenPrice.overrideUsdPerToken != null && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: terminal.gold, color: terminal.bg }}>
                    Override active
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs uppercase" style={{ color: terminal.dim }}>Live:</span>
                <span className="font-mono" style={{ color: terminal.text }}>
                  {tokenPrice.loading ? '…' : tokenPrice.liveUsdPerToken != null
                    ? `$${tokenPrice.liveUsdPerToken.toFixed(6)}`
                    : tokenPrice.error ?? '—'}
                </span>
                {tokenPrice.lastFetchedAt && (
                  <span className="text-xs" style={{ color: terminal.dim }}>
                    Updated {new Date(tokenPrice.lastFetchedAt).toLocaleTimeString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => tokenPrice.refetch()}
                  className="px-3 py-1 rounded border text-xs"
                  style={{ borderColor: terminal.border, color: terminal.text }}
                >
                  Refetch now
                </button>
              </div>
            </div>
            <div className="border-t pt-4 space-y-4" style={{ borderColor: terminal.border }}>
              <div>
                <label className="text-xs uppercase block mb-2" style={{ color: terminal.dim }}>
                  Manual override ($ per token) — e.g. 5 = 1 token = $5
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={tokenPrice.overrideUsdPerToken?.toString() ?? 'e.g. 0.000005'}
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                    className="font-mono px-3 py-2 rounded border w-40"
                    style={{ borderColor: terminal.border, background: terminal.bg, color: terminal.text }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = parseFloat(overrideInput);
                      if (Number.isFinite(n) && n > 0) {
                        tokenPrice.setOverride(n);
                        setOverrideInput('');
                      }
                    }}
                    className="px-3 py-2 rounded border font-medium"
                    style={{ borderColor: terminal.accent, color: terminal.accent }}
                  >
                    Set override
                  </button>
                  {tokenPrice.overrideUsdPerToken != null && (
                    <button
                      type="button"
                      onClick={() => { tokenPrice.setOverride(null); setOverrideInput(''); }}
                      className="px-3 py-2 rounded border"
                      style={{ borderColor: terminal.red, color: terminal.red }}
                    >
                      Clear override
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase block mb-2" style={{ color: terminal.dim }}>
                  Or set from: [raw units] = $ [USD] — e.g. 1,000,000 raw = $5
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="1000000"
                    value={rawUnitsInput}
                    onChange={(e) => setRawUnitsInput(e.target.value)}
                    className="font-mono px-3 py-2 rounded border w-32"
                    style={{ borderColor: terminal.border, background: terminal.bg, color: terminal.text }}
                  />
                  <span style={{ color: terminal.dim }}>= $</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="5"
                    value={usdInput}
                    onChange={(e) => setUsdInput(e.target.value)}
                    className="font-mono px-3 py-2 rounded border w-24"
                    style={{ borderColor: terminal.border, background: terminal.bg, color: terminal.text }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const raw = parseInt(rawUnitsInput.replace(/,/g, ''), 10);
                      const usd = parseFloat(usdInput);
                      if (Number.isFinite(raw) && raw > 0 && Number.isFinite(usd)) {
                        tokenPrice.setOverrideFromRawAndUsd(raw, usd);
                      }
                    }}
                    className="px-3 py-2 rounded border font-medium"
                    style={{ borderColor: terminal.accent, color: terminal.accent }}
                  >
                    Apply
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: terminal.dim }}>
                  At 6 decimals, 1,000,000 raw = 1 token. So 1M raw = $5 → $5 per token.
                </p>
              </div>
            </div>

            {/* Lottery controls — Trigger snapshot, Set winners, Execute payout */}
            <div className="border-t pt-6 mt-6 space-y-4" style={{ borderColor: terminal.border }}>
              <h4 className="text-sm font-bold tracking-tight" style={{ color: terminal.gold, fontFamily: terminal.fontDisplay }}>
                Lottery controls
              </h4>
              <p className="text-xs" style={{ color: terminal.dim }}>
                1) Trigger snapshot (freeze participant list). 2) Set winners (main + up to 8 minor). 3) Execute payout.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  type="button"
                  disabled={snapshotLoading || !user?.address || !window.phantom?.solana?.signTransaction}
                  onClick={async () => {
                    if (!user?.address) return;
                    setSnapshotLoading(true);
                    try {
                      const tx = await buildTakeSnapshotTx(
                        TAROBASE_CONFIG.rpcUrl,
                        LOTTERY_PROGRAM_ID,
                        user.address
                      );
                      const provider = window.phantom?.solana;
                      if (!provider?.signTransaction) {
                        toast.error('Phantom signTransaction not available');
                        return;
                      }
                      const signed = (await provider.signTransaction(tx)) as Transaction;
                      const conn = new Connection(TAROBASE_CONFIG.rpcUrl, 'confirmed');
                      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
                      toast.success(`Snapshot: ${sig}`);
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : String(e);
                      toast.error(msg || 'Snapshot failed');
                    } finally {
                      setSnapshotLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded border font-medium disabled:opacity-50"
                  style={{ borderColor: terminal.accent, color: terminal.accent }}
                >
                  {snapshotLoading ? '…' : 'Trigger snapshot'}
                </button>
              </div>
              <div>
                <label className="text-xs uppercase block mb-2" style={{ color: terminal.dim }}>
                  Set winners — line 1 = main winner, lines 2–9 = minor winners (one address per line)
                </label>
                <textarea
                  placeholder="Main winner address\nMinor1\nMinor2\n..."
                  rows={5}
                  value={winnersInput}
                  onChange={(e) => setWinnersInput(e.target.value)}
                  className="font-mono text-sm w-full px-3 py-2 rounded border mb-2"
                  style={{ borderColor: terminal.border, background: terminal.bg, color: terminal.text }}
                />
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    type="button"
                    disabled={setWinnersLoading || !user?.address || !winnersInput.trim() || !window.phantom?.solana?.signTransaction}
                    onClick={async () => {
                      if (!user?.address) return;
                      const lines = winnersInput.trim().split(/\n/).map((s) => s.trim()).filter(Boolean);
                      const main = lines[0];
                      const minors = lines.slice(1, 9);
                      if (!main) {
                        toast.error('Enter at least main winner address');
                        return;
                      }
                      setSetWinnersLoading(true);
                      try {
                        const tx = await buildSetWinnersTx(
                          TAROBASE_CONFIG.rpcUrl,
                          LOTTERY_PROGRAM_ID,
                          user.address,
                          main,
                          minors
                        );
                        const provider = window.phantom?.solana;
                        if (!provider?.signTransaction) {
                          toast.error('Phantom signTransaction not available');
                          return;
                        }
                        const signed = (await provider.signTransaction(tx)) as Transaction;
                        const conn = new Connection(TAROBASE_CONFIG.rpcUrl, 'confirmed');
                        const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
                        toast.success(`Set winners: ${sig}`);
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e);
                        toast.error(msg || 'Set winners failed');
                      } finally {
                        setSetWinnersLoading(false);
                      }
                    }}
                    className="px-4 py-2 rounded border font-medium disabled:opacity-50"
                    style={{ borderColor: terminal.accent, color: terminal.accent }}
                  >
                    {setWinnersLoading ? '…' : 'Set winners'}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <button
                  type="button"
                  disabled={payoutLoading || !user?.address || !window.phantom?.solana?.signTransaction}
                  onClick={async () => {
                    if (!user?.address) return;
                    setPayoutLoading(true);
                    try {
                      const tx = await buildPayoutWinnersTx(
                        TAROBASE_CONFIG.rpcUrl,
                        LOTTERY_PROGRAM_ID,
                        user.address
                      );
                      const provider = window.phantom?.solana;
                      if (!provider?.signTransaction) {
                        toast.error('Phantom signTransaction not available');
                        return;
                      }
                      const signed = (await provider.signTransaction(tx)) as Transaction;
                      const conn = new Connection(TAROBASE_CONFIG.rpcUrl, 'confirmed');
                      const sig = await conn.sendRawTransaction(signed.serialize(), { skipPreflight: false });
                      toast.success(`Payout: ${sig}`);
                    } catch (e: unknown) {
                      const msg = e instanceof Error ? e.message : String(e);
                      toast.error(msg || 'Payout failed');
                    } finally {
                      setPayoutLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded border font-medium disabled:opacity-50"
                  style={{ borderColor: terminal.gold, color: terminal.gold }}
                >
                  {payoutLoading ? '…' : 'Execute payout'}
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="relative z-10 text-center text-[10px] sm:text-xs py-8 sm:py-10" style={{ color: terminal.dim }}>
          All transactions are public and verifiable on Solana
        </footer>
      </main>
    </div>
  );
};

export default HomePage;
