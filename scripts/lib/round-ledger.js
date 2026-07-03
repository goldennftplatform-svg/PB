/**
 * Round ledger — fixed SOL commitment + optional meme callout stash per draw round.
 * SOL jackpot and meme bonus are separate buckets (see docs/ROUND_LEDGER.md).
 */
const fs = require('fs');
const path = require('path');
const { LAMPORTS_PER_SOL } = require('@solana/web3.js');

const LEDGER_VERSION = 1;

const SOL_SPLITS = {
  mainBps: 5000n,
  minorTotalBps: 4000n,
  minorCount: 8n,
  houseBps: 1000n,
};

const MEME_SPLITS = {
  /** 64% main — includes former 6% rollover reserve (one-and-done, no meme carry) */
  mainBps: 6400n,
  minorEachBps: 425n,
  minorCount: 8n,
  devBps: 200n,
};

function ledgerPath() {
  if (process.env.ROUND_LEDGER_PATH) return process.env.ROUND_LEDGER_PATH;
  const outside = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    'pepeball-game-day',
    'round-ledger.json'
  );
  if (fs.existsSync(outside) || process.env.GAME_DAY_WALLET_DIR) {
    return outside;
  }
  return path.join(__dirname, '..', '..', 'game-day-wallets', 'round-ledger.json');
}

function publicExportPath() {
  return (
    process.env.ROUND_LEDGER_PUBLIC_PATH ||
    path.join(__dirname, '..', '..', 'v2turbo', 'public', 'round-ledger-public.json')
  );
}

function emptyLedger() {
  return {
    version: LEDGER_VERSION,
    updatedAt: new Date().toISOString(),
    activeRoundId: null,
    rounds: [],
  };
}

function loadLedger() {
  const p = ledgerPath();
  if (!fs.existsSync(p)) {
    return { ledger: emptyLedger(), path: p };
  }
  const ledger = JSON.parse(fs.readFileSync(p, 'utf8'));
  ledger.version = ledger.version ?? LEDGER_VERSION;
  ledger.rounds = ledger.rounds ?? [];
  return { ledger, path: p };
}

function saveLedger(ledger) {
  const p = ledgerPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  ledger.updatedAt = new Date().toISOString();
  ledger.version = LEDGER_VERSION;
  fs.writeFileSync(p, JSON.stringify(ledger, null, 2), 'utf8');
  return p;
}

function nextRoundId(ledger) {
  const d = new Date().toISOString().slice(0, 10);
  const sameDay = ledger.rounds.filter((r) => r.id?.startsWith(d)).length;
  return `${d}-r${String(sameDay + 1).padStart(3, '0')}`;
}

function newRound({ solCommittedLamports = 0, calloutEnabled = false, memeMint = null, notes = '' } = {}) {
  return {
    id: null,
    status: 'open',
    phase: 'A',
    openedAt: new Date().toISOString(),
    notes,
    callout: {
      enabled: Boolean(calloutEnabled),
      mint: memeMint || null,
      buySolLamports: null,
      memeStashRaw: '0',
      buyTx: null,
      boughtAt: null,
    },
    sol: {
      committedLamports: String(solCommittedLamports),
      preSnapshotLamports: null,
      rolledForwardLamports: '0',
    },
    draw: {
      snapshotTx: null,
      snapshotSeed: null,
      pepeBallCount: null,
      outcome: null,
      isOdd: null,
      drawnAt: null,
    },
    settlement: {
      mainWinner: null,
      minorWinners: [],
      solPayoutTx: null,
      payoutWinnersTx: null,
      settledAt: null,
      solSplits: null,
      memeSplits: null,
    },
  };
}

function getActiveRound(ledger) {
  if (!ledger.activeRoundId) return null;
  return ledger.rounds.find((r) => r.id === ledger.activeRoundId) ?? null;
}

function openRound(ledger, opts) {
  const active = getActiveRound(ledger);
  if (active && !['settled', 'rolled'].includes(active.status)) {
    throw new Error(`Round ${active.id} is still ${active.status}. Settle or roll over first.`);
  }
  const round = newRound(opts);
  round.id = nextRoundId(ledger);
  ledger.rounds.push(round);
  ledger.activeRoundId = round.id;
  return round;
}

function findRound(ledger, id) {
  const rid = id || ledger.activeRoundId;
  const round = ledger.rounds.find((r) => r.id === rid);
  if (!round) throw new Error(`Round not found: ${rid}`);
  return round;
}

function setSolCommitted(ledger, lamports, roundId) {
  const round = findRound(ledger, roundId);
  round.sol.committedLamports = String(lamports);
  return round;
}

function enableCallout(ledger, memeMint, roundId) {
  const round = findRound(ledger, roundId);
  round.callout.enabled = true;
  round.callout.mint = memeMint;
  return round;
}

function recordMemeBuy(ledger, { memeStashRaw, buySolLamports, buyTx, roundId }) {
  const round = findRound(ledger, roundId);
  if (!round.callout.enabled) throw new Error('Callout not enabled for this round');
  round.phase = 'B';
  round.callout.memeStashRaw = String(memeStashRaw);
  round.callout.buySolLamports = String(buySolLamports);
  round.callout.buyTx = buyTx || null;
  round.callout.boughtAt = new Date().toISOString();
  return round;
}

