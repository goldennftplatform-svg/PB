export const ADMIN_ADDRESS = "2QAQ367aBeHgCoHQwHo8x7ga34dANguG5Nu82Rs4ky42";

/** Privy app ID for wallet connect (Poof/Privy plug-and-play). Set VITE_PRIVY_APP_ID in Vercel or .env. */
export const PRIVY_CUSTOM_APP_ID = import.meta.env?.VITE_PRIVY_APP_ID ?? undefined;
/** Custom Privy API URL (e.g. self-hosted or proxy). Set VITE_PRIVY_API_URL to use your own Privy API. */
export const PRIVY_API_URL = import.meta.env?.VITE_PRIVY_API_URL ?? undefined;
/** Phantom app ID for Phantom wallet connect. Set VITE_PHANTOM_APP_ID in Vercel or .env. */
export const PHANTOM_APP_ID = import.meta.env?.VITE_PHANTOM_APP_ID ?? undefined;
export const PROJECT_VAULT_ADDRESS = "FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje";
export const SOL = "solana";
export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** Proof-phase token (low stakes $0.50/$1/$5) — existing contract. */
export const PROOF_MINT = "3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump";
/** Lottery token mint — proof by default. To switch to production: set VITE_PEPEBALL_MINT to your new CA and redeploy. See v2turbo/docs/SWITCH_TO_PRODUCTION_TOKEN.md */
export const PEPEBALL_MINT = import.meta.env?.VITE_PEPEBALL_MINT ?? PROOF_MINT;
/** In-app swap widget: 'pond' (PondX iframe) or 'jupiter'. Set VITE_SWAP_WIDGET to switch; default Pond for now. */
export const SWAP_WIDGET_PROVIDER = (import.meta.env?.VITE_SWAP_WIDGET ?? 'pond') as 'pond' | 'jupiter';
export const MIN_HOLDING_USD = "20";
export const DRAWING_INTERVAL_NORMAL = "172800";
export const DRAWING_INTERVAL_HIGH_JACKPOT = "259200";
export const HIGH_JACKPOT_THRESHOLD = "200000000000";
export const JACKPOT_ID = "main";
export const MAIN_WINNER_PERCENT = "60";
export const SECONDARY_WINNER_PERCENT = "4";
export const ROLLOVER_PERCENT = "6";
export const DEV_PERCENT = "2";
export const LOTTERY_HOUSE_ID = "lottery_house";

/** Lottery program ID — same on devnet and mainnet once deployed to mainnet */
export const LOTTERY_PROGRAM_ID = import.meta.env?.VITE_LOTTERY_PROGRAM_ID ?? "8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7";
/** Lottery state PDA (game snapshot account) — derive with same seeds on mainnet after deploy */
export const LOTTERY_PDA = import.meta.env?.VITE_LOTTERY_PDA ?? "ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb";
/** Jackpot wallet = tax recipient. Set VITE_TAX_RECIPIENT to pivot (same wallet for both tokens is fine). */
export const JACKPOT_SOL_DESTINATION_MAINNET = import.meta.env?.VITE_TAX_RECIPIENT ?? "FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje";
export const TOKEN_MINT_ADDRESS = import.meta.env?.VITE_PEPEBALL_MINT ?? "3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump";
/** Token tax in basis points (250 = 2.5%). Set VITE_TOKEN_TAX_BPS for new token. */
export const TOKEN_TAX_BPS = import.meta.env?.VITE_TOKEN_TAX_BPS ?? "250";
/** Tax recipient = jackpot wallet. Payouts from here. */
export const TAX_RECIPIENT_ADDRESS = import.meta.env?.VITE_TAX_RECIPIENT ?? "FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje";
export const TOKEN_TAX_MAX_FEE = "1000000";
export const HARVEST_BOT_ENABLED = "false";

// Harmonized drip: tax token → SOL jackpot in small random chunks to help the chart
export const DRIP_MIN_BALANCE_RAW = "10000000"; // min token balance (raw) to run a drip (~10 tokens @ 6 decimals)
export const DRIP_PERCENT_BPS = "1000"; // 10% of balance per drip (1000 = 10%)
export const DRIP_MAX_CHUNK_RAW = "100000000"; // max tokens per drip in raw units (~100 @ 6 decimals)
export const DRIP_RANDOM_MIN = "80"; // min % of chunk (80 = 0.8x)
export const DRIP_RANDOM_MAX = "120"; // max % of chunk (120 = 1.2x)
/** Used for scripts/backend; app uses VITE_CHAIN (solana_mainnet / solana_devnet). */
export const TAROBASE_ENV = import.meta.env?.VITE_CHAIN === "solana_mainnet" ? "mainnet" : "devnet";
/** Min tokens to enter (raw units). Set VITE_MIN_HOLDING_TOKENS for new token. */
export const MIN_HOLDING_TOKENS = import.meta.env?.VITE_MIN_HOLDING_TOKENS ?? "1000000";

// ─── Static value (display / eligibility) ───────────────────────────────────
/** Token decimals. Set VITE_TOKEN_DECIMALS for new token (e.g. 6 or 9). */
export const TOKEN_DECIMALS = parseInt(import.meta.env?.VITE_TOKEN_DECIMALS ?? "6", 10) || 6;
/** Static USD per 1 token. Tune to current price for live token (e.g. DexScreener). */
export const STATIC_USD_PER_TOKEN = 0.0001;

/** Raw token units → USD using static price (for display only unless you rely on it for gating). */
export function tokensToStaticUsd(rawUnits: number): number {
  const tokens = rawUnits / 10 ** TOKEN_DECIMALS;
  return tokens * STATIC_USD_PER_TOKEN;
}

/** USD → raw token units using static price. */
export function staticUsdToTokenRaw(usd: number): number {
  const tokens = usd / STATIC_USD_PER_TOKEN;
  return Math.floor(tokens * 10 ** TOKEN_DECIMALS);
}