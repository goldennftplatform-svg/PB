declare module '@faremeter/info' {
  export const solana: {
    x402Exact: (options: {
      network: 'devnet' | 'mainnet-beta';
      asset: string;
      amount: string;
      payTo: string;
    }) => any;
  };
}

declare module '@faremeter/middleware' {
  import type { Context, Next } from 'hono';

  export const hono: {
    createMiddleware: (options: {
      facilitatorURL: string;
      accepts: any[];
    }) => Promise<(c: Context, next: Next) => Promise<Response | void>>;
  };
}
