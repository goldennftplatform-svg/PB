import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'pepball-phantom-fallback-address';

interface PhantomFallbackContextValue {
  address: string | null;
  connectPhantom: () => Promise<void>;
  disconnectPhantom: () => void;
  isAvailable: boolean;
}

const PhantomFallbackContext = createContext<PhantomFallbackContextValue | null>(null);

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(address: string | null): void {
  try {
    if (address) sessionStorage.setItem(STORAGE_KEY, address);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

declare global {
  interface Window {
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
        disconnect: () => Promise<void>;
        publicKey?: { toString: () => string } | null;
      };
    };
  }
}

export function PhantomFallbackProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(readStored);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const check = () => !!window.phantom?.solana?.isPhantom;
    setIsAvailable(check());
    const t = setInterval(() => setIsAvailable(check()), 2000);
    return () => clearInterval(t);
  }, []);

  const connectPhantom = useCallback(async () => {
    const phantom = window.phantom?.solana;
    if (!phantom?.connect) {
      throw new Error('Phantom not installed');
    }
    const { publicKey } = await phantom.connect();
    const addr = publicKey?.toString() ?? null;
    if (addr) {
      setAddress(addr);
      writeStored(addr);
    }
  }, []);

  const disconnectPhantom = useCallback(() => {
    setAddress(null);
    writeStored(null);
    window.phantom?.solana?.disconnect?.();
  }, []);

  const value: PhantomFallbackContextValue = {
    address,
    connectPhantom,
    disconnectPhantom,
    isAvailable,
  };

  return (
    <PhantomFallbackContext.Provider value={value}>
      {children}
    </PhantomFallbackContext.Provider>
  );
}

export function usePhantomFallback(): PhantomFallbackContextValue {
  const ctx = useContext(PhantomFallbackContext);
  if (!ctx) throw new Error('usePhantomFallback must be used within PhantomFallbackProvider');
  return ctx;
}
