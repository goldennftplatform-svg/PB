/**
 * Harmonized drip: sell tax tokens → SOL in small random chunks (chart-friendly).
 * Devnet: Orca Whirlpool. Mainnet: set USE_JUPITER=1 when Jupiter route exists.
 *
 * Usage:
 *   node scripts/harmonized-drip-settlement.js
 *   node scripts/harmonized-drip-settlement.js --dry-run
 *
 * Cron: every 15–30 min on game-day jackpot_tax wallet.
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { getRpcConnection } = require('./lib/get-rpc-connection');
const { loadKeypair } = require('./lib/game-day-wallet');
const { getDevnetMint, getOgPool } = require('./lib/devnet-config');
const { sellTokensForSol } = require('./lib/orca-swap-sell');
const {
  TOKEN_MINT_ADDRESS,
  TAX_RECIPIENT_ADDRESS,
  JACKPOT_SOL_DESTINATION_MAINNET,
  TOKEN_DECIMALS,
} = require('./lib/token-config');

const DRY_RUN = process.argv.includes('--dry-run');
const DRIP_MIN_BALANCE_RAW = BigInt(process.env.DRIP_MIN_BALANCE_RAW || '1000000');
const DRIP_PERCENT_BPS = BigInt(process.env.DRIP_PERCENT_BPS || '1000');
const DRIP_MAX_CHUNK_RAW = BigInt(process.env.DRIP_MAX_CHUNK_RAW || '50000000000');
const DRIP_RANDOM_MIN = Number(process.env.DRIP_RANDOM_MIN || '80');
const DRIP_RANDOM_MAX = Number(process.env.DRIP_RANDOM_MAX || '120');

const HARVEST_LOG = path.join(__dirname, '..', 'devnet', 'fee-harvest-log.jsonl');

function randomFactor() {
  return DRIP_RANDOM_MIN / 100 + Math.random() * ((DRIP_RANDOM_MAX - DRIP_RANDOM_MIN) / 100);
}

function resolveMint() {
  return getDevnetMint() || TOKEN_MINT_ADDRESS;
}

function resolveTaxWallet() {
  try {
    return loadKeypair('jackpot_tax');
  } catch {
    throw new Error('Need jackpot_tax wallet in pepeball-game-day/private/');
  }
}

async function readTokenBalance(connection, owner, mintPk, isToken2022) {
  const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  try {
    const ata = await getAssociatedTokenAddress(mintPk, owner, false, programId);
    const acc = await getAccount(connection, ata, undefined, programId);
    return { raw: acc.amount, ata: ata.toBase58() };
  } catch {
    return { raw: 0n, ata: null };
  }
}

async function jupiterSwap(connection, keypair, inputMint, amountRaw) {
  const slippageBps = Number(process.env.SLIPPAGE_BPS || '1000');
  const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=So11111111111111111111111111111111111111112&amount=${amountRaw}&slippageBps=${slippageBps}`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) throw new Error(`Jupiter quote failed: ${quoteRes.status}`);
  const quote = await quoteRes.json();
  const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: keypair.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
    }),
  });
  if (!swapRes.ok) throw new Error(`Jupiter swap failed: ${swapRes.status}`);
  const { swapTransaction } = await swapRes.json();
  const { VersionedTransaction } = require('@solana/web3.js');
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
  tx.sign([keypair]);
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return { sig, outLamports: quote.outAmount };
}

function appendHarvestLog(entry) {
  fs.mkdirSync(path.dirname(HARVEST_LOG), { recursive: true });
  fs.appendFileSync(HARVEST_LOG, JSON.stringify(entry) + '\n', 'utf8');
}

async function main() {
  const mintStr = resolveMint();
  const mintPk = new PublicKey(mintStr);
  const taxWallet = resolveTaxWallet();
  const isDevnet = (process.env.SOLANA_RPC || '').includes('devnet') || process.env.TAROBASE_ENV === 'devnet' || !process.env.RPC_URL?.includes('mainnet');
  const connection = isDevnet
    ? new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed')
    : await getRpcConnection();

  const mintInfo = await connection.getAccountInfo(mintPk);
  const isToken2022 = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID);

  const { raw: balanceRaw, ata } = await readTokenBalance(connection, taxWallet.publicKey, mintPk, isToken2022);
  const balanceHuman = Number(balanceRaw) / 10 ** TOKEN_DECIMALS;

  console.log('\n═══ Harmonized drip settlement ═══\n');
  console.log('Tax wallet:', taxWallet.publicKey.toBase58());
  console.log('Mint:', mintStr, isToken2022 ? '(Token-2022)' : '(SPL)');
  console.log('Token ATA:', ata || 'none');
  console.log('Balance:', balanceHuman.toFixed(4), 'tokens');

  if (balanceRaw < DRIP_MIN_BALANCE_RAW) {
    console.log(`Below min (${DRIP_MIN_BALANCE_RAW} raw). Run withdraw-token2022-fees.js or wait for tax.`);
    return;
  }

  const baseChunk = (balanceRaw * DRIP_PERCENT_BPS) / 10000n;
  const capped = baseChunk > DRIP_MAX_CHUNK_RAW ? DRIP_MAX_CHUNK_RAW : baseChunk;
  const dripRaw = BigInt(Math.floor(Number(capped) * randomFactor()));
  if (dripRaw <= 0n) {
    console.log('Chunk too small after random factor.');
    return;
  }

  console.log(`Drip chunk: ${(Number(dripRaw) / 10 ** TOKEN_DECIMALS).toFixed(4)} tokens`);

  if (DRY_RUN) {
    console.log('[dry-run] would swap chunk → SOL');
    return;
  }

  const solBefore = await connection.getBalance(taxWallet.publicKey);
  let sig;
  let route = 'orca';

  if (process.env.USE_JUPITER === '1' && !isDevnet) {
    route = 'jupiter';
    const r = await jupiterSwap(connection, taxWallet, mintStr, dripRaw.toString());
    sig = r.sig;
  } else {
    const pool = getOgPool();
    const r = await sellTokensForSol({
      walletSecret: Uint8Array.from(taxWallet.secretKey),
      tokenMint: mintStr,
      poolAddress: pool,
      amountRaw: dripRaw,
    });
    sig = r.sig;
    route = 'orca';
  }

  const solAfter = await connection.getBalance(taxWallet.publicKey);
  const solDelta = (solAfter - solBefore) / LAMPORTS_PER_SOL;

  const entry = {
    at: new Date().toISOString(),
    route,
    mint: mintStr,
    tokenSoldRaw: dripRaw.toString(),
    solReceivedApprox: solDelta,
    tx: sig,
    taxWallet: taxWallet.publicKey.toBase58(),
    jackpotDest: JACKPOT_SOL_DESTINATION_MAINNET,
  };
  appendHarvestLog(entry);

  console.log(`\n✅ ${route} swap tx:`, sig);
  console.log(`SOL balance change: ~${solDelta.toFixed(6)} SOL`);
  console.log('Logged:', HARVEST_LOG);

  if (taxWallet.publicKey.toBase58() !== JACKPOT_SOL_DESTINATION_MAINNET) {
    console.log('\nDifferent tax vs jackpot wallet — run: node scripts/send-sol-to-jackpot.js');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
