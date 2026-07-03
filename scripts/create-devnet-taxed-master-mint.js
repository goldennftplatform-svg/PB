/**
 * Create Token-2022 master mint with 2.5% transfer fee (250 bps) for devnet.
 * Fees auto-withhold on every transfer (Orca/Jupiter buys & sells).
 *
 * Usage:
 *   node scripts/create-devnet-taxed-master-mint.js
 *
 * Writes: devnet/taxed-master-mint.json (gitignored via devnet/)
 * Then: create Orca pool + set PEPEBALL_MINT=<mint> for drip scripts
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
} = require('@solana/web3.js');
const {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeTransferFeeConfigInstruction,
  createInitializeMint2Instruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  mintTo,
  createMintToInstruction,
} = require('@solana/spl-token');
const { loadKeypair } = require('./lib/game-day-wallet');
const { TOKEN_TAX_BPS } = require('./lib/token-config');

const OUT = path.join(__dirname, '..', 'devnet', 'taxed-master-mint.json');
const DECIMALS = 6;
const SUPPLY_HUMAN = 1_000_000; // devnet scale

function loadMintAuthority() {
  const p =
    process.env.MINT_AUTHORITY_WALLET ||
    path.join(__dirname, '..', 'wallet-backups', 'admin-wallet-imported-2025-11-08T23-18-11.json');
  if (!fs.existsSync(p)) throw new Error('Mint authority not found: ' + p);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8'))));
}

async function main() {
  if (fs.existsSync(OUT)) {
    const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log('Already exists:', OUT);
    console.log(JSON.stringify(existing, null, 2));
    console.log('\nDelete file to recreate.');
    return;
  }

  const connection = new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');
  const payer = loadMintAuthority();
  const jackpotTax = loadKeypair('jackpot_tax');
  const mintKp = Keypair.generate();

  const extensions = [ExtensionType.TransferFeeConfig];
  const mintLen = getMintLen(extensions);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
  const maxFee = BigInt(process.env.TOKEN_TAX_MAX_FEE || '1000000000000');

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKp.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeTransferFeeConfigInstruction(
      mintKp.publicKey,
      payer.publicKey,
      jackpotTax.publicKey,
      TOKEN_TAX_BPS,
      maxFee,
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMint2Instruction(
      mintKp.publicKey,
      DECIMALS,
      payer.publicKey,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log('Creating Token-2022 taxed mint…');
  console.log('  Tax:', TOKEN_TAX_BPS, 'bps');
  console.log('  Withdraw authority:', jackpotTax.publicKey.toBase58());

  await sendAndConfirmTransaction(connection, tx, [payer, mintKp], { commitment: 'confirmed' });

  const supplyRaw = BigInt(SUPPLY_HUMAN) * 10n ** BigInt(DECIMALS);
  const ata = await getAssociatedTokenAddress(mintKp.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);

  const tx2 = new Transaction();
  tx2.add(
    createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, mintKp.publicKey, TOKEN_2022_PROGRAM_ID)
  );
  tx2.add(createMintToInstruction(mintKp.publicKey, ata, payer.publicKey, supplyRaw, [], TOKEN_2022_PROGRAM_ID));
  await sendAndConfirmTransaction(connection, tx2, [payer], { commitment: 'confirmed' });

  const manifest = {
    network: 'devnet',
    createdAt: new Date().toISOString(),
    mint: mintKp.publicKey.toBase58(),
    program: TOKEN_2022_PROGRAM_ID.toBase58(),
    decimals: DECIMALS,
    transferFeeBps: TOKEN_TAX_BPS,
    withdrawAuthority: jackpotTax.publicKey.toBase58(),
    mintAuthority: payer.publicKey.toBase58(),
    supplyHuman: SUPPLY_HUMAN,
    nextSteps: [
      'set PEPEBALL_MINT=' + mintKp.publicKey.toBase58(),
      'node scripts/devnet-create-orca-pools.js --only og  (after funding lp_ops + tokens)',
      'node scripts/devnet-twenty-wallet-tax-rehearsal.js',
      'node scripts/withdraw-token2022-fees.js',
      'node scripts/harmonized-drip-settlement.js',
    ],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n✅ Taxed master mint:', manifest.mint);
  console.log('Saved:', OUT);
  console.log('\nexport PEPEBALL_MINT=' + manifest.mint);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
