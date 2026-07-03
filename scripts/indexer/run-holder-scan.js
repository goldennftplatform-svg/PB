#!/usr/bin/env node
/**
 * Scan registry mints for qualifying holders (combined USD tiers).
 *
 *   node scripts/indexer/run-holder-scan.js
 */
const { scanQualifiedHolders } = require('../lib/holder-scan');
const { loadState, saveState, saveQualifiedHolders } = require('../lib/indexer-store');
const { exportPublicStatus } = require('../lib/indexer-public-export');

async function main() {
  const state = loadState();
  const roundId = state.roundId || 'default';
  const holders = await scanQualifiedHolders();
  saveQualifiedHolders(roundId, holders);
  saveState({
    lastHolderScanAt: new Date().toISOString(),
    qualifiedHolderCount: holders.length,
    lastError: null,
  });
  exportPublicStatus();
  console.log(`\nSaved ${holders.length} qualified holders for round ${roundId}`);
}

main().catch((e) => {
  console.error(e.message || e);
  const { saveState } = require('../lib/indexer-store');
  saveState({ lastError: e.message || String(e) });
  process.exit(1);
});
