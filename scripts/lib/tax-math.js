/**
 * PEPEBALL buy/sell tax — 2.5% total (0.05% creator + 2.45% jackpot).
 * Tax applies on the token leg of each trade (standard meme / Token-2022 model).
 */

const { TOKEN_TAX_BPS } = require('./token-config');

const CREATOR_BPS = 5;
const JACKPOT_BPS = TOKEN_TAX_BPS - CREATOR_BPS; // 245 when TOKEN_TAX_BPS=250

function taxOnTokenRaw(grossRaw) {
  const gross = BigInt(grossRaw);
  const creator = (gross * BigInt(CREATOR_BPS)) / 10000n;
  const jackpot = (gross * BigInt(JACKPOT_BPS)) / 10000n;
  const total = creator + jackpot;
  return {
    creatorTaxRaw: creator,
    jackpotTaxRaw: jackpot,
    totalTaxRaw: total,
    netRaw: gross - total,
  };
}

/** Buy: user receives net tokens; tax was withheld from gross pool output */
function expectedBuyTaxFromNetReceived(netRaw) {
  const net = BigInt(netRaw);
  if (net <= 0n) return { creatorTaxRaw: 0n, jackpotTaxRaw: 0n, totalTaxRaw: 0n, netRaw: 0n, grossRaw: 0n };
  const gross = (net * 10000n) / (10000n - BigInt(TOKEN_TAX_BPS));
  const tax = taxOnTokenRaw(gross);
  return { ...tax, grossRaw: gross };
}

/** @deprecated use expectedBuyTaxFromNetReceived when measuring wallet balance */
function expectedBuyTax(tokensOutGrossRaw) {
  return taxOnTokenRaw(tokensOutGrossRaw);
}

/** Sell: tax on tokens the seller sends into the pool */
function expectedSellTax(tokensInRaw) {
  return taxOnTokenRaw(tokensInRaw);
}

function formatBps(bps) {
  return `${(bps / 100).toFixed(2)}%`;
}

module.exports = {
  TOKEN_TAX_BPS,
  CREATOR_BPS,
  JACKPOT_BPS,
  taxOnTokenRaw,
  expectedBuyTaxFromNetReceived,
  expectedBuyTax,
  expectedSellTax,
  formatBps,
};
