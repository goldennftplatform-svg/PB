const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function getDevnetMint() {
  if (process.env.PEPEBALL_MINT || process.env.VITE_PEPEBALL_MINT) {
    return process.env.PEPEBALL_MINT || process.env.VITE_PEPEBALL_MINT;
  }
  const taxed = readJson(path.join(ROOT, 'devnet', 'taxed-master-mint.json'));
  if (taxed?.mint) return taxed.mint;
  const trio = readJson(path.join(ROOT, 'devnet', 'trio-mints.json'));
  return trio?.mints?.master_mint ?? null;
}

function getOgPool() {
  const lp = readJson(path.join(ROOT, 'devnet', 'lp-pools.json'));
  const taxed = readJson(path.join(ROOT, 'devnet', 'taxed-master-mint.json'));
  if (taxed?.mint && lp?.pools?.sol_taxed?.tokenMint === taxed.mint) {
    return lp.pools.sol_taxed.orca_whirlpool;
  }
  return lp?.pools?.sol_og?.orca_whirlpool ?? '9uBz1CqDNBzDdMgHpwEFbaoYLYKEZv9U7jWetKLgDoZj';
}

function getJackpotTaxPubkey() {
  const { loadKeypair } = require('./game-day-wallet');
  try {
    return loadKeypair('jackpot_tax').publicKey.toBase58();
  } catch {
    return process.env.VITE_TAX_RECIPIENT || process.env.TAX_RECIPIENT_ADDRESS || null;
  }
}

module.exports = { getDevnetMint, getOgPool, getJackpotTaxPubkey, readJson };
