/**
 * Social Links Routes
 *
 * These routes allow querying and managing linked social accounts.
 * Users can view their connected providers and unlink accounts.
 *
 * To enable these routes:
 * 1. Uncomment the imports and registrations in routes/index.ts
 * 2. Deploy your app
 */

import { get, set } from '@pooflabs/server';
import type { Context } from 'hono';
import { OAUTH_STORAGE_PATH } from '../lib/config.js';
import type { OAuthProvider } from '../lib/poof-oauth.js';
import { validatePoofAuth } from '../lib/poof-auth.js';
import type { ApiEndpointConfig } from '../types/api.js';
import { formatError } from '../lib/api-response.js';

// ═══════════════════════════════════════════════════════════════
// GET /api/social-links/:provider - Get specific linked account
// ═══════════════════════════════════════════════════════════════

export const getSocialLinkConfig: ApiEndpointConfig = {
  method: 'GET',
  path: '/api/social-links/:provider',
  description: 'Get a specific linked social account',
  tags: ['auth', 'oauth'],
  requiresAuth: true,
};

export async function getSocialLinkHandler(c: Context) {
  try {
    const { walletAddress } = await validatePoofAuth(c);
    const provider = c.req.param('provider') as OAuthProvider;

    // Validate provider
    const validProviders: OAuthProvider[] = ['twitter', 'google', 'discord', 'github', 'farcaster'];
    if (!validProviders.includes(provider)) {
      return c.json({ error: 'Invalid provider' }, 400);
    }

    const storageKey = `social:${walletAddress}:${provider}`;
    const data = await get(`${OAUTH_STORAGE_PATH}/${storageKey}`);

    if (!data) {
      return c.json({ error: 'Social link not found' }, 404);
    }

    const profile = typeof data.profile === 'string' ? JSON.parse(data.profile) : data.profile;

    return c.json({
      provider,
      profile,
      linkedAt: data.linkedAt,
    });
  } catch (error) {
    console.error('Error getting social link:', formatError(error));
    return c.json(
      {
        error: 'Failed to get social link',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/social-links/:provider - Unlink account
// ═══════════════════════════════════════════════════════════════

export const deleteSocialLinkConfig: ApiEndpointConfig = {
  method: 'DELETE',
  path: '/api/social-links/:provider',
  description: 'Unlink a social account',
  tags: ['auth', 'oauth'],
  requiresAuth: true,
};

export async function deleteSocialLinkHandler(c: Context) {
  try {
    const { walletAddress } = await validatePoofAuth(c);
    const provider = c.req.param('provider') as OAuthProvider;

    // Validate provider
    const validProviders: OAuthProvider[] = ['twitter', 'google', 'discord', 'github', 'farcaster'];
    if (!validProviders.includes(provider)) {
      return c.json({ error: 'Invalid provider' }, 400);
    }

    const storageKey = `social:${walletAddress}:${provider}`;

    // Check if link exists
    const data = await get(`${OAUTH_STORAGE_PATH}/${storageKey}`);
    if (!data) {
      return c.json({ error: 'Social link not found' }, 404);
    }

    await set(`${OAUTH_STORAGE_PATH}/${storageKey}`, null);

    return c.json({
      success: true,
      message: `Unlinked ${provider} account`,
      provider,
    });
  } catch (error) {
    console.error('Error deleting social link:', formatError(error));
    return c.json(
      {
        error: 'Failed to delete social link',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
}
