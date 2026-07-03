/**
 * One-screen tax pipeline status + what to run next.
 *   node scripts/tax-pipeline-status.js
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount, getMint, getTransferFeeConfig, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { getDevnetMint, getOgPool, readJson } = require('./lib/devnet-config');
const { loadKeypair } = require('./lib/game-day-wallet');
const { TOKEN_TAX_BPS } = require('./lib/token-config');

async function main() {
  const rpc = process.env.SOLANA_RPC || clusterApiUrl('devnet');
  const connection = new Connection(rpc, 'confirmed');
  const taxedFile = path.join(__dirname, '..', 'devnet', 'taxed-master-mint.json');
  const taxed = readJson(taxedFile);
  const mintStr = getDevnetMint();
  const pool = getOgPool();

  console.log('\n═══ Tax pipeline status ═══\n');

  let jackpot;
  try {
    jackpot = loadKeypair('jackpot_tax');
    const sol = await connection.getBalance(jackpot.publicKey);
    console.log('jackpot_tax:', jackpot.publicKey.toBase58());
    console.log('  SOL:', (sol / LAMPORTS_PER_SOL).toFixed(4));
  } catch (e) {
    console.log('jackpot_tax: MISSING —', e.message);
    return;
  }

  if (!mintStr) {
    console.log('\n❌ No mint configured.');
    console.log('  → node scripts/create-devnet-taxed-master-mint.js');
    return;
  }

  console.log('\nActive mint:', mintStr);
  console.log('Orca SOL/OG pool:', pool);

  const mintPk = new PublicKey(mintStr);
  const info = await connection.getAccountInfo(mintPk);
  const is2022 = info?.owner.equals(TOKEN_2022_PROGRAM_ID);
  console.log('Token type:', is2022 ? 'Token-2022 ✅ (auto buy/sell tax)' : 'Plain SPL ⚠️ (no DEX tax)');

  if (is2022) {
    try {
      const m = await getMint(connection, mintPk, undefined, TOKEN_2022_PROGRAM_ID);
      const fc = getTransferFeeConfig(m);
      console.log('Transfer fee:', fc.newerTransferFee.transferFeeBasisPoints, 'bps');
      console.log('Withheld on mint (raw):', fc.withheldAmount.toString());
      console.log('Withdraw authority:', fc.withdrawWithheldAuthority.toBase58());
    } catch (e) {
      console.log('Fee config:', e.message);
    }
  }

  const programId = is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  try {
    const ata = await getAssociatedTokenAddress(mintPk, jackpot.publicKey, false, programId);
    const acc = await getAccount(connection, ata, undefined, programId);
    console.log('Tax wallet tokens:', (Number(acc.amount) / 1e6).toFixed(4));
  } catch {
    console.log('Tax wallet tokens: 0 (no ATA)');
  }

  const harvestLog = path.join(__dirname, '..', 'devnet', 'fee-harvest-log.jsonl');
  if (fs.existsSync(harvestLog)) {
    const lines = fs.readFileSync(harvestLog, 'utf8').trim().split('\n');
    console.log('Drip harvests logged:', lines.length);
  }

  console.log('\n── Run order (devnet) ──');
  if (!taxed && !is2022) {
    console.log('1. npm run tax:mint    # Token-2022 @ 250 bps');
    console.log('2. npm run tax:pool    # Orca SOL/TAXED pool');
  }
  console.log('• node scripts/devnet-twenty-wallet-tax-rehearsal.js   # buy/sell → withheld fees');
  console.log('• npm run tax:withdraw                                 # harvest → jackpot ATA');
  console.log('• npm run tax:drip                                     # token → SOL drip');
  console.log('• cron tax:drip every 15–30 min\n');

  console.log('Docs: HARMONIZED_SETTLEMENT.md · docs/DEPLOY_MINT_TAX_AUTOMATION.md\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
