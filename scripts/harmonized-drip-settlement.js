/**
 * Harmonized drip settlement: when tax accumulates in token, sell in small
 * random chunks (token → SOL) and send SOL to jackpot. Market-makes a little
 * so we don't dump and help the chart.
 *
 * Run on a cron (e.g. every 15–30 min). Set ADMIN_KEYPAIR path or use default.
 *
 * Usage: node scripts/harmonized-drip-settlement.js [--dry-run]
 */

const { PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');
const { getRpcConnection } = require('./lib/get-rpc-connection');
const { TOKEN_MINT_ADDRESS, TAX_RECIPIENT_ADDRESS, JACKPOT_SOL_DESTINATION_MAINNET } = require('./lib/token-config');
const TOKEN_DECIMALS = require('./lib/token-config').TOKEN_DECIMALS;
const DRIP_MIN_BALANCE_RAW = Number(process.env.DRIP_MIN_BALANCE_RAW || '10000000');   // ~10 tokens
const DRIP_PERCENT_BPS = Number(process.env.DRIP_PERCENT_BPS || '1000');              // 10%
const DRIP_MAX_CHUNK_RAW = Number(process.env.DRIP_MAX_CHUNK_RAW || '100000000');     // ~100 tokens
const DRIP_RANDOM_MIN = Number(process.env.DRIP_RANDOM_MIN || '80');                  // 0.8x
const DRIP_RANDOM_MAX = Number(process.env.DRIP_RANDOM_MAX || '120');                 // 1.2x

const DRY_RUN = process.argv.includes('--dry-run');

function randomFactor() {
  const min = DRIP_RANDOM_MIN / 100;
  const max = DRIP_RANDOM_MAX / 100;
  return min + Math.random() * (max - min);
}

async function main() {
  const connection = await getRpcConnection();
  const mint = new PublicKey(TOKEN_MINT_ADDRESS);
  const taxRecipient = new PublicKey(TAX_RECIPIENT_ADDRESS);

  const ata = await getAssociatedTokenAddress(mint, taxRecipient, false);
  let balanceRaw = 0;
  try {
    const account = await getAccount(connection, ata);
    balanceRaw = Number(account.amount.toString());
  } catch (e) {
    if (e.name === 'TokenAccountNotFoundError' || e.message?.includes('could not find account')) {
      console.log('No token account for tax recipient yet. Balance = 0.');
    } else {
      throw e;
    }
  }

  const balanceTokens = balanceRaw / Math.pow(10, TOKEN_DECIMALS);
  console.log(`Tax recipient token balance: ${balanceTokens.toFixed(2)} (raw: ${balanceRaw})`);

  if (balanceRaw < DRIP_MIN_BALANCE_RAW) {
    console.log(`Below min drip threshold (${DRIP_MIN_BALANCE_RAW}). Skip.`);
    return;
  }

  const percent = DRIP_PERCENT_BPS / 10000;
  const baseChunk = Math.floor(balanceRaw * percent);
  const cappedChunk = Math.min(baseChunk, DRIP_MAX_CHUNK_RAW);
  const factor = randomFactor();
  const dripChunkRaw = Math.floor(cappedChunk * factor);
  const dripChunkTokens = dripChunkRaw / Math.pow(10, TOKEN_DECIMALS);

  console.log(`Drip chunk: ${dripChunkTokens.toFixed(2)} tokens (raw: ${dripChunkRaw}, factor: ${factor.toFixed(2)}x)`);

  if (DRY_RUN) {
    console.log('[DRY-RUN] Would swap token → SOL via Jupiter, send SOL to jackpot:', JACKPOT_SOL_DESTINATION_MAINNET);
    console.log('Chunk to sell (raw):', dripChunkRaw);
    return;
  }

  // Flow: (1) Jupiter swap TOKEN_MINT → SOL from taxRecipient. (2) Send received SOL to JACKPOT_SOL_DESTINATION_MAINNET (see send-sol-to-jackpot.js for manual SOL forward).
  // TODO: Jupiter swap token → SOL, then SystemProgram.transfer to JACKPOT_SOL_DESTINATION_MAINNET, then setFeeHarvests.
  console.log('Chunk to sell (raw):', dripChunkRaw);
  console.log('SOL destination (jackpot):', JACKPOT_SOL_DESTINATION_MAINNET);
  console.log('To forward existing SOL from tax wallet now: node scripts/send-sol-to-jackpot.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
