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
/** Lottery token mint (live test: 3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump) */
export const PEPEBALL_MINT = "3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump";
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

/** Lottery program ID (devnet) — for Solscan / verification */
export const LOTTERY_PROGRAM_ID = "8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7";
/** Lottery state PDA (devnet) — snapshot / game account */
export const LOTTERY_PDA = "ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb";
export const TOKEN_MINT_ADDRESS = "3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump";
export const TOKEN_TAX_BPS = "250";
export const TAX_RECIPIENT_ADDRESS = "FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje";
export const TOKEN_TAX_MAX_FEE = "1000000";
export const HARVEST_BOT_ENABLED = "false";

// Harmonized drip: tax token → SOL jackpot in small random chunks to help the chart
export const DRIP_MIN_BALANCE_RAW = "10000000"; // min token balance (raw) to run a drip (~10 tokens @ 6 decimals)
export const DRIP_PERCENT_BPS = "1000"; // 10% of balance per drip (1000 = 10%)
export const DRIP_MAX_CHUNK_RAW = "100000000"; // max tokens per drip in raw units (~100 @ 6 decimals)
export const DRIP_RANDOM_MIN = "80"; // min % of chunk (80 = 0.8x)
export const DRIP_RANDOM_MAX = "120"; // max % of chunk (120 = 1.2x)
export const TAROBASE_ENV = "devnet";
/** Min tokens to enter (raw units). Live test: 1 token at 6 decimals = 1_000_000. */
export const MIN_HOLDING_TOKENS = "1000000";

// ─── Static value (display / eligibility) ───────────────────────────────────
// Use a fixed USD-per-token for UI and checks when not using live price. Replace
// with Jupiter/Meteora quote when you want live. Live test token uses 6 decimals.
export const TOKEN_DECIMALS = 6;
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