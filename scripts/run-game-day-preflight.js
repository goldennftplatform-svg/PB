/**
 * Game-day preflight — devnet security + full ODD payout rehearsal.
 *
 * Usage:
 *   node scripts/run-game-day-preflight.js
 *   node scripts/run-game-day-preflight.js --skip-tax
 *   node scripts/run-game-day-preflight.js --entries 14
 *
 * Funds deployer from ~/.config/solana/id.json if deployer balance is low.
 * Writes: devnet/game-day-preflight-report.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} = require('@solana/web3.js');
const { loadKeypair, privateDir } = require('./lib/game-day-wallet');
const {
  LOTTERY_PDA,
  fetchLottery,
  makeEntry,
  takeSnapshot,
  configureTiming,
  setWinnersRaw,
  payoutWinnersRaw,
  getParticipants,
  calculateWinners,
  calcPayoutLamports,
  sendSolPayouts,
} = require('./lib/lottery-raw');
const ledgerLib = require('./lib/round-ledger');

const RPC_URL = process.env.SOLANA_RPC || process.env.RPC_URL || clusterApiUrl('devnet');
const OUT = path.join(__dirname, '..', 'devnet', 'game-day-preflight-report.json');
const SKIP_TAX = process.argv.includes('--skip-tax');
const ENTRY_COUNT = Number(
  process.argv.find((a) => a.startsWith('--entries='))?.split('=')[1] ||
    process.env.ENTRY_COUNT ||
    '14'
);
const MAX_SNAPSHOT_ATTEMPTS = Number(process.env.MAX_SNAPSHOT_ATTEMPTS || '15');
const FUND_DEPLOYER_SOL = Number(process.env.FUND_DEPLOYER_SOL || '3');
const FUND_JACKPOT_SOL = Number(process.env.FUND_JACKPOT_SOL || '2');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadIdKeypair() {
  const p = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'solana', 'id.json');
  if (!fs.existsSync(p)) return null;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8'))));
}

function resolveSigners(onChainAdmin) {
  let adminKp;
  try {
    adminKp = loadKeypair('admin');
  } catch (e) {
    throw new Error(`game-day admin wallet required: ${e.message}`);
  }

  const adminAddr = adminKp.publicKey.toBase58();
  if (onChainAdmin && onChainAdmin !== adminAddr) {
    throw new Error(
      `Lottery admin is ${onChainAdmin} but game-day admin is ${adminAddr}. ` +
        'Run: SOLANA_CLUSTER=devnet node scripts/init-lottery-game-day.js (after close/reinit if needed).'
    );
  }

  return {
    adminSigner: adminKp,
    adminRole: 'admin',
    snapshotSigner: adminKp,
    snapshotRole: 'admin',
  };
}

async function ensureFunded(connection, funder, recipient, minSol) {
  const bal = await connection.getBalance(recipient.publicKey);
  if (bal >= minSol * LAMPORTS_PER_SOL) return null;
  const need = Math.ceil((minSol * LAMPORTS_PER_SOL - bal) * 1.05);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: funder.publicKey,
      toPubkey: recipient.publicKey,
      lamports: need,
    })
  );
  const sig = await connection.sendTransaction(tx, [funder]);
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

function runAudit() {
  try {
    const out = execSync('node scripts/audit-no-wallet-secrets.js', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });
    return { pass: true, output: out };
  } catch (e) {
    const msg = (e.stdout || '') + (e.stderr || '') + e.message;
    const devnetOnly = msg.includes('devnet/tax-test-wallets');
    return { pass: false, devnetOnly, output: msg };
  }
}

async function expectTxFail(label, fn) {
  try {
    await fn();
    return { label, pass: false, error: 'Expected failure but tx succeeded' };
  } catch (e) {
    return { label, pass: true, error: e.message.split('\n')[0] };
  }
}

async function runNegativeTests(connection, admin, wrongWallet) {
  const results = [];

  results.push(
    await expectTxFail('random wallet cannot snapshot', () =>
      takeSnapshot(connection, wrongWallet)
    )
  );

  const { fields } = await fetchLottery(connection);
  if (fields.totalParticipants < 9) {
    try {
      await takeSnapshot(connection, admin);
      results.push({ label: '<9 participants blocks snapshot', pass: false, error: 'succeeded' });
    } catch (e) {
      results.push({
        label: '<9 participants blocks snapshot',
        pass: true,
        error: e.message.split('\n')[0],
      });
    }
  } else {
    results.push({ label: '<9 participants blocks snapshot', pass: true, skipped: true });
  }

  try {
    const fakeMain = Keypair.generate().publicKey;
    await setWinnersRaw(connection, wrongWallet, fakeMain, []);
    results.push({ label: 'wrong signer cannot set_winners', pass: false, error: 'succeeded' });
  } catch (e) {
    results.push({
      label: 'wrong signer cannot set_winners',
      pass: true,
      error: e.message.split('\n')[0],
    });
  }

  return results;
}

async function addEntries(connection, funder, count, entryRows) {
  const baseAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000];
  let added = 0;
  for (let i = 0; i < count; i++) {
    const wallet = Keypair.generate();
    const usd = baseAmounts[i % baseAmounts.length];
    try {
      await ensureFunded(connection, funder, wallet, 0.06);
      await sleep(350);
      const sig = await makeEntry(connection, wallet, usd);
      entryRows.push({ wallet: wallet.publicKey.toBase58(), usdCents: usd, tx: sig });
      added++;
      await sleep(400);
    } catch (e) {
      entryRows.push({ wallet: wallet.publicKey.toBase58(), error: e.message });
    }
  }
  return added;
}

async function snapshotUntilOdd(connection, admin, funder, report, entryRows) {
  const waits = [];
  for (let attempt = 1; attempt <= MAX_SNAPSHOT_ATTEMPTS; attempt++) {
    const before = await fetchLottery(connection);
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - before.fields.lastSnapshot;
    const interval = before.fields.baseIntervalSec || 60;
    if (elapsed < interval) {
      const waitMs = (interval - elapsed + 2) * 1000;
      console.log(`  ⏳ Waiting ${Math.ceil(waitMs / 1000)}s for draw interval…`);
      await sleep(waitMs);
    }

    console.log(`  📸 Snapshot attempt ${attempt}/${MAX_SNAPSHOT_ATTEMPTS}…`);
    console.log('  📝 Fresh entries for this draw round…');
    const added = await addEntries(connection, funder, 10, entryRows);
    if (added < 9) throw new Error(`Need 9+ entries before snapshot, got ${added}`);
    const sig = await takeSnapshot(connection, admin);
    await sleep(2500);
    const after = await fetchLottery(connection);

    const txInfo = await connection.getTransaction(sig, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    const logs = (txInfo?.meta?.logMessages ?? []).join('\n');
    const logPepe = logs.match(/[Pp]epe\s+[Bb]all\s+[Cc]ount:\s*(\d+)/)?.[1];
    const logSeed = logs.match(/Snapshot\s+Seed:\s*(\d+)/i)?.[1];
    const pepe = logPepe ? parseInt(logPepe, 10) : after.fields.pepeBallCount;
    const seed = logSeed || (after.fields.snapshotSeed !== '0' ? after.fields.snapshotSeed : null);
    const isOdd = pepe >= 1 && pepe <= 30 ? pepe % 2 === 1 : false;

    const row = {
      attempt,
      tx: sig,
      pepe,
      seed,
      isOdd: !!isOdd,
      participants: after.fields.totalParticipants,
      tickets: after.fields.totalTickets,
    };
    waits.push(row);
    console.log(
      `     pepe=${pepe} → ${isOdd ? 'ODD ✅' : 'EVEN (rollover)'} seed=${seed || '—'}`
    );

    if (isOdd && seed) {
      return { ...row, attempts: waits };
    }

    if (!isOdd) {
      console.log('     EVEN rollover — will re-enter before next attempt');
    }

    report.warnings = report.warnings || [];
    if (!isOdd) {
      const futureSnap = after.fields.lastSnapshot > now + interval;
      if (futureSnap) {
        report.warnings.push(
          'EVEN rollover pushed last_snapshot far ahead — may need to wait hours between attempts on this build'
        );
      }
    }
  }
  throw new Error(`No ODD snapshot after ${MAX_SNAPSHOT_ATTEMPTS} attempts`);
}

async function runTaxPhase(connection, funder, report) {
  console.log('\n── Phase 4: Tax pipeline ──');
  let jackpot;
  try {
    jackpot = loadKeypair('jackpot_tax');
  } catch (e) {
    report.tax = { skipped: true, reason: e.message };
    console.log('  ⚠️  Skip tax:', e.message);
    return;
  }

  await ensureFunded(connection, funder, jackpot, FUND_JACKPOT_SOL);
  const before = await connection.getBalance(jackpot.publicKey);

  let dripOk = false;
  let dripError = null;
  try {
    execSync('node harmonized-drip-settlement.js', {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    dripOk = true;
  } catch (e) {
    dripError = (e.stdout || e.stderr || e.message).split('\n').slice(-5).join(' ');
  }

  const after = await connection.getBalance(jackpot.publicKey);
  report.tax = {
    wallet: jackpot.publicKey.toBase58(),
    solBefore: before / LAMPORTS_PER_SOL,
    solAfter: after / LAMPORTS_PER_SOL,
    dripOk,
    dripError,
  };
  console.log(
    dripOk
      ? `  ✅ tax:drip OK — jackpot_tax ${(after / LAMPORTS_PER_SOL).toFixed(4)} SOL`
      : `  ⚠️  tax:drip: ${dripError || 'failed'}`
  );
}

async function main() {
  const report = {
    network: 'devnet',
    at: new Date().toISOString(),
    rpc: RPC_URL,
    entryCount: ENTRY_COUNT,
    phases: {},
    warnings: [],
  };

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  GAME-DAY PREFLIGHT (devnet)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const connection = new Connection(RPC_URL, 'confirmed');
  const funder = loadIdKeypair();
  if (!funder) throw new Error('Need ~/.config/solana/id.json to fund test wallets');

  console.log('── Phase 0: Opsec audit ──');
  const audit = runAudit();
  report.phases.audit = audit;
  if (audit.pass) {
    console.log('  ✅ audit-no-wallet-secrets PASS');
  } else if (audit.devnetOnly) {
    console.log('  ⚠️  audit FAIL — devnet test wallets in repo (gitignore before mainnet)');
    report.warnings.push('gitignore devnet/tax-test-wallets before mainnet funding');
  } else {
    console.log('  ❌ audit FAIL');
  }

  console.log('\n── Phase 1: Wallet verify ──');
  const walletRoles = ['deployer', 'admin', 'jackpot_tax'];
  report.phases.wallets = {};
  for (const role of walletRoles) {
    try {
      const kp = loadKeypair(role);
      const bal = await connection.getBalance(kp.publicKey);
      report.phases.wallets[role] = {
        address: kp.publicKey.toBase58(),
        sol: bal / LAMPORTS_PER_SOL,
      };
      console.log(`  ✅ ${role}: ${kp.publicKey.toBase58()} (${(bal / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);
    } catch (e) {
      report.phases.wallets[role] = { error: e.message };
      console.log(`  ⚠️  ${role}: ${e.message}`);
    }
  }
  console.log(`  📁 Key dir: ${privateDir()}`);

  const { fields: lotBefore } = await fetchLottery(connection);
  const { adminSigner, adminRole, snapshotSigner, snapshotRole } = resolveSigners(lotBefore.admin);
  console.log(`\n  Lottery admin (on-chain): ${lotBefore.admin}`);
  console.log(`  Snapshot signer:          ${snapshotSigner.publicKey.toBase58()} (${snapshotRole})`);
  console.log(`  Settlement signer:        ${adminSigner.publicKey.toBase58()} (${adminRole})`);
  if (adminSigner.publicKey.toBase58() !== lotBefore.admin) {
    report.warnings.push(
      `On-chain admin field parse may not match settlement wallet — using ${adminRole} for set_winners`
    );
  }

  try {
    let { ledger } = ledgerLib.loadLedger();
    const active = ledgerLib.getActiveRound(ledger);
    if (!active || ['settled', 'rolled'].includes(active.status)) {
      ledgerLib.openRound(ledger, {
        solCommittedLamports: lotBefore.jackpotLamports,
        notes: 'game-day-preflight',
      });
    } else {
      ledgerLib.setSolCommitted(ledger, lotBefore.jackpotLamports);
    }
    ledgerLib.saveLedger(ledger);
    ledgerLib.exportPublic(ledger);
    console.log(`\n  📒 Round ledger: ${ledger.activeRoundId}`);
  } catch (e) {
    report.warnings.push(`round ledger open: ${e.message}`);
  }

  console.log('\n── Phase 2: Fund hot wallets ──');
  const fundDeployerSig = await ensureFunded(
    connection,
    funder,
    snapshotSigner,
    FUND_DEPLOYER_SOL
  );
  await ensureFunded(connection, funder, adminSigner, 0.1);
  if (fundDeployerSig) console.log(`  ✅ Funded deployer/admin +${FUND_DEPLOYER_SOL} SOL`);
  else console.log('  ✅ Deployer/admin already funded');

  console.log('\n── Phase 3: Negative security tests ──');
  const wrong = Keypair.generate();
  await ensureFunded(connection, funder, wrong, 0.01);
  const negatives = await runNegativeTests(connection, adminSigner, wrong);
  report.phases.negative = negatives;
  for (const n of negatives) {
    console.log(`  ${n.pass ? '✅' : '❌'} ${n.label}${n.skipped ? ' (skipped)' : ''}`);
  }

  console.log('\n── Phase 4: Configure test timing (60s / 30s) ──');
  try {
    const cfgSig = await configureTiming(connection, adminSigner, 60, 30, LAMPORTS_PER_SOL);
    report.phases.configureTiming = { ok: true, tx: cfgSig };
    console.log('  ✅ configure_timing', cfgSig.slice(0, 20) + '…');
  } catch (e) {
    report.phases.configureTiming = { ok: false, error: e.message };
    console.log('  ⚠️  configure_timing failed:', e.message.split('\n')[0]);
  }

  console.log(`\n── Phase 5: Initial ${ENTRY_COUNT} lottery entries ──`);
  const entryRows = [];
  const initialAdded = await addEntries(connection, funder, ENTRY_COUNT, entryRows);
  console.log(`  ✅ ${initialAdded}/${ENTRY_COUNT} entries`);
  if (initialAdded < 9) throw new Error(`Need 9+ entries, got ${initialAdded}`);

  console.log('\n── Phase 6: Snapshot until ODD ──');
  const snap = await snapshotUntilOdd(connection, snapshotSigner, funder, report, entryRows);
  report.phases.entries = {
    requested: ENTRY_COUNT,
    ok: entryRows.filter((r) => r.tx).length,
    rows: entryRows,
  };
  report.phases.snapshot = snap;

  console.log('\n── Phase 7: Winner index + set_winners ──');
  const participants = await getParticipants(connection);
  const winners = calculateWinners(participants, snap.seed);
  const setSig = await setWinnersRaw(
    connection,
    adminSigner,
    winners.mainWinner,
    winners.minorWinners
  );
  report.phases.winners = {
    main: winners.mainWinner.toBase58(),
    minors: winners.minorWinners.map((w) => w.toBase58()),
    winningTicketIndex: winners.winIdx,
    totalTickets: winners.totalTickets,
    setWinnersTx: setSig,
  };
  console.log(`  ✅ Main winner: ${winners.mainWinner.toBase58()}`);
  console.log(`  ✅ Minors: ${winners.minorWinners.length}`);

  console.log('\n── Phase 8: SOL payout (jackpot_tax → winners) ──');
  let payoutWallet;
  try {
    payoutWallet = loadKeypair('jackpot_tax');
  } catch {
    payoutWallet = funder;
    report.warnings.push('Used id.json as payout wallet — fund jackpot_tax for production-like test');
  }
  await ensureFunded(connection, funder, payoutWallet, FUND_JACKPOT_SOL);

  const { fields: lotOdd } = await fetchLottery(connection);
  const payerBal = await connection.getBalance(payoutWallet.publicKey);
  const payoutLamports = Math.min(lotOdd.jackpotLamports, payerBal - Math.floor(0.05 * LAMPORTS_PER_SOL));
  const planned = calcPayoutLamports(payoutLamports);
  console.log(
    `  💰 Paying from ${payoutWallet.publicKey.toBase58()} — ~${(Number(planned.total) / LAMPORTS_PER_SOL).toFixed(4)} SOL`
  );

  const solPayout = await sendSolPayouts(
    connection,
    payoutWallet,
    payoutLamports,
    winners.mainWinner,
    winners.minorWinners
  );
  report.phases.solPayout = {
    tx: solPayout.sig,
    mainSol: solPayout.mainSol,
    minorSolEach: solPayout.minorSol,
    from: payoutWallet.publicKey.toBase58(),
  };
  console.log(`  ✅ SOL sent — main ${solPayout.mainSol.toFixed(4)} SOL, each minor ${solPayout.minorSol.toFixed(4)} SOL`);

  console.log('\n── Phase 9: On-chain payout_winners (state reset) ──');
  const payoutSig = await payoutWinnersRaw(connection, adminSigner);
  report.phases.onChainPayout = { tx: payoutSig };
  console.log('  ✅ payout_winners', payoutSig.slice(0, 20) + '…');

  if (!SKIP_TAX) {
    await runTaxPhase(connection, funder, report);
  } else {
    console.log('\n── Phase 4: Tax pipeline (skipped) ──');
  }

  const { fields: lotAfter } = await fetchLottery(connection);
  report.summary = {
    outcome: 'ODD_PAYOUT_COMPLETE',
    participantsAfter: lotAfter.totalParticipants,
    ticketsAfter: lotAfter.totalTickets,
    jackpotSolAfter: lotAfter.jackpotSol,
    snapshotTx: snap.tx,
    solPayoutTx: solPayout.sig,
    onChainPayoutTx: payoutSig,
  };

  try {
    const { ledger } = ledgerLib.loadLedger();
    ledgerLib.recordSnapshot(ledger, {
      pepeBallCount: snap.pepe,
      snapshotSeed: snap.seed,
      snapshotTx: snap.tx,
      preSnapshotLamports: lotOdd.jackpotLamports,
    });
    ledgerLib.recordSettlement(ledger, {
      mainWinner: winners.mainWinner.toBase58(),
      minorWinners: winners.minorWinners.map((w) => w.toBase58()),
      solPayoutTx: solPayout.sig,
      payoutWinnersTx: payoutSig,
    });
    ledgerLib.saveLedger(ledger);
    const exp = ledgerLib.exportPublic(ledger);
    report.phases.roundLedger = { roundId: ledger.activeRoundId, exportPath: exp.path };
    console.log('\n  📒 Round ledger updated →', exp.path);
  } catch (e) {
    report.warnings.push(`round ledger settle: ${e.message}`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ PREFLIGHT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Report:', OUT);
  console.log('  Snapshot:', `https://solscan.io/tx/${snap.tx}?cluster=devnet`);
  console.log('  SOL payout:', `https://solscan.io/tx/${solPayout.sig}?cluster=devnet`);
  console.log('');
}

main().catch((e) => {
  console.error('\n❌ Preflight failed:', e.message);
  if (e.logs) e.logs.forEach((l) => console.error('  ', l));
  process.exit(1);
});
