// ═══════════════════════════════════════════════════════════════
// APP CONFIGURATION - CENTRALIZED CONFIG FOR ENTIRE APPLICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if we're running in production (LIVE environment)
 * Mock/test features are disabled in production for security.
 * Vercel production build uses MODE=production even when VITE_ENV is PREVIEW.
 */
const isLiveEnvironment =
  import.meta.env.VITE_ENV === 'LIVE' || import.meta.env.MODE === 'production';

/**
 * Get URL search params
 * Works both when running standalone or embedded in an iframe
 */
const getQueryParams = (): URLSearchParams | null => {
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search);
  }
  return null;
};

let mockAppId: boolean = false;

/**
 * Get app ID with runtime override support
 * Priority: URL query param (non-LIVE only) → Environment variable
 *
 * Security: Query param override is disabled in LIVE environment
 */
const getAppId = (): string | undefined => {
  // Only allow query param override in non-LIVE environments
  if (!isLiveEnvironment) {
    const params = getQueryParams();
    if (params) {
      const urlAppId = params.get('appId');
      if (urlAppId) {
        mockAppId = true;
        return urlAppId;
      }
    }
  }
  mockAppId = false;

  // Fall back to environment variable
  return import.meta.env.VITE_TAROBASE_APP_ID;
};

/**
 * Check if mock authentication is enabled via query param
 * When mockAuth=true, the SDK should use mock authentication providers
 * for browser automation and testing purposes.
 *
 * Security: Mock auth is disabled in LIVE environment
 */
const getMockAuth = (): boolean => {
  // Never allow mock auth in LIVE environment
  if (isLiveEnvironment) {
    return false;
  }

  const params = getQueryParams();
  if (params) {
    const mockAuth = params.get('mockAuth');
    return mockAuth === 'true' || mockAuth === '1';
  }
  return false;
};

/**
 * Get optional mock wallet address for mock auth session
 * When provided, the mock auth will use this address instead of the default.
 * Default address if not provided: (none)
 *
 * Security: Mock address is disabled in LIVE environment
 */
const getMockAddress = (): string | null => {
  // Never allow mock address in LIVE environment
  if (isLiveEnvironment) {
    return null;
  }

  const params = getQueryParams();
  if (params) {
    return params.get('mockAddress');
  }
  return null;
};

// Get app ID for building default URLs
const appId = getAppId();

// Check if mock auth is enabled
const mockAuth = getMockAuth();

// Get optional mock address for mock auth session
const mockAddress = getMockAddress();

// ═════════════════════════════════════════════════════════════
// API URL CONFIGURATION
// ═════════════════════════════════════════════════════════════

// API URL for Tarobase backend (used to construct offchain RPC URL)
const apiUrl = import.meta.env.VITE_API_URL || 'https://api.tarobase.com';

/**
 * Get the RPC URL based on environment
 *
 * In non-LIVE environments, we ALWAYS use the offchain RPC endpoint which provides
 * a Solana RPC-compatible interface that reads from simulated state instead
 * of the actual blockchain. This allows testing without real blockchain interactions.
 *
 * In LIVE environment, we use the real Solana RPC if explicitly set.
 * Returns undefined if no RPC URL is configured (SDK will use its default).
 */
const getRpcUrl = (): string | undefined => {
  // Non-LIVE: Always use offchain RPC (no override allowed)
  if (!isLiveEnvironment && mockAppId && appId) {
    return `${apiUrl}/app/${appId}/rpc`;
  }

  // Use explicit RPC URL if set, otherwise return undefined to let SDK use its default
  if (import.meta.env.VITE_RPC_URL) {
    return import.meta.env.VITE_RPC_URL;
  }

  return "https://celestia-cegncv-fast-mainnet.helius-rpc.com";
};

// ═════════════════════════════════════════════════════════════
// PARTYSERVER CONFIGURATION
// ═════════════════════════════════════════════════════════════

/**
 * PartyServer backend URL configuration
 *
 * Priority:
 * 1. VITE_PARTYSERVER_URL (if explicitly set)
 * 2. When appId is set: <appId>-api.poof.new (Tarobase backend)
 * 3. localhost:1999 (fallback for local development)
 */
