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
import { useTokenPrice } from '@/contexts/TokenPriceContext';
import { useAuth } from '@pooflabs/web';
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

const FIRST_VISIT_KEY = 'pepball-draw-seen';
const SPIN_DURATION_MS = 2800;
const BALL_TICK_MS = 80;

export const HomePage: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [drawPhase, setDrawPhase] = useState<'idle' | 'spinning' | 'revealed'>('idle');
  const [ballValues, setBallValues] = useState<number[]>([0, 0, 0, 0, 0]);
  const [drawResult, setDrawResult] = useState<{ sum: number; isEven: boolean; winnerIndex: number } | null>(null);
  const auth = useAuth() as AuthContextType;
  const user = auth.user;
  const isAdmin = user?.address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
  const tokenPrice = useTokenPrice();
  const [overrideInput, setOverrideInput] = useState('');
  const [rawUnitsInput, setRawUnitsInput] = useState('1000000');
  const [usdInput, setUsdInput] = useState('5');
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
    <div className="min-h-screen" style={{ background: terminal.bg, color: terminal.text, fontFamily: "'Courier New', Consolas, Monaco, monospace" }}>
      <style dangerouslySetInnerHTML={{ __html: animationStyles }} />
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
          <div className="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center pepball-float">
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
          <div className="text-4xl font-bold tabular-nums mb-6 pepball-glow" style={{ color: terminal.accent }}>
            {loading ? '...' : error ? '—' : jackpotSol != null ? `${jackpotSol} SOL` : '—'}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-xs uppercase mr-2" style={{ color: terminal.dim }}>DRAW_{jackpot?.drawingNumber ?? '?'}</span>
              <span className="text-xs uppercase" style={{ color: terminal.dim }}>NEXT_DRAW_IN</span>
            </div>
            {countdown != null ? (
              <span className="tabular-nums font-mono pepball-pulse" style={{ color: terminal.gold }}>
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
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 flex items-center justify-center text-lg sm:text-xl font-bold tabular-nums"
                  style={{
                    borderColor: terminal.accent,
                    background: drawPhase === 'spinning' ? terminal.panel : terminal.bg,
                    color: terminal.accent,
                    boxShadow: '0 0 10px rgba(0, 255, 65, 0.3)',
                    transition: 'background 0.2s',
                  }}
                >
                  {drawPhase === 'idle' ? '?' : String(ballValues[i] ?? 0).padStart(2, '0')}
                </div>
                <span className="text-xs mt-1" style={{ color: terminal.dim }}>#{i + 1}</span>
              </div>
            ))}
            <div className="flex flex-col items-center">
              <div
                className="pepball-ball-hover w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center flex-shrink-0 p-0.5"
                style={{
                  borderColor: terminal.accent,
                  background: terminal.bg,
                  boxShadow: '0 0 15px rgba(0, 255, 65, 0.5)',
                }}
              >
                <img src={pepeBallSrc} alt="PEPE" className="w-full h-full object-contain" />
              </div>
              <span className="text-xs mt-1" style={{ color: terminal.dim }}>PEPE</span>
            </div>
          </div>
          {drawPhase === 'revealed' && drawResult && (
            <div className="mb-6 p-4 rounded-lg border-2 text-center" style={{ borderColor: terminal.accent, background: terminal.bg }}>
              <div className="text-xs uppercase mb-2" style={{ color: terminal.dim }}>FINAL_SUM</div>
              <div className="text-3xl font-bold tabular-nums pepball-glow mb-2" style={{ color: terminal.accent }}>{drawResult.sum}</div>
              <div className="text-sm font-semibold mb-2" style={{ color: terminal.accent }}>
                {drawResult.isEven ? 'EVEN = PAYOUT' : 'ODD = ROLLOVER'}
              </div>
              <div className="text-base font-bold py-2 px-4 rounded inline-block mb-2" style={{ color: terminal.accent, border: `2px solid ${terminal.accent}` }}>
                SUM: {drawResult.sum} — {drawResult.isEven ? 'EVEN PAYOUT!' : 'ODD ROLLOVER!'}
              </div>
              {drawResult.isEven && <p className="text-sm" style={{ color: terminal.gold }}>PEPE CELEBRATES! WINNERS PAID OUT!</p>}
              <div className="mt-3 py-2 px-4 rounded font-bold" style={{ background: 'rgba(212,165,32,0.2)', color: terminal.gold, border: `1px solid ${terminal.gold}` }}>
                WINNER INDEX: #{drawResult.winnerIndex}
              </div>
            </div>
          )}
          <p className="text-xs uppercase text-center mb-4" style={{ color: terminal.dim }}>
            {drawPhase === 'spinning' ? 'SPINNING...' : 'FORTUNE_SPINS_WHEN_COUNTDOWN_ENDS'}
          </p>
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <button
              type="button"
              onClick={runDrawingAnimation}
              className="px-6 py-2 rounded border-2 font-semibold uppercase text-sm transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,65,0.4)]"
              style={{
                borderColor: terminal.accent,
                color: terminal.accent,
                background: 'transparent',
              }}
            >
              {drawPhase === 'revealed' ? 'PLAY DRAWING AGAIN' : 'PLAY DRAWING'}
            </button>
            <button
              type="button"
              className="px-6 py-2 rounded border-2 font-semibold uppercase text-sm opacity-80"
              style={{ borderColor: terminal.border, color: terminal.dim, background: 'transparent' }}
            >
              ENTER_DRAWING
            </button>
            <span className="text-xs uppercase" style={{ color: terminal.dim }}>CONNECT_WALLET_TO_ENTER</span>
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

        {/* Admin: token price sniffer + manual override */}
        {isAdmin && (
          <section
            className="rounded-xl border-2 p-6 mb-8"
            style={{ borderColor: terminal.gold, background: terminal.card }}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: terminal.gold }}>
              ADMIN — Token price (5 min updates)
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
                <span className="text-xs uppercase" style={{ color: terminal.dim }}>Live (Jupiter):</span>
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
          </section>
        )}

        <footer className="text-center text-xs py-6" style={{ color: terminal.dim }}>
          WE_HAVE_NOTHING_TO_HIDE // All transactions are public and verifiable on Solana blockchain
        </footer>
      </main>
    </div>
  );
};

export default HomePage;
