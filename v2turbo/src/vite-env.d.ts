/// <reference types="vite/client" />

interface Window {
  phantom?: {
    solana?: {
      isPhantom?: boolean;
      isConnected?: boolean;
      publicKey?: { toString(): string } | null;
      connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
      disconnect: () => Promise<void>;
      signTransaction?: (tx: unknown) => Promise<unknown>;
      signAndSendTransaction?: (tx: unknown) => Promise<{ signature: string }>;
    };
  };
}
