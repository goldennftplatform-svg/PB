/**
 * Orca splash pool for Token-2022 taxed master mint (devnet).
 * Transfers tokens from mint authority → lp_ops, deposits ~0.95 SOL + 95k tokens.
 *
 * Usage:
 *   node scripts/create-devnet-taxed-orca-pool.js
 *   node scripts/create-devnet-taxed-orca-pool.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const { address, createSolanaRpc, devnet } = require('@solana/kit');
const {
  setRpc,
  setDefaultFunder,
  setPayerFromBytes,
  createSplashPool,
  createSplashPoolInstructions,
  openFullRangePosition,
  WhirlpoolDeployment,
} = require('@orca-so/whirlpools');
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
  createTransferCheckedInstruction,
  getAccount,
} = require('@solana/spl-token');

const WSOL = 'So11111111111111111111111111111111111111112';
const TAXED_FILE = path.join(__dirname, '..', 'devnet', 'taxed-master-mint.json');
const OUT_FILE = path.join(__dirname, '..', 'devnet', 'lp-pools.json');
const DRY_RUN = process.argv.includes('--dry-run');
const SOL_AMOUNT = Number(process.env.LP_SOL || '0.95');
const TOKEN_AMOUNT = Number(process.env.LP_TOKENS || '95000');
const TOKENS_PER_SOL = Number(process.env.TOKENS_PER_SOL || '100000');
const TOKEN_DECIMALS = 6;

function loadKeypairBytes(role) {
  const walletPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'pepeball-game-day',
    'private',
    `${role}-keypair.json`
  );
  if (!fs.existsSync(walletPath)) throw new Error(`Missing wallet: ${walletPath}`);
  return Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
}

function loadMintAuthority() {
  const p =
    process.env.MINT_AUTHORITY_WALLET ||
    path.join(__dirname, '..', 'wallet-backups', 'admin-wallet-imported-2025-11-08T23-18-11.json');
  if (!fs.existsSync(p)) throw new Error('Mint authority not found: ' + p);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8'))));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanToRaw(amount, decimals) {
  return BigInt(Math.round(Number(amount) * 10 ** decimals));
}

async function lpOpsTokenBalance(connection, mintPk, lpOps) {
  const ata = await getAssociatedTokenAddress(mintPk, lpOps.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const acc = await getAccount(connection, ata, undefined, TOKEN_2022_PROGRAM_ID);
  return acc.amount;
}

async function ensureLpOpsTokens(connection, mintPk, mintAuthority, lpOps, feeBps) {
  const targetRaw = humanToRaw(TOKEN_AMOUNT, TOKEN_DECIMALS);
  const grossRaw = (targetRaw * 10000n + BigInt(10000 - feeBps) - 1n) / BigInt(10000 - feeBps);
  const fromAta = await getAssociatedTokenAddress(mintPk, mintAuthority.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const toAta = await getAssociatedTokenAddress(mintPk, lpOps.publicKey, false, TOKEN_2022_PROGRAM_ID);

  const tx = new Transaction();
  try {
    await getAccount(connection, toAta, undefined, TOKEN_2022_PROGRAM_ID);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        lpOps.publicKey,
        toAta,
        lpOps.publicKey,
        mintPk,
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  let have = 0n;
  try {
    have = (await getAccount(connection, toAta, undefined, TOKEN_2022_PROGRAM_ID)).amount;
  } catch {
    /* new ata */
  }
  if (have >= targetRaw) {
    console.log(`  lp_ops tokens ok: ${(Number(have) / 10 ** TOKEN_DECIMALS).toLocaleString()}`);
    return have;
  }

  const sendRaw = grossRaw > have ? grossRaw - have : 0n;
  const fromBal = (await getAccount(connection, fromAta, undefined, TOKEN_2022_PROGRAM_ID)).amount;
  if (fromBal < sendRaw) throw new Error(`Mint authority has ${fromBal} raw, need ${sendRaw}`);

  if (tx.instructions.length) {
    await sendAndConfirmTransaction(connection, tx, [lpOps], { commitment: 'confirmed' });
  }

  if (sendRaw > 0n) {
    const tx2 = new Transaction().add(
      createTransferCheckedInstruction(
        fromAta,
        mintPk,
        toAta,
        mintAuthority.publicKey,
        sendRaw,
        TOKEN_DECIMALS,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, tx2, [mintAuthority], { commitment: 'confirmed' });
    console.log(`  ✓ sent ~${(Number(sendRaw) / 10 ** TOKEN_DECIMALS).toLocaleString()} tokens to lp_ops (gross, incl. fee)`);
  }

  return lpOpsTokenBalance(connection, mintPk, lpOps);
}

