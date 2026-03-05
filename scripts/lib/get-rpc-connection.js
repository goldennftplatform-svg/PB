/**
 * Get a Solana Connection using the first working RPC from a fallback list.
 * Reduces single-point-of-failure when Helius (or one provider) is down.
 *
 * Usage:
 *   const { getRpcConnection, getRpcUrl } = require('./lib/get-rpc-connection');
 *   const connection = await getRpcConnection();
 *   // or
 *   const url = await getRpcUrl();
 */

const { Connection } = require('@solana/web3.js');

function getRpcCandidates() {
  const candidates = [];
  if (process.env.RPC_URL) candidates.push(process.env.RPC_URL);
  if (process.env.HELIUS_RPC_URL) candidates.push(process.env.HELIUS_RPC_URL);
  if (process.env.RPC_FALLBACK_URL) candidates.push(process.env.RPC_FALLBACK_URL);
  if (process.env.VITE_RPC_URL) candidates.push(process.env.VITE_RPC_URL);
  // Public fallbacks (no API key)
  candidates.push('https://api.mainnet.solana.com');
  return [...new Set(candidates)];
}

async function checkRpc(url) {
  try {
    const c = new Connection(url, 'confirmed');
    await c.getSlot();
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the first RPC URL that responds. Use this to build your own Connection.
 * @returns {Promise<string>}
 */
async function getRpcUrl() {
  const candidates = getRpcCandidates();
  for (const url of candidates) {
    if (await checkRpc(url)) return url;
    console.warn('RPC failed, trying next:', url);
  }
  return candidates[0];
}

/**
 * Returns a Connection using the first working RPC. Use for payout scripts.
 * @returns {Promise<Connection>}
 */
async function getRpcConnection() {
  const url = await getRpcUrl();
  return new Connection(url, 'confirmed');
}

module.exports = { getRpcConnection, getRpcUrl, getRpcCandidates };
