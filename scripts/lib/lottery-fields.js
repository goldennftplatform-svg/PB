/**
 * Parse lottery + participant account layouts (raw bytes, no IDL).
 */
const { PublicKey } = require('@solana/web3.js');

const PARTICIPANT_ACCOUNT_SIZE = 92;

function readLotteryFields(data) {
  const buf = Buffer.from(data);
  if (buf.length < 160) {
    throw new Error(`Lottery account too small (${buf.length} bytes)`);
  }
  const jackpotLamports = Number(buf.readBigUInt64LE(8));
  const entryMinCents = Number(buf.readBigUInt64LE(16));
  const tier2MinCents = Number(buf.readBigUInt64LE(24));
  const tier3MinCents = Number(buf.readBigUInt64LE(32));
  const lastSnapshot = Number(buf.readBigInt64LE(48));
  const admin = new PublicKey(buf.subarray(96, 128));
  const totalParticipants = Number(buf.readBigUInt64LE(128));
  const totalTickets = Number(buf.readBigUInt64LE(136));
  const totalSnapshots = Number(buf.readBigUInt64LE(144));
  const snapshotSeed = buf.readBigUInt64LE(152);
  let pepeBallCount = buf.length > 200 ? buf[buf.length - 1] : 0;
  if (pepeBallCount < 1 || pepeBallCount > 30) {
    pepeBallCount = snapshotSeed > 0n ? Number(snapshotSeed % 30n) + 1 : 0;
  }
  return {
    jackpotLamports,
    jackpotSol: jackpotLamports / 1e9,
    entryMinCents,
    tier2MinCents,
    tier3MinCents,
    lastSnapshot,
    admin: admin.toBase58(),
    totalParticipants,
    totalTickets,
    totalSnapshots,
    snapshotSeed: snapshotSeed.toString(),
    pepeBallCount,
    isOdd: pepeBallCount >= 1 && pepeBallCount <= 30 ? pepeBallCount % 2 === 1 : null,
  };
}

function parseParticipantAccount(data, lotteryPda) {
  const buf = Buffer.from(data);
  if (buf.length !== PARTICIPANT_ACCOUNT_SIZE) return null;
  const lottery = new PublicKey(buf.subarray(8, 40));
  if (!lottery.equals(lotteryPda)) return null;
  return {
    wallet: new PublicKey(buf.subarray(40, 72)).toBase58(),
    ticketCount: buf.readUInt32LE(72),
    usdCents: Number(buf.readBigUInt64LE(76)),
    entryTime: Number(buf.readBigInt64LE(84)),
  };
}

module.exports = {
  PARTICIPANT_ACCOUNT_SIZE,
  readLotteryFields,
  parseParticipantAccount,
};
