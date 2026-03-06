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
  ROLLOVER_PERCENT,
  DEV_PERCENT,
  SECONDARY_WINNER_PERCENT,
} from '@/lib/constants';
import { TAROBASE_CONFIG } from '@/lib/config';
import { buildTakeSnapshotTx } from '@/lib/lottery-actions';
import { usePhantomFallback } from '@/contexts/PhantomFallbackContext';
import { useTokenPrice } from '@/contexts/TokenPriceContext';
import { useAuth } from '@pooflabs/web';
import { Connection, Transaction } from '@solana/web3.js';
import React, { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
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

const FIRST_VISIT_KEY = 'pepball-draw-seen';
const SPIN_DURATION_MS = 2800;
const BALL_TICK_MS = 80;

export const HomePage: React.FC = () => {
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
      try { sessionStorage.setItem(FIRST_VISIT_KEY, '1'); } catch { /* ignore */ }
    }, 100);
    return () => { clearInterval(spinInterval); clearInterval(stopInterval); };
  }, [drawPhase]);

  useEffect(() => {
    if (drawPhase !== 'idle') return;
    try {
      if (sessionStorage.getItem(FIRST_VISIT_KEY)) return;
    } catch { /* ignore */ }
    const t = setTimeout(runDrawingAnimation, 900);
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

  // Premium terminal: matrix vibe, Fortune 500 polish
  const terminal = {
    bg: '#0a0e12',
    bgGradient: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 255, 65, 0.06), transparent), #0a0e12',
    panel: '#111820',
    card: 'rgba(22, 28, 36, 0.85)',
    cardBorder: 'rgba(0, 255, 65, 0.12)',
    border: '#1e2836',
    text: '#e6edf3',
    dim: '#7d8a99',
    accent: '#00ff41',
    accentDim: 'rgba(0, 255, 65, 0.7)',
    accentAlt: '#58a6ff',
    gold: '#e5b84a',
    red: '#f85149',
    fontDisplay: "'Syne', system-ui, sans-serif",
    fontMono: "'JetBrains Mono', 'Courier New', Consolas, monospace",
  };

  const pepeBallSrc = '/pepe-ball.png';

  // Inline animation CSS so it cannot be stripped by build — guaranteed to run
  const animationStyles = `
    @keyframes pepball-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-14px); }
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
    .pepball-glow { animation: pepball-glow 1.4s ease-in-out infinite; }
    .pepball-pulse { animation: pepball-pulse 0.9s ease-in-out infinite; }
    .pepball-ball-hover { transition: transform 0.25s ease, box-shadow 0.25s ease; }
    .pepball-ball-hover:hover { transform: scale(1.12); box-shadow: 0 0 24px rgba(0,255,65,0.6); }
  `;

  return (
    <div className="min-h-screen" style={{ background: terminal.bgGradient, color: terminal.text, fontFamily: terminal.fontMono }}>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
      {/* Header — circular logo, premium typography */}
      <header
        className="sticky top-0 z-10 text-center border-b"
        style={{
          borderColor: terminal.cardBorder,
          background: 'linear-gradient(180deg, rgba(17, 24, 32, 0.98) 0%, rgba(17, 24, 32, 0.95) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '28px 20px',
          boxShadow: '0 1px 0 rgba(0, 255, 65, 0.06), 0 20px 40px -20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8">
          {/* Circular logo crop — premium ring + shadow */}
          <div
            className="flex-shrink-0 pepball-float rounded-full overflow-hidden ring-2"
            style={{
              width: 'clamp(88px, 20vw, 120px)',
              height: 'clamp(88px, 20vw, 120px)',
              boxShadow: '0 0 0 1px rgba(0, 255, 65, 0.2), 0 0 40px rgba(0, 255, 65, 0.15), inset 0 0 20px rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(0, 255, 65, 0.35)',
            }}
          >
            <img
              src={pepeBallSrc}
              alt="PEPEBALL"
              className="w-full h-full object-cover scale-110"
            />
          </div>
          <div>
            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight"
              style={{
                fontFamily: terminal.fontDisplay,
                color: terminal.accent,
                textShadow: '0 0 20px rgba(0, 255, 65, 0.4), 0 2px 4px rgba(0, 0, 0, 0.4)',
                letterSpacing: '-0.02em',
              }}
            >
              PEPEBALL
            </h1>
            <p className="text-sm mt-1.5 tracking-wide" style={{ color: terminal.dim, fontFamily: terminal.fontMono }}>
              Solana Powerball Lottery
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center mt-5">
          <WalletButton variant="dark" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-10 max-w-4xl">
        {/* Tagline */}
        <p className="text-center text-xs uppercase tracking-[0.2em] mb-10" style={{ color: terminal.dim, fontFamily: terminal.fontMono }}>
          Spin your destiny · Provably fair
        </p>

        {/* Jackpot + countdown — hero block */}
        <section className="mb-10 rounded-2xl border p-6 sm:p-8" style={{ background: terminal.card, borderColor: terminal.cardBorder, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)' }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: terminal.dim }}>Jackpot</div>
          <div className="text-4xl sm:text-5xl font-bold tabular-nums mb-6 pepball-glow" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            {loading ? '...' : error ? '—' : jackpotSol != null ? `${jackpotSol} SOL` : '—'}
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
            <span className="text-xs uppercase" style={{ color: terminal.dim }}>Draw {jackpot?.drawingNumber ?? '?'}</span>
            <span className="text-xs uppercase" style={{ color: terminal.dim }}>Next draw (one for everyone)</span>
            {countdown != null ? (
              <span className="tabular-nums pepball-pulse font-medium" style={{ color: terminal.gold, fontFamily: terminal.fontMono }}>
                {String(countdown.hours).padStart(2, '0')} : {String(countdown.mins).padStart(2, '0')} : {String(countdown.secs).padStart(2, '0')}
              </span>
            ) : (
              <span style={{ color: terminal.dim }}>{nextDrawLabel}</span>
            )}
            <span style={{ color: terminal.dim }}>· 0 entries in this draw</span>
            <span className="text-xs uppercase" style={{ color: terminal.accentDim }}>Connect wallet to enter</span>
          </div>
        </section>

        {/* Fortune spin section */}
        <section
          className="rounded-2xl border p-6 sm:p-8 mb-8"
          style={{ borderColor: terminal.cardBorder, background: terminal.card, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)' }}
        >
          <h2 className="text-xl font-bold tracking-tight mb-2" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            Fortune Spin
          </h2>
          <p className="text-sm mb-6" style={{ color: terminal.dim }}>
            5 balls + Pepe · Even = payout · Odd = rollover
          </p>
          <div className="text-xs uppercase tracking-wider mb-4" style={{ color: terminal.dim }}>Balls</div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center text-lg sm:text-xl font-bold tabular-nums transition-colors"
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
              <div
                className="pepball-ball-hover w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden flex-shrink-0 ring-2"
                style={{
                  boxShadow: '0 0 20px rgba(0, 255, 65, 0.25), inset 0 0 10px rgba(0, 0, 0, 0.2)',
                  border: `2px solid ${terminal.accentDim}`,
                }}
              >
                <img src={pepeBallSrc} alt="PEPE" className="w-full h-full object-cover scale-110" />
              </div>
              <span className="text-xs mt-1" style={{ color: terminal.dim }}>Pepe</span>
            </div>
          </div>
          {drawPhase === 'revealed' && drawResult && (
            <div className="mb-6 p-6 rounded-xl border text-center" style={{ borderColor: terminal.cardBorder, background: 'rgba(0, 255, 65, 0.04)' }}>
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
            {drawPhase === 'spinning' ? 'Spinning…' : 'One draw for everyone when the countdown above hits zero. Simulate below.'}
          </p>
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <button
              type="button"
              onClick={runDrawingAnimation}
              className="px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:scale-[1.02]"
              style={{
                border: 'none',
                color: terminal.bg,
                background: terminal.accent,
                boxShadow: '0 0 20px rgba(0, 255, 65, 0.3), 0 4px 14px rgba(0, 0, 0, 0.2)',
              }}
            >
              {drawPhase === 'revealed' ? 'Simulate again' : 'Simulate draw'}
            </button>
            <button
              type="button"
              className="px-6 py-3 rounded-xl border font-semibold text-sm transition-all duration-200"
              style={{ borderColor: terminal.cardBorder, color: terminal.text, background: 'transparent' }}
            >
              Enter this draw
            </button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: terminal.dim }}>
            Connect wallet to enter this round (same countdown for everyone).
          </p>
        </section>

        {/* Entry registry */}
        <section
          className="rounded-2xl border p-5 sm:p-6 mb-8"
          style={{ borderColor: terminal.cardBorder, background: terminal.card, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)' }}
        >
          <div className="text-xs uppercase tracking-wider" style={{ color: terminal.dim }}>Entry registry</div>
          <div className="text-sm mt-2" style={{ color: terminal.text }}>0 registered in this draw · Connect wallet to enter</div>
        </section>

        {/* Payout structure */}
        <section
          className="rounded-2xl border p-6 sm:p-8 mb-8"
          style={{ borderColor: terminal.cardBorder, background: terminal.card, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)' }}
        >
          <h3 className="text-base font-bold tracking-tight mb-4" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            Payout structure
          </h3>
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
        <section className="mb-8 text-sm rounded-2xl border p-6" style={{ borderColor: terminal.cardBorder, background: terminal.card, color: terminal.dim }}>
          <h3 className="text-base font-bold tracking-tight mb-3" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>Provably fair</h3>
          <ul className="space-y-2">
            <li>· No way to predict or manipulate the winner</li>
            <li>· Result verified on-chain before payout</li>
            <li>· Sealed by VRF on Solana</li>
          </ul>
        </section>

        {/* Current round info */}
        <section
          className="rounded-2xl border p-6 sm:p-8 mb-8"
          style={{ borderColor: terminal.cardBorder, background: terminal.card, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)' }}
        >
          <h3 className="text-base font-bold tracking-tight mb-4" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            Current round
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Current jackpot</div>
              <div className="font-mono tabular-nums font-medium" style={{ color: terminal.gold }}>
                {loading ? '...' : jackpotSol != null ? `${jackpotSol} SOL` : '0.00 SOL'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Entries</div>
              <div className="font-mono">0</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Next drawing (one for everyone)</div>
              <div className="font-mono">{nextDrawLabel || 'TBD'}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t" style={{ borderColor: terminal.cardBorder }}>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: terminal.dim }}>Eligibility</div>
            <p style={{ color: terminal.text }}>Hold $20 worth of $PBALL at draw time</p>
            <p className="text-xs mt-1" style={{ color: terminal.dim }}>
              At current price: $20 ≈ {(20 / tokenPrice.effectiveUsdPerToken).toFixed(2)} tokens (1 token = ${tokenPrice.effectiveUsdPerToken.toFixed(6)})
            </p>
            <p className="text-xs mt-2" style={{ color: terminal.dim }}>
              How it works: Hold at least $20 worth of $PBALL at snapshot, register for the spin, and let fate decide. VRF-powered randomness, winners paid automatically on-chain.
            </p>
          </div>
        </section>

        {/* Winners history */}
        <section
          className="rounded-2xl border p-6 sm:p-8 mb-8"
          style={{ borderColor: terminal.cardBorder, background: terminal.card, boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)' }}
        >
          <h3 className="text-base font-bold tracking-tight mb-2" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
            Winners
          </h3>
          <p className="text-xs mb-4" style={{ color: terminal.dim }}>All transactions verifiable on Solscan</p>
          <div className="text-center py-10" style={{ color: terminal.dim }}>
            No drawings yet
          </div>
          <p className="text-sm text-center" style={{ color: terminal.accentDim }}>
            Be the first winner.
          </p>
        </section>

        {/* Game snapshot — verify on Solscan; program is live on Devnet; mainnet after deploy */}
        <section
          className="rounded-2xl border p-5 mb-8"
          style={{ borderColor: terminal.cardBorder, background: terminal.card }}
        >
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
            className="rounded-xl border-2 p-6 mb-8"
            style={{ borderColor: terminal.gold, background: terminal.card }}
          >
            <h3 className="text-base font-bold tracking-tight mb-4" style={{ color: terminal.gold, fontFamily: terminal.fontDisplay }}>
              Admin — Token price
            </h3>
            <p className="text-xs font-mono break-all mb-4" style={{ color: terminal.dim }}>
              Mint: {PEPEBALL_MINT}
            </p>
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

            {/* Lottery controls — manual snapshot (set winners / payout via scripts) */}
            <div className="border-t pt-6 mt-6 space-y-4" style={{ borderColor: terminal.border }}>
              <h4 className="text-sm font-bold tracking-tight" style={{ color: terminal.gold, fontFamily: terminal.fontDisplay }}>
                Lottery controls
              </h4>
              <p className="text-xs" style={{ color: terminal.dim }}>
                Trigger a snapshot on-chain (freezes participant list for this drawing). Set winners and run payout via <code className="font-mono">scripts/complete-payout-raw.js</code>.
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
                      toast.success(`Snapshot tx sent: ${sig}`);
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
                  {snapshotLoading ? 'Sending…' : 'Trigger snapshot'}
                </button>
              </div>
            </div>
          </section>
        )}

        <footer className="text-center text-xs py-10 sm:py-12" style={{ color: terminal.dim }}>
          All transactions are public and verifiable on Solana
        </footer>
      </main>
    </div>
  );
};

export default HomePage;
