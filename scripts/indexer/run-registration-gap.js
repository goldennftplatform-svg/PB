#!/usr/bin/env node
/**
 * Compare qualified holders vs registered on-chain entrants.
 * Writes registration-gap.json — wallets that hold enough but have not entered.
 *
 *   node scripts/indexer/run-registration-gap.js
 */
const fs = require('fs');
const {
  loadState,
  saveState,
  loadParticipants,
  loadQualifiedHolders,
  gapReportPath,
  writeJsonAtomic,
} = require('../lib/indexer-store');
const { exportPublicStatus } = require('../lib/indexer-public-export');

async function main() {
  const state = loadState();
  const roundId = state.roundId || 'default';
  const holders = loadQualifiedHolders(roundId);
  const participants = loadParticipants(roundId);
  const registered = new Set(participants.map((p) => p.wallet));

  const unregistered = holders.filter((h) => !registered.has(h.wallet));
  const report = {
    version: 1,
    roundId,
    generatedAt: new Date().toISOString(),
    qualifiedHolderCount: holders.length,
    registeredCount: participants.length,
    gapCount: unregistered.length,
    coveragePercent: holders.length
      ? Math.round((1000 * (holders.length - unregistered.length)) / holders.length) / 10
      : 100,
    unregisteredSample: unregistered.slice(0, 50).map((h) => ({
      wallet: h.wallet,
      tickets: h.tickets,
      combinedUsdCents: h.combinedUsdCents,
    })),
    note:
      'Wallets must sign enter_lottery on-chain to register. Gap list = marketing / Register CTA targets.',
  };

  const out = gapReportPath(roundId);
  writeJsonAtomic(out, report);
  saveState({
    registeredGapCount: unregistered.length,
    lastError: null,
  });
  exportPublicStatus();

  console.log(`Qualified holders: ${holders.length}`);
  console.log(`Registered entrants: ${participants.length}`);
  console.log(`Gap (hold but not registered): ${unregistered.length}`);
  console.log(`Coverage: ${report.coveragePercent}%`);
  console.log(`Report: ${out}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
