/**
 * Export indexer status for the public site (v2turbo/public/indexer-status-public.json).
 */
const fs = require('fs');
const path = require('path');
const { loadState } = require('./indexer-store');

function publicExportPath() {
  return (
    process.env.INDEXER_STATUS_PUBLIC_PATH ||
    path.join(__dirname, '..', '..', 'v2turbo', 'public', 'indexer-status-public.json')
  );
}

function buildPublicStatus() {
  const state = loadState();
  const staleMs = Number(process.env.INDEXER_STALE_MS || 15 * 60 * 1000);
  const lastSync = state.lastParticipantSyncAt ? new Date(state.lastParticipantSyncAt).getTime() : 0;
  const age = lastSync ? Date.now() - lastSync : Infinity;

  let syncStatus = 'unknown';
  if (!lastSync) syncStatus = 'pending';
  else if (age > staleMs) syncStatus = 'stale';
  else syncStatus = 'ok';

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    roundId: state.roundId,
    syncStatus,
    entrantCount: state.participantCount ?? 0,
    totalTickets: state.totalTickets ?? 0,
    qualifiedHolderCount: state.qualifiedHolderCount ?? 0,
    registrationGapCount: state.registeredGapCount ?? 0,
    coveragePercent:
      state.qualifiedHolderCount > 0
        ? Math.round(
            (1000 * (state.qualifiedHolderCount - (state.registeredGapCount ?? 0))) /
              state.qualifiedHolderCount
          ) / 10
        : null,
    lastParticipantSyncAt: state.lastParticipantSyncAt,
    lastHolderScanAt: state.lastHolderScanAt,
    lastManifestAt: state.lastManifestAt,
    lastManifestMerkle: state.lastManifestMerkle ?? null,
    onChainTotalParticipants: state.onChainTotalParticipants ?? null,
    onChainTotalTickets: state.onChainTotalTickets ?? null,
    crossCheck: state.crossCheck ?? null,
    network: process.env.SOLANA_CLUSTER || 'devnet',
  };
}

function exportPublicStatus() {
  const out = publicExportPath();
  const payload = buildPublicStatus();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tmp, out);
  return { path: out, payload };
}

module.exports = { buildPublicStatus, exportPublicStatus, publicExportPath };
