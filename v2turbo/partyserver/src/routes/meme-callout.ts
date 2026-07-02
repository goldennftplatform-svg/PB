/**
 * Meme callout config — admin sets bonus-round contract address (CA).
 *
 * @endpoint GET /api/meme-callout
 * @endpoint PUT /api/meme-callout
 * @tags admin, lottery
 * @public GET only
 */

import { get, set } from '@pooflabs/server';
import type { Context } from 'hono';
import { z } from 'zod';
import { ADMIN_ADDRESS } from '../constants.js';
import { sendSuccess, ApiErrors, STANDARD_STATUS_CODES } from '../lib/api-response.js';
import type { ApiEndpointConfig } from '../types/api.js';

const STORAGE_PATH = 'memeCallout/config';

export const MemeCalloutSchema = z.object({
  enabled: z.boolean(),
  mint: z.string().nullable(),
  label: z.string().max(64).optional().default(''),
  network: z.enum(['devnet', 'mainnet']),
  updatedAt: z.number(),
  updatedBy: z.string().nullable(),
});

export const MemeCalloutPutSchema = z.object({
  enabled: z.boolean(),
  mint: z.string().nullable(),
  label: z.string().max(64).optional().default(''),
  network: z.enum(['devnet', 'mainnet']),
});

export type MemeCalloutConfig = z.infer<typeof MemeCalloutSchema>;

const DEFAULT_CONFIG: MemeCalloutConfig = {
  enabled: false,
  mint: null,
  label: '',
  network: 'devnet',
  updatedAt: 0,
  updatedBy: null,
};

function isValidBase58Pubkey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 32 || trimmed.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed);
}

export const getMemeCalloutConfig: ApiEndpointConfig = {
  method: 'GET',
  path: '/api/meme-callout',
  summary: 'Get meme callout config',
  description: 'Public read of the current rare meme bonus-round contract address (CA), if enabled.',
  tags: ['admin', 'lottery'],
  requiresAuth: false,
  responseSchema: MemeCalloutSchema,
};

export const putMemeCalloutConfig: ApiEndpointConfig = {
  method: 'PUT',
  path: '/api/meme-callout',
  summary: 'Set meme callout config',
  description: 'Admin-only. Enable/disable meme callout and set the bonus mint CA for this round.',
  tags: ['admin', 'lottery'],
  requiresAuth: false,
  requestSchema: MemeCalloutPutSchema,
  responseSchema: MemeCalloutSchema,
};

export async function getMemeCalloutHandler(c: Context): Promise<Response> {
  try {
    const stored = await get(STORAGE_PATH);
    if (!stored) {
      return sendSuccess(c, DEFAULT_CONFIG, STANDARD_STATUS_CODES.SUCCESS);
    }
    const parsed = MemeCalloutSchema.safeParse(stored);
    return sendSuccess(
      c,
      parsed.success ? parsed.data : DEFAULT_CONFIG,
      STANDARD_STATUS_CODES.SUCCESS,
    );
  } catch {
    return ApiErrors.internal(c, 'Failed to load meme callout config');
  }
}

export async function putMemeCalloutHandler(c: Context): Promise<Response> {
  const wallet = c.req.header('x-wallet-address')?.trim();
  if (!wallet || wallet.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    return ApiErrors.unauthorized(c, 'Admin wallet required');
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return ApiErrors.badRequest(c, 'Invalid JSON body');
  }

  const parsed = MemeCalloutPutSchema.safeParse(body);
  if (!parsed.success) {
    return ApiErrors.badRequest(c, 'Invalid meme callout payload', parsed.error.flatten());
  }

  const { enabled, mint, label, network } = parsed.data;
  if (enabled) {
    if (!mint || !isValidBase58Pubkey(mint)) {
      return ApiErrors.badRequest(c, 'Valid contract address (mint) required when callout is enabled');
    }
  }

  const config: MemeCalloutConfig = {
    enabled,
    mint: enabled ? mint!.trim() : null,
    label: (label ?? '').trim(),
    network,
    updatedAt: Date.now(),
    updatedBy: wallet,
  };

  try {
    await set(STORAGE_PATH, config);
    return sendSuccess(c, config, STANDARD_STATUS_CODES.SUCCESS);
  } catch {
    return ApiErrors.internal(c, 'Failed to save meme callout config');
  }
}