async function fundSolIfNeeded(connection, deployer, lpOps, sol) {
  const need = Math.floor(sol * LAMPORTS_PER_SOL) + 50_000_000;
  const bal = await connection.getBalance(lpOps.publicKey);
  if (bal >= need) {
    console.log(`  lp_ops SOL ok: ${(bal / LAMPORTS_PER_SOL).toFixed(3)}`);
    return;
  }
  const topUp = need - bal;
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: deployer.publicKey, toPubkey: lpOps.publicKey, lamports: topUp })
  );
  await sendAndConfirmTransaction(connection, tx, [deployer], { commitment: 'confirmed' });
  console.log(`  ✓ funded lp_ops +${(topUp / LAMPORTS_PER_SOL).toFixed(3)} SOL`);
}

async function main() {
  if (!fs.existsSync(TAXED_FILE)) {
    throw new Error(`Missing ${TAXED_FILE} — run: node scripts/create-devnet-taxed-master-mint.js`);
  }
  const taxed = JSON.parse(fs.readFileSync(TAXED_FILE, 'utf8'));
  const tokenMint = taxed.mint;
  const mintPk = new PublicKey(tokenMint);

  const rpcUrl = process.env.SOLANA_RPC || clusterApiUrl('devnet');
  const connection = new Connection(rpcUrl, 'confirmed');
  const lpSecret = loadKeypairBytes('lp_ops');
  const lpOps = Keypair.fromSecretKey(lpSecret);
  const deployer = Keypair.fromSecretKey(loadKeypairBytes('deployer'));
  const mintAuthority = loadMintAuthority();

  console.log('═══ Taxed mint Orca pool ═══\n');
  console.log(`Mint: ${tokenMint} (Token-2022 @ ${taxed.transferFeeBps} bps)`);
  console.log(`lp_ops: ${lpOps.publicKey.toBase58()}`);
  if (DRY_RUN) console.log('Mode: DRY RUN\n');

  let tokenRaw = humanToRaw(TOKEN_AMOUNT, TOKEN_DECIMALS);
  if (!DRY_RUN) {
    await fundSolIfNeeded(connection, deployer, lpOps, SOL_AMOUNT + 0.15);
    tokenRaw = await ensureLpOpsTokens(connection, mintPk, mintAuthority, lpOps, taxed.transferFeeBps);
  }

  await setRpc(rpcUrl);
  const signer = await setPayerFromBytes(lpSecret);
  setDefaultFunder(signer);

  const rpc = createSolanaRpc(devnet(rpcUrl));
  const { poolAddress } = await createSplashPoolInstructions(rpc, address(WSOL), address(tokenMint), {
    initialPrice: TOKENS_PER_SOL,
    whirlpoolDeployment: WhirlpoolDeployment.devnet,
  });

  let poolAddr = poolAddress;
  const ORCA = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');
  const info = await connection.getAccountInfo(new PublicKey(poolAddress));
  if (!info || !info.owner.equals(ORCA)) {
    console.log(`  Creating pool @ ${TOKENS_PER_SOL.toLocaleString()} tokens/SOL…`);
    if (!DRY_RUN) {
      const { poolAddress: created, callback } = await createSplashPool(address(WSOL), address(tokenMint), {
        initialPrice: TOKENS_PER_SOL,
        whirlpoolDeployment: WhirlpoolDeployment.devnet,
      });
      const sig = await callback();
      console.log(`  ✓ pool: ${sig}`);
      poolAddr = created;
      await sleep(2500);
    }
  } else {
    console.log(`  Pool exists: ${poolAddress}`);
  }

  console.log(`  Depositing ${SOL_AMOUNT} SOL + ${(Number(tokenRaw) / 10 ** TOKEN_DECIMALS).toLocaleString()} tokens…`);
  if (!DRY_RUN) {
    const { callback } = await openFullRangePosition(
      poolAddr,
      { tokenMaxA: humanToRaw(SOL_AMOUNT, 9), tokenMaxB: tokenRaw },
      { whirlpoolDeployment: WhirlpoolDeployment.devnet }
    );
    const depSig = await callback();
    console.log(`  ✓ liquidity: ${depSig}`);
  }

  const entry = {
    pair: 'SOL/TAXED',
    tokenMint,
    tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58(),
    orca_whirlpool: poolAddr,
    tick_spacing: 32896,
    solDeposited: SOL_AMOUNT,
    tokensDeposited: TOKEN_AMOUNT,
    transferFeeBps: taxed.transferFeeBps,
  };

  if (!DRY_RUN) {
    let merged = { network: 'devnet', pools: {} };
    if (fs.existsSync(OUT_FILE)) {
      try {
        merged = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
      } catch {
        /* fresh */
      }
    }
    merged.pools = merged.pools ?? {};
    merged.pools.sol_taxed = entry;
    merged.activeTaxedMint = tokenMint;
    merged.updatedAt = new Date().toISOString();
    fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`\nSaved: ${OUT_FILE}`);
  }

  console.log(`\n✅ Pool: ${poolAddr}`);
  console.log('Next: node scripts/devnet-twenty-wallet-tax-rehearsal.js --count 5');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
