/**
 * Deterministic winner selection + manifest merkle root (matches lottery-raw.js).
 */
const crypto = require('crypto');
const { calculateWinners } = require('./lottery-raw');

function sortParticipants(rows) {
  return [...rows].sort((a, b) => {
    const wa = typeof a.wallet === 'string' ? a.wallet : a.wallet.toBase58();
    const wb = typeof b.wallet === 'string' ? b.wallet : b.wallet.toBase58();
    return wa.localeCompare(wb);
  });
}

function merkleRootFromParticipants(rows) {
  const sorted = sortParticipants(rows);
  if (!sorted.length) return null;
  const leaves = sorted.map((p) => {
    const wallet = typeof p.wallet === 'string' ? p.wallet : p.wallet.toBase58();
    const line = `${wallet}:${p.ticketCount}:${p.usdCents ?? 0}`;
    return crypto.createHash('sha256').update(line).digest();
  });

  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(crypto.createHash('sha256').update(Buffer.concat([left, right])).digest());
    }
    level = next;
  }
  return level[0].toString('hex');
}

function buildDrawManifest({ roundId, snapshotSeed, participants, lottery }) {
  const sorted = sortParticipants(participants);
  const totalTickets = sorted.reduce((s, p) => s + p.ticketCount, 0);

  let winners = null;
  if (snapshotSeed && snapshotSeed !== '0' && totalTickets > 0) {
    const { PublicKey } = require('@solana/web3.js');
    const calcRows = sorted.map((p) => ({
      wallet: new PublicKey(p.wallet),
      ticketCount: p.ticketCount,
    }));
    const w = calculateWinners(calcRows, snapshotSeed);
    winners = {
      mainWinner: w.mainWinner.toBase58(),
      minorWinners: w.minorWinners.map((x) => x.toBase58()),
      totalTickets: w.totalTickets,
      winIdx: w.winIdx,
    };
  }

  return {
    version: 1,
    roundId,
    generatedAt: new Date().toISOString(),
    snapshotSeed: snapshotSeed || null,
    participantCount: sorted.length,
    totalTickets,
    merkleRoot: merkleRootFromParticipants(sorted),
    participants: sorted.map((p) => ({
      wallet: p.wallet,
      ticketCount: p.ticketCount,
      usdCents: p.usdCents ?? 0,
      entryTime: p.entryTime ?? null,
    })),
    winners,
    onChain: lottery
      ? {
          totalParticipants: lottery.totalParticipants,
          totalTickets: lottery.totalTickets,
          pepeBallCount: lottery.pepeBallCount,
          isOdd: lottery.isOdd,
        }
      : null,
  };
}

module.exports = {
  sortParticipants,
  merkleRootFromParticipants,
  buildDrawManifest,
};
