/**
 * Close devnet lottery (legacy admin) and re-init with game-day admin.
 *
 *   node scripts/reinit-lottery-game-day.js
 *   SOLANA_CLUSTER=devnet node scripts/reinit-lottery-game-day.js
 *
 * Legacy close signer: ~/.config/solana/id.json (must match on-chain lottery.admin)
 * Init signer: pepeball-game-day/private/admin-keypair.json
 */

const fs = require('fs');
const path = require('path');
const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} = require('@solana/web3.js');
const {
  fetchLottery,
  closeLotteryRaw,
  initializeLotteryRaw,
  LOTTERY_PDA,
} = require('./lib/lottery-raw');
const { loadKeypair } = require('./lib/game-day-wallet');

const CLUSTER = process.env.SOLANA_CLUSTER || 'devnet';
const RPC_URL =
  process.env.SOLANA_RPC ||
  process.env.RPC_URL ||
  (CLUSTER === 'mainnet-beta' ? clusterApiUrl('mainnet-beta') : clusterApiUrl('devnet'));

const JACKPOT_SOL = Number(process.env.JACKPOT_SOL || '10');
const ENTRY_MIN = Number(process.env.ENTRY_MIN_CENTS || '2000');
const TIER2_MIN = Number(process.env.TIER2_MIN_CENTS || '10000');
const TIER3_MIN = Number(process.env.TIER3_MIN_CENTS || '50000');
const FUND_ADMIN_SOL = Number(process.env.FUND_ADMIN_SOL || '0.15');

function loadLegacyAdmin() {
  const walletPath =
    process.env.LEGACY_ADMIN_KEYPAIR ||
    process.env.ANCHOR_WALLET ||
    path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'solana', 'id.json');
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Legacy admin keypair missing: ${walletPath}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
}

async function fundIfNeeded(connection, from, to, minLamports) {
  const bal = await connection.getBalance(to);
  if (bal >= minLamports) return null;
  const need = minLamports - bal;
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: need,
    })
  );
  const sig = await connection.sendTransaction(tx, [from], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function main() {
  console.log('\n═══ Close + re-init lottery (game-day admin) ═══\n');
  console.log('Cluster:', CLUSTER);

  const connection = new Connection(RPC_URL, 'confirmed');
  const legacyAdmin = loadLegacyAdmin();
  const gameDayAdmin = loadKeypair('admin');

  console.log('Legacy close admin:', legacyAdmin.publicKey.toBase58());
  console.log('Game-day admin:   ', gameDayAdmin.publicKey.toBase58());
  console.log('Lottery PDA:      ', LOTTERY_PDA.toBase58());
  console.log('Jackpot field:    ', JACKPOT_SOL, 'SOL\n');

  let lotteryExists = false;
  try {
    const { fields } = await fetchLottery(connection);
    lotteryExists = true;
    console.log('Current on-chain admin:', fields.admin);
    console.log('Jackpot lamports:', fields.jackpotLamports);
    console.log('Participants:', fields.totalParticipants, '\n');

    if (fields.admin === gameDayAdmin.publicKey.toBase58()) {
      console.log('✅ Already on game-day admin. Nothing to close.\n');
      return;
    }

    if (fields.admin !== legacyAdmin.publicKey.toBase58()) {
      throw new Error(
        `On-chain admin ${fields.admin} does not match legacy key ${legacyAdmin.publicKey.toBase58()}`
      );
    }

    console.log('Closing lottery (rent + jackpot lamports → legacy admin)…');
    const closeTx = await closeLotteryRaw(connection, legacyAdmin);
    console.log('✅ Closed:', closeTx);
    const clusterQ = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
    console.log(`   https://solscan.io/tx/${closeTx}${clusterQ}\n`);
  } catch (e) {
    if (lotteryExists) throw e;
    console.log('Lottery PDA not found — fresh init.\n');
  }

  const fundSig = await fundIfNeeded(
    connection,
    legacyAdmin,
    gameDayAdmin.publicKey,
    Math.floor(FUND_ADMIN_SOL * LAMPORTS_PER_SOL)
  );
  if (fundSig) {
    console.log('Funded game-day admin:', fundSig);
  }

  const adminBal = await connection.getBalance(gameDayAdmin.publicKey);
  console.log('Game-day admin balance:', (adminBal / LAMPORTS_PER_SOL).toFixed(4), 'SOL\n');
  if (adminBal < 0.05 * LAMPORTS_PER_SOL) {
    throw new Error('Game-day admin still underfunded for init');
  }

  console.log('Initializing lottery with game-day admin…');
  const initTx = await initializeLotteryRaw(
    connection,
    gameDayAdmin,
    Math.floor(JACKPOT_SOL * LAMPORTS_PER_SOL),
    ENTRY_MIN,
    TIER2_MIN,
    TIER3_MIN
  );
  console.log('✅ Initialized:', initTx);
  const clusterQ = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
  console.log(`   https://solscan.io/tx/${initTx}${clusterQ}\n`);

  const { fields } = await fetchLottery(connection);
  console.log('Verified admin:', fields.admin);
  console.log('Jackpot field:', fields.jackpotSol, 'SOL');
  console.log('\nNext: anchor deploy (hardened binary), fund jackpot_tax, then:');
  console.log('  node scripts/run-game-day-preflight.js\n');
}

main().catch((e) => {
  console.error(e.message || e);
  if (e.logs) e.logs.forEach((l) => console.error(' ', l));
  process.exit(1);
});
