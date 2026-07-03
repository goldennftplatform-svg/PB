#!/usr/bin/env node
/**
 * Bind indexer to active round-ledger round.
 *
 *   node scripts/indexer/sync-round-from-ledger.js
 */
const ledgerLib = require('../lib/round-ledger');
const { saveState } = require('../lib/indexer-store');
const { exportPublicStatus } = require('../lib/indexer-public-export');

function main() {
  const { ledger } = ledgerLib.loadLedger();
  const active = ledgerLib.getActiveRound(ledger);
  if (!active) {
    console.error('No active round in round-ledger — run: node scripts/round-ledger.js open-round …');
    process.exit(1);
  }
  saveState({
    roundId: active.id,
    roundOpenedAt: active.openedAt,
  });
  exportPublicStatus();
  console.log('Indexer bound to round', active.id, 'opened', active.openedAt);
}

main();
