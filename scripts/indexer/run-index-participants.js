#!/usr/bin/env node
/**
 * Sync on-chain participant PDAs into local indexer store.
 *
 *   node scripts/indexer/run-index-participants.js
 *   node scripts/indexer/run-index-participants.js --round-id 2026-07-02-r001 --round-opened 2026-07-02T00:00:00.000Z
 */
const { syncParticipants } = require('../lib/participant-indexer');
const { exportPublicStatus } = require('../lib/indexer-public-export');

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}

async function main() {
  const roundId = arg('round-id');
  const roundOpenedAt = arg('round-opened');
  const result = await syncParticipants({ roundId, roundOpenedAt });
  exportPublicStatus();
  console.log('\nDone.', result.state.participantCount, 'entrants indexed.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
