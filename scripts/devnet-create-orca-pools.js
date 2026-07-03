/**
 * Create Orca Whirlpool splash pools on devnet + deposit rehearsal liquidity.
 * No Orca UI required — fully scripted via @orca-so/whirlpools.
 *
 * Usage:
 *   node scripts/devnet-create-orca-pools.js
 *   node scripts/devnet-create-orca-pools.js --dry-run
 *   node scripts/devnet-create-orca-pools.js --only og
 *
 * Reads:  devnet/launch-emulation.json
 * Writes: devnet/lp-pools.json (gitignored — public addresses only)
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
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

const ORCA_PROGRAM = new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc');

const WSOL = 'So11111111111111111111111111111111111111112';
const MANIFEST = path.join(__dirname, '..', 'devnet', 'launch-emulation.json');
const OUT_FILE = path.join(__dirname, '..', 'devnet', 'lp-pools.json');
const DRY_RUN = process.argv.includes('--dry-run');
const ONLY = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? process.argv[i + 1] : null;
})();
const TOKEN_DECIMALS = 6;

function loadKeypairBytes(role) {
  const walletPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'pepeball-game-day',
    'private',
    `${role}-keypair.json`
  );
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Missing wallet for ${role}: ${walletPath}`);
  }
  return Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanToRaw(amount, decimals) {
  return BigInt(Math.round(Number(amount) * 10 ** decimals));
}

async function initOrcaSigner() {
  const secret = loadKeypairBytes('lp_ops');
  const rpcUrl = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
  await setRpc(rpcUrl);
  const signer = await setPayerFromBytes(secret);
  setDefaultFunder(signer);
  return { signer, rpcUrl };
}

async function resolvePoolAddress(tokenMint, tokensPerSol) {
  const rpc = createSolanaRpc(devnet(process.env.SOLANA_RPC || 'https://api.devnet.solana.com'));
  const { poolAddress } = await createSplashPoolInstructions(
    rpc,
    address(WSOL),
    address(tokenMint),
    {
      initialPrice: tokensPerSol,
      whirlpoolDeployment: WhirlpoolDeployment.devnet,
    }
  );
  return poolAddress;
}

async function poolExists(poolAddress) {
  const connection = new Connection(
    process.env.SOLANA_RPC || clusterApiUrl('devnet'),
    'confirmed'
  );
  const info = await connection.getAccountInfo(new PublicKey(poolAddress));
  return info != null && info.owner.equals(ORCA_PROGRAM);
}

async function createPool(tokenMint, tokensPerSol) {
  const poolAddress = await resolvePoolAddress(tokenMint, tokensPerSol);

  if (await poolExists(poolAddress)) {
    console.log(`  Pool already exists: ${poolAddress}`);
    return poolAddress;
  }

  console.log(`  Creating splash pool @ ${tokensPerSol.toLocaleString()} tokens/SOL...`);
  if (DRY_RUN) {
    console.log(`  [dry-run] would create pool ${poolAddress}`);
    return poolAddress;
  }

  const { poolAddress: created, callback } = await createSplashPool(
    address(WSOL),
    address(tokenMint),
    {
      initialPrice: tokensPerSol,
      whirlpoolDeployment: WhirlpoolDeployment.devnet,
    }
  );
  const sig = await callback();
  console.log(`  ✓ initialize pool: ${sig}`);
  await sleep(2500);
  return created;
}

async function depositLiquidity(poolAddress, solHuman, tokenHuman) {
  const tokenMaxA = humanToRaw(solHuman, 9);
  const tokenMaxB = humanToRaw(tokenHuman, TOKEN_DECIMALS);

  console.log(`  Depositing ${solHuman} SOL + ${tokenHuman.toLocaleString()} tokens...`);
  if (DRY_RUN) {
    console.log('  [dry-run] would open full-range position');
    return null;
  }

  const { callback } = await openFullRangePosition(
    poolAddress,
    { tokenMaxA, tokenMaxB },
    { whirlpoolDeployment: WhirlpoolDeployment.devnet }
  );
  const sig = await callback();
  console.log(`  ✓ deposit liquidity: ${sig}`);
  return sig;
}

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    throw new Error(`Missing ${MANIFEST} — run: node scripts/devnet-launch-pool-test.js`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const tokensPerSol = manifest.pricing?.tokensPerSol ?? 100_000;
  const { signer } = await initOrcaSigner();

  console.log('═══ Orca devnet pool automation ═══\n');
  console.log(`lp_ops: ${signer.address}`);
  console.log(`Price: ${tokensPerSol.toLocaleString()} tokens per 1 SOL`);
  if (DRY_RUN) console.log('Mode: DRY RUN\n');

  const poolsOut = {
    network: 'devnet',
    createdAt: new Date().toISOString(),
    tickSpacing: 32896,
    pricing: manifest.pricing,
    pools: {},
  };

  const entries = manifest.pools.filter((p) => {
    if (!ONLY) return true;
    const surface = p.pair.split('/')[1]?.toLowerCase();
    return surface === ONLY.toLowerCase() || p.tokenMint === ONLY;
  });

  if (!entries.length) {
    throw new Error(`No pools matched --only ${ONLY}`);
  }

  for (const row of entries) {
    const surface = row.pair.replace('SOL/', '').toLowerCase();
    const key = `sol_${surface}`;

    console.log(`\n── ${row.pair} ──`);
    console.log(`  Mint: ${row.tokenMint}`);

    const poolAddress = await createPool(row.tokenMint, tokensPerSol);
    const depositSig = await depositLiquidity(poolAddress, row.solAmount, row.tokenAmount);

    poolsOut.pools[key] = {
      pair: row.pair,
      tokenMint: row.tokenMint,
      orca_whirlpool: poolAddress,
      tick_spacing: 32896,
      solDeposited: row.solAmount,
      tokensDeposited: row.tokenAmount,
      depositTx: depositSig,
    };

    if (!DRY_RUN) await sleep(3000);
  }

  if (!DRY_RUN) {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    let merged = poolsOut;
    if (fs.existsSync(OUT_FILE)) {
      try {
        const prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
        merged = {
          ...prev,
          ...poolsOut,
          pools: { ...(prev.pools ?? {}), ...poolsOut.pools },
        };
      } catch {
        /* use fresh */
      }
    }
    fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`\nSaved: ${OUT_FILE}`);
  }

  console.log('\nDone. Verify: node scripts/devnet-proof-status.js');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
