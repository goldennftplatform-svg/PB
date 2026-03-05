import {
  PEPEBALL_MINT,
  STATIC_USD_PER_TOKEN,
  TOKEN_DECIMALS,
} from '@/lib/constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const JUPITER_PRICE_URL = 'https://price.jup.ag/v4/price';
const FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = 'pepball-price-override';

export interface TokenPriceState {
  /** USD per 1 token (effective: override ?? live ?? static). */
  effectiveUsdPerToken: number;
  /** Live price from API (null until first fetch). */
  liveUsdPerToken: number | null;
  /** When the live price was last fetched (ISO string or null). */
  lastFetchedAt: string | null;
  /** Manual override in use (null = no override). */
  overrideUsdPerToken: number | null;
  /** Loading state for live fetch. */
  loading: boolean;
  /** Error from last fetch (null if ok). */
  error: string | null;
}

export interface TokenPriceContextValue extends TokenPriceState {
  /** Set manual override ($ per token). Pass null to clear. */
  setOverride: (usdPerToken: number | null) => void;
  /** Set override from "X raw token units = $Y". */
  setOverrideFromRawAndUsd: (rawUnits: number, usd: number) => void;
  /** Refetch live price now. */
  refetch: () => Promise<void>;
}

const defaultState: TokenPriceState = {
  effectiveUsdPerToken: STATIC_USD_PER_TOKEN,
  liveUsdPerToken: null,
  lastFetchedAt: null,
  overrideUsdPerToken: null,
  loading: false,
  error: null,
};

const TokenPriceContext = createContext<TokenPriceContextValue | null>(null);

function readOverrideFromStorage(): number | null {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s == null || s === '') return null;
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeOverrideToStorage(value: number | null): void {
  try {
    if (value == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function TokenPriceProvider({ children }: { children: React.ReactNode }) {
  const [liveUsdPerToken, setLiveUsdPerToken] = useState<number | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [overrideUsdPerToken, setOverrideState] = useState<number | null>(readOverrideFromStorage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${JUPITER_PRICE_URL}?ids=${PEPEBALL_MINT}`, {
        cache: 'no-cache',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data?.data?.[PEPEBALL_MINT]) {
        const p = parseFloat(data.data[PEPEBALL_MINT].price ?? 0);
        setLiveUsdPerToken(Number.isFinite(p) ? p : null);
        setLastFetchedAt(new Date().toISOString());
      } else {
        setError('No price data for mint');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, FETCH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPrice]);

  const setOverride = useCallback((usdPerToken: number | null) => {
    setOverrideState(usdPerToken);
    writeOverrideToStorage(usdPerToken);
  }, []);

  const setOverrideFromRawAndUsd = useCallback((rawUnits: number, usd: number) => {
    if (rawUnits <= 0 || !Number.isFinite(usd)) return;
    const tokens = rawUnits / 10 ** TOKEN_DECIMALS;
    const usdPerToken = usd / tokens;
    setOverrideState(usdPerToken);
    writeOverrideToStorage(usdPerToken);
  }, []);

  const effectiveUsdPerToken = useMemo(() => {
    if (overrideUsdPerToken != null && overrideUsdPerToken > 0) return overrideUsdPerToken;
    if (liveUsdPerToken != null && liveUsdPerToken > 0) return liveUsdPerToken;
    return STATIC_USD_PER_TOKEN;
  }, [overrideUsdPerToken, liveUsdPerToken]);

  const value: TokenPriceContextValue = useMemo(
    () => ({
      effectiveUsdPerToken,
      liveUsdPerToken,
      lastFetchedAt,
      overrideUsdPerToken,
      loading,
      error,
      setOverride,
      setOverrideFromRawAndUsd,
      refetch: fetchPrice,
    }),
    [
      effectiveUsdPerToken,
      liveUsdPerToken,
      lastFetchedAt,
      overrideUsdPerToken,
      loading,
      error,
      setOverride,
      setOverrideFromRawAndUsd,
      fetchPrice,
    ]
  );

  return (
    <TokenPriceContext.Provider value={value}>
      {children}
    </TokenPriceContext.Provider>
  );
}

export function useTokenPrice(): TokenPriceContextValue {
  const ctx = useContext(TokenPriceContext);
  if (!ctx) throw new Error('useTokenPrice must be used within TokenPriceProvider');
  return ctx;
}
