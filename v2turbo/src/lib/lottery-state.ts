import { Connection, PublicKey } from '@solana/web3.js';

/** snapshot_seed field offset in lottery account (8-byte Anchor disc + struct fields). */
const SNAPSHOT_SEED_OFFSET = 8 + 138;

export interface LotteryDrawState {
  snapshotSeed: bigint;
  pepeBallCount: number;
}

export async function fetchLotteryDrawState(
  rpcUrl: string,
  lotteryPda: string
): Promise<LotteryDrawState | null> {
  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const info = await connection.getAccountInfo(new PublicKey(lotteryPda));
    if (!info?.data || info.data.length < SNAPSHOT_SEED_OFFSET + 8) return null;

    const data = Buffer.from(info.data);
    const snapshotSeed = data.readBigUInt64LE(SNAPSHOT_SEED_OFFSET);
    const pepeBallCount = data[data.length - 1] ?? 0;

    if (pepeBallCount < 1 || pepeBallCount > 30) {
      return { snapshotSeed, pepeBallCount: 0 };
    }
    return { snapshotSeed, pepeBallCount };
  } catch {
    return null;
  }
}
