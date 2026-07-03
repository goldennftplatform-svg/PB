/**
 * RPC client for indexer jobs — paid Helius/QuickNode URL from env, with fallbacks.
 */
const { Connection, clusterApiUrl } = require('@solana/web3.js');

function cluster() {
  return process.env.SOLANA_CLUSTER || process.env.CLUSTER || 'devnet';
}

function getRpcCandidates() {
  const candidates = [];
  if (process.env.RPC_URL) candidates.push(process.env.RPC_URL);
  if (process.env.HELIUS_RPC_URL) candidates.push(process.env.HELIUS_RPC_URL);
  if (process.env.HELIUS_API_KEY) {
    const c = cluster();
    const host = c === 'mainnet-beta' || c === 'mainnet' ? 'mainnet.helius-rpc.com' : 'devnet.helius-rpc.com';
    candidates.push(`https://${host}/?api-key=${process.env.HELIUS_API_KEY}`);
  }
  if (process.env.RPC_FALLBACK_URL) candidates.push(process.env.RPC_FALLBACK_URL);
  candidates.push(clusterApiUrl(cluster()));
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

async function getRpcUrl() {
  const candidates = getRpcCandidates();
  for (const url of candidates) {
    if (await checkRpc(url)) return url;
    console.warn('[indexer-rpc] RPC failed, trying next:', url.replace(/api-key=[^&]+/, 'api-key=***'));
  }
  return candidates[0];
}

async function getIndexerConnection() {
  const url = await getRpcUrl();
  return { connection: new Connection(url, 'confirmed'), rpcUrl: url };
}

/**
 * getProgramAccounts via JSON-RPC fetch (works well with Helius).
 */
async function getProgramAccountsRaw(rpcUrl, programId, filters) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getProgramAccounts',
    params: [
      programId,
      {
        filters,
        encoding: 'base64',
      },
    ],
  };
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result || [];
}

module.exports = {
  cluster,
  getRpcCandidates,
  getRpcUrl,
  getIndexerConnection,
  getProgramAccountsRaw,
};
