#!/usr/bin/env node
/**
 * Build draw manifest (entrant list + merkle root + winners if snapshot taken).
 *
 *   node scripts/indexer/publish-manifest.js
 */
const { loadState, loadParticipants, saveManifest, saveState } = require('../lib/indexer-store');
const { buildDrawManifest } = require('../lib/manifest');
const { exportPublicStatus } = require('../lib/indexer-public-export');
const { syncParticipants } = require('../lib/participant-indexer');

async function main() {
  const state = loadState();
  const roundId = state.roundId || 'default';
  const { lottery } = await syncParticipants({ roundId, roundOpenedAt: state.roundOpenedAt });
  const participants = loadParticipants(roundId);
  if (!participants.length) {
    throw new Error('No participants indexed — run run-index-participants.js first');
  }

  const manifest = buildDrawManifest({
    roundId,
    snapshotSeed: lottery.snapshotSeed,
    participants,
    lottery,
  });

  const fullPath = saveManifest(roundId, 'draw-manifest.json', manifest);
  const summary = { ...manifest, participants: undefined, participantListFile: 'draw-manifest.json' };
  const summaryPath = saveManifest(roundId, 'draw-manifest-summary.json', summary);

  saveState({ lastManifestAt: new Date().toISOString(), lastManifestMerkle: manifest.merkleRoot });
  exportPublicStatus();

  console.log('Manifest:', fullPath);
  console.log('Summary:', summaryPath);
  console.log('Merkle root:', manifest.merkleRoot);
  console.log('Entrants:', manifest.participantCount, 'Tickets:', manifest.totalTickets);
  if (manifest.winners) {
    console.log('Main winner:', manifest.winners.mainWinner);
  } else {
    console.log('No snapshot seed yet — winners not computed');
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
