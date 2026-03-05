/**
 * Send SOL from the tax-recipient wallet (3X36... token proceeds + any manual top-up like 0.01)
 * to the jackpot destination so the lottery payout can run.
 *
 * Requires: keypair that owns TAX_RECIPIENT_ADDRESS (the wallet you sent 0.01 SOL to).
 *   KEYPAIR_PATH=/path/to/keypair.json   or   TAX_RECIPIENT_KEYPAIR=path
 * Optional: AMOUNT_SOL=0.01  (default: all but ~0.001 for rent), RPC_URL, JACKPOT_SOL_DESTINATION_MAINNET
 *
 * Usage: node scripts/send-sol-to-jackpot.js [--dry-run]
 */

const { Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { getRpcConnection } = require('./lib/get-rpc-connection');
const fs = require('fs');
const path = require('path');

const TAX_RECIPIENT_ADDRESS = 'FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje';
const JACKPOT_SOL_DESTINATION_MAINNET = process.env.JACKPOT_SOL_DESTINATION_MAINNET || 'FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje';
const TOKEN_MINT_ADDRESS = '3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump';

const LAMPORTS_PER_SOL = 1e9;
const RENT_RESERVE_LAMPORTS = 5000; // leave a bit so account stays rent-exempt

const DRY_RUN = process.argv.includes('--dry-run');

function getKeypairPath() {
  if (process.env.TAX_RECIPIENT_KEYPAIR) return process.env.TAX_RECIPIENT_KEYPAIR;
  if (process.env.KEYPAIR_PATH) return process.env.KEYPAIR_PATH;
  const home = process.env.HOME || process.env.USERPROFILE;
  return path.join(home, '.config', 'solana', 'id.json');
}

async function main() {
  const connection = await getRpcConnection();
  const keypairPath = getKeypairPath();

  if (!fs.existsSync(keypairPath)) {
    console.error('Keypair not found at:', keypairPath);
    console.error('Set TAX_RECIPIENT_KEYPAIR or KEYPAIR_PATH to the wallet that holds the SOL (tax recipient).');
    process.exit(1);
  }

  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf8'))));
  const senderPubkey = keypair.publicKey.toString();
  if (senderPubkey !== TAX_RECIPIENT_ADDRESS) {
    console.warn(`Warning: keypair address ${senderPubkey} does not match TAX_RECIPIENT_ADDRESS ${TAX_RECIPIENT_ADDRESS}. Proceeding anyway.`);
  }

  const destPubkey = new PublicKey(JACKPOT_SOL_DESTINATION_MAINNET);
  const balance = await connection.getBalance(keypair.publicKey);
  const amountLamports = process.env.AMOUNT_SOL
    ? Math.floor(parseFloat(process.env.AMOUNT_SOL) * LAMPORTS_PER_SOL)
    : Math.max(0, balance - RENT_RESERVE_LAMPORTS);

  console.log('Tax recipient (sender):', senderPubkey);
  console.log('Jackpot destination:   ', JACKPOT_SOL_DESTINATION_MAINNET);
  console.log('Token mint (3X36...):  ', TOKEN_MINT_ADDRESS);
  console.log('Balance (lamports):    ', balance, `(${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
  console.log('Send amount (lamports):', amountLamports, `(${(amountLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);

  if (amountLamports <= 0) {
    console.error('Nothing to send (balance too low or AMOUNT_SOL=0).');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('\n[DRY-RUN] Would send', (amountLamports / LAMPORTS_PER_SOL).toFixed(6), 'SOL to jackpot. Run without --dry-run to execute.');
    return;
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: destPubkey,
      lamports: amountLamports,
    })
  );

  const sig = await connection.sendTransaction(tx, [keypair], { skipPreflight: false, preflightCommitment: 'confirmed' });
  console.log('\nSent SOL to jackpot.');
  console.log('Tx:', sig);
  console.log('Explorer: https://solscan.io/tx/' + sig);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
