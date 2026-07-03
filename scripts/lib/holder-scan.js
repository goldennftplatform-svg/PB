/**
 * Scan SPL token accounts for registry mints and aggregate balances per owner.
 */
const { PublicKey } = require('@solana/web3.js');
const { getIndexerConnection, getProgramAccountsRaw } = require('./indexer-rpc');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

function loadRegistryMints() {
  const fs = require('fs');
  const path = require('path');
  const fromEnv = process.env.REGISTRY_MINTS;
  if (fromEnv) {
    return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const trioPath = path.join(__dirname, '..', '..', 'devnet', 'trio-mints.json');
  if (fs.existsSync(trioPath)) {
    const trio = JSON.parse(fs.readFileSync(trioPath, 'utf8'));
    const m = trio.mints || {};
    const list = [m.master_mint, m.pump_shell_mint, m.trix_yang_mint, m.trix_bridge_mint].filter(Boolean);
    return [...new Set(list)];
  }
  const { getDevnetMint } = require('./devnet-config');
  const single = getDevnetMint();
  return single ? [single] : [];
}

function loadMintPrices(mints) {
  const staticUsd = Number(process.env.STATIC_USD_PER_TOKEN || '0.0001');
  const prices = {};
  for (const mint of mints) {
    const envKey = `MINT_PRICE_USD_${mint.slice(0, 8)}`;
    prices[mint] = Number(process.env[envKey] || process.env.MINT_PRICE_USD || staticUsd);
  }
  return prices;
}

function parseTokenAccount(data, mint) {
  const buf = Buffer.from(data);
  if (buf.length < 72) return null;
  const accountMint = new PublicKey(buf.subarray(0, 32));
  if (!accountMint.equals(mint)) return null;
  const owner = new PublicKey(buf.subarray(32, 64));
  const amount = buf.readBigUInt64LE(64);
  return { owner: owner.toBase58(), amount };
}

async function fetchMintTokenAccounts(rpcUrl, mintPubkey, programId) {
  const accounts = await getProgramAccountsRaw(rpcUrl, programId.toBase58(), [
    { dataSize: 165 },
    { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } },
  ]);
  const rows = [];
  for (const row of accounts) {
    const raw = row.account?.data?.[0] ?? row.account?.data;
    const data = typeof raw === 'string' ? Buffer.from(raw, 'base64') : Buffer.from(raw || []);
    const parsed = parseTokenAccount(data, mintPubkey);
    if (parsed && parsed.amount > 0n) rows.push(parsed);
  }
  return rows;
}

async function scanMintHolders(mint, { rpcUrl, connection }) {
  const mintPk = new PublicKey(mint);
  const decimals = Number(process.env.TOKEN_DECIMALS || '6');
  const divisor = 10 ** decimals;

  let accounts = [];
  try {
    accounts = await fetchMintTokenAccounts(rpcUrl, mintPk, TOKEN_PROGRAM_ID);
  } catch (e) {
    console.warn(`[holder-scan] Token program scan failed for ${mint}: ${e.message}`);
  }
  if (accounts.length === 0) {
    try {
      accounts = await fetchMintTokenAccounts(rpcUrl, mintPk, TOKEN_2022_PROGRAM_ID);
    } catch (e) {
      console.warn(`[holder-scan] Token-2022 scan failed for ${mint}: ${e.message}`);
    }
  }

  const byOwner = new Map();
  for (const { owner, amount } of accounts) {
    const ui = Number(amount) / divisor;
    byOwner.set(owner, (byOwner.get(owner) || 0) + ui);
  }
  return byOwner;
}

/**
 * @returns {Promise<Array<{ wallet: string, combinedUsdCents: number, tickets: number, balancesByMint: object }>>}
 */
async function scanQualifiedHolders(options = {}) {
  const mints = options.mints || loadRegistryMints();
  if (!mints.length) throw new Error('No registry mints configured (REGISTRY_MINTS or devnet/trio-mints.json)');

  const { connection, rpcUrl } = options.connection
    ? { connection: options.connection, rpcUrl: options.rpcUrl }
    : await getIndexerConnection();

  const prices = loadMintPrices(mints);
  const { ticketsFromUsdCents, combinedUsdCents } = require('./eligibility-tiers');
  const tiers = options.tiers;

  console.log(`[holder-scan] Mints: ${mints.join(', ')}`);
  console.log(`[holder-scan] RPC: ${rpcUrl.replace(/api-key=[^&]+/, 'api-key=***')}`);

  const walletBalances = new Map();

  for (const mint of mints) {
    console.log(`[holder-scan] Scanning ${mint}…`);
    const holders = await scanMintHolders(mint, { rpcUrl, connection });
    console.log(`[holder-scan]   ${holders.size} owners with balance`);
    for (const [owner, uiAmount] of holders) {
      if (!walletBalances.has(owner)) walletBalances.set(owner, {});
      walletBalances.get(owner)[mint] = uiAmount;
    }
  }

  const qualified = [];
  for (const [wallet, balancesByMint] of walletBalances) {
    const cents = combinedUsdCents(balancesByMint, prices);
    const tickets = ticketsFromUsdCents(cents, tiers);
    if (tickets > 0) {
      qualified.push({ wallet, combinedUsdCents: cents, tickets, balancesByMint });
    }
  }

  qualified.sort((a, b) => a.wallet.localeCompare(b.wallet));
  console.log(`[holder-scan] Qualified holders: ${qualified.length}`);
  return qualified;
}

module.exports = {
  loadRegistryMints,
  loadMintPrices,
  scanQualifiedHolders,
};
