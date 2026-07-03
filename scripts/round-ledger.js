#!/usr/bin/env node
/**
 * Round ledger CLI — fixed SOL + optional meme callout per draw round.
 *
 *   node scripts/round-ledger.js status
 *   node scripts/round-ledger.js open --sol 10
 *   node scripts/round-ledger.js open --sol 10 --callout --mint <PUBKEY>
 *   node scripts/round-ledger.js set-sol --sol 42.5
 *   node scripts/round-ledger.js enable-callout --mint <PUBKEY>
 *   node scripts/round-ledger.js record-meme-buy --raw 1200000000 --sol 1 --tx <SIG>
 *   node scripts/round-ledger.js record-snapshot --pepe 7 --seed 843930448394710746 --tx <SIG>
 *   node scripts/round-ledger.js record-settlement --main <PUBKEY> --sol-tx <SIG> --payout-tx <SIG>
 *   node scripts/round-ledger.js splits --sol 10
 *   node scripts/round-ledger.js splits --meme-raw 1000000000
 *   node scripts/round-ledger.js export-public
 *   node scripts/round-ledger.js list
 */

const { LAMPORTS_PER_SOL } = require('@solana/web3.js');
const {
  loadLedger,
  saveLedger,
  ledgerPath,
  openRound,
  getActiveRound,
  setSolCommitted,
  enableCallout,
  recordMemeBuy,
  recordSnapshot,
  recordSettlement,
  markRolled,
  calcSolPayoutSplits,
  calcMemePayoutSplits,
  exportPublic,
} = require('./lib/round-ledger');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function solToLamports(sol) {
  return Math.floor(Number(sol) * LAMPORTS_PER_SOL);
}

function printRound(r) {
  console.log(`\n  ID:      ${r.id}`);
  console.log(`  Status:  ${r.status}  phase ${r.phase}`);
  console.log(`  SOL:     ${(Number(r.sol.committedLamports) / LAMPORTS_PER_SOL).toFixed(4)} committed`);
  if (r.callout.enabled) {
    console.log(`  Callout: ${r.callout.mint}`);
    console.log(`  Meme:    ${r.callout.memeStashRaw} raw`);
  }
  if (r.draw.pepeBallCount != null) {
    console.log(`  Draw:    pepe=${r.draw.pepeBallCount} → ${r.draw.outcome}`);
  }
  if (r.notes) console.log(`  Notes:   ${r.notes}`);
}

function cmdStatus() {
  const { ledger, path: p } = loadLedger();
  console.log('\n═══ Round ledger ═══');
  console.log('File:', p);
  console.log('Rounds:', ledger.rounds.length);
  console.log('Active:', ledger.activeRoundId || '(none)');
  const active = getActiveRound(ledger);
  if (active) printRound(active);
  else console.log('\n  No active round. Run: node scripts/round-ledger.js open --sol 10\n');
}

function cmdOpen() {
  const sol = arg('--sol');
  if (!sol) throw new Error('--sol required (e.g. --sol 10)');
  const { ledger } = loadLedger();
  const round = openRound(ledger, {
    solCommittedLamports: solToLamports(sol),
    calloutEnabled: hasFlag('--callout'),
    memeMint: arg('--mint'),
    notes: arg('--notes') || '',
  });
  const saved = saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Opened round', round.id);
  console.log('   SOL committed:', sol, 'SOL');
  if (round.callout.enabled) console.log('   Meme callout:', round.callout.mint);
  console.log('   Saved:', saved);
}

function cmdSetSol() {
  const sol = arg('--sol');
  const lam = arg('--lamports');
  const { ledger } = loadLedger();
  const v = lam != null ? Number(lam) : solToLamports(sol);
  if (!v) throw new Error('--sol or --lamports required');
  const round = setSolCommitted(ledger, v);
  saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Updated', round.id, '→', (v / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
}

function cmdEnableCallout() {
  const mint = arg('--mint');
  if (!mint) throw new Error('--mint required');
  const { ledger } = loadLedger();
  const round = enableCallout(ledger, mint);
  saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Callout enabled on', round.id, '→', mint);
}

function cmdRecordMemeBuy() {
  const raw = arg('--raw');
  const sol = arg('--sol');
  if (!raw || !sol) throw new Error('--raw and --sol required');
  const { ledger } = loadLedger();
  const round = recordMemeBuy(ledger, {
    memeStashRaw: raw,
    buySolLamports: solToLamports(sol),
    buyTx: arg('--tx'),
  });
  saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Meme buy recorded on', round.id);
  console.log('   Stash:', raw, 'raw tokens');
  console.log('   Spent:', sol, 'SOL');
}

