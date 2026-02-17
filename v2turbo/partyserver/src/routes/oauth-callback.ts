/**
 * OAuth Callback Route
 *
 * This route handles OAuth callbacks from Poof's OAuth service.
 * When a user completes OAuth with a provider (Twitter, Google, etc.),
 * Poof redirects back here with a signed JWT containing the connection data.
 *
 * To enable this route:
 * 1. Uncomment the import and registration in routes/index.ts
 * 2. Customize the logic below (optional)
 * 3. Deploy your app
 *
 * The route will:
 * 1. Verify the JWT signature (proves it came from Poof)
 * 2. Store the social connection in your database
 * 3. Run any custom logic you add (airdrops, welcome messages, etc.)
 * 4. Redirect back to your frontend
 */

import { set } from '@pooflabs/server';
import type { Context } from 'hono';
import { OAUTH_STORAGE_PATH } from '../lib/config.js';
import { initializeCORS, isOriginAllowed } from '../lib/cors-helpers.js';
import { verifyPoofOAuthToken, type PoofOAuthPayload } from '../lib/poof-oauth.js';
import type { ApiEndpointConfig } from '../types/api.js';

/**
 * Validate redirect URL for OAuth callback.
 *
 * SECURITY: Only allows redirects to domains in the CORS allowlist.
 * This prevents open redirect attacks that could lead to phishing.
 *
 * TO ADD ALLOWED REDIRECT DOMAINS:
 * - Add custom domains via poof's domain management UI (recommended)
 * - Or set CORS_PROD_DOMAINS env var: CORS_PROD_DOMAINS=myapp.com,other.com
 * - Localhost is always allowed for development
 */
const corsConfig = initializeCORS();

function isAllowedRedirect(url: URL): boolean {
  // Allow localhost for development (any port, http or https)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return true;
  }

  // Require HTTPS for production
  if (url.protocol !== 'https:') {
    return false;
  }

  // Check against CORS allowlist (same domains trusted for API access)
  return isOriginAllowed(url.origin, corsConfig);
}

/**
 * Get validated redirect URL from request, with logging for blocked domains.
 * Falls back to request origin if redirect is not allowed.
 */
function getValidatedRedirectUrl(redirectParam: string | undefined, requestUrl: string): URL {
  if (redirectParam) {
    try {
      const url = new URL(redirectParam);
      if (isAllowedRedirect(url)) {
        return url;
      }
      // Domain not in CORS allowlist - log for debugging
      console.warn(
        `[OAuth] Redirect blocked: "${url.hostname}" not in allowed domains. ` +
        `Allowed: [${corsConfig.allowedOrigins.join(', ')}]. ` +
        `To fix: Add domain via poof's domain UI, or set CORS_PROD_DOMAINS=${url.hostname}`
      );
    } catch {
      // Invalid URL format
    }
  }
  return new URL('/', requestUrl);
}

// ═══════════════════════════════════════════════════════════════
// ROUTE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const oauthCallbackConfig: ApiEndpointConfig = {
  method: 'GET',
  path: '/api/oauth/callback',
  description: 'Handle OAuth callback from Poof OAuth service',
  tags: ['auth', 'oauth'],
  requiresAuth: false, // Public endpoint (security via JWT verification)
};

// ═══════════════════════════════════════════════════════════════
// ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════

export async function oauthCallbackHandler(c: Context) {
  const token = c.req.query('token');
  const provider = c.req.query('provider');

  // Validate required parameters
  if (!token) {
    console.error('OAuth callback missing token parameter');
    return c.redirect('/?error=missing_token');
  }

  if (!provider) {
    console.error('OAuth callback missing provider parameter');
    return c.redirect('/?error=missing_provider');
  }

  try {
    const payload = verifyPoofOAuthToken(token);

    if (payload.provider !== provider) {
      throw new Error('Provider mismatch');
    }

    const storageKey = `social:${payload.wallet}:${provider}`;

    await set(`${OAUTH_STORAGE_PATH}/${storageKey}`, {
      wallet: payload.wallet,
      provider: payload.provider,
      profile: JSON.stringify({
        id: payload.profile.id,
        username: payload.profile.username,
        email: payload.profile.email,
        avatar: payload.profile.avatar,
        displayName: payload.profile.displayName,
        metadata: payload.profile.metadata,
      }),
      linkedAt: Date.now(),
    });

    await handleOAuthSuccess(payload);

    // Get validated redirect URL (falls back to origin if domain not allowed)
    const redirectUrl = getValidatedRedirectUrl(c.req.query('redirect'), c.req.url);
    redirectUrl.searchParams.set('oauth_success', 'true');
    redirectUrl.searchParams.set('provider', provider);

    return c.redirect(redirectUrl.toString());
  } catch (error) {
    // Get validated redirect URL (falls back to origin if domain not allowed)
    const redirectUrl = getValidatedRedirectUrl(c.req.query('redirect'), c.req.url);
    redirectUrl.searchParams.set('oauth_error', 'true');
    redirectUrl.searchParams.set('message', error instanceof Error ? error.message : 'unknown_error');
    return c.redirect(redirectUrl.toString());
  }
}

// ═══════════════════════════════════════════════════════════════
// CUSTOM LOGIC - Modify this function to add your own behavior
// ═══════════════════════════════════════════════════════════════

async function handleOAuthSuccess(payload: PoofOAuthPayload): Promise<void> {
  // Add custom logic here (airdrops, webhooks, etc.)
}
