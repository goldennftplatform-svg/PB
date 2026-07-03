import { Link } from 'react-router-dom';
import { PEPEBALL_MINT, INFO_SITE_URL } from '@/lib/constants';
import MatrixRain from './MatrixRain';
import WalletButton from './WalletButton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ExternalLink } from 'lucide-react';

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

const INFO_HUB_LINKS = [
  { href: `${INFO_SITE_URL}`, label: 'Info home', desc: 'Pitch, pillars, play CTA' },
  { href: `${INFO_SITE_URL}guides/rules.html`, label: 'Game rules', desc: 'ODD/EVEN, tiers, meme callouts' },
  { href: `${INFO_SITE_URL}guides/round-ledger.html`, label: 'Round ledger', desc: 'Fixed SOL commitment per draw' },
  { href: `${INFO_SITE_URL}leaderboard/`, label: 'Hall of Fame', desc: 'Verified winners on Solscan' },
  { href: `${INFO_SITE_URL}verify/`, label: 'Verify on-chain', desc: 'Programs, PDAs, public wallets' },
  { href: `${INFO_SITE_URL}guides/`, label: 'Guides', desc: 'How to play, devnet, liquidity' },
  { href: `${INFO_SITE_URL}guides/brand.html`, label: 'Brand kit', desc: 'Logos, colors, talking points' },
  { href: `${INFO_SITE_URL}community/`, label: 'Community', desc: 'Links and share copy' },
] as const;

