/**
 * Devnet launch + LP rehearsal — NOT mainnet.
 *
 * Emulates:
 *   • 5% "launch buy" on OG (master), Pump shell, TRiX yang (+ bridge)
 *   • 95% to lp_ops for Orca SOL pairing at a declared starting price
 *
 * Mints full scaled supply (default 100k per mint on devnet, not 1B).
 * Registry OG master mint must match trio master_mint.
 *
 * Usage:
 *   set ANCHOR_WALLET=C:\Users\...\deployer-keypair.json
 *   node scripts/devnet-launch-pool-test.js
 *   node scripts/devnet-launch-pool-test.js --dry-run
 *
 * Env:
 *   DEVNET_TOTAL_PER_MINT — human token units per mint (default 100000)
 *   TOKENS_PER_SOL — starting LP price (default 100000 = 1 SOL buys 100k tokens)
 *   SIM_BUY_SOL — cosmetic SOL sent to each sim wallet (default 0.05)
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
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
  getAccount,
} = require('@solana/spl-token');

const TRIO_FILE = path.join(__dirname, '..', 'devnet', 'trio-mints.json');
const OUT_FILE = path.join(__dirname, '..', 'devnet', 'launch-emulation.json');
const REGISTRY_PDA = '7KTFqUTfV93BtU4koWV1VGgcDENrNPm1dvxr1KWrxbCQ';
const DRY_RUN = process.argv.includes('--dry-run');
const DECIMALS = 6;
const LAUNCH_BUY_PCT = 0.05;
const LP_PCT = 0.95;

const MINT_ROLES = [
  { key: 'master_mint', label: 'OG / PBALL (master)', simWallet: 'floor_buy_ops', surface: 'og' },
  { key: 'pump_shell_mint', label: 'Pump shell (sim)', simWallet: 'floor_buy_ops', surface: 'pump' },
  { key: 'trix_yang_mint', label: 'TRiX yang (sim)', simWallet: 'trix_launch_yang', surface: 'trix_yang' },
  { key: 'trix_bridge_mint', label: 'TRiX bridge (sim)', simWallet: 'trix_launch_bridge', surface: 'trix_bridge' },
];

function loadKeypair(role) {
  const walletPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'pepeball-game-day',
    'private',
    `${role}-keypair.json`
  );
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Missing wallet for ${role}: ${walletPath}\nRun: node scripts/game-day-create-wallet.js ${role}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
}

function loadDeployer() {
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.USERPROFILE || process.env.HOME, 'pepeball-game-day', 'private', 'deployer-keypair.json');
  if (!fs.existsSync(walletPath)) throw new Error('Deployer not found: ' + walletPath);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
}

function loadMintAuthority(trio) {
  const walletPath =
    process.env.MINT_AUTHORITY_WALLET ||
    path.join(__dirname, '..', 'wallet-backups', 'admin-wallet-imported-2025-11-08T23-18-11.json');
  if (!fs.existsSync(walletPath)) {
    throw new Error(
      `Mint authority keypair not found (${trio.payer}). Set MINT_AUTHORITY_WALLET to the wallet that created trio mints.`
    );
  }
  const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
  if (kp.publicKey.toBase58() !== trio.payer) {
    console.warn('Warning: mint authority', kp.publicKey.toBase58(), '!= trio payer', trio.payer);
  }
  return kp;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanToRaw(n) {
  return BigInt(Math.round(n * 10 ** DECIMALS));
}

async function maybeSendSol(connection, from, to, sol) {
  if (sol <= 0) return null;
  if (DRY_RUN) {
    console.log(`  [dry-run] would send ${sol} SOL → ${to.toBase58()}`);
    return 'dry-run';
  }
  const lamports = Math.round(sol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: to, lamports })
  );
  return sendAndConfirmTransaction(connection, tx, [from], { commitment: 'confirmed' });
}

async function main() {
  const totalHuman = Number(process.env.DEVNET_TOTAL_PER_MINT || 100_000);
  const tokensPerSol = Number(process.env.TOKENS_PER_SOL || 100_000);
  const simBuySol = Number(process.env.SIM_BUY_SOL || 0.05);

  if (!fs.existsSync(TRIO_FILE)) {
    console.error('Missing', TRIO_FILE);
    process.exit(1);
  }
  const trio = JSON.parse(fs.readFileSync(TRIO_FILE, 'utf8'));
  const rpc = process.env.RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpc, 'confirmed');
  const deployer = loadDeployer();
  const mintAuthority = loadMintAuthority(trio);
  const lpOps = loadKeypair('lp_ops');

  const simWallets = {
    floor_buy_ops: loadKeypair('floor_buy_ops'),
    trix_launch_yang: loadKeypair('trix_launch_yang'),
    trix_launch_bridge: loadKeypair('trix_launch_bridge'),
  };

  const launchBuyHuman = totalHuman * LAUNCH_BUY_PCT;
  const lpHuman = totalHuman * LP_PCT;
  const solPerPool = lpHuman / tokensPerSol;

  console.log('\n═══ DEVNET launch emulation (NOT mainnet) ═══\n');
  console.log('⚠️  Scaled supply per mint:', totalHuman.toLocaleString(), 'tokens (mainnet target = 1B)');
  console.log('    5% sim buy:', launchBuyHuman.toLocaleString(), '| 95% LP:', lpHuman.toLocaleString());
  console.log('    Starting price:', tokensPerSol.toLocaleString(), 'tokens per 1 SOL');
  console.log('    SOL per Orca pool (95% side):', solPerPool.toFixed(4), 'SOL');
  console.log('    Registry PDA (OG binding):', REGISTRY_PDA);
  console.log('Deployer (fees):', deployer.publicKey.toBase58());
  console.log('Mint authority:', mintAuthority.publicKey.toBase58());
  console.log('LP ops:', lpOps.publicKey.toBase58());
  console.log('Balance:', ((await connection.getBalance(deployer.publicKey)) / LAMPORTS_PER_SOL).toFixed(4), 'SOL\n');

  const manifest = {
    network: 'devnet',
    label: 'DEVNET REHEARSAL — not a live burn',
    createdAt: new Date().toISOString(),
    scaledFromMainnet: { totalPerMint: '1_000_000_000', devnetTotalPerMint: totalHuman },
    split: { launchBuyPct: LAUNCH_BUY_PCT, lpPct: LP_PCT },
    pricing: { tokensPerSol, solPerPool },
    registryPda: REGISTRY_PDA,
    wallets: {
      deployer: deployer.publicKey.toBase58(),
      lp_ops: lpOps.publicKey.toBase58(),
      floor_buy_ops: simWallets.floor_buy_ops.publicKey.toBase58(),
      trix_launch_yang: simWallets.trix_launch_yang.publicKey.toBase58(),
      trix_launch_bridge: simWallets.trix_launch_bridge.publicKey.toBase58(),
    },
    mints: {},
    pools: [],
  };

  for (const role of MINT_ROLES) {
    const mintStr = trio.mints[role.key];
    const mint = new PublicKey(mintStr);
    const simKp = simWallets[role.simWallet];
    const launchRaw = humanToRaw(launchBuyHuman);
    const lpRaw = humanToRaw(lpHuman);

    console.log(`── ${role.label} ──`);
    console.log('  Mint:', mintStr);
    console.log('  Surface:', role.surface);

    const mintInfo = await getMint(connection, mint);
  if (mintInfo.mintAuthority === null) {
      console.error('  ❌ Mint authority renounced — cannot mint more');
      continue;
    }
    if (mintInfo.mintAuthority.toBase58() !== mintAuthority.publicKey.toBase58()) {
      console.warn('  ⚠️  Expected mint authority', mintAuthority.publicKey.toBase58(), 'got', mintInfo.mintAuthority?.toBase58());
    }

    const currentSupply = Number(mintInfo.supply) / 10 ** DECIMALS;
    const needMint = totalHuman - currentSupply;
    if (needMint > 0.000001) {
      console.log(`  → Minting ${needMint.toLocaleString()} to mint authority treasury...`);
      if (!DRY_RUN) {
        const treasury = await getOrCreateAssociatedTokenAccount(
          connection,
          deployer,
          mint,
          mintAuthority.publicKey
        );
        await mintTo(
          connection,
          deployer,
          mint,
          treasury.address,
          mintAuthority,
          humanToRaw(needMint)
        );
      }
    }

    if (!DRY_RUN) {
      const authAta = await getOrCreateAssociatedTokenAccount(
        connection,
        deployer,
        mint,
        mintAuthority.publicKey
      );
      const simAta = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, simKp.publicKey);
      const lpAta = await getOrCreateAssociatedTokenAccount(connection, deployer, mint, lpOps.publicKey);

      const simBal = Number((await getAccount(connection, simAta.address)).amount);
      const lpBal = Number((await getAccount(connection, lpAta.address)).amount);
      const launchRawTarget = Number(launchRaw);
      const lpRawTarget = Number(lpRaw);

      const { createTransferInstruction } = require('@solana/spl-token');

      if (simBal < launchRawTarget) {
        const tx1 = new Transaction().add(
          createTransferInstruction(
            authAta.address,
            simAta.address,
            mintAuthority.publicKey,
            BigInt(launchRawTarget - simBal)
          )
        );
        const sig1 = await sendAndConfirmTransaction(connection, tx1, [mintAuthority], { commitment: 'confirmed' });
        console.log('  → 5% sim buy tokens tx:', sig1);
      } else {
        console.log('  → 5% sim buy already funded');
      }

      if (lpBal < lpRawTarget) {
        const tx2 = new Transaction().add(
          createTransferInstruction(
            authAta.address,
            lpAta.address,
            mintAuthority.publicKey,
            BigInt(lpRawTarget - lpBal)
          )
        );
        const sig2 = await sendAndConfirmTransaction(connection, tx2, [mintAuthority], { commitment: 'confirmed' });
        console.log('  → 95% LP reserve tx:', sig2);
      } else {
        console.log('  → 95% LP reserve already funded');
      }

      if (simBal < launchRawTarget) {
        console.log(`  → Sim "buy" SOL (${simBuySol} SOL cosmetic)...`);
        const solSig = await maybeSendSol(connection, deployer, simKp.publicKey, simBuySol);
        if (solSig) console.log('     ', solSig);
      }
    } else {
      console.log(`  [dry-run] 5% → ${role.simWallet}, 95% → lp_ops`);
    }

    manifest.mints[role.key] = {
      mint: mintStr,
      label: role.label,
      surface: role.surface,
      simWallet: role.simWallet,
      launchBuyTokens: launchBuyHuman,
      lpReserveTokens: lpHuman,
      lpSolSuggested: solPerPool,
    };

    manifest.pools.push({
      pair: `SOL/${role.surface.toUpperCase()}`,
      tokenMint: mintStr,
      depositWallet: 'lp_ops',
      depositWalletAddress: lpOps.publicKey.toBase58(),
      tokenAmount: lpHuman,
      solAmount: solPerPool,
      venue: 'Orca Whirlpool devnet',
      url: 'https://www.orca.so/whirlpools',
    });
    console.log('');
    if (!DRY_RUN) await sleep(3500);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  if (!DRY_RUN) {
    fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  }

  console.log('═══ Orca devnet pools (automated) ═══\n');
  console.log('Run: node scripts/devnet-create-orca-pools.js');
  console.log('Uses lp_ops wallet + @orca-so/whirlpools — no Orca UI needed.\n');
  for (const p of manifest.pools) {
    console.log(`   ${p.pair}`);
    console.log(`     Token: ${p.tokenMint}`);
    console.log(`     Tokens: ${p.tokenAmount.toLocaleString()} | SOL: ${p.solAmount.toFixed(4)}`);
    console.log(`     Wallet: lp_ops (${p.depositWalletAddress})\n`);
  }
  console.log('After pools exist: devnet/lp-pools.json (written by create script)');
  if (!DRY_RUN) console.log('Saved:', OUT_FILE, '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
