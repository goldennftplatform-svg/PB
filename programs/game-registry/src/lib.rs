//! Master launch registry — single on-chain source of truth for PEPEBALL game day.
//! Wire master mint (pepball-token), Pump shell, and TRiX mints BEFORE public launch.
//! `seal_registry` is irreversible: no mint/program pointer changes after seal.

use anchor_lang::prelude::*;

declare_id!("CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR");

#[program]
pub mod game_registry {
    use super::*;

    /// Step 1: Create registry with program IDs and jackpot destination.
    /// Mint pubkeys are set via `register_mints` before seal.
    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        jackpot_sol_dest: Pubkey,
        lottery_program: Pubkey,
        pepball_token_program: Pubkey,
        tax_harvest_program: Pubkey,
        lp_manager_program: Pubkey,
    ) -> Result<()> {
        let reg = &mut ctx.accounts.registry;
        require!(!reg.sealed, RegistryError::AlreadySealed);

        reg.admin = ctx.accounts.admin.key();
        reg.bump = ctx.bumps.registry;
        reg.sealed = false;
        reg.jackpot_sol_dest = jackpot_sol_dest;
        reg.lottery_program = lottery_program;
        reg.pepball_token_program = pepball_token_program;
        reg.tax_harvest_program = tax_harvest_program;
        reg.lp_manager_program = lp_manager_program;

        reg.master_mint = Pubkey::default();
        reg.pump_shell_mint = Pubkey::default();
        reg.trix_yang_mint = Pubkey::default();
        reg.trix_yin_mint = Pubkey::default();
        reg.trix_bridge_mint = Pubkey::default();
        reg.mints_registered = false;

        reg.peg_numerator = 1;
        reg.peg_denominator = 1;

        msg!("Game registry initialized — register all mints then seal before launch");
        Ok(())
    }

    /// Step 2: Register master + Pump + TRiX mints (all required before seal).
    pub fn register_mints(
        ctx: Context<UpdateRegistry>,
        master_mint: Pubkey,
        pump_shell_mint: Pubkey,
        trix_yang_mint: Pubkey,
        trix_yin_mint: Pubkey,
        trix_bridge_mint: Pubkey,
    ) -> Result<()> {
        let reg = &mut ctx.accounts.registry;
        require!(!reg.sealed, RegistryError::AlreadySealed);

        require!(master_mint != Pubkey::default(), RegistryError::InvalidMint);
        require!(pump_shell_mint != Pubkey::default(), RegistryError::InvalidMint);
        require!(trix_yang_mint != Pubkey::default(), RegistryError::InvalidMint);
        require!(trix_yin_mint != Pubkey::default(), RegistryError::InvalidMint);
        require!(trix_bridge_mint != Pubkey::default(), RegistryError::InvalidMint);

        // Yin core should match master (1B taxed token); enforce equality
        require!(trix_yin_mint == master_mint, RegistryError::YinMustEqualMaster);

        reg.master_mint = master_mint;
        reg.pump_shell_mint = pump_shell_mint;
        reg.trix_yang_mint = trix_yang_mint;
        reg.trix_yin_mint = trix_yin_mint;
        reg.trix_bridge_mint = trix_bridge_mint;
        reg.mints_registered = true;

        msg!("Mints registered: master={}, pump={}, trix bridge={}", master_mint, pump_shell_mint, trix_bridge_mint);
        Ok(())
    }

    /// Step 3: Irreversible — locks registry for launch. No post-launch patching.
    pub fn seal_registry(ctx: Context<UpdateRegistry>) -> Result<()> {
        let reg = &mut ctx.accounts.registry;
        require!(!reg.sealed, RegistryError::AlreadySealed);
        require!(reg.mints_registered, RegistryError::MintsNotRegistered);

        reg.sealed = true;
        msg!("Game registry SEALED — launch config is immutable on-chain");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + GameRegistry::INIT_SPACE,
        seeds = [b"game_registry"],
        bump
    )]
    pub registry: Account<'info, GameRegistry>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRegistry<'info> {
    #[account(
        mut,
        seeds = [b"game_registry"],
        bump = registry.bump,
        has_one = admin @ RegistryError::Unauthorized
    )]
    pub registry: Account<'info, GameRegistry>,

    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct GameRegistry {
    pub admin: Pubkey,
    pub bump: u8,
    pub sealed: bool,
    pub mints_registered: bool,
    /// Custom 1B taxed token (pepball-token program) — lottery canonical mint
    pub master_mint: Pubkey,
    /// Pump.fun Yang / marketing shell
    pub pump_shell_mint: Pubkey,
    /// TRiX attention coin (may equal pump or be distinct)
    pub trix_yang_mint: Pubkey,
    /// TRiX Yin — MUST equal master_mint
    pub trix_yin_mint: Pubkey,
    /// TRiX bridge / 1:1 discovery coin
    pub trix_bridge_mint: Pubkey,
    /// 1:1 peg master ↔ bridge (fixed at launch)
    pub peg_numerator: u64,
    pub peg_denominator: u64,
    pub jackpot_sol_dest: Pubkey,
    pub lottery_program: Pubkey,
    pub pepball_token_program: Pubkey,
    pub tax_harvest_program: Pubkey,
    pub lp_manager_program: Pubkey,
}

#[error_code]
pub enum RegistryError {
    #[msg("Registry is sealed — no changes allowed")]
    AlreadySealed,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid mint pubkey")]
    InvalidMint,
    #[msg("Register all mints before sealing")]
    MintsNotRegistered,
    #[msg("TRiX Yin mint must equal master mint")]
    YinMustEqualMaster,
}
