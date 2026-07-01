import type { VrfDrawingsResponse } from '@/lib/collections/vrfDrawings';
import type { DevnetLotteryLive, LotteryDrawState } from '@/lib/lottery-state';

export interface DrawReplay {
  drawNum: number;
  drawingId: string;
  ballValues: number[];
  pepeCount: number;
  isPayout: boolean;
  winnerIndex: number | null;
  winnerAddress: string | null;
  ballSum: number;
  revealedAt: number | null;
}

export function pepeCountFromSeed(seed: bigint): number {
  return Number((seed % 30n) + 1n);
}

/** Deterministic display balls from on-chain snapshot seed. */
export function ballsFromSeed(seed: bigint): number[] {
  let s = Number(seed % 0x100000000n) || 1;
  return Array.from({ length: 5 }, (_, i) => {
    s = (Math.imul(s, 1664525) + 1013904223 + i * 17) >>> 0;
    return s % 100;
  });
}

export function pickLatestDrawing(drawings: VrfDrawingsResponse[]): VrfDrawingsResponse | null {
  const completed = drawings.filter((d) => d.result != null && d.result !== undefined);
  if (!completed.length) return null;
  return [...completed].sort(
    (a, b) =>
      (b.drawNum ?? 0) - (a.drawNum ?? 0) ||
      (b.tarobase_created_at ?? 0) - (a.tarobase_created_at ?? 0)
  )[0];
}

function parseEvenOddResult(raw?: string): { pepeCount?: number; isPayout?: boolean } {
  if (!raw) return {};
  const upper = raw.toUpperCase();
  const num = raw.match(/(\d{1,2})/);
  return {
    pepeCount: num ? Math.min(30, Math.max(1, Number(num[1]))) : undefined,
    isPayout: upper.includes('ODD') ? true : upper.includes('EVEN') ? false : undefined,
  };
}

export function buildDrawReplayFromChain(live: DevnetLotteryLive): DrawReplay | null {
  const snap = live.lastSnapshot;
  let pepeCount = live.pepeBallCount;
  if (pepeCount < 1 || pepeCount > 30) {
    if (snap?.pepeCount) pepeCount = snap.pepeCount;
    else return null;
  }

  const seedStr = live.snapshotSeed > 0n ? live.snapshotSeed.toString() : snap?.seed;
  const ballSeed = seedStr ? BigInt(seedStr) : BigInt((live.totalSnapshots || 1) * 9973);
  const ballValues = ballsFromSeed(ballSeed);
  const isPayout = snap?.isOdd ?? pepeCount % 2 === 1;

  return {
    drawNum: live.totalSnapshots || 1,
    drawingId: snap?.signature ?? 'on-chain',
    ballValues,
    pepeCount,
    isPayout,
    winnerIndex: null,
    winnerAddress: null,
    ballSum: ballValues.reduce((a, b) => a + b, 0),
    revealedAt: snap?.blockTime ?? live.lastSnapshotUnix ?? null,
  };
}

export function buildDrawReplay(
  drawing: VrfDrawingsResponse | null,
  lotteryState: LotteryDrawState | null,
  chainLive?: DevnetLotteryLive | null
): DrawReplay | null {
  const parsed = parseEvenOddResult(drawing?.evenOddResult);

  let pepeCount = 0;
  let ballSeed = 0n;

  if (lotteryState?.pepeBallCount && lotteryState.pepeBallCount >= 1 && lotteryState.pepeBallCount <= 30) {
    pepeCount = lotteryState.pepeBallCount;
    ballSeed = lotteryState.snapshotSeed > 0n ? lotteryState.snapshotSeed : BigInt(drawing?.drawNum ?? 1);
  } else if (parsed.pepeCount) {
    pepeCount = parsed.pepeCount;
    ballSeed = BigInt((drawing?.drawNum ?? 1) * 9973 + (drawing?.result ?? 0) * 7919);
  } else if (drawing?.result != null) {
    ballSeed = BigInt((drawing.drawNum ?? 1) * 9973 + drawing.result * 7919);
    pepeCount = pepeCountFromSeed(ballSeed);
  } else if (chainLive) {
    return buildDrawReplayFromChain(chainLive);
  } else {
    return null;
  }

  const ballValues = ballsFromSeed(ballSeed);
  const isPayout = parsed.isPayout ?? pepeCount % 2 === 1;

  return {
    drawNum: drawing?.drawNum ?? 0,
    drawingId: drawing?.id ?? '',
    ballValues,
    pepeCount,
    isPayout,
    winnerIndex: drawing?.result ?? null,
    winnerAddress: drawing?.winner ?? null,
    ballSum: ballValues.reduce((a, b) => a + b, 0),
    revealedAt: drawing?.actualRevealAt ?? drawing?.tarobase_created_at ?? null,
  };
}

export function formatWalletShort(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