function cmdRecordSnapshot() {
  const pepe = arg('--pepe');
  if (!pepe) throw new Error('--pepe required (1-30)');
  const { ledger } = loadLedger();
  const round = recordSnapshot(ledger, {
    pepeBallCount: Number(pepe),
    snapshotSeed: arg('--seed'),
    snapshotTx: arg('--tx'),
    preSnapshotLamports: arg('--pre-sol-lamports') || (arg('--pre-sol') ? String(solToLamports(arg('--pre-sol'))) : null),
  });
  saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Snapshot recorded on', round.id);
  console.log('   Outcome:', round.draw.outcome);
}

function cmdRecordSettlement() {
  const main = arg('--main');
  const { ledger } = loadLedger();
  const minors = [];
  for (let i = 0; process.argv.includes(`--minor${i}`); i++) {
    const m = arg(`--minor${i}`);
    if (m) minors.push(m);
  }
  const round = recordSettlement(ledger, {
    mainWinner: main,
    minorWinners: minors,
    solPayoutTx: arg('--sol-tx'),
    payoutWinnersTx: arg('--payout-tx'),
  });
  saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Settlement recorded on', round.id);
  if (round.settlement.solSplits) {
    const s = round.settlement.solSplits;
    console.log('   SOL main:', (Number(s.mainLamports) / LAMPORTS_PER_SOL).toFixed(4));
    console.log('   SOL each minor:', (Number(s.minorEachLamports) / LAMPORTS_PER_SOL).toFixed(4));
  }
}

function cmdMarkRolled() {
  const { ledger } = loadLedger();
  const round = markRolled(ledger, {
    carrySolLamports: arg('--carry-sol') ? solToLamports(arg('--carry-sol')) : null,
    carryMemeRaw: arg('--carry-meme-raw'),
  });
  saveLedger(ledger);
  exportPublic(ledger);
  console.log('\n✅ Marked rolled:', round.id);
}

function cmdSplits() {
  const sol = arg('--sol');
  const meme = arg('--meme-raw');
  if (sol) {
    const s = calcSolPayoutSplits(solToLamports(sol));
    console.log('\nSOL splits for', sol, 'SOL:');
    console.log('  Main (50%):', (Number(s.mainLamports) / LAMPORTS_PER_SOL).toFixed(6));
    console.log('  Each minor (5% ×8):', (Number(s.minorEachLamports) / LAMPORTS_PER_SOL).toFixed(6));
    console.log('  House (10%):', (Number(s.houseLamports) / LAMPORTS_PER_SOL).toFixed(6));
  }
  if (meme) {
    const m = calcMemePayoutSplits(meme);
    console.log('\nMeme splits for', meme, 'raw:');
    console.log('  Main (64%):', m.mainRaw);
    console.log('  Each minor (4.25% ×8):', m.minorEachRaw);
    console.log('  Dev (2%):', m.devRaw);
  }
  if (!sol && !meme) throw new Error('--sol or --meme-raw required');
}

function cmdList() {
  const { ledger } = loadLedger();
  console.log('\nRounds:', ledger.rounds.length);
  for (const r of ledger.rounds.slice(-10)) {
    printRound(r);
  }
  console.log('');
}

function cmdExport() {
  const { ledger } = loadLedger();
  const { path: p, summary } = exportPublic(ledger);
  console.log('\n✅ Public summary →', p);
  if (summary.active) {
    console.log('   Active:', summary.active.id, '—', summary.active.solCommittedSol, 'SOL');
  }
}

function main() {
  const cmd = process.argv[2];
  const map = {
    status: cmdStatus,
    open: cmdOpen,
    'set-sol': cmdSetSol,
    'enable-callout': cmdEnableCallout,
    'record-meme-buy': cmdRecordMemeBuy,
    'record-snapshot': cmdRecordSnapshot,
    'record-settlement': cmdRecordSettlement,
    'mark-rolled': cmdMarkRolled,
    splits: cmdSplits,
    list: cmdList,
    'export-public': cmdExport,
  };
  if (!cmd || !map[cmd]) {
    console.log('Usage: node scripts/round-ledger.js <command>');
    console.log('Commands:', Object.keys(map).join(', '));
    process.exit(cmd ? 1 : 0);
  }
  try {
    map[cmd]();
  } catch (e) {
    console.error('\n❌', e.message || e);
    process.exit(1);
  }
}

main();