function recordSnapshot(ledger, { snapshotTx, snapshotSeed, pepeBallCount, preSnapshotLamports, roundId }) {
  const round = findRound(ledger, roundId);
  round.phase = 'C';
  round.draw.snapshotTx = snapshotTx || null;
  round.draw.snapshotSeed = snapshotSeed != null ? String(snapshotSeed) : null;
  round.draw.pepeBallCount = pepeBallCount != null ? Number(pepeBallCount) : null;
  round.draw.isOdd = pepeBallCount != null ? Number(pepeBallCount) % 2 === 1 : null;
  round.draw.outcome = round.draw.isOdd ? 'ODD_PAYOUT' : 'EVEN_ROLLOVER';
  round.draw.drawnAt = new Date().toISOString();
  if (preSnapshotLamports != null) {
    round.sol.preSnapshotLamports = String(preSnapshotLamports);
  }
  round.status = round.draw.isOdd ? 'drawn' : 'rolled';
  return round;
}

function calcSolPayoutSplits(lamports) {
  const total = BigInt(lamports);
  const main = (total * SOL_SPLITS.mainBps) / 10000n;
  const minorEach = (total * SOL_SPLITS.minorTotalBps) / 10000n / SOL_SPLITS.minorCount;
  const house = (total * SOL_SPLITS.houseBps) / 10000n;
  const paid = main + minorEach * SOL_SPLITS.minorCount;
  return {
    mainLamports: main.toString(),
    minorEachLamports: minorEach.toString(),
    houseLamports: house.toString(),
    paidLamports: paid.toString(),
    totalLamports: total.toString(),
  };
}

function calcMemePayoutSplits(memeStashRaw) {
  const total = BigInt(memeStashRaw);
  const main = (total * MEME_SPLITS.mainBps) / 10000n;
  const minorEach = (total * MEME_SPLITS.minorEachBps) / 10000n;
  const dev = (total * MEME_SPLITS.devBps) / 10000n;
  const paid = main + minorEach * MEME_SPLITS.minorCount + dev;
  return {
    mainRaw: main.toString(),
    minorEachRaw: minorEach.toString(),
    devRaw: dev.toString(),
    paidRaw: paid.toString(),
    totalRaw: total.toString(),
  };
}

function recordSettlement(ledger, { mainWinner, minorWinners, solPayoutTx, payoutWinnersTx, roundId }) {
  const round = findRound(ledger, roundId);
  round.phase = 'D';
  round.settlement.mainWinner = mainWinner || null;
  round.settlement.minorWinners = minorWinners || [];
  round.settlement.solPayoutTx = solPayoutTx || null;
  round.settlement.payoutWinnersTx = payoutWinnersTx || null;
  round.settlement.settledAt = new Date().toISOString();
  const committed = BigInt(round.sol.committedLamports || '0');
  round.settlement.solSplits = calcSolPayoutSplits(committed);
  if (round.callout.enabled && BigInt(round.callout.memeStashRaw || '0') > 0n) {
    round.settlement.memeSplits = calcMemePayoutSplits(round.callout.memeStashRaw);
  }
  round.status = 'settled';
  return round;
}

function markRolled(ledger, { carrySolLamports, carryMemeRaw, roundId }) {
  const round = findRound(ledger, roundId);
  if (round.draw.outcome !== 'EVEN_ROLLOVER') {
    throw new Error('Round is not EVEN rollover');
  }
  round.status = 'rolled';
  round.sol.rolledForwardLamports = String(
    BigInt(round.sol.rolledForwardLamports || '0') + BigInt(carrySolLamports || round.sol.committedLamports || '0')
  );
  if (carryMemeRaw != null) {
    round.callout.memeStashRaw = String(
      BigInt(round.callout.memeStashRaw || '0') + BigInt(carryMemeRaw)
    );
  }
  return round;
}

function toPublicSummary(ledger) {
  const active = getActiveRound(ledger);
  const latest = ledger.rounds[ledger.rounds.length - 1] ?? null;
  const focus = active || latest;
  const solLamports = focus ? BigInt(focus.sol?.committedLamports || '0') : 0n;
  const memeRaw = focus && focus.callout?.enabled ? BigInt(focus.callout.memeStashRaw || '0') : 0n;
  return {
    version: LEDGER_VERSION,
    exportedAt: new Date().toISOString(),
    activeRoundId: ledger.activeRoundId,
    roundCount: ledger.rounds.length,
    active: focus
      ? {
          id: focus.id,
          status: focus.status,
          phase: focus.phase,
          solCommittedSol: Number(solLamports) / LAMPORTS_PER_SOL,
          solCommittedLamports: solLamports.toString(),
          calloutEnabled: Boolean(focus.callout?.enabled),
          memeMint: focus.callout?.mint ?? null,
          memeStashRaw: memeRaw.toString(),
          pepeBallCount: focus.draw?.pepeBallCount ?? null,
          outcome: focus.draw?.outcome ?? null,
          isOdd: focus.draw?.isOdd ?? null,
          openedAt: focus.openedAt,
          notes: focus.notes || '',
        }
      : null,
    splits: {
      sol: {
        mainPercent: 50,
        minorEachPercent: 5,
        minorCount: 8,
        housePercent: 10,
      },
      meme: {
        mainPercent: 64,
        minorEachPercent: 4.25,
        minorCount: 8,
        devPercent: 2,
        oneAndDone: true,
      },
    },
  };
}

function exportPublic(ledger) {
  const out = publicExportPath();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const summary = toPublicSummary(ledger);
  fs.writeFileSync(out, JSON.stringify(summary, null, 2), 'utf8');
  return { path: out, summary };
}

module.exports = {
  LEDGER_VERSION,
  ledgerPath,
  publicExportPath,
  loadLedger,
  saveLedger,
  openRound,
  getActiveRound,
  findRound,
  setSolCommitted,
  enableCallout,
  recordMemeBuy,
  recordSnapshot,
  recordSettlement,
  markRolled,
  calcSolPayoutSplits,
  calcMemePayoutSplits,
  toPublicSummary,
  exportPublic,
};
