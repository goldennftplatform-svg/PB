import { Link } from 'react-router-dom';
import { PEPEBALL_MINT } from '@/lib/constants';
import MatrixRain from './MatrixRain';
import WalletButton from './WalletButton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const terminal = {
  bg: 'rgba(2, 8, 6, 0.5)',
  panel: 'rgba(4, 14, 10, 0.6)',
  cardBorder: 'rgba(0, 255, 65, 0.18)',
  border: 'rgba(0, 255, 65, 0.12)',
  text: '#e8f2ee',
  dim: '#6b8a7a',
  accent: '#00ff41',
  accentDim: 'rgba(0, 255, 65, 0.7)',
  accentAlt: '#5ce1e6',
  gold: '#e5b84a',
  fontDisplay: "'Orbitron', 'Syne', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', 'Courier New', Consolas, monospace",
};

export default function FaqPage() {
  return (
    <div className="matrix-page matrix-page__bg relative min-h-screen" style={{ color: terminal.text, fontFamily: terminal.fontMono }}>
      <MatrixRain />
      <div className="matrix-scanline" aria-hidden />

      <header
        className="matrix-glass-strong sticky top-0 z-10 border-b px-3 py-2.5 sm:px-4 sm:py-3"
        style={{ borderColor: 'rgba(0,255,65,0.18)', boxShadow: 'inset 0 1px 0 rgba(0,255,65,0.08), 0 1px 0 rgba(0,0,0,0.2)' }}
      >
        <div className="container mx-auto max-w-4xl flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <img src="/pepe-ball.png" alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${terminal.accentDim}` }} />
            <span style={{ fontFamily: terminal.fontDisplay, color: terminal.accent }}>PEPE</span>
            <span style={{ fontFamily: terminal.fontDisplay, color: terminal.gold }}>BALL</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-xs sm:text-sm font-medium px-3 py-2 rounded-lg transition-all hover:opacity-90"
              style={{ background: 'rgba(0,255,65,0.08)', color: terminal.dim, border: `1px solid ${terminal.border}` }}
            >
              Back to game
            </Link>
            <WalletButton variant="dark" />
          </div>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-6 sm:py-10 max-w-3xl">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-2" style={{ fontFamily: terminal.fontDisplay, color: terminal.accent }}>
          Frequently asked questions
        </h1>
        <p className="text-sm mb-8" style={{ color: terminal.dim }}>
          How the draw works, entries, winnings, and how to stay safe.
        </p>

        {/* Legal disclaimer — prominent, same idea as powerball.tech */}
        <section
          className="rounded-xl p-4 sm:p-5 mb-8 border-2"
          style={{ borderColor: terminal.gold, background: 'rgba(229, 184, 74, 0.06)' }}
        >
          <div className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: terminal.gold }}>
            Important legal disclaimer
          </div>
          <p className="text-xs sm:text-sm leading-relaxed" style={{ color: terminal.text }}>
            This platform is <strong>not</strong> affiliated with any government-run Powerball or official lottery. PEPEBALL is a memecoin and entertainment project on Solana. We are not connected to any state-sponsored drawing or the official Powerball game. This is a token-based draw for entertainment only and should not be construed as gambling in a legal sense. You are solely responsible for compliance with your local laws. Participate only if it is legal in your jurisdiction and only with funds you can afford to lose.
          </p>
        </section>

        <Accordion type="multiple" className="w-full" defaultValue={['legal-1', 'how-1']}>
          <AccordionItem value="legal-1" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              Are you affiliated with official Powerball or any government lottery?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              No. PEPEBALL is an independent Solana project. We use a similar “ball draw” theme for fun only. The draw and payouts are on-chain and have no connection to any government or official lottery.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="legal-2" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              Is this legal where I live?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              Laws vary by country and region. We do not provide legal advice. You must check your local laws before participating. If token-based draws or similar activities are restricted, do not participate.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="what" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              What is PEPEBALL?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              PEPEBALL is a Solana token ($PBALL) and an on-chain draw. Hold $20+ worth of $PBALL at snapshot time to be in the draw. We take a snapshot, run a provably fair draw (odd/even Pepe ball), and pay winners in SOL. More value held = more entries per snapshot: $20 = 1 ticket, $100 = 4, $500 = 10.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="how-1" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              How do I get tickets / entries?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              Hold $PBALL in your wallet at snapshot time. Minimum $20 worth to be in the draw. Entries scale: <strong style={{ color: terminal.accent }}>$20 = 1 ticket</strong>, <strong style={{ color: terminal.accent }}>$100 = 4 tickets</strong>, <strong style={{ color: terminal.accent }}>$500 = 10 tickets</strong>. Buy $PBALL via the swap widget on the main page (Jupiter or Pond) or use Birdeye/GMGN/DexTools links. No separate “ticket purchase”—your holding is your entry.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="how-2" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              How does the draw work? What’s odd/even / rollover?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              Each draw we take a snapshot and compute a “Pepe ball” count (1–30) from on-chain randomness. <strong style={{ color: terminal.accent }}>Odd</strong> = payout round: we select winners and pay out (50% main winner, 40% split across 8 minors, 10% house). <strong style={{ color: terminal.accent }}>Even</strong> = rollover: jackpot grows, timer extends, no payout that round. So roughly 50/50 chance each draw is a payout vs rollover. All verifiable on-chain (Solscan, program ID and PDA linked on the main page).
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="how-3" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              How often is the jackpot drawn?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              Draws run on a fixed interval (e.g. every 24–48 hours depending on config). The exact “next draw” time is shown on the main page. Rollovers extend the next draw time; after a payout we reset for the next round.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="winnings" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              How and when do I receive winnings?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              When the draw is <strong>odd</strong> (payout round), winners are set on-chain and paid in SOL to their wallet. Main winner gets 50% of the jackpot; 8 minor winners split 40%; 10% goes to the house. You don’t need to “claim”—if you’re selected, the SOL is sent to the wallet that held $PBALL at snapshot. You can verify every transaction on Solscan.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="scams" style={{ borderColor: terminal.border }}>
            <AccordionTrigger className="text-left hover:no-underline py-4" style={{ color: terminal.text, fontFamily: terminal.fontDisplay }}>
              How do I avoid scams?
            </AccordionTrigger>
            <AccordionContent style={{ color: terminal.dim }}>
              Only use links from this site (the official PEPEBALL app). We never DM you first or ask for your seed phrase. Always verify the token contract address ($PBALL mint) and the lottery program on Solscan before buying or trusting any “PEPEBALL” link. Check the “Verify on-chain” section on the main page for the real program and PDA. If someone claims to be “support” or “admin” in DMs, it’s a scam.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Still have questions + CTAs */}
        <section className="mt-10 pt-8 border-t" style={{ borderColor: terminal.border }}>
          <p className="text-sm mb-4" style={{ color: terminal.dim }}>
            Can’t find what you need? Verify everything on-chain and use only official links from this site.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: terminal.accent, color: '#020806', boxShadow: '0 0 20px rgba(0,255,65,0.3)' }}
            >
              Back to game
            </Link>
            <a
              href={`https://jup.ag/swap/SOL-${PEPEBALL_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'rgba(0,255,65,0.15)', color: terminal.accent, border: `2px solid ${terminal.accentDim}` }}
            >
              Buy $PBALL (Jupiter)
            </a>
          </div>
        </section>

        <footer className="text-center text-[10px] sm:text-xs py-10" style={{ color: terminal.dim }}>
          All transactions are public and verifiable on Solana
        </footer>
      </main>
    </div>
  );
}
