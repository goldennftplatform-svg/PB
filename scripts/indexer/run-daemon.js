#!/usr/bin/env node
/**
 * Option B indexer daemon — run on your VPS with paid RPC in env.
 *
 *   node scripts/indexer/run-daemon.js
 *
 * Env:
 *   INDEXER_SYNC_INTERVAL_MS=300000   (5 min)
 *   INDEXER_HOLDER_SCAN_EVERY=12      (every 12 sync cycles)
 */
const { syncParticipants } = require('../lib/participant-indexer');
const { scanQualifiedHolders } = require('../lib/holder-scan');
const {
  loadState,
  saveState,
  saveQualifiedHolders,
  gapReportPath,
  writeJsonAtomic,
  loadParticipants,
  loadQualifiedHolders,
} = require('../lib/indexer-store');
const { exportPublicStatus } = require('../lib/indexer-public-export');

const INTERVAL = Number(process.env.INDEXER_SYNC_INTERVAL_MS || 300000);
const HOLDER_EVERY = Number(process.env.INDEXER_HOLDER_SCAN_EVERY || 12);
let cycle = 0;

function updateGapReport(roundId) {
  const holders = loadQualifiedHolders(roundId);
  const participants = loadParticipants(roundId);
  const registered = new Set(participants.map((p) => p.wallet));
  const gap = holders.filter((h) => !registered.has(h.wallet));
  writeJsonAtomic(gapReportPath(roundId), {
    version: 1,
    roundId,
    generatedAt: new Date().toISOString(),
    gapCount: gap.length,
    qualifiedHolderCount: holders.length,
    registeredCount: participants.length,
  });
  saveState({ registeredGapCount: gap.length });
}

async function tick() {
  cycle += 1;
  console.log(`\n[indexer-daemon] cycle ${cycle} @ ${new Date().toISOString()}`);
  const state = loadState();
  const roundId = state.roundId || 'default';

  try {
    await syncParticipants({ roundId, roundOpenedAt: state.roundOpenedAt });

    if (cycle === 1 || cycle % HOLDER_EVERY === 0) {
      console.log('[indexer-daemon] holder scan…');
      const holders = await scanQualifiedHolders();
      saveQualifiedHolders(roundId, holders);
      saveState({
        lastHolderScanAt: new Date().toISOString(),
        qualifiedHolderCount: holders.length,
      });
    }

    updateGapReport(roundId);
    exportPublicStatus();
    saveState({ lastError: null });
  } catch (e) {
    console.error('[indexer-daemon] error:', e.message || e);
    saveState({ lastError: e.message || String(e) });
  }
}

async function main() {
  console.log('PEPEBALL indexer daemon (Option B)');
  console.log('Interval ms:', INTERVAL);
  console.log('Data dir:', require('../lib/indexer-store').dataDir());
  await tick();
  setInterval(tick, INTERVAL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
