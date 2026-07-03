/**
 * Combined-USD ticket tiers (matches on-chain + docs/ROUND_LEDGER.md).
 */

const DEFAULT_TIERS = {
  entryMinCents: 2000,
  tier2MinCents: 10000,
  tier3MinCents: 50000,
};

function ticketsFromUsdCents(usdCents, tiers = DEFAULT_TIERS) {
  const { entryMinCents, tier2MinCents, tier3MinCents } = { ...DEFAULT_TIERS, ...tiers };
  if (usdCents < entryMinCents) return 0;
  if (usdCents < tier2MinCents) return 1;
  if (usdCents < tier3MinCents) return 2;
  return 4;
}

function usdToCents(usd) {
  return Math.round(Number(usd) * 100);
}

function combinedUsdCents(balancesByMint, usdPriceByMint) {
  let cents = 0;
  for (const [mint, rawAmount] of Object.entries(balancesByMint)) {
    const price = usdPriceByMint[mint] ?? 0;
    cents += usdToCents(Number(rawAmount) * price);
  }
  return cents;
}

module.exports = {
  DEFAULT_TIERS,
  ticketsFromUsdCents,
  usdToCents,
  combinedUsdCents,
};
