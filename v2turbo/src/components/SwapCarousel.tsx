import { PEPEBALL_MINT } from '@/lib/constants';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SWAP_ROTATE_MS = 180000; // 3 minutes
const SWAP_PANELS = ['Jupiter', 'Pond'] as const;
const POND_REF = 'HMtGbWoz2CwSK6ZQ5dzcRnAJZbAWHqzAjon6m6jaw8WGLW4da8Y6jknaXnFK';

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
    const id = setInterval(() => setSwapPanelIndex((i) => (i + 1) % 2), SWAP_ROTATE_MS);
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
          Rotates every 3m. Swap SOL or USDC → $PBALL — aim for $20+ to get in the draw.
          {userAddress && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => setBuyPromptOpen(true)}
                className="font-semibold underline focus:outline-none"
                style={{ color: theme.accent }}
              >
                Buy ~$20 worth now
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
            src={`https://www.pondx.com/swap/solana/${PEPEBALL_MINT}?inputMint=${SOL_MINT}&ref=${POND_REF}`}
            className="w-full h-[420px] sm:h-[480px] border-0 rounded-xl"
            allow="clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
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
              Buy ~$20 of $PBALL
            </h3>
            <p className="text-sm mb-6" style={{ color: theme.text }}>
              Opens Jupiter with SOL → $PBALL (same as the widget). Aim for $20+ to get in the draw.
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
                  const url = `https://jup.ag/swap/SOL-${PEPEBALL_MINT}`;
                  window.open(url, '_blank', 'noopener');
                  setBuyPromptOpen(false);
                  toast.success('Opened Jupiter — swap SOL → $PBALL');
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
