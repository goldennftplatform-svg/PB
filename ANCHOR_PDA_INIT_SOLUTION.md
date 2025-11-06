# Anchor PDA Initialization Solution

## Current Issue

When trying to initialize the lottery PDA account, Anchor throws:
```
Error: Signature verification failed.
Missing signature for public key [5qrYwQEcoTKn6i3MGdw5SbQVApg4nwNHbH89PzidCL4d]
```

This happens because:
1. The IDL marks `lottery` account as `signer: true`
2. The account is actually a PDA (Program Derived Address)
3. PDAs can't sign directly - they need to be signed by the program using seeds
4. Anchor isn't recognizing that this PDA should be signed with seeds

## Solution: Add Seeds to Rust Constraint

The Rust code needs to specify the seeds for the PDA account. Update `programs/lottery/src/lib.rs`:

```rust
#[derive(Accounts)]
pub struct InitializeLottery<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Lottery::INIT_SPACE,
        seeds = [b"lottery"],
        bump
    )]
    pub lottery: Account<'info, Lottery>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
```

The key changes:
- `seeds = [b"lottery"]` - tells Anchor the seeds used to derive the PDA
- `bump` - tells Anchor to find and use the canonical bump seed

## After Fix

1. Rebuild the contract:
   ```bash
   anchor build
   ```

2. Redeploy to devnet:
   ```bash
   anchor deploy --program-name lottery --provider.cluster devnet
   ```

3. Run the initialization test:
   ```powershell
   $env:ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
   $env:ANCHOR_WALLET="$env:USERPROFILE\.config\solana\id.json"
   npx ts-mocha -p ./tsconfig.json -t 1000000 ./tests/init-lottery-devnet.ts
   ```

## Why This Works

When Anchor sees `seeds` and `bump` in the account constraint:
- It knows this is a PDA
- It derives the PDA using the seeds
- It signs the transaction with the program's authority using the seeds
- The PDA can be marked as `signer: true` because Anchor handles the signing

Without seeds specified, Anchor treats it as a regular account that needs a keypair signature, which PDAs can't provide.

