import { getPartyServerHttpUrl } from '@/lib/config';
import { PublicKey } from '@solana/web3.js';

export type MemeCalloutConfig = {
  enabled: boolean;
  mint: string | null;
  label: string;
  network: 'devnet' | 'mainnet';
  updatedAt: number;
  updatedBy: string | null;
};

const STORAGE_KEY = 'pepeball-meme-callout-v1';

export const EMPTY_MEME_CALLOUT: MemeCalloutConfig = {
  enabled: false,
  mint: null,
  label: '',
  network: 'devnet',
  updatedAt: 0,
  updatedBy: null,
};

export function isValidSolanaMint(mint: string): boolean {
  const trimmed = mint.trim();
  if (!trimmed) return false;
  try {
    // eslint-disable-next-line no-new
    new PublicKey(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function loadMemeCalloutLocal(): MemeCalloutConfig | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MemeCalloutConfig;
    if (typeof parsed?.enabled !== 'boolean') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveMemeCalloutLocal(config: MemeCalloutConfig): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

type ApiEnvelope<T> = { success: boolean; data?: T };

export async function fetchMemeCallout(): Promise<MemeCalloutConfig | null> {
  try {
    const res = await fetch(getPartyServerHttpUrl('/api/meme-callout'), { cache: 'no-store' });
    if (!res.ok) return loadMemeCalloutLocal();
    const body = (await res.json()) as ApiEnvelope<MemeCalloutConfig>;
    if (body?.success && body.data) return body.data;
    return loadMemeCalloutLocal();
  } catch {
    return loadMemeCalloutLocal();
  }
}

export async function saveMemeCallout(
  adminWallet: string,
  config: Omit<MemeCalloutConfig, 'updatedAt' | 'updatedBy'>,
): Promise<{ ok: boolean; config: MemeCalloutConfig; viaApi: boolean }> {
  const payload: MemeCalloutConfig = {
    ...config,
    mint: config.enabled ? config.mint?.trim() ?? null : null,
    label: config.label.trim(),
    updatedAt: Date.now(),
    updatedBy: adminWallet,
  };

  try {
    const res = await fetch(getPartyServerHttpUrl('/api/meme-callout'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Wallet-Address': adminWallet,
      },
      body: JSON.stringify({
        enabled: payload.enabled,
        mint: payload.mint,
        label: payload.label,
        network: payload.network,
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as ApiEnvelope<MemeCalloutConfig>;
      const saved = body?.data ?? payload;
      saveMemeCalloutLocal(saved);
      return { ok: true, config: saved, viaApi: true };
    }
  } catch {
    // fall through to localStorage
  }

  saveMemeCalloutLocal(payload);
  return { ok: true, config: payload, viaApi: false };
}

export function buildRoundLedgerEnableCalloutCli(mint: string): string {
  return `node scripts/round-ledger.js enable-callout --mint ${mint}`;
}
