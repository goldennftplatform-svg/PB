/**
 * Index on-chain participant PDAs for the active lottery round.
 */
const { PublicKey } = require('@solana/web3.js');
const { LOTTERY_PROGRAM_ID, LOTTERY_PDA } = require('./lottery-raw');
const { PARTICIPANT_ACCOUNT_SIZE, readLotteryFields, parseParticipantAccount } = require('./lottery-fields');
const { getIndexerConnection, getProgramAccountsRaw } = require('./indexer-rpc');
const { loadState, saveState, saveParticipants } = require('./indexer-store');

function filterForRound(rows, { roundOpenedAt, snapshotCutoff }) {
  const openedUnix = roundOpenedAt ? Math.floor(new Date(roundOpenedAt).getTime() / 1000) : 0;
  const cutoff = snapshotCutoff || null;

  return rows.filter((row) => {
    if (openedUnix && row.entryTime < openedUnix) return false;
    if (cutoff && row.entryTime > cutoff) return false;
    if (row.ticketCount <= 0) return false;
    return true;
  });
}

async function fetchAllParticipants({ rpcUrl, connection } = {}) {
  let url = rpcUrl;
  let conn = connection;
  if (!url || !conn) {
    const resolved = await getIndexerConnection();
    url = resolved.rpcUrl;
    conn = resolved.connection;
  }

  console.log('[participant-indexer] Fetching participant PDAs…');
  const raw = await getProgramAccountsRaw(url, LOTTERY_PROGRAM_ID.toBase58(), [
    { dataSize: PARTICIPANT_ACCOUNT_SIZE },
  ]);

  const rows = [];
  for (const item of raw) {
    const dataB64 = item.account?.data?.[0] ?? item.account?.data;
    const data = Buffer.from(dataB64, 'base64');
    const parsed = parseParticipantAccount(data, LOTTERY_PDA);
    if (!parsed) continue;
    rows.push({
      wallet: parsed.wallet,
      ticketCount: parsed.ticketCount,
      usdCents: parsed.usdCents,
      entryTime: parsed.entryTime,
      pda: item.pubkey,
    });
  }

  console.log(`[participant-indexer] Raw PDAs for program: ${rows.length}`);
  return rows;
}

async function syncParticipants(options = {}) {
  const { connection, rpcUrl } = await getIndexerConnection();
  const info = await connection.getAccountInfo(LOTTERY_PDA);
  if (!info) throw new Error('Lottery PDA not found');

  const lottery = readLotteryFields(info.data);
  const state = loadState();
  const roundId = options.roundId || state.roundId || 'default';
  const roundOpenedAt = options.roundOpenedAt ?? state.roundOpenedAt;

  const all = await fetchAllParticipants({ rpcUrl, connection });
  const filtered = filterForRound(all, {
    roundOpenedAt,
    snapshotCutoff: options.snapshotCutoff,
  });

  filtered.sort((a, b) => a.wallet.localeCompare(b.wallet));
  const totalTickets = filtered.reduce((s, p) => s + p.ticketCount, 0);

  saveParticipants(roundId, filtered);
  const nextState = saveState({
    roundId,
    roundOpenedAt,
    lastParticipantSyncAt: new Date().toISOString(),
    participantCount: filtered.length,
    totalTickets,
    onChainTotalParticipants: lottery.totalParticipants,
    onChainTotalTickets: lottery.totalTickets,
    onChainSnapshotSeed: lottery.snapshotSeed,
    crossCheck: {
      participantsDelta: filtered.length - lottery.totalParticipants,
      ticketsDelta: totalTickets - lottery.totalTickets,
    },
    lastError: null,
  });

  console.log(`[participant-indexer] Round ${roundId}: ${filtered.length} entrants, ${totalTickets} tickets`);
  if (Math.abs(nextState.crossCheck.participantsDelta) > 0) {
    console.warn(
      `[participant-indexer] On-chain counter mismatch: indexed=${filtered.length} chain=${lottery.totalParticipants}`
    );
  }

  return { participants: filtered, lottery, state: nextState };
}

module.exports = {
  fetchAllParticipants,
  filterForRound,
  syncParticipants,
};
