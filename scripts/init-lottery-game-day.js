/**
 * Initialize lottery PDA with game-day admin (production path).
 *
 *   node scripts/init-lottery-game-day.js
 *   SOLANA_CLUSTER=devnet node scripts/init-lottery-game-day.js
 *   JACKPOT_SOL=5 SOLANA_CLUSTER=mainnet-beta node scripts/init-lottery-game-day.js
 *
 * Requires: anchor build (target/idl/lottery.json) OR run from WSL after build.
 * Admin signer: pepeball-game-day/private/admin-keypair.json
 *
 * If lottery already exists with a different admin, close it first (old admin key):
 *   LEGACY_ADMIN_KEYPAIR=~/.config/solana/id.json node scripts/reinit-lottery-game-day.js
 */

const fs = require('fs');
const path = require('path');
const anchor = require('@coral-xyz/anchor');
const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { loadKeypair } = require('./lib/game-day-wallet');

const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const CLUSTER = process.env.SOLANA_CLUSTER || 'devnet';
const RPC_URL =
  process.env.SOLANA_RPC ||
  process.env.RPC_URL ||
  (CLUSTER === 'mainnet-beta' ? clusterApiUrl('mainnet-beta') : clusterApiUrl('devnet'));

const JACKPOT_SOL = Number(process.env.JACKPOT_SOL || '10');
const ENTRY_MIN = Number(process.env.ENTRY_MIN_CENTS || '2000');
const TIER2_MIN = Number(process.env.TIER2_MIN_CENTS || '10000');
const TIER3_MIN = Number(process.env.TIER3_MIN_CENTS || '50000');

async function main() {
  console.log('\n═══ Initialize lottery (game-day admin) ═══\n');
  console.log('Cluster:', CLUSTER);
  console.log('RPC:', RPC_URL);
  console.log('Program:', LOTTERY_PROGRAM_ID.toBase58());

  const admin = loadKeypair('admin');
  console.log('Admin:', admin.publicKey.toBase58());
  console.log('Jackpot field:', JACKPOT_SOL, 'SOL');
  console.log('Tiers ($):', ENTRY_MIN / 100, '/', TIER2_MIN / 100, '/', TIER3_MIN / 100);
  console.log('Tickets: 1 / 2 / 4\n');

  const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
  if (!fs.existsSync(idlPath)) {
    console.error('IDL missing. Run: anchor build');
    console.error('On Windows use WSL — see docs/MAINNET_GO_LIVE_WSL.md');
    process.exit(1);
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  const program = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);

  const [lotteryPDA] = PublicKey.findProgramAddressSync([Buffer.from('lottery')], LOTTERY_PROGRAM_ID);
  console.log('Lottery PDA:', lotteryPDA.toBase58());

  const bal = await connection.getBalance(admin.publicKey);
  console.log('Admin balance:', (bal / LAMPORTS_PER_SOL).toFixed(4), 'SOL\n');
  if (bal < 0.05 * LAMPORTS_PER_SOL) {
    console.error('Fund admin wallet before init.');
    process.exit(1);
  }

  try {
    const existing = await program.account.lottery.fetch(lotteryPDA);
    const onAdmin = existing.admin.toBase58();
    console.log('Lottery already initialized.');
    console.log('  On-chain admin:', onAdmin);
    console.log('  Jackpot:', (existing.jackpotAmount.toNumber() / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
    console.log('  Active:', existing.isActive);
    if (onAdmin !== admin.publicKey.toBase58()) {
      console.error('\n❌ Admin mismatch — cannot re-init without close_lottery (old admin).');
      console.error('   Devnet: close with old admin, then re-run this script.');
      console.error('   Mainnet: use NEW program keypair → new PDA, or never init twice.');
      process.exit(1);
    }
    console.log('\n✅ Admin matches game-day wallet. Ready.\n');
    return;
  } catch {
    console.log('Initializing new lottery account…\n');
  }

  const tx = await program.methods
    .initializeLottery(
      new anchor.BN(Math.floor(JACKPOT_SOL * LAMPORTS_PER_SOL)),
      new anchor.BN(ENTRY_MIN),
      new anchor.BN(TIER2_MIN),
      new anchor.BN(TIER3_MIN)
    )
    .accounts({
      lottery: lotteryPDA,
      admin: admin.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log('✅ Initialized:', tx);
  const clusterQ = CLUSTER === 'mainnet-beta' ? '' : `?cluster=${CLUSTER}`;
  console.log(`   https://solscan.io/tx/${tx}${clusterQ}\n`);
  console.log('Fund lottery PDA with jackpot SOL if jackpot_amount is bookkeeping only.');
  console.log('Next: node scripts/run-game-day-preflight.js\n');
}

main().catch((e) => {
  console.error(e.message || e);
  if (e.logs) e.logs.forEach((l) => console.error(' ', l));
  process.exit(1);
});
