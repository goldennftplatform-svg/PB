import { Connection, PublicKey } from '@solana/web3.js';

/** Anchor discriminator + tiered Lottery struct field offsets (devnet deploy). */
const OFF = {
  jackpotAmount: 8,
  lastSnapshot: 48,
  totalParticipants: 122,
  totalTickets: 130,
  totalSnapshots: 138,
  snapshotSeed: 146,
} as const;

export interface LotteryDrawState {
  snapshotSeed: bigint;
  pepeBallCount: number;
}

export interface LastSnapshotTx {
  signature: string;
  blockTime: number | null;
  pepeCount: number | null;
  seed: string | null;
  isOdd: boolean | null;
}

export interface DevnetLotteryLive {
  jackpotAmountLamports: number;
  pdaBalanceLamports: number;
  totalParticipants: number;
  totalTickets: number;
  totalSnapshots: number;
  snapshotSeed: bigint;
  pepeBallCount: number;
  lastSnapshotUnix: number;
  isActive: boolean;
  lastSnapshot: LastSnapshotTx | null;
  participantAccountCount: number | null;
  fetchedAt: number;
}

function readU64(data: Buffer, offset: number): bigint {
  if (data.length < offset + 8) return 0n;
  return data.readBigUInt64LE(offset);
}

function readI64(data: Buffer, offset: number): number {
  if (data.length < offset + 8) return 0;
  return Number(data.readBigInt64LE(offset));
}

function parseSnapshotLogs(logs: string[]): Partial<LastSnapshotTx> {
  const joined = logs.join('\n');
  if (!/TakeSnapshot|take_snapshot/i.test(joined)) return {};
  const pepeMatch =
    joined.match(/[Pp]epe\s+[Bb]all\s+[Cc]ount:\s*(\d+)/) ??
    joined.match(/Pepe.*?[Cc]ount[:\s]+(\d+)/);
  const seedMatch = joined.match(/Snapshot\s+Seed:\s*(\d+)/i);
  const pepeCount = pepeMatch ? Math.min(30, Math.max(1, Number(pepeMatch[1]))) : null;
  const seed = seedMatch?.[1] ?? null;
  let isOdd: boolean | null = null;
  if (pepeCount != null) isOdd = pepeCount % 2 === 1;
  if (/ODD|PAYOUT/i.test(joined)) isOdd = true;
  if (/EVEN|ROLLOVER/i.test(joined)) isOdd = false;
  return { pepeCount, seed, isOdd };
}

async function fetchLastSnapshotTx(
  connection: Connection,
  lotteryPda: PublicKey
): Promise<LastSnapshotTx | null> {
  try {
    const sigs = await connection.getSignaturesForAddress(lotteryPda, { limit: 20 });
    for (const s of sigs) {
      if (s.err) continue;
      const tx = await connection.getTransaction(s.signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      const logs = tx?.meta?.logMessages ?? [];
      const parsed = parseSnapshotLogs(logs);
      if (parsed.pepeCount == null && !parsed.seed) continue;
      return {
        signature: s.signature,
        blockTime: s.blockTime ?? null,
        pepeCount: parsed.pepeCount ?? null,
        seed: parsed.seed ?? null,
        isOdd: parsed.isOdd ?? null,
      };
    }
  } catch {
    /* RPC limit */
  }
  return null;
}

async function countParticipantAccounts(
  connection: Connection,
  programId: PublicKey,
  lotteryPda: PublicKey
): Promise<number | null> {
  try {
    const accs = await connection.getProgramAccounts(programId, {
      filters: [{ dataSize: 92 }],
    });
    let n = 0;
    for (const { account } of accs) {
      const d = Buffer.from(account.data);
      if (d.length < 40) continue;
      const lottery = new PublicKey(d.subarray(8, 40));
      if (lottery.equals(lotteryPda)) n++;
    }
    return n;
  } catch {
    return null;
  }
}

export async function fetchLotteryDrawState(
  rpcUrl: string,
  lotteryPda: string
): Promise<LotteryDrawState | null> {
  const live = await fetchDevnetLotteryLive(rpcUrl, lotteryPda, LOTTERY_PROGRAM_ID_DEFAULT);
  if (!live) return null;
  return { snapshotSeed: live.snapshotSeed, pepeBallCount: live.pepeBallCount };
}

const LOTTERY_PROGRAM_ID_DEFAULT = '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7';

export async function fetchDevnetLotteryLive(
  rpcUrl: string,
  lotteryPda: string,
  programId: string = LOTTERY_PROGRAM_ID_DEFAULT
): Promise<DevnetLotteryLive | null> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const pda = new PublicKey(lotteryPda);
    const program = new PublicKey(programId);

    const [info, lastSnapshot, participantAccountCount] = await Promise.all([
      connection.getAccountInfo(pda),
      fetchLastSnapshotTx(connection, pda),
      countParticipantAccounts(connection, program, pda),
    ]);

    if (!info?.data || info.data.length < OFF.snapshotSeed + 8) return null;

    const data = Buffer.from(info.data);
    const snapshotSeed = readU64(data, OFF.snapshotSeed);
    let pepeBallCount = data[data.length - 1] ?? 0;
    if (pepeBallCount < 1 || pepeBallCount > 30) {
      if (lastSnapshot?.pepeCount) pepeBallCount = lastSnapshot.pepeCount;
      else if (snapshotSeed > 0n) pepeBallCount = Number((snapshotSeed % 30n) + 1n);
      else pepeBallCount = 0;
    }

    return {
      jackpotAmountLamports: Number(readU64(data, OFF.jackpotAmount)),
      pdaBalanceLamports: info.lamports,
      totalParticipants: Number(readU64(data, OFF.totalParticipants)),
      totalTickets: Number(readU64(data, OFF.totalTickets)),
      totalSnapshots: Number(readU64(data, OFF.totalSnapshots)),
      snapshotSeed,
      pepeBallCount,
      lastSnapshotUnix: readI64(data, OFF.lastSnapshot),
      isActive: data[82] === 1,
      lastSnapshot,
      participantAccountCount,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
