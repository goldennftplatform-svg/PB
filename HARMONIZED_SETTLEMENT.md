# Harmonized Tax → SOL Jackpot Settlement

When the contract receives funds from the **2.5% buy/sell tax** (in the project token), we want the **jackpot in SOL**. This doc describes the **harmonized drip settlement** tool: convert token to SOL in small, randomized chunks so we don’t dump and we help the chart.

## Goal

- **Jackpot in SOL** – Winners get paid in SOL; tax is collected in token.
- **Harmonized** – Sell token → SOL over time in small amounts, not one big dump.
- **Drip + random (“danrom”)** – Each run sells a *chunk* of token (e.g. 5–15% of accumulated balance), with size slightly randomized so it looks like normal flow.
- **Chart-friendly** – Many small sells act like light market-making and can support the chart instead of one large sell.

## Flow

1. **Tax** accumulates at **TAX_RECIPIENT_ADDRESS** (or lottery house) in **project token**.
2. **Settlement bot/cron** runs on a schedule (e.g. every 15–30 min):
   - Read token balance of the tax recipient (or house).
   - If balance &gt; **min threshold**, compute a **drip chunk**:
     - e.g. `chunk = min(balance * dripPercent, maxChunkSize)` with a small random factor (e.g. 0.8–1.2x).
   - **Sell** that chunk: Token → SOL via **Jupiter** (or **Meteora** for pump-style pools).
   - **Send SOL** to lottery house (or jackpot vault) so the next drawing pays out in SOL.
   - **Record** the harvest in **feeHarvests** (token amount sold, SOL received, timestamp, tx sig).
3. Optionally **bump jackpot** state (e.g. `jackpotDeposits` or update jackpot balance) so the UI shows the new SOL.

## Config (concept)

| Constant / env | Meaning |
|----------------|--------|
| `TAX_RECIPIENT_ADDRESS` | Wallet that holds the tax token (source of sells). |
| `TOKEN_MINT_ADDRESS` | Project token mint. |
| `LOTTERY_HOUSE_ID` / jackpot vault | Where SOL is sent (jackpot in SOL). |
| `DRIP_MIN_BALANCE` | Min token balance (raw units) to run a drip. |
| `DRIP_PERCENT` | % of current balance to sell per drip (e.g. 5–15%). |
| `DRIP_MAX_CHUNK` | Cap per drip in raw token units (avoid one big sell). |
| `DRIP_RANDOM_FACTOR` | e.g. 0.8–1.2 so chunk size varies (“danrom”). |
| `DRIP_INTERVAL_MS` | How often the script runs (e.g. 15–30 min). |

## Implementation

- **`scripts/harmonized-drip-settlement.js`** – Node script that:
  - Uses the above config (from env or a small config file).
  - Fetches token balance for the tax recipient.
  - Computes chunk with random factor.
  - Builds a **Jupiter** (or Meteora) swap: token → SOL.
  - Signs with admin/settlement keypair, sends SOL to lottery house.
  - Records in **feeHarvests** (and optionally updates jackpot).
- Run via **cron** or a process manager so it executes on the chosen interval.

## Notes

- **No deletion** – Existing collections (feeHarvests, jackpot, jackpotDeposits, vrfSettlements) stay as-is; this only *adds* harvest records and SOL to the house.
- **On-chain** – The actual swap and transfer are on-chain; the script only drives *when* and *how much* (harmonized + random).
- **Poof/Tarobase** – Recording in `feeHarvests` can be done via your existing SDK (e.g. `setFeeHarvests`) after the swap tx confirms.
