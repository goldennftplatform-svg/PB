export type IndexerStatusPublic = {
  version: number;
  exportedAt: string | null;
  roundId: string | null;
  syncStatus: 'ok' | 'stale' | 'pending' | 'unknown';
  entrantCount: number;
  totalTickets: number;
  qualifiedHolderCount: number;
  registrationGapCount: number;
  coveragePercent: number | null;
  lastParticipantSyncAt: string | null;
  lastHolderScanAt: string | null;
  lastManifestAt: string | null;
  lastManifestMerkle: string | null;
  onChainTotalParticipants: number | null;
  onChainTotalTickets: number | null;
  crossCheck: { participantsDelta?: number; ticketsDelta?: number } | null;
  network: string;
};

const EMPTY: IndexerStatusPublic = {
  version: 1,
  exportedAt: null,
  roundId: null,
  syncStatus: 'pending',
  entrantCount: 0,
  totalTickets: 0,
  qualifiedHolderCount: 0,
  registrationGapCount: 0,
  coveragePercent: null,
  lastParticipantSyncAt: null,
  lastHolderScanAt: null,
  lastManifestAt: null,
  lastManifestMerkle: null,
  onChainTotalParticipants: null,
  onChainTotalTickets: null,
  crossCheck: null,
  network: 'devnet',
};

export async function fetchIndexerStatusPublic(): Promise<IndexerStatusPublic> {
  try {
    const res = await fetch('/indexer-status-public.json', { cache: 'no-store' });
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as IndexerStatusPublic;
    return data?.version ? data : EMPTY;
  } catch {
    return EMPTY;
  }
}
