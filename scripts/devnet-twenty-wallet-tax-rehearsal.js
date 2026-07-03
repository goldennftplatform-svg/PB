/**
 * Devnet: 20 wallets → Orca BUY + optional SELL on SOL/OG pool.
 * Verifies 2.5% buy/sell tax math vs jackpot_tax token balance.
 *
 * Basics: tax hits the TOKEN leg of each trade (not SOL in).
 * Production master = Token-2022 transfer fee (250 bps) or pepball-token.
 * Devnet trio master is plain SPL today → swaps work, on-chain tax = 0 until taxed mint.
 *
 * Usage:
 *   node scripts/devnet-twenty-wallet-tax-rehearsal.js
 *   node scripts/devnet-twenty-wallet-tax-rehearsal.js --dry-run
 *   node scripts/devnet-twenty-wallet-tax-rehearsal.js --count 5
 *
 * Fund deployer on devnet first (you said you can): solana airdrop 5 <deployer>
 * Env: SOLANA_RPC, BUY_SOL (default 0.01), WALLET_SOL (default 0.06 fund each)
 */

const fs = require('fs');
const path = require('path');
const { address } = require('@solana/kit');
const {
  setRpc,
  setDefaultFunder,
  setPayerFromBytes,
  swap,
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
const { getDevnetMint, getOgPool } = require('./lib/devnet-config');
const { expectedBuyTaxFromNetReceived, expectedSellTax, TOKEN_TAX_BPS, formatBps } = require('./lib/tax-math');
const { TOKEN_DECIMALS } = require('./lib/token-config');
const { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } = require('@solana/spl-token');

const WSOL = 'So11111111111111111111111111111111111111112';
const TRIO_FILE = path.join(__dirname, '..', 'devnet', 'trio-mints.json');
const LP_FILE = path.join(__dirname, '..', 'devnet', 'lp-pools.json');
const OUT_DIR = path.join(__dirname, '..', 'devnet', 'tax-test-wallets');
const MANIFEST_OUT = path.join(__dirname, '..', 'devnet', 'tax-test-manifest.json');

const DRY_RUN = process.argv.includes('--dry-run');
const COUNT = (() => {
  const i = process.argv.indexOf('--count');
  return i >= 0 ? Math.min(20, Math.max(1, Number(process.argv[i + 1]) || 20)) : 20;
})();
const BUY_SOL = Number(process.env.BUY_SOL || '0.01');
const WALLET_SOL = Number(process.env.WALLET_SOL || '0.06');
const TX_DELAY_MS = Number(process.env.TX_DELAY_MS || '4500');

function loadKeypair(role) {
  const walletPath = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'pepeball-game-day',
    'private',
    `${role}-keypair.json`
  );
  if (!fs.existsSync(walletPath)) throw new Error(`Missing wallet: ${walletPath}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function rawToHuman(raw) {
  return Number(raw) / 10 ** TOKEN_DECIMALS;
}

async function tokenBalance(connection, owner, mint, isToken2022) {
  const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  try {
    const ata = await getAssociatedTokenAddress(mint, owner, false, programId);
    const acc = await getAccount(connection, ata, undefined, programId);
    return acc.amount;
  } catch {
    return 0n;
  }
}

async function fundSol(connection, from, to, sol) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    })
  );
  await sendAndConfirmTransaction(connection, tx, [from], { commitment: 'confirmed' });
}

async function runSwap(walletSecret, poolAddr, params, attempt = 0) {
  const rpcUrl = process.env.SOLANA_RPC || process.env.RPC_URL || clusterApiUrl('devnet');
  try {
    await setRpc(rpcUrl);
    const signer = await setPayerFromBytes(walletSecret);
    setDefaultFunder(signer);
    const result = await swap(params, poolAddr, {
      whirlpoolDeployment: WhirlpoolDeployment.devnet,
      slippageToleranceBps: 300,
    });
    const sig = DRY_RUN ? null : await result.callback();
    return { sig, quote: result.quote ?? result.instructions?.quote };
  } catch (e) {
    const is429 = String(e?.message || e).includes('429') || e?.context?.statusCode === 429;
    const isTimeout = String(e?.message || e).includes('timeout');
    if ((is429 || isTimeout) && attempt < 5) {
      const wait = is429
        ? Number(e?.context?.headers?.get?.('retry-after') || 12) * 1000
        : 15000;
      console.log(`  ${is429 ? 'RPC 429' : 'Timeout'} — retry in ${wait / 1000}s…`);
      await sleep(wait);
      return runSwap(walletSecret, poolAddr, params, attempt + 1);
    }
    throw e;
  }
}

async function main() {
  const mintStr = getDevnetMint();
  if (!mintStr) throw new Error('No mint — run create-devnet-taxed-master-mint.js or set PEPEBALL_MINT');
  const masterMint = new PublicKey(mintStr);
  const tokenMintAddr = address(mintStr);

  const taxedFile = path.join(__dirname, '..', 'devnet', 'taxed-master-mint.json');
  const isToken2022 =
    fs.existsSync(taxedFile) && JSON.parse(fs.readFileSync(taxedFile, 'utf8')).mint === mintStr;

  let poolAddr = address(getOgPool());

  const rpcUrl = process.env.SOLANA_RPC || process.env.RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpcUrl, { commitment: 'confirmed', confirmTransactionInitialTimeout: 120_000 });
  const deployer = loadKeypair('deployer');
  const jackpotTax = loadKeypair('jackpot_tax');

  const deployerBal = await connection.getBalance(deployer.publicKey);
  const needSol = COUNT * WALLET_SOL + 0.5;

  console.log('\n═══ Buy/sell tax rehearsal (devnet) ═══\n');
  console.log(`Tax: ${formatBps(TOKEN_TAX_BPS)} on token leg (buy + sell)`);
  console.log(`Pool SOL/OG: ${poolAddr}`);
  console.log(`Master mint: ${masterMint.toBase58()}${isToken2022 ? ' (Token-2022 taxed)' : ' (plain SPL)'}`);
  console.log(`Jackpot/tax: ${jackpotTax.publicKey.toBase58()}`);
  console.log(`Wallets: ${COUNT} · buy ${BUY_SOL} SOL each · fund ${WALLET_SOL} SOL each`);
  console.log(`Deployer: ${(deployerBal / LAMPORTS_PER_SOL).toFixed(3)} SOL (need ~${needSol.toFixed(2)})`);
  if (deployerBal < needSol * LAMPORTS_PER_SOL * 0.9) {
    console.log('\n⚠️  Fund deployer on devnet: solana airdrop 5', deployer.publicKey.toBase58());
  }
  if (DRY_RUN) console.log('\nMode: DRY RUN\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const jackpotBefore = await tokenBalance(connection, jackpotTax.publicKey, masterMint, isToken2022);
  const buyLamports = BigInt(Math.floor(BUY_SOL * LAMPORTS_PER_SOL));
  const rows = [];
  let expectedTaxTotal = 0n;

  for (let i = 0; i < COUNT; i++) {
    const kp = Keypair.generate();
    const secret = Uint8Array.from(kp.secretKey);
    const walletPath = path.join(OUT_DIR, `wallet-${i + 1}.json`);
    if (!DRY_RUN) fs.writeFileSync(walletPath, JSON.stringify(Array.from(secret)), 'utf8');

    console.log(`\n── Wallet ${i + 1}/${COUNT} ${kp.publicKey.toBase58().slice(0, 8)}… ──`);

    try {
    if (!DRY_RUN) {
      await fundSol(connection, deployer, kp.publicKey, WALLET_SOL);
      await sleep(800);
    }

    const tokBefore = DRY_RUN ? 0n : await tokenBalance(connection, kp.publicKey, masterMint, isToken2022);

    // BUY: SOL → OG
    let buyQuote;
    if (!DRY_RUN) {
      const buy = await runSwap(secret, poolAddr, {
        inputAmount: buyLamports,
        mint: address(WSOL),
      });
      buyQuote = buy.quote;
      console.log(`  BUY tx: ${buy.sig}`);
      await sleep(TX_DELAY_MS);
    } else {
      buyQuote = { tokenEstOut: buyLamports * 100000n / BigInt(LAMPORTS_PER_SOL) }; // rough
    }

    const tokAfterBuy = DRY_RUN ? buyQuote?.tokenEstOut ?? 0n : await tokenBalance(connection, kp.publicKey, masterMint, isToken2022);
    const tokensBought = tokAfterBuy - tokBefore;
    const buyTax = expectedBuyTaxFromNetReceived(tokensBought);
    expectedTaxTotal += buyTax.totalTaxRaw;

    let sellTax = { totalTaxRaw: 0n };
    let tokensSold = 0n;
    let sellSig = null;

    // SELL half the wallets (50% of bag)
    if (i % 2 === 0 && tokAfterBuy > 0n) {
      tokensSold = tokAfterBuy / 2n;
      if (tokensSold > 0n) {
        sellTax = expectedSellTax(tokensSold);
        expectedTaxTotal += sellTax.totalTaxRaw;
        if (!DRY_RUN) {
          const sell = await runSwap(secret, poolAddr, {
            inputAmount: tokensSold,
            mint: tokenMintAddr,
          });
          sellSig = sell.sig;
          console.log(`  SELL tx: ${sellSig}`);
          await sleep(TX_DELAY_MS);
        }
      }
    }

    const tokFinal = DRY_RUN ? tokAfterBuy - tokensSold : await tokenBalance(connection, kp.publicKey, masterMint, isToken2022);

    rows.push({
      wallet: i + 1,
      pubkey: kp.publicKey.toBase58(),
      buySol: BUY_SOL,
      tokensBought: rawToHuman(tokensBought),
      expectedBuyTax: rawToHuman(buyTax.totalTaxRaw),
      sold: tokensSold > 0n,
      tokensSold: rawToHuman(tokensSold),
      expectedSellTax: rawToHuman(sellTax.totalTaxRaw),
      balanceAfter: rawToHuman(tokFinal),
    });

    console.log(
      `  bought ~${rawToHuman(tokensBought).toFixed(2)} OG | tax (exp) buy ${rawToHuman(buyTax.totalTaxRaw).toFixed(4)}` +
        (tokensSold > 0n ? ` | sell tax (exp) ${rawToHuman(sellTax.totalTaxRaw).toFixed(4)}` : '')
    );
    } catch (err) {
      console.log(`  ⚠️  skipped: ${err.message}`);
      rows.push({
        wallet: i + 1,
        pubkey: kp.publicKey.toBase58(),
        error: err.message,
      });
    }
  }

  const jackpotAfter = DRY_RUN ? jackpotBefore : await tokenBalance(connection, jackpotTax.publicKey, masterMint, isToken2022);
  const taxOnChain = jackpotAfter - jackpotBefore;

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('Wallet │ Buy SOL │ Tokens │ Exp buy tax │ Sell? │ Exp sell tax');
  console.log('───────┼─────────┼────────┼─────────────┼───────┼─────────────');
  for (const r of rows) {
    console.log(
      `${String(r.wallet).padStart(6)} │ ${r.buySol.toFixed(3).padStart(7)} │ ${r.tokensBought.toFixed(2).padStart(6)} │ ${r.expectedBuyTax.toFixed(4).padStart(11)} │ ${r.sold ? ' yes' : '  —'} │ ${r.sold ? r.expectedSellTax.toFixed(4).padStart(11) : '—'.padStart(11)}`
    );
  }

  console.log('\n── Jackpot / tax wallet (token ATA) ──');
  console.log(`Before: ${rawToHuman(jackpotBefore).toFixed(6)} OG`);
  console.log(`After:  ${rawToHuman(jackpotAfter).toFixed(6)} OG`);
  console.log(`On-chain increase: ${rawToHuman(taxOnChain).toFixed(6)} OG`);
  console.log(`Expected from ${COUNT} buy/sells: ${rawToHuman(expectedTaxTotal).toFixed(6)} OG (${formatBps(TOKEN_TAX_BPS)})`);

  if (!DRY_RUN) {
    if (taxOnChain === 0n && expectedTaxTotal > 0n && isToken2022) {
      console.log('\n⚠️  Jackpot ATA unchanged — Token-2022 fees are withheld on trader ATAs until harvest.');
      console.log('   Run: node scripts/withdraw-token2022-fees.js  then  node scripts/harmonized-drip-settlement.js');
    } else if (taxOnChain === 0n && expectedTaxTotal > 0n) {
      console.log('\n⚠️  On-chain tax = 0 — mint has no transfer fee extension.');
    } else if (taxOnChain >= expectedTaxTotal * 95n / 100n) {
      console.log('\n✅ Jackpot tax wallet tracking matches buy/sell model.');
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(
      MANIFEST_OUT,
      JSON.stringify(
        {
          network: 'devnet',
          createdAt: new Date().toISOString(),
          taxBps: TOKEN_TAX_BPS,
          model: 'buy_sell_2.5pct_on_token_leg',
          pool: poolAddr,
          expectedTaxTokens: rawToHuman(expectedTaxTotal),
          onChainTaxTokens: rawToHuman(taxOnChain),
          wallets: rows,
        },
        null,
        2
      ),
      'utf8'
    );
    console.log(`\nSaved: ${MANIFEST_OUT}`);
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
