# Helius Winner Indexer Setup

## Overview

The Helius Winner Indexer uses Helius Enhanced API to efficiently index all participant accounts and calculate lottery winners. This enables the lottery to scale to 20,000+ participants.

## Setup

### 1. Get Helius API Key

1. Visit https://www.helius.dev/
2. Sign up for a free account
3. Get your API key from the dashboard
4. Set it as an environment variable:

```bash
# Windows PowerShell
$env:HELIUS_API_KEY="your-api-key-here"

# Linux/Mac
export HELIUS_API_KEY="your-api-key-here"
```

### 2. Install Dependencies

```bash
cd scripts
npm install
```

## Usage

### Index Winners After Snapshot

After running `take_snapshot`, use the indexer to find winners:

```bash
# With Helius API key set
node helius-winner-indexer.js

# Or using npm script
npm run index-winners
```

The indexer will:
1. Fetch all participant accounts using Helius Enhanced API
2. Calculate winners based on snapshot seed
3. Set winners on-chain via `set_winners` instruction

### Check Participant Account

To check a specific participant account:

```bash
node participant-account-helper.js <wallet_address1> <wallet_address2> ...
```

## How It Works

### 1. Participant Account Indexing

The indexer uses Helius Enhanced API's `getProgramAccounts` to fetch all participant accounts:

- **With Helius**: Fast, efficient, handles 20k+ accounts
- **Without Helius**: Falls back to standard RPC (slower, may timeout with large datasets)

### 2. Winner Calculation

Winners are calculated deterministically based on:
- `snapshot_seed` from lottery account
- `total_tickets` across all participants
- Weighted selection (tickets determine probability)

**Main Winner**: Selected by weighted random based on ticket count
**Minor Winners**: 8 winners selected randomly (excluding main winner)

### 3. On-Chain Verification

After calculating winners off-chain, the indexer calls `set_winners` to:
- Verify winners on-chain
- Store winners in lottery account
- Enable payout execution

## Architecture

```
┌─────────────────┐
│  take_snapshot  │ → Calculates snapshot_seed, resets counters
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Helius Indexer  │ → Fetches all participant accounts
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calculate       │ → Deterministic winner selection
│ Winners         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ set_winners     │ → On-chain verification
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ payout_winners  │ → Distribute prizes
└─────────────────┘
```

## Benefits of Helius

1. **Performance**: 10-100x faster than standard RPC for large datasets
2. **Reliability**: Enhanced APIs with better error handling
3. **Scalability**: Handles 20k+ accounts without timeouts
4. **Free Tier**: Sufficient for development and testing

## Troubleshooting

### "HELIUS_API_KEY not set"

The indexer will still work but will use standard RPC (slower). Get a free API key from https://www.helius.dev/

### "No participants found"

- Ensure participants have entered the lottery
- Check that `take_snapshot` has been called
- Verify lottery PDA is correct

### "Not enough participants"

Need at least 9 participants for 1 main + 8 minor winners.

## Production Considerations

For production with 20k+ participants:

1. **Use Helius Enhanced API** - Essential for performance
2. **Maintain Off-Chain Index** - Cache participant accounts for faster queries
3. **Monitor API Limits** - Helius free tier has rate limits
4. **Error Handling** - Implement retry logic for API calls
5. **Verification** - Always verify winners on-chain before payout

