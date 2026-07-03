/**
 * Verify combined-USD ticket tiers (no chain required).
 * ODD/EVEN rule is separate (Pepe count on draw).
 *
 * Run: node scripts/verify-combined-eligibility.js
 */

function ticketsFromCombinedUsdCents(usdCents) {
  const entry = 2000;
  const tier2 = 10000;
  const tier3 = 50000;
  if (usdCents < entry) return 0;
  if (usdCents < tier2) return 1;
  if (usdCents < tier3) return 2;
  return 4;
}

function usdToCents(usd) {
  return Math.round(usd * 100);
}

const cases = [
  { label: 'Below minimum', balances: [10, 5, 4], prices: [1, 1, 1], expect: 0 },
  { label: '$20 in one mint', balances: [20, 0, 0], prices: [1, 1, 1], expect: 1 },
  { label: '$100 in one mint', balances: [100, 0, 0], prices: [1, 1, 1], expect: 2 },
  { label: '$500 in one mint', balances: [500, 0, 0], prices: [1, 1, 1], expect: 4 },
  { label: 'Smart split $200+$200+$100', balances: [200, 200, 100], prices: [1, 1, 1], expect: 4 },
  { label: 'Naive $500 each ($1500) — no stack', balances: [500, 500, 500], prices: [1, 1, 1], expect: 4 },
  { label: 'Mixed prices', balances: [100, 50, 50], prices: [1, 2, 1], expect: 2 },
];

function combinedUsd(balances, prices) {
  return balances.reduce((s, b, i) => s + b * prices[i], 0);
}

let failed = 0;
console.log('\nCombined eligibility verifier\n');

for (const c of cases) {
  const usd = combinedUsd(c.balances, c.prices);
  const got = ticketsFromCombinedUsdCents(usdToCents(usd));
  const ok = got === c.expect;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${c.label}: $${usd} → ${got} tickets (expected ${c.expect})`);
}

console.log('\nDraw rule (Pepe count 1–30): ODD = payout, EVEN = rollover\n');

const pepeCases = [
  { count: 1, payout: true },
  { count: 2, payout: false },
  { count: 29, payout: true },
  { count: 30, payout: false },
];
for (const p of pepeCases) {
  const isPayout = p.count % 2 === 1;
  const ok = isPayout === p.payout;
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} Pepe ${p.count} → ${isPayout ? 'PAYOUT' : 'ROLLOVER'}`);
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll cases passed.\n');
