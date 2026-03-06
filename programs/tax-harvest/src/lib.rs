//! Locked harvest: the only thing this program can do with the tax vault
//! is swap token -> SOL and send SOL to the configured jackpot address.
//! Tax is auto-sent to the vault by pepball-token (or Token-2022); this program
//! only converts it to SOL for the jackpot.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};

declare_id!("TaxHrvst1111111111111111111111111111111111111");

#[program]
pub mod tax_harvest {
    use super::*;

    /// Initialize config: set the SOL address that receives jackpot SOL.
    pub fn initialize(ctx: Context<Initialize>, jackpot_sol_dest: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.jackpot_sol_dest = jackpot_sol_dest;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        msg!("Tax harvest config: SOL -> {}", jackpot_sol_dest);
        Ok(())
    }

    /// Locked function: sell `amount` of vault token for SOL and send SOL to jackpot.
    /// Only the program PDA can sign for the vault; this is the only way vault tokens leave.
    /// TODO: Add CPI to DEX (Meteora DLMM / Raydium) to swap token -> SOL, then
    /// SystemProgram::transfer received SOL to config.jackpot_sol_dest.
    pub fn process_harvest(ctx: Context<ProcessHarvest>, amount: u64) -> Result<()> {
        require!(amount > 0, HarvestError::InvalidAmount);

        let (vault_pda, _) = Pubkey::find_program_address(&[b"vault_authority"], ctx.program_id);
        require!(
            ctx.accounts.vault_authority.key() == vault_pda,
            HarvestError::VaultNotOwnedByProgram
        );

        let vault = &ctx.accounts.tax_vault;
        let vault_balance = vault.amount;
        require!(amount <= vault_balance, HarvestError::InsufficientVaultBalance);

        let config = &ctx.accounts.config;

        // TODO: CPI to DEX (Meteora/Raydium): swap `amount` of tax_vault token -> SOL.
        // Use invoke_signed with seeds = [b"vault_authority", &[bump]] so vault_authority PDA signs.
        // Then system_program::transfer(sol_received -> config.jackpot_sol_dest).
        msg!("Harvest: would swap {} raw tokens -> SOL -> {}", amount, config.jackpot_sol_dest);
        msg!("Implement DEX CPI (Meteora DLMM or Raydium) then SystemProgram::transfer");

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + HarvestConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, HarvestConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProcessHarvest<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = jackpot_sol_dest
    )]
    pub config: Account<'info, HarvestConfig>,

    /// Token account holding the tax; authority must be vault_authority PDA so only this program can move tokens
    #[account(
        mut,
        constraint = tax_vault.owner == vault_authority.key() @ HarvestError::VaultNotOwnedByProgram
    )]
    pub tax_vault: Account<'info, TokenAccount>,

    /// PDA that authorizes moves from tax_vault (validated in instruction)
    /// CHECK: must be program PDA with seeds ["vault_authority"]
    pub vault_authority: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    /// Destination for SOL (jackpot); must match config.jackpot_sol_dest
    /// CHECK: validated by config has_one
    #[account(mut)]
    pub jackpot_sol_dest: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct HarvestConfig {
    pub jackpot_sol_dest: Pubkey,
    pub authority: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum HarvestError {
    #[msg("Harvest amount must be positive")]
    InvalidAmount,
    #[msg("Vault balance too low")]
    InsufficientVaultBalance,
    #[msg("Tax vault must be owned by program PDA")]
    VaultNotOwnedByProgram,
}
