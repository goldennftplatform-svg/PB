import { PEPEBALL_MINT, USDC } from '@/lib/constants';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SWAP_ROTATE_MS = 15000;
const SWAP_PANELS = ['Jupiter', 'Pond', 'Your swap'] as const;

type Theme = {
  accent: string;
  accentDim: string;
  border: string;
  dim: string;
  text: string;
  bg: string;
  fontDisplay: string;
};

type SwapCarouselProps = {
  theme: Theme;
  swapWidgetRef: React.RefObject<HTMLDivElement | null>;
  userAddress: string | undefined;
  onJupiterInit?: () => void;
  jupiterInitializedRef: React.MutableRefObject<boolean>;
};

export const SwapCarousel: React.FC<SwapCarouselProps> = ({
  theme,
  swapWidgetRef,
  userAddress,
  onJupiterInit,
  jupiterInitializedRef,
}) => {
  const [swapPanelIndex, setSwapPanelIndex] = useState(0);
  const [buyPromptOpen, setBuyPromptOpen] = useState(false);

  useEffect(() => {
    const initJupiter = () => {
      if (jupiterInitializedRef.current || typeof window === 'undefined' || !window.Jupiter) return false;
      window.Jupiter.init({
        displayMode: 'integrated',
        integratedTargetId: 'jupiter-embedded-swap',
        formProps: {
          initialInputMint: SOL_MINT,
          initialOutputMint: PEPEBALL_MINT,
          swapMode: 'ExactIn',
        },
        onSuccess: ({ txid }) => toast.success(`Swap complete! ${txid.slice(0, 8)}…`),
      });
      jupiterInitializedRef.current = true;
      onJupiterInit?.();
      return true;
    };
    if (initJupiter()) return;
    const t = setInterval(() => { if (initJupiter()) clearInterval(t); }, 200);
    return () => clearInterval(t);
  }, [jupiterInitializedRef, onJupiterInit]);

  useEffect(() => {
    const id = setInterval(() => setSwapPanelIndex((i) => (i + 1) % 3), SWAP_ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <section
        ref={swapWidgetRef}
        className="matrix-data-panel rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border-2 overflow-hidden"
        style={{ borderColor: 'rgba(0,255,65,0.25)', boxShadow: '0 0 24px rgba(0,255,65,0.08)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="matrix-data-label font-semibold tracking-[0.2em]" style={{ fontFamily: theme.fontDisplay }}>
            Buy $PBALL here
          </div>
          <div className="flex items-center gap-2">
            {SWAP_PANELS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setSwapPanelIndex(i)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  background: swapPanelIndex === i ? 'rgba(0,255,65,0.25)' : 'rgba(0,255,65,0.08)',
                  color: swapPanelIndex === i ? theme.accent : theme.dim,
                  border: `1px solid ${swapPanelIndex === i ? theme.accentDim : theme.border}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm mb-4" style={{ color: theme.dim }}>
          Rotates every 15s. Swap SOL or USDC → $PBALL — aim for $20+ to get in the draw.
          {userAddress && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setBuyPromptOpen(true)}
                className="font-semibold underline focus:outline-none"
                style={{ color: theme.accent }}
              >
                Buy ~$20.10 USDC worth now
              </button>
            </>
          )}
        </p>
        <div style={{ display: swapPanelIndex === 0 ? 'block' : 'none' }} className="min-h-[360px] w-full rounded-xl overflow-hidden">
          <div id="jupiter-embedded-swap" className="min-h-[360px] w-full rounded-xl overflow-hidden" />
        </div>
        <div
          style={{ display: swapPanelIndex === 1 ? 'block' : 'none', borderColor: theme.border }}
          className="min-h-[420px] w-full rounded-xl overflow-hidden border"
        >
          <iframe
            title="Pond swap — SOL to $PBALL"
            src={`https://www.pondx.com/swap/solana/${PEPEBALL_MINT}?inputMint=${SOL_MINT}`}
            className="w-full h-[420px] sm:h-[480px] border-0 rounded-xl"
            allow="clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
        <div
          style={{
            display: swapPanelIndex === 2 ? 'flex' : 'none',
            borderColor: 'rgba(0,255,65,0.2)',
            background: 'linear-gradient(145deg, rgba(0,255,65,0.04) 0%, rgba(2,12,8,0.6) 50%)',
            boxShadow: 'inset 0 0 60px rgba(0,255,65,0.06)',
          }}
          className="min-h-[360px] w-full rounded-xl overflow-hidden border-2 flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="text-4xl mb-4" aria-hidden>⚡</div>
          <div className="matrix-data-label mb-2 font-bold tracking-wider" style={{ fontFamily: theme.fontDisplay, color: theme.accent }}>
            Your swap
          </div>
          <p className="text-sm mb-6 max-w-md" style={{ color: theme.dim }}>
            Drop your own widget or custom swap UI here. Same vibe as Jupiter — make it yours.
          </p>
          <a
            href={`https://jup.ag/swap/USDC-${PEPEBALL_MINT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 min-h-[44px] px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
            style={{ background: theme.accent, color: theme.bg, boxShadow: '0 0 20px rgba(0,255,65,0.3)' }}
          >
            Open Jupiter (USDC → $PBALL)
          </a>
        </div>
      </section>

      {buyPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="buy-prompt-title"
        >
          <div
            className="matrix-data-panel rounded-2xl p-6 sm:p-8 max-w-md w-full border-2"
            style={{ borderColor: theme.accentDim, boxShadow: '0 0 40px rgba(0,255,65,0.15)' }}
          >
            <h3 id="buy-prompt-title" className="text-lg font-bold mb-3" style={{ fontFamily: theme.fontDisplay, color: theme.accent }}>
              Buy ~$20.10 of $PBALL
            </h3>
            <p className="text-sm mb-6" style={{ color: theme.text }}>
              We'll open Jupiter with USDC → $PBALL. Enter <strong>20.10</strong> USDC (or whatever you want) and complete the swap there.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setBuyPromptOpen(false)}
                className="flex-1 min-h-[44px] px-4 py-3 rounded-xl font-semibold border"
                style={{ borderColor: theme.border, color: theme.dim }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(`https://jup.ag/swap/${USDC}-${PEPEBALL_MINT}`, '_blank', 'noopener');
                  setBuyPromptOpen(false);
                  toast.success('Opened Jupiter — enter 20.10 USDC to swap');
                }}
                className="flex-1 min-h-[44px] px-4 py-3 rounded-xl font-semibold"
                style={{ background: theme.accent, color: theme.bg, boxShadow: '0 0 16px rgba(0,255,65,0.25)' }}
              >
                Open Jupiter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SwapCarousel;