const triggerClass = 'text-left hover:no-underline py-4 text-sm sm:text-base';

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
            <a
              href={INFO_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm font-medium px-3 py-2 rounded-lg transition-all hover:opacity-90 hidden sm:inline-flex"
              style={{ background: 'rgba(0,255,65,0.08)', color: terminal.accentDim, border: `1px solid ${terminal.border}` }}
            >
              Info hub
            </a>
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

        {/* PEPEBALL Info hub — GitHub Pages */}
        <section className="matrix-data-panel rounded-xl p-4 sm:p-6 mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: terminal.fontDisplay, color: terminal.gold }}>
              PEPEBALL info hub
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(0,255,65,0.12)', color: terminal.accentDim }}>
              GitHub Pages
            </span>
          </div>
          <p className="text-xs sm:text-sm mb-4 leading-relaxed" style={{ color: terminal.dim }}>
            Deep docs, verify links, Hall of Fame, and brand assets live on our public info site — same repo, always auditable.
          </p>
          <a
            href={INFO_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-xl font-semibold text-sm mb-5 transition-all hover:opacity-90"
            style={{ background: terminal.accent, color: '#020806', boxShadow: '0 0 20px rgba(0,255,65,0.25)' }}
          >
            Open info hub
            <ExternalLink className="w-4 h-4" aria-hidden />
          </a>
          <div className="grid gap-2 sm:grid-cols-2">
            {INFO_HUB_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="faq-info-card block group"
              >
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: terminal.accent, fontFamily: terminal.fontDisplay }}>
                  {item.label}
                  <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" aria-hidden />
                </span>
                <span className="text-[11px] mt-1 block leading-snug" style={{ color: terminal.dim }}>
                  {item.desc}
                </span>
              </a>
            ))}
          </div>
        </section>

        <section
          className="rounded-xl p-4 sm:p-5 mb-8 border-2"
          style={{ borderColor: terminal.gold, background: 'rgba(229, 184, 74, 0.06)' }}
        >
          <div className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: terminal.gold }}>
            Important legal disclaimer
          </div>
          <p className="text-xs sm:text-sm leading-relaxed" style={{ color: terminal.text }}>
            This platform is <strong style={{ color: terminal.gold }}>not</strong> affiliated with any government-run Powerball or official lottery. PEPEBALL is a memecoin and entertainment project on Solana. We are not connected to any state-sponsored drawing or the official Powerball game. This is a token-based draw for entertainment only and should not be construed as gambling in a legal sense. You are solely responsible for compliance with your local laws. Participate only if it is legal in your jurisdiction and only with funds you can afford to lose.
          </p>
        </section>

        <Accordion type="multiple" className="w-full faq-accordion space-y-0" defaultValue={['legal-1', 'how-1', 'info-hub']}>
          <AccordionItem value="info-hub" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              Where is the full documentation and verify page?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              The{' '}
              <a href={INFO_SITE_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>
                PEPEBALL info hub
              </a>{' '}
              on GitHub Pages has rules, round ledger explainers, Hall of Fame, on-chain verify links, devnet checklist, and brand kit. Use it to double-check program IDs and wallets before you buy or trust any link.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="legal-1" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              Are you affiliated with official Powerball or any government lottery?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              No. PEPEBALL is an independent Solana project. We use a similar “ball draw” theme for fun only. The draw and payouts are on-chain and have no connection to any government or official lottery.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="legal-2" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              Is this legal where I live?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              Laws vary by country and region. We do not provide legal advice. You must check your local laws before participating. If token-based draws or similar activities are restricted, do not participate.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="what" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              What is PEPEBALL?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              PEPEBALL is a Solana draw: hold game tokens at snapshot, win <strong style={{ color: terminal.accent }}>SOL</strong>. Combined USD across game mints: $20 = 1 ticket, $100 = 2, $500 = 4. <strong style={{ color: terminal.accent }}>Odd</strong> Pepe count = payout; <strong style={{ color: terminal.accent }}>even</strong> = rollover. Rare meme callout rounds pay a bonus token bag (64% / 4.25%×8 / 2% — 100% on ODD, no reserve). See{' '}
              <a href={`${INFO_SITE_URL}guides/rules.html`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>full rules</a>.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="how-1" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              How do I get tickets / entries?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              Hold game tokens at snapshot and register on-chain before the draw. Combined USD across mints: <strong style={{ color: terminal.accent }}>$20 = 1</strong>, <strong style={{ color: terminal.accent }}>$100 = 2</strong>, <strong style={{ color: terminal.accent }}>$500 = 4</strong> tickets. Swap on the main page or external DEX. The homepage shows how many wallets are registered vs qualifying holders.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="how-2" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              How does the draw work? What’s odd/even / rollover?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              Pepe ball count (1–30) from on-chain randomness. <strong style={{ color: terminal.accent }}>ODD = payout</strong> (winners paid in SOL). <strong style={{ color: terminal.accent }}>EVEN = rollover</strong> (jackpot grows, timer extends). SOL split on payout: 50% main, 8×5% minors, 8% rollover reserve, 2% dev. Verifiable on Solscan — see{' '}
              <a href={`${INFO_SITE_URL}verify/`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>verify page</a>.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="how-3" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              How often is the jackpot drawn?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              Draws run on a fixed interval (e.g. every 48–72 hours depending on config). The exact “next draw” time is shown on the main page. Rollovers extend the next draw time; after a payout we reset for the next round.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="winnings" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              How and when do I receive winnings?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              On <strong style={{ color: terminal.accent }}>odd</strong> (payout) rounds, winners receive <strong style={{ color: terminal.accent }}>SOL</strong> to their snapshot wallet (50% main, 8×5% minors). <strong style={{ color: terminal.accent }}>8%</strong> stays in the jackpot reserve; <strong style={{ color: terminal.accent }}>2%</strong> dev. On rare meme callout rounds, the token stash splits <strong style={{ color: terminal.accent }}>64% / 4.25%×8 / 2%</strong> — fully paid on ODD, no meme rollover slice. Verify every payout on{' '}
              <a href={`${INFO_SITE_URL}leaderboard/`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>Hall of Fame</a>.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="scams" className="border-0">
            <AccordionTrigger className={triggerClass} style={{ fontFamily: terminal.fontDisplay }}>
              How do I avoid scams?
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed pb-4" style={{ color: terminal.dim }}>
              Only use links from this app or the{' '}
              <a href={INFO_SITE_URL} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>official info hub</a>. We never DM you first or ask for your seed phrase. Verify the token mint and lottery program on the{' '}
              <a href={`${INFO_SITE_URL}verify/`} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: terminal.accentAlt }}>verify page</a>{' '}
              before buying. If someone claims to be “support” or “admin” in DMs, it’s a scam.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <section className="mt-10 pt-8 border-t" style={{ borderColor: terminal.border }}>
          <p className="text-sm mb-4" style={{ color: terminal.dim }}>
            Can’t find what you need? Use the info hub to verify on-chain and only trust official links.
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
              href={INFO_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'rgba(0,255,65,0.15)', color: terminal.accent, border: `2px solid ${terminal.accentDim}` }}
            >
              Info hub
              <ExternalLink className="w-4 h-4" aria-hidden />
            </a>
            <a
              href={`https://jup.ag/swap/SOL-${PEPEBALL_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: 'rgba(229,184,74,0.12)', color: terminal.gold, border: `1px solid ${terminal.gold}` }}
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