export const PARTYSERVER_URL =
  import.meta.env.VITE_PARTYSERVER_URL || (appId ? `${appId}-api.poof.new` : 'localhost:1999');

// ═════════════════════════════════════════════════════════════
// TAROBASE CONFIGURATION
// ═════════════════════════════════════════════════════════════

export const TAROBASE_CONFIG = {
  appId,
  chain: mockAppId ? "offchain" : import.meta.env.VITE_CHAIN || 'solana_devnet',
  rpcUrl: getRpcUrl(),
  authMethod: import.meta.env.VITE_AUTH_METHOD || 'privy',
  wsApiUrl: import.meta.env.VITE_WS_API_URL || 'wss://api.tarobase.com/ws/v2',
  apiUrl,
  authApiUrl: import.meta.env.VITE_AUTH_API_URL || 'https://auth.tarobase.com',
  /**
   * When true, enables mock authentication for browser automation/testing.
   * Set via ?mockAuth=true query param.
   * Disabled in LIVE environment for security.
   */
  mockAuth,
  /**
   * Optional wallet address to use for mock auth session.
   * Set via ?mockAddress=<address> query param.
   * If not provided, no default (mock auth uses session/default)
   * Disabled in LIVE environment for security.
   */
  mockAddress,
} as const;

/**
 * Get headers for PartyServer API calls.
 * Includes x-tarobase-app-id header when in non-LIVE environment
 * to trigger offchain RPC mode on the backend.
 */
export function getPartyServerHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  // In non-LIVE environments, send app ID header to trigger offchain RPC
  if (!isLiveEnvironment && (mockAppId || import.meta.env.VITE_CHAIN == 'offchain') && appId) {
    headers['x-tarobase-app-id'] = appId;
  }

  return headers;
}

// ═════════════════════════════════════════════════════════════
// OAUTH CONFIGURATION
// ═════════════════════════════════════════════════════════════

/**
 * OAuth service URL for social login (Twitter, Google, Discord, etc.)
 */
export const OAUTH_URL = import.meta.env.VITE_OAUTH_URL || import.meta.env.VITE_POOF_OAUTH_URL || '';

// ═════════════════════════════════════════════════════════════
// UI CONFIGURATION
// ═════════════════════════════════════════════════════════════

export const UI_CONFIG = {
  // UI configuration settings can be added here
} as const;

// ═════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════

/**
 * Get the full PartyServer WebSocket URL for a specific room
 * @param roomId - The room identifier
 * @param party - The party name (defaults to "state")
 * @param protocol - WebSocket protocol (defaults to "wss" for production, "ws" for localhost)
 * @param token - Optional JWT token to embed in URL query parameters
 */
export function getPartyServerWsUrl(
  roomId: string | number,
  party: string = 'state',
  protocol?: 'ws' | 'wss',
  token?: string,
): string {
  // Auto-detect protocol if not specified
  if (!protocol) {
    protocol = PARTYSERVER_URL.includes('localhost') ? 'ws' : 'wss';
  }

  const baseUrl = `${protocol}://${PARTYSERVER_URL}/parties/${party}/${roomId}`;

  // Add JWT token as query parameter if provided
  if (token) {
    const urlParams = new URLSearchParams({ token });
    return `${baseUrl}?${urlParams.toString()}`;
  }

  return baseUrl;
}

/**
 * Get the PartyServer HTTP URL for API calls
 * @param path - API path (optional)
 */
export function getPartyServerHttpUrl(path?: string): string {
  const protocol = PARTYSERVER_URL.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${PARTYSERVER_URL}`;
  return path ? `${baseUrl}${path}` : baseUrl;
}

/**
 * Get the API URL for backend calls (alias for getPartyServerHttpUrl)
 * @param path - API path (optional)
 * @example
 * ```typescript
 * const baseUrl = getApiUrl();
 * const healthUrl = getApiUrl('/health');
 * ```
 */
export const getApiUrl = getPartyServerHttpUrl;

// ═════════════════════════════════════════════════════════════
// DEVELOPMENT HELPERS
// ═════════════════════════════════════════════════════════════

