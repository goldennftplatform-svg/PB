#!/usr/bin/env tsx
/**
 * Simple SDK Generator - HTTP API Client
 *
 * Generates a TypeScript SDK focused on HTTP REST API endpoints only.
 */

import fs from 'fs';
import path from 'path';
import { zodSchemaToTypeScript } from '../src/lib/type-generation.js';
import { getAllRouteConfigs } from '../src/routes/index.js';
import type { ApiEndpointConfig } from '../src/types/api.js';

/**
 * Extract route flags from ApiEndpointConfig and JSDoc
 */
function extractRouteFlags(route: ApiEndpointConfig & { name: string }): {
  requiresAuth: boolean;
  isCron: boolean;
} {
  const requiresAuth = route.requiresAuth || !!route.cronExpression;
  const isCron = !!route.cronExpression;

  return { requiresAuth, isCron };
}

const outputPath = './generated/api-client.ts';

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateSDK(): string {
  const allRoutes = getAllRouteConfigs();

  // Filter out cron routes - they shouldn't be in the frontend API client
  const routes = allRoutes.filter((route) => {
    const routeFlags = extractRouteFlags(route);
    return !routeFlags.isCron;
  });
  const timestamp = new Date().toISOString();

  // Generate type definitions for each route
  const typeDefinitions = routes
    .map((route) => {
      const requestType = route.requestSchema
        ? zodSchemaToTypeScript(route.requestSchema, `${route.name}Request`)
        : 'void';

      const responseType = route.responseSchema
        ? zodSchemaToTypeScript(route.responseSchema, `${route.name}Response`)
        : 'any';

      return `
// ${route.summary || route.description}
export type ${capitalizeFirst(route.name)}Request = ${requestType};
export type ${capitalizeFirst(route.name)}Response = ${responseType};`;
    })
    .join('\n');

  return `/**
 * Generated API Client SDK
 * HTTP REST API endpoints with full TypeScript types
 *
 * Generated at: ${timestamp}
 */

// ═══════════════════════════════════════════════════════════════
// BASE TYPES
// ═══════════════════════════════════════════════════════════════

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
  requestId?: string;
}

// ═══════════════════════════════════════════════════════════════
// ENDPOINT-SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════
${typeDefinitions}

export interface ApiClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  tarobaseAuth?: {
    token: string;
    walletAddress: string;
  };
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ═══════════════════════════════════════════════════════════════
// HTTP API CLIENT
// ═══════════════════════════════════════════════════════════════

export class ApiClient {
  constructor(private config: ApiClientConfig) {}

  private async request<T>(
    method: string,
    path: string,
    body?: any,
    isAuthenticatedRoute?: boolean
  ): Promise<T> {
    const url = \`\${this.config.baseUrl}\${path}\`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers
    };

    // Add auth headers if this is an authenticated route and we have tarobase auth
    if (isAuthenticatedRoute && this.config.tarobaseAuth) {
      headers['Authorization'] = \`Bearer \${this.config.tarobaseAuth.token}\`;
      headers['X-Wallet-Address'] = this.config.tarobaseAuth.walletAddress;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeout || 300000)
    });

    const data: ApiResponse<T> = await response.json();

    if (!data.success) {
      throw new ApiError(
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || 'An unknown error occurred',
        data.error?.details,
        response
      );
    }

    return data.data!;
  }

${routes
      .map((route) => {
        const methodName = route.name;
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(route.method);
        const requestTypeName = `${capitalizeFirst(route.name)}Request`;
        const responseTypeName = `${capitalizeFirst(route.name)}Response`;

        // Extract route flags from ApiEndpointConfig
        const routeFlags = extractRouteFlags(route);

        // Extract path parameters (e.g., :userId )
        const pathParams = route.path
          .split('/')
          .filter((segment) => segment.startsWith(':'))
          .map((param) => param.slice(1));

        const pathParamArgs = pathParams.map((param) => `${param}: string`).join(', ');
        const requestBody = hasBody
          ? route.requestSchema
            ? `request: ${requestTypeName}`
            : 'request?: any'
          : '';

        const methodArgs = [pathParamArgs, requestBody].filter(Boolean).join(', ');
        const requestArg = hasBody ? ', request' : ', undefined';
        const returnType = route.responseSchema ? responseTypeName : 'any';

        let dynamicPath = route.path;
        pathParams.forEach((param) => {
          dynamicPath = dynamicPath.replace(`:${param}`, `\${${param}}`);
        });

        // Generate comprehensive JSDoc comment
        const authInfo = route.requiresAuth
          ? `@auth Required - ${route.authDescription || 'Authentication needed'}`
          : `@auth Not required - ${route.authDescription || 'Public endpoint'}`;

        const rateLimit = route.rateLimit
          ? `@rateLimit ${route.rateLimit.requests} requests per ${route.rateLimit.window} seconds`
          : '';

        const example = route.examples?.request
          ? `@example
   * \`\`\`typescript
   * const result = await api.${methodName}(${pathParams.length > 0 ? pathParams.map((p) => `'${p}-value'`).join(', ') + ', ' : ''}${JSON.stringify(route.examples.request, null, 2)});
   * \`\`\``
          : '';

        const usageNotes = route.usageNotes ? `@usage ${route.usageNotes}` : '';

        return `  /**
   * ${route.summary || route.description}
   *
   * ${route.description}
   *
   * ${authInfo}
   * ${rateLimit}
   * ${usageNotes}
   *
   * @tags ${(route.tags || []).join(', ')}
   * ${example}
   */
  async ${methodName}(${methodArgs}): Promise<${returnType}> {
    return this.request<${returnType}>('${route.method}', \`${dynamicPath}\`${requestArg}, ${routeFlags.requiresAuth});
  }`;
      })
      .join('\n\n')}
}

