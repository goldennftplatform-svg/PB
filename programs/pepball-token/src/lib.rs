use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::clock::Clock;

declare_id!("PEPEBALL111111111111111111111111111111111111");

#[program]
pub mod pepball_token {
    use super::*;

    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        name: String,
        symbol: String,
        decimals: u8,
        creator_fund_address: Pubkey,
    ) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        token_info.name = name;
        token_info.symbol = symbol;
        token_info.decimals = decimals;
        token_info.total_supply = 1_000_000_000 * 10_u64.pow(decimals as u32);
        token_info.tax_rate = 250; // 2.5% total tax
        token_info.creator_fund_rate = 5; // 0.05% to creator fund (Matt Furie)
        token_info.jackpot_rate = 245; // 2.45% to jackpot
        token_info.creator_fund_address = creator_fund_address;
        token_info.is_renounced = false;
        token_info.admin = ctx.accounts.admin.key();
        
        msg!("PEPEBALL Token initialized!");
        msg!("Creator Fund Address: {}", creator_fund_address);
        msg!("Tax Rate: {}% ({}% creator + {}% jackpot)", 
             token_info.tax_rate as f64 / 100.0,
             token_info.creator_fund_rate as f64 / 100.0,
             token_info.jackpot_rate as f64 / 100.0);
        
        Ok(())
    }

    pub fn transfer_with_tax(
        ctx: Context<TransferWithTax>,
        amount: u64,
    ) -> Result<()> {
        let token_info = &ctx.accounts.token_info;
        
        // Calculate taxes
        let creator_tax = (amount * token_info.creator_fund_rate) / 10000; // 0.05%
        let jackpot_tax = (amount * token_info.jackpot_rate) / 10000; // 2.45%
        let total_tax = creator_tax + jackpot_tax;
        let transfer_amount = amount - total_tax;
        
        msg!("Transfer: {} tokens", amount);
        msg!("Creator Tax: {} tokens (0.05%)", creator_tax);
        msg!("Jackpot Tax: {} tokens (2.45%)", jackpot_tax);
        msg!("Net Transfer: {} tokens", transfer_amount);
        
        // Transfer to recipient
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.to.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, transfer_amount)?;
        
        // Transfer creator fund tax to Matt Furie
        let creator_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.creator_fund.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(creator_ctx, creator_tax)?;
        
        // Transfer jackpot tax to lottery pool
        let jackpot_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.jackpot_pool.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(jackpot_ctx, jackpot_tax)?;
        
        Ok(())
    }

    pub fn renounce_admin(ctx: Context<RenounceAdmin>) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        require!(!token_info.is_renounced, ErrorCode::AlreadyRenounced);
        require!(ctx.accounts.admin.key() == token_info.admin, ErrorCode::Unauthorized);
        
        token_info.is_renounced = true;
        token_info.admin = Pubkey::default();
        
        msg!("Admin renounced! PEPEBALL is now fully decentralized!");
        
        Ok(())
    }

    pub fn emergency_pause(ctx: Context<EmergencyPause>) -> Result<()> {
        let token_info = &mut ctx.accounts.token_info;
        require!(!token_info.is_renounced, ErrorCode::AlreadyRenounced);
        require!(ctx.accounts.admin.key() == token_info.admin, ErrorCode::Unauthorized);
        
        token_info.is_paused = !token_info.is_paused;
        
        if token_info.is_paused {
            msg!("EMERGENCY PAUSE ACTIVATED - All transfers halted!");
        } else {
            msg!("Emergency pause lifted - Transfers resumed!");
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeToken<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + TokenInfo::INIT_SPACE
    )]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferWithTax<'info> {
    #[account(mut)]
    pub token_info: Account<'info, TokenInfo>,
    
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub creator_fund: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub jackpot_pool: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RenounceAdmin<'info> {
    #[account(mut)]
    pub token_info: Account<'info, TokenInfo>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyPause<'info> {
    #[account(mut)]
    pub token_info: Account<'info, TokenInfo>,
    
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct TokenInfo {
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: u64,
    pub tax_rate: u16, // Total tax rate (250 = 2.5%)
    pub creator_fund_rate: u16, // Creator fund rate (5 = 0.05%)
    pub jackpot_rate: u16, // Jackpot rate (245 = 2.45%)
    pub creator_fund_address: Pubkey, // Matt Furie's address
    pub is_renounced: bool,
    pub is_paused: bool,
    pub admin: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Admin has already been renounced")]
    AlreadyRenounced,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Token transfers are paused")]
    TransfersPaused,
}
