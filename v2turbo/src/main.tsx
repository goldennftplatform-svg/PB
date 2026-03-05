// Buffer polyfill - required for Solana and wallet libraries
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
window.Buffer = Buffer;

import { init, useAuth, ClientConfig } from '@pooflabs/web';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';

import './globals.css';
import './app-chrome.css';
import { TAROBASE_CONFIG } from './lib/config';
import './styles/base.css';

const { appId, chain, rpcUrl, authMethod, wsApiUrl, apiUrl, authApiUrl, mockAuth, mockAddress } =
  TAROBASE_CONFIG;

(async () => {
  try {
    if (mockAuth && mockAddress) {
      sessionStorage.setItem('test-user-address', mockAddress);
    }

    let privyCustomAppId: string | undefined;
    let privyApiUrl: string | undefined;
    let phantomAppId: string | undefined;
    try {
      const constantsModule = await import('./lib/constants');
      privyCustomAppId = (constantsModule as any).PRIVY_CUSTOM_APP_ID;
      privyApiUrl = (constantsModule as any).PRIVY_API_URL;
      phantomAppId = (constantsModule as any).PHANTOM_APP_ID;
    } catch {
      // optional
    }

    const baseConfig = {
      apiKey: '',
      wsApiUrl,
      apiUrl,
      authApiUrl,
      appId,
      authMethod,
      chain,
      skipBackendInit: true,
      mockAuth,
      ...(rpcUrl ? { rpcUrl } : {}),
    };

    let config: Partial<ClientConfig> = { ...baseConfig };

    if (privyCustomAppId) {
      config = {
        ...config,
        privyConfig: {
          appId: privyCustomAppId,
          ...(privyApiUrl ? { apiUrl: privyApiUrl } : {}),
          config: {
            appearance: {
              walletChainType: 'solana-only',
            },
          },
        },
      };
    }

    if (phantomAppId) {
      config = {
        ...config,
        phantomConfig: {
          appId: phantomAppId,
        },
      };
    }

    await init(config);
  } catch (err) {
    console.error('Failed to init app', err);
    throw err;
  }
})();

interface AuthContextType {
  user: { address: string; provider: any } | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const PhantomWalletWarning = () => {
  const { user } = useAuth() as AuthContextType;
  const [balance, setBalance] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(true);
  const [showGuideModal, setShowGuideModal] = useState(false);

  const isDevnet = TAROBASE_CONFIG.chain === 'solana_devnet';
  const isPhantomConnected = window.phantom?.solana?.isConnected ?? false;

  const fetchBalance = async (address: string) => {
    if (!TAROBASE_CONFIG.rpcUrl) return;
    try {
      const response = await fetch(TAROBASE_CONFIG.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });
      const data = await response.json();
      if (!data.error) setBalance(data.result.value / 1_000_000_000);
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  useEffect(() => {
    if (user?.address && isDevnet && isPhantomConnected) {
      fetchBalance(user.address);
    } else {
      setBalance(null);
    }
  }, [user?.address, isDevnet, isPhantomConnected]);

  const shouldShowWarning =
    isDevnet && isPhantomConnected && user?.address && balance === 0 && showWarning;

  if (!shouldShowWarning) return null;

  return (
    <>
      <div
        className="fixed bottom-20 left-4 z-40 transition-[opacity,transform] duration-300"
        style={{ maxWidth: '320px', transform: 'translateZ(0)', willChange: 'transform' }}
      >
        <div className="bg-orange-500 text-white rounded-lg shadow-lg cursor-pointer hover:bg-orange-600 transition-colors">
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1" onClick={() => setShowGuideModal(true)}>
                <p className="text-sm font-medium">
                  Your Phantom wallet may be on the wrong network. Click here to learn how to fix it.
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowWarning(false); }}
                className="text-white hover:text-gray-200 text-lg flex-shrink-0"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      {showGuideModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "'Montserrat Variable', 'Hanken Grotesk', sans-serif" }}
          >
            <div className="sticky top-0 bg-orange-500 rounded-t-lg p-4 flex items-start justify-between">
              <h2 className="text-2xl font-bold text-white pr-8">Switch Phantom to Devnet</h2>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-white hover:text-gray-200 font-bold text-2xl flex-shrink-0 border-0 bg-transparent p-0 cursor-pointer leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-8 text-gray-700 space-y-4">
              <p className="font-medium text-orange-600">
                This app runs on Solana Devnet. Your Phantom wallet might be on the wrong network.
              </p>
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">How to switch to Devnet:</h3>
                <ol className="list-decimal list-inside space-y-2 pl-2">
                  <li>Open Phantom → profile → Settings</li>
                  <li>Developer Settings → Testnet Mode ON → select Devnet</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h3 className="font-semibold text-blue-900 mb-2">Getting Devnet SOL</h3>
                <p className="text-sm text-blue-800">
                  Use a public Solana devnet faucet or your wallet provider's faucet to get test SOL.
                </p>
              </div>
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                <p className="text-sm text-yellow-800">
                  Devnet uses <strong>test assets only</strong>. Switch back to Mainnet when you're done.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen">
          {TAROBASE_CONFIG.chain === 'solana_devnet' && <PhantomWalletWarning />}
          <App />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