// ═══════════════════════════════════════════════════════════════
// FACTORY AND EXPORTS
// ═══════════════════════════════════════════════════════════════

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

import { PARTYSERVER_URL, getPartyServerHeaders } from '@/lib/config';

/**
 * Default API client instance
 * Automatically includes x-tarobase-app-id header in non-LIVE environments
 */
export const api = createApiClient({
  baseUrl: \`https://\${PARTYSERVER_URL}\`,
  headers: getPartyServerHeaders()
});

/**
 * Create API client with admin authentication
 * This client automatically detects admin routes and adds auth headers
 *
 * @example
 * \`\`\`typescript
 * import { useAuth } from '@pooflabs/web';
 *
 * const { user } = useAuth();
 * const authenticatedApi = createAuthenticatedApiClient({
 *   token: user?.idToken,
 *   walletAddress: user?.address
 * });
 *
 * // Public routes work normally
 * const health = await authenticatedApi.health();
 *
 * // Admin routes automatically include auth headers
 * const adminResult = await authenticatedApi.adminRoute();
 * \`\`\`
 */
export function createAuthenticatedApiClient(auth: { token: string; walletAddress: string }) {
  return createApiClient({
    baseUrl: \`https://\${PARTYSERVER_URL}\`,
    headers: getPartyServerHeaders(),
    tarobaseAuth: {
      token: auth.token,
      walletAddress: auth.walletAddress
    }
  });
  }

// Default export
export default api;
`;
}

async function main() {
  console.log('🎯 Generating HTTP API Client SDK...');

  try {
    const sdkContent = generateSDK();

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, sdkContent, 'utf8');

    console.log('✅ HTTP API Client SDK generated successfully!');
    console.log(`   File: ${path.resolve(outputPath)}`);
    console.log(`   Size: ${(Buffer.byteLength(sdkContent, 'utf8') / 1024).toFixed(1)} KB`);

    // Copy to frontend src/lib/ for UI access
    const frontendOutputPath = '../src/lib/api-client.ts';
    const frontendOutputDir = path.dirname(frontendOutputPath);
    if (!fs.existsSync(frontendOutputDir)) {
      fs.mkdirSync(frontendOutputDir, { recursive: true });
    }
    fs.writeFileSync(frontendOutputPath, sdkContent, 'utf8');
    console.log(`   Copied to: ${path.resolve(frontendOutputPath)}`);

    console.log(`
🚀 Usage:

\`\`\`typescript
import { api } from '@/lib/api-client';

// HTTP API calls
const health = await api.health();
const result = await api.myEndpoint({ data: 'value' });
\`\`\`
`);
  } catch (error) {
    console.error('❌ Failed to generate SDK:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
