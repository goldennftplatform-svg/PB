/**

 * Withdraw Token-2022 withheld transfer fees → jackpot_tax token ATA.

 * Harvests from rehearsal wallet ATAs (and any account with withheld balance), then withdraws.

 *

 * Usage:

 *   node scripts/withdraw-token2022-fees.js

 *   node scripts/withdraw-token2022-fees.js --dry-run

 */



const fs = require('fs');

const path = require('path');

const {

  Connection,

  Keypair,

  PublicKey,

  SystemProgram,

  Transaction,

  sendAndConfirmTransaction,

  clusterApiUrl,

  LAMPORTS_PER_SOL,

} = require('@solana/web3.js');

const {

  TOKEN_2022_PROGRAM_ID,

  getAssociatedTokenAddress,

  createAssociatedTokenAccountInstruction,

  getAccount,

  getMint,

  getTransferFeeConfig,

  getTransferFeeAmount,

  unpackAccount,

  harvestWithheldTokensToMint,

  withdrawWithheldTokensFromMint,

} = require('@solana/spl-token');

const { loadKeypair } = require('./lib/game-day-wallet');

const { getDevnetMint } = require('./lib/devnet-config');



const DRY_RUN = process.argv.includes('--dry-run');

const MANIFEST = path.join(__dirname, '..', 'devnet', 'tax-test-manifest.json');

const WALLET_DIR = path.join(__dirname, '..', 'devnet', 'tax-test-wallets');



function loadDeployer() {

  return loadKeypair('deployer');

}



async function ensureSol(connection, deployer, target, minSol = 0.02) {

  const bal = await connection.getBalance(target.publicKey);

  if (bal >= minSol * LAMPORTS_PER_SOL) return;

  const topUp = Math.ceil(minSol * LAMPORTS_PER_SOL) - bal;

  if (DRY_RUN) return;

  const tx = new Transaction().add(

    SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: target.publicKey, lamports: topUp })

  );

  await sendAndConfirmTransaction(connection, tx, [deployer], { commitment: 'confirmed' });

  console.log(`Funded ${target.publicKey.toBase58().slice(0, 8)}… +${(topUp / LAMPORTS_PER_SOL).toFixed(3)} SOL`);

}



async function collectCandidateOwners() {

  const owners = new Set();

  if (fs.existsSync(MANIFEST)) {

    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

    for (const w of m.wallets ?? []) {

      if (w.pubkey) owners.add(w.pubkey);

    }

  }

  if (fs.existsSync(WALLET_DIR)) {

    for (const f of fs.readdirSync(WALLET_DIR)) {

      if (!f.endsWith('.json')) continue;

      const secret = JSON.parse(fs.readFileSync(path.join(WALLET_DIR, f), 'utf8'));

      owners.add(Keypair.fromSecretKey(Uint8Array.from(secret)).publicKey.toBase58());

    }

  }

  return [...owners];

}



async function findHarvestSources(connection, mint) {

  const owners = await collectCandidateOwners();

  const sources = [];

  for (const ownerStr of owners) {

    const owner = new PublicKey(ownerStr);

    const ata = await getAssociatedTokenAddress(mint, owner, false, TOKEN_2022_PROGRAM_ID);

    try {

      const info = await connection.getAccountInfo(ata);

      if (!info) continue;

      const acct = unpackAccount(ata, info, info.owner);

      const feeAmt = getTransferFeeAmount(acct);

      if (feeAmt && feeAmt.withheldAmount > 0n) {

        sources.push(ata);

      }

    } catch {

      /* no ata */

    }

  }

  return sources;

}



async function main() {

  const mintStr = getDevnetMint();

  if (!mintStr) throw new Error('No mint — set PEPEBALL_MINT or run create-devnet-taxed-master-mint.js');



  const connection = new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');

  const mint = new PublicKey(mintStr);

  const jackpot = loadKeypair('jackpot_tax');

  const deployer = loadDeployer();



  const mintInfo = await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);

  let feeConfig;

  try {

    feeConfig = getTransferFeeConfig(mintInfo);

  } catch {

    console.error('Mint is not Token-2022 with transfer fee.');

    process.exit(1);

  }



  console.log('Mint:', mintStr);

  console.log('Withdraw authority:', feeConfig.withdrawWithheldAuthority.toBase58());



  if (!DRY_RUN) {

    await ensureSol(connection, deployer, jackpot, 0.03);

    await ensureSol(connection, deployer, deployer, 0.1);

  }



  const destAta = await getAssociatedTokenAddress(mint, jackpot.publicKey, false, TOKEN_2022_PROGRAM_ID);

  try {

    await getAccount(connection, destAta, undefined, TOKEN_2022_PROGRAM_ID);

  } catch {

    if (!DRY_RUN) {

      const tx = new Transaction().add(

        createAssociatedTokenAccountInstruction(

          deployer.publicKey,

          destAta,

          jackpot.publicKey,

          mint,

          TOKEN_2022_PROGRAM_ID

        )

      );

      await sendAndConfirmTransaction(connection, tx, [deployer], { commitment: 'confirmed' });

      console.log('Created jackpot tax ATA:', destAta.toBase58());

    }

  }



  const sources = await findHarvestSources(connection, mint);

  console.log('Harvest sources with withheld fees:', sources.length);

  for (const s of sources) console.log(' ', s.toBase58());



  let withheldOnMint = feeConfig.withheldAmount;

  if (sources.length > 0 && !DRY_RUN) {

    const sig = await harvestWithheldTokensToMint(connection, deployer, mint, sources, {
      commitment: 'confirmed',
    });

    console.log('✅ Harvest tx:', sig);

    const mintInfo2 = await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);

    withheldOnMint = getTransferFeeConfig(mintInfo2).withheldAmount;

  }



  console.log('Withheld on mint (raw):', withheldOnMint.toString());



  if (withheldOnMint === 0n) {

    console.log('Nothing on mint to withdraw — run tax rehearsal first or wait for harvest.');

    return;

  }



  if (DRY_RUN) {

    console.log('[dry-run] would withdraw', withheldOnMint.toString(), 'raw to', destAta.toBase58());

    return;

  }



  const sig = await withdrawWithheldTokensFromMint(connection, deployer, mint, destAta, jackpot, [], {

    commitment: 'confirmed',

  });

  console.log('✅ Withdraw tx:', sig);



  const bal = await getAccount(connection, destAta, undefined, TOKEN_2022_PROGRAM_ID);

  console.log('Jackpot tax token balance:', Number(bal.amount) / 1e6, 'tokens');

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});


