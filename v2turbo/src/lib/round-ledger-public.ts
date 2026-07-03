export type RoundLedgerPublic = {
  version: number;
  exportedAt: string | null;
  activeRoundId: string | null;
  roundCount: number;
  active: {
    id: string;
    status: string;
    phase: string;
    solCommittedSol: number;
    solCommittedLamports: string;
    calloutEnabled: boolean;
    memeMint: string | null;
    memeStashRaw: string;
    pepeBallCount: number | null;
    outcome: string | null;
    isOdd: boolean | null;
    openedAt: string;
    notes: string;
  } | null;
  splits: {
    sol: { mainPercent: number; minorEachPercent: number; minorCount: number; housePercent: number };
    meme: { mainPercent: number; minorEachPercent: number; minorCount: number; devPercent: number; oneAndDone?: boolean };
  };
};

const EMPTY: RoundLedgerPublic = {
  version: 1,
  exportedAt: null,
  activeRoundId: null,
  roundCount: 0,
  active: null,
  splits: {
    sol: { mainPercent: 50, minorEachPercent: 5, minorCount: 8, housePercent: 10 },
    meme: { mainPercent: 64, minorEachPercent: 4.25, minorCount: 8, devPercent: 2, oneAndDone: true },
  },
};

export async function fetchRoundLedgerPublic(): Promise<RoundLedgerPublic> {
  try {
    const res = await fetch('/round-ledger-public.json', { cache: 'no-store' });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as RoundLedgerPublic;
    return data?.version ? data : EMPTY;
  } catch {
    return EMPTY;
  }
}
