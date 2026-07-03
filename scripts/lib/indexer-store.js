/**
 * File-backed store for the Option B indexer (VPS-friendly, no native deps).
 */
const fs = require('fs');
const path = require('path');

function dataDir() {
  const base =
    process.env.INDEXER_DATA_DIR ||
    path.join(process.env.USERPROFILE || process.env.HOME || '', 'pepeball-game-day', 'indexer');
  return base;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, value) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function statePath() {
  return path.join(dataDir(), 'state.json');
}

function loadState() {
  return readJson(statePath(), {
    version: 1,
    roundId: null,
    roundOpenedAt: null,
    lastParticipantSyncAt: null,
    lastHolderScanAt: null,
    participantCount: 0,
    totalTickets: 0,
    qualifiedHolderCount: 0,
    registeredGapCount: 0,
    lastManifestAt: null,
    lastError: null,
  });
}

function saveState(patch) {
  const next = { ...loadState(), ...patch, version: 1, updatedAt: new Date().toISOString() };
  writeJsonAtomic(statePath(), next);
  return next;
}

function participantsPath(roundId) {
  const id = roundId || loadState().roundId || 'default';
  return path.join(dataDir(), 'rounds', id, 'participants.json');
}

function loadParticipants(roundId) {
  return readJson(participantsPath(roundId), []);
}

function saveParticipants(roundId, rows) {
  const p = participantsPath(roundId);
  writeJsonAtomic(p, rows);
  return p;
}

function holdersPath(roundId) {
  const id = roundId || loadState().roundId || 'default';
  return path.join(dataDir(), 'rounds', id, 'qualified-holders.json');
}

function loadQualifiedHolders(roundId) {
  return readJson(holdersPath(roundId), []);
}

function saveQualifiedHolders(roundId, rows) {
  const p = holdersPath(roundId);
  writeJsonAtomic(p, rows);
  return p;
}

function manifestDir(roundId) {
  const id = roundId || loadState().roundId || 'default';
  const dir = path.join(dataDir(), 'rounds', id, 'manifests');
  ensureDir(dir);
  return dir;
}

function saveManifest(roundId, name, payload) {
  const file = path.join(manifestDir(roundId), name);
  writeJsonAtomic(file, payload);
  return file;
}

function gapReportPath(roundId) {
  const id = roundId || loadState().roundId || 'default';
  return path.join(dataDir(), 'rounds', id, 'registration-gap.json');
}

module.exports = {
  dataDir,
  loadState,
  saveState,
  loadParticipants,
  saveParticipants,
  loadQualifiedHolders,
  saveQualifiedHolders,
  saveManifest,
  gapReportPath,
  writeJsonAtomic,
};
