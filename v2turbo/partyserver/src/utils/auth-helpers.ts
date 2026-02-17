import { ConnectionContext } from 'partyserver';
import { formatError } from '../lib/api-response.js';
// Optional: Import Poof SDK functions if using Poof auth
// import { getLobbies, getLobbiesMembers } from '../poof';
// Note: "Tarobase" references refer to Poof's authentication service

export interface AuthResult {
  success: boolean;
  user?: any;
  error?: string;
}

export interface AuthConfig {
  type: 'public' | 'jwt' | 'poof' | 'custom';
  options?: any;
}

export function createAuthHelpers(config: AuthConfig = { type: 'public' }) {
  return {
    // Public access (no authentication required) - default
    async validatePublicAccess(): Promise<AuthResult> {
      return { success: true, user: { role: 'public' } };
    },

    // JWT token authentication
    async validateJWTAuth(ctx: ConnectionContext): Promise<AuthResult> {
      try {
        const token =
          new URL(ctx.request.url).searchParams.get('token') ||
          ctx.request.headers.get('authorization')?.replace('Bearer ', '');

        if (!token) {
          return { success: false, error: 'Missing authentication token' };
        }

        // EXAMPLE: Add your JWT validation logic here
        // const decoded = await verifyJWT(token);
        // return { success: true, user: decoded };

        // Placeholder - replace with actual JWT validation
        return {
          success: true,
          user: {
            id: crypto.randomUUID(),
            role: 'authenticated',
            token,
          },
        };
      } catch (error) {
        console.error('JWT auth error:', formatError(error));
        return { success: false, error: 'Invalid token' };
      }
    },

    // Poof wallet/lobby authentication
    async validatePoofAuth(ctx: ConnectionContext, roomName: string): Promise<AuthResult> {
      try {
        const walletAddress =
          ctx.request.headers.get('X-Wallet-Address') ||
          new URL(ctx.request.url).searchParams.get('wallet');

        if (!walletAddress) {
          return { success: false, error: 'Missing wallet address' };
        }

        // EXAMPLE: Uncomment and modify these if using Poof authentication
        /*
        const lobby = await getLobbies(roomName);
        if (!lobby) {
          return { success: false, error: 'Invalid room' };
        }

        const member = await getLobbiesMembers(roomName, walletAddress);
        if (!member) {
          return { success: false, error: 'Not a member of this room' };
        }

        return {
          success: true,
          user: {
            walletAddress,
            role: 'member',
            ...member
          }
        };
        */

        // Placeholder - replace with actual Poof validation
        return {
          success: true,
          user: {
            walletAddress,
            role: 'member',
          },
        };
      } catch (error) {
        console.error('Poof auth error:', formatError(error));
        return { success: false, error: 'Authentication failed' };
      }
    },

    // Main validation method that uses the configured strategy
    async validateConnection(ctx: ConnectionContext, roomName?: string): Promise<AuthResult> {
      switch (config.type) {
        case 'jwt':
          return this.validateJWTAuth(ctx);
        case 'poof':
          return this.validatePoofAuth(ctx, roomName!);
        case 'public':
        default:
          return this.validatePublicAccess();
      }
    },

    // Request validation for use with onBeforeConnect
    async validateRequest(request: Request): Promise<Request | Response> {
      switch (config.type) {
        case 'jwt':
          const token =
            new URL(request.url).searchParams.get('token') ||
            request.headers.get('authorization')?.replace('Bearer ', '');
          if (!token) {
            return new Response('Unauthorized: Missing token', { status: 401 });
          }
          break;
        case 'poof':
          const walletAddress =
            request.headers.get('X-Wallet-Address') ||
            new URL(request.url).searchParams.get('wallet');
          if (!walletAddress) {
            return new Response('Unauthorized: Missing wallet address', { status: 401 });
          }
          break;
        case 'public':
        default:
          // No validation required
          break;
      }

      return request;
    },

    // Utility methods
    getAuthType(): string {
      return config.type;
    },

    isAuthenticationRequired(): boolean {
      return config.type !== 'public';
    },
  };
}

// Helper to create middleware for Hono-Party onBeforeConnect
export function createAuthMiddleware(config: AuthConfig) {
  return async (request: Request): Promise<Request | Response> => {
    const helpers = createAuthHelpers(config);
    return helpers.validateRequest(request);
  };
}
