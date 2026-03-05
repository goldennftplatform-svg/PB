// Buffer polyfill - DO NOT REMOVE - required for @pooflabs/web and Solana libraries
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
window.Buffer = Buffer;

import { init, useAuth, ClientConfig } from '@pooflabs/web';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary';

const poofLogo = '/assets/poof-logo.png';
const poofPoofnetLogo = '/assets/poof-poofnet-logo.png';
const poofPreviewLogo = '/assets/poof-preview-logo.png';
import './globals.css'; // user-editable
import { TAROBASE_CONFIG } from './lib/config';
import './poof-styling.css'; // poof-owned, loaded last
import './styles/base.css';
const { appId, chain, rpcUrl, authMethod, wsApiUrl, apiUrl, authApiUrl, mockAuth, mockAddress } =
  TAROBASE_CONFIG;

const SHOW_FLOATING_POOF_BUTTON = import.meta.env.VITE_STANDALONE !== 'true';

(async () => {
  try {
    // Set mock auth address in sessionStorage before SDK init (if provided)
    // This allows the SDK to use a specific wallet address for mock auth
    if (mockAuth && mockAddress) {
      sessionStorage.setItem('test-user-address', mockAddress);
    }

    // Check if PRIVY_CUSTOM_APP_ID or PHANTOM_APP_ID exists in constants
    let privyCustomAppId: string | undefined;
    let phantomAppId: string | undefined;
    try {
      const constantsModule = await import('./lib/constants');
      privyCustomAppId = (constantsModule as any).PRIVY_CUSTOM_APP_ID;
      phantomAppId = (constantsModule as any).PHANTOM_APP_ID;
    } catch (e) {
      // Constants file doesn't exist or custom auth IDs don't exist
    }

    // Base configuration
    const baseConfig = {
      apiKey: '',
      wsApiUrl,
      apiUrl,
      authApiUrl,
      appId,
      authMethod,
      chain,
      skipBackendInit: true,
      // Enable mock authentication for browser automation/testing
      // When true, SDK uses mock auth providers instead of real ones (Privy/Phantom)
      mockAuth,
      // Only include rpcUrl if explicitly configured (not falling back to default)
      ...(rpcUrl ? { rpcUrl } : {}),
    };

    // Build config with optional auth customizations
    let config: Partial<ClientConfig> = { ...baseConfig };

    // Add privyConfig if PRIVY_CUSTOM_APP_ID is available
    if (privyCustomAppId) {
      config = {
        ...config,
        privyConfig: {
          appId: privyCustomAppId,
          config: {
            appearance: {
              walletChainType: 'solana-only',
            },
          },
        },
      };
    }

    // Add phantomConfig if PHANTOM_APP_ID is available
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

  // Check if we're on devnet
  const isDevnet = TAROBASE_CONFIG.chain === 'solana_devnet';

  // Check if Phantom is connected
  const isPhantomConnected = window.phantom?.solana?.isConnected ?? false;

  const fetchBalance = async (address: string) => {
    if (!TAROBASE_CONFIG.rpcUrl) return;
    try {
      const response = await fetch(TAROBASE_CONFIG.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
      });

      const data = await response.json();

      if (!data.error) {
        // Convert lamports to SOL
        const balanceInSol = data.result.value / 1_000_000_000;
        setBalance(balanceInSol);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  useEffect(() => {
    // Only fetch balance when user logs in, on devnet, and Phantom is connected
    if (user?.address && isDevnet && isPhantomConnected) {
      fetchBalance(user.address);
    } else {
      setBalance(null);
    }
  }, [user?.address, isDevnet, isPhantomConnected]);

  // Only show warning if: on devnet, Phantom is connected, user is logged in, and balance is 0
  const shouldShowWarning =
    isDevnet && isPhantomConnected && user?.address && balance === 0 && showWarning;

  if (!shouldShowWarning) return null;

  return (
    <>
      <div
        className='fixed bottom-20 left-4 z-40 transition-[opacity,transform] duration-300'
        style={{
          maxWidth: '320px',
          transform: 'translateZ(0)', // GPU acceleration for scroll performance
          willChange: 'transform',
        }}
      >
        <div
          className='bg-orange-500 text-white rounded-lg shadow-lg cursor-pointer hover:bg-orange-600 transition-colors hover:animate-bounce-gentle'
        >
          <div className='p-3'>
            <div className='flex items-start justify-between gap-2'>
              <div className='flex-1' onClick={() => setShowGuideModal(true)}>
                <p className='text-sm font-medium'>
                  Your Phantom wallet may be configured to the wrong network. Click here to learn
                  how to fix it.
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWarning(false);
                }}
                className='text-white hover:text-gray-200 text-lg flex-shrink-0'
                aria-label='Dismiss warning'
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      {showGuideModal && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className='bg-white rounded-lg max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "'Montserrat Variable', 'Hanken Grotesk', sans-serif" }}
          >
            <div className='sticky top-0 bg-orange-500 rounded-t-lg p-4 flex items-start justify-between'>
              <h2 className='text-2xl font-bold text-white pr-8'>Switch Phantom to Devnet</h2>
              <button
                onClick={() => setShowGuideModal(false)}
                className='text-white hover:text-gray-200 font-bold text-2xl flex-shrink-0'
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '0',
                  cursor: 'pointer',
                  lineHeight: '1',
                }}
                aria-label='Close modal'
              >
                ×
              </button>
            </div>

            <div className='p-8 text-gray-700 space-y-4'>
              <p className='font-medium text-orange-600'>
                Your Phantom wallet might be on the wrong network. This app runs on Solana Devnet.
              </p>

              <div className='space-y-3'>
                <h3 className='font-semibold text-lg'>How to switch to Devnet:</h3>
                <ol className='list-decimal list-inside space-y-2 pl-2'>
                  <li>Open your Phantom wallet extension</li>
                  <li>Click on your profile picture at the top left</li>
                  <li>Click the settings gear icon at the bottom right</li>
                  <li>Select "Developer Settings"</li>
                  <li>Toggle "Testnet Mode" ON</li>
                  <li>Under "Testnet Mode", select "Devnet"</li>
                  <li>Refresh this page</li>
                </ol>
              </div>

              <div className='bg-blue-50 border-l-4 border-blue-500 p-4 rounded'>
                <h3 className='font-semibold text-blue-900 mb-2'>Getting Devnet SOL</h3>
                <p className='text-sm text-blue-800 mb-2'>
                  Once you're on Devnet, you may need SOL to use onchain portions of this app. You
                  can request devnet SOL by typing in your poof chat:
                </p>
                <code className='block bg-blue-100 text-blue-900 px-3 py-2 rounded font-mono text-sm'>
                  "send me some devnet SOL"
                </code>
              </div>

              <div className='bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded'>
                <h3 className='font-semibold text-yellow-900 mb-2'>⚠️ Important: Using Testnet</h3>
                <p className='text-sm text-yellow-800 mb-2'>
                  Devnet uses <strong>fake assets</strong>, not real mainnet assets. If you see "You
                  are currently in testnet mode" in your Phantom wallet, you are NOT using real
                  assets.
                </p>
                <p className='text-sm text-yellow-800'>
                  <strong>Remember:</strong> After using this app, switch Phantom back to Mainnet to
                  access your real assets again. Exercise caution when switching networks.
                </p>
              </div>

              <div className='bg-green-50 border-l-4 border-green-500 p-4 rounded'>
                <p className='text-sm text-green-800'>
                  <strong>Note:</strong> This warning will automatically disappear once your wallet
                  has devnet SOL in it.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const FloatingPoofButton = ({
  deploymentTier,
  isPoofnet,
}: {
  deploymentTier: string;
  isPoofnet: boolean;
}) => {
  const [showModal, setShowModal] = useState(false);

  // Logo selection based on deployment tier:
  // - 'production': Production logo (main poof logo)
  // - 'offchain'/poofnet: Poofnet logo
  // - 'preview' or 'mainnet-preview': Preview logo
  const logoSrc = deploymentTier === 'production' ? poofLogo : isPoofnet ? poofPoofnetLogo : poofPreviewLogo;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`fixed bottom-2 left-2 z-50 hover:opacity-80 transition-[opacity,transform] duration-300 hover:scale-105 overflow-hidden`}
        style={{
          height: '70px',
          width: 'auto',
          border: 'none',
          background: 'transparent',
          padding: 0,
          transform: 'translateZ(0)', // GPU acceleration for scroll performance
          willChange: 'opacity, transform',
        }}
      >
        <img
          src={logoSrc}
          alt='Poof Logo'
          style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
        />
      </button>
      {showModal && (
        <div
          className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
          onClick={() => setShowModal(false)}
        >
          <div
            className='bg-white rounded-lg p-10 max-w-md mx-4 shadow-2xl relative'
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "'Montserrat Variable', 'Hanken Grotesk', sans-serif" }}
          >
            <button
              onClick={() => setShowModal(false)}
              className='absolute top-2 right-2 text-gray-600 hover:text-gray-800 font-dark text-xl'
              style={{
                border: 'none',
                background: 'transparent',
                padding: '8px',
                cursor: 'pointer',
              }}
              aria-label='Close modal'
            >
              x
            </button>
            <div className='text-gray-600 space-y-3'>
              <p>
                This app was built using{' '}
                <a
                  href='https://poof.new'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:text-blue-800 underline'
                >
                  poof.new
                </a>
                .
              </p>
              <p>Create Solana dApps in minutes using natural language.</p>
              <p className='text-sm text-gray-500 font-medium'>Use at your own risk.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const AppWithChrome = () => {
  return (
    <div id='poof-chrome'>
      {SHOW_FLOATING_POOF_BUTTON && (
        <>
          <FloatingPoofButton
            deploymentTier={import.meta.env.VITE_DEPLOYMENT_TIER || 'preview'}
            isPoofnet={chain === 'offchain'}
          />
          <PhantomWalletWarning />
        </>
      )}
      <App />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppWithChrome />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
