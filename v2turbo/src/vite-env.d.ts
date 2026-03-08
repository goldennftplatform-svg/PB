/// <reference types="vite/client" />

interface JupiterFormProps {
  swapMode?: 'ExactIn' | 'ExactOut' | 'ExactInOrOut';
  initialAmount?: string;
  initialInputMint?: string;
  initialOutputMint?: string;
  fixedAmount?: boolean;
  fixedMint?: string;
}

interface JupiterInitOptions {
  displayMode?: 'modal' | 'integrated' | 'widget';
  integratedTargetId?: string;
  formProps?: JupiterFormProps;
  onSuccess?: (args: { txid: string }) => void;
}

interface JupiterPlugin {
  init: (options: JupiterInitOptions) => void;
  resume?: () => void;
  close?: () => void;
}

interface Window {
  Jupiter?: JupiterPlugin;
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
