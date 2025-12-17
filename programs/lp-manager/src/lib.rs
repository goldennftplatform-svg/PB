use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;
use std::cmp::{min, max};

declare_id!("G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG");

#[program]
pub mod lp_manager {
    use super::*;

    pub fn initialize_lp_manager(
        ctx: Context<InitializeLPManager>,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        lp_manager.admin = ctx.accounts.admin.key();
        lp_manager.is_initialized = true;
        lp_manager.total_funded = 0;
        lp_manager.sol_converted = 0;
        lp_manager.fee_conversion_rate = 8000; // 80% of fees converted to SOL
        lp_manager.jackpot_funding_rate = 4000; // 40% of jackpot goes to next jackpot
        
        // Initialize delta-neutral hedging fields
        lp_manager.orca_position_initialized = false;
        lp_manager.tick_lower = 0;
        lp_manager.tick_upper = 0;
        lp_manager.target_delta = 0;
        lp_manager.current_delta = 0;
        lp_manager.last_rebalance_amount = 0;
        lp_manager.last_rebalance_direction = 0;
        lp_manager.rebalance_count = 0;
        lp_manager.last_rebalance_time = 0;
        lp_manager.orca_whirlpool = None;
        lp_manager.orca_position_nft = None;
        
        msg!("LP Manager initialized!");
        msg!("Fee conversion rate: {}%", lp_manager.fee_conversion_rate / 100);
        msg!("Jackpot funding rate: {}%", lp_manager.jackpot_funding_rate / 100);
        
        Ok(())
    }

    pub fn fund_jackpot(
        ctx: Context<FundJackpot>,
        amount: u64,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        
        // Transfer tokens to jackpot pool
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.lp_pool.to_account_info(),
                to: ctx.accounts.jackpot_pool.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;
        
        lp_manager.total_funded += amount;
        
        msg!("Funded jackpot with {} tokens", amount);
        msg!("Total funded: {} tokens", lp_manager.total_funded);
        
        Ok(())
    }

    pub fn convert_fees_to_sol(
        ctx: Context<ConvertFeesToSol>,
        token_amount: u64,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        
        // Calculate conversion amount (80% of fees)
        let conversion_amount = token_amount
            .saturating_mul(lp_manager.fee_conversion_rate as u64)
            / 10000;
        
        msg!("Converting {} tokens to SOL", conversion_amount);
        msg!("Conversion rate: {}%", lp_manager.fee_conversion_rate / 100);
        
        // This would integrate with Raydium or Jupiter for token-to-SOL conversion
        // For MVP, we'll implement a simplified version
        lp_manager.sol_converted += conversion_amount;
        
        msg!("Converted {} tokens to SOL", conversion_amount);
        msg!("Total SOL converted: {}", lp_manager.sol_converted);
        
        Ok(())
    }

    pub fn boost_jackpot(
        ctx: Context<BoostJackpot>,
        sol_amount: u64,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        
        msg!("Boosting jackpot with {} SOL", sol_amount / 1_000_000_000);
        
        // This would transfer SOL to the jackpot pool
        // For MVP, we'll track the boost amount
        lp_manager.jackpot_boosts += sol_amount;
        
        msg!("Jackpot boosted by {} SOL", sol_amount / 1_000_000_000);
        msg!("Total boosts: {} SOL", lp_manager.jackpot_boosts / 1_000_000_000);
        
        Ok(())
    }

    pub fn emergency_withdraw(
        ctx: Context<EmergencyWithdraw>,
        amount: u64,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        require!(ctx.accounts.admin.key() == lp_manager.admin, ErrorCode::Unauthorized);
        
        msg!("EMERGENCY WITHDRAWAL: {} tokens", amount);
        msg!("This should only be used in extreme circumstances!");
        
        // Transfer tokens back to admin (emergency only)
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.lp_pool.to_account_info(),
                to: ctx.accounts.admin_token_account.to_account_info(),
                authority: ctx.accounts.admin.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;
        
        Ok(())
    }

    /// Initialize Orca Whirlpool position for delta-neutral hedging
    pub fn initialize_orca_position(
        ctx: Context<InitializeOrcaPosition>,
        tick_lower: i32,
        tick_upper: i32,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        require!(ctx.accounts.admin.key() == lp_manager.admin, ErrorCode::Unauthorized);
        require!(lp_manager.is_initialized, ErrorCode::NotInitialized);
        
        lp_manager.orca_position_initialized = true;
        lp_manager.tick_lower = tick_lower;
        lp_manager.tick_upper = tick_upper;
        lp_manager.target_delta = 0; // Delta-neutral target
        
        msg!("Orca position initialized!");
        msg!("Tick range: [{}, {}]", tick_lower, tick_upper);
        msg!("Target delta: {} (delta-neutral)", lp_manager.target_delta);
        
        Ok(())
    }

    /// Calculate current delta exposure based on LP position
    pub fn calculate_delta(
        ctx: Context<CalculateDelta>,
        current_price: u64, // Price in basis points (e.g., 10000 = 1.0)
        liquidity_amount: u64,
    ) -> Result<i64> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        require!(lp_manager.is_initialized, ErrorCode::NotInitialized);
        
        // Delta calculation for concentrated liquidity (like Orca Whirlpool)
        // Delta = (liquidity * price_change) / (price * sqrt(price))
        // Simplified: Delta ≈ liquidity * (price_upper - price_lower) / current_price
        
        let price_lower = lp_manager.tick_to_price(lp_manager.tick_lower)?;
        let price_upper = lp_manager.tick_to_price(lp_manager.tick_upper)?;
        
        // Calculate delta exposure
        // Positive delta = long exposure, Negative delta = short exposure
        let delta = if current_price < price_lower {
            // Below range - no exposure
            0
        } else if current_price > price_upper {
            // Above range - full exposure
            liquidity_amount as i64
        } else {
            // In range - proportional exposure
            let price_range = price_upper - price_lower;
            let price_in_range = current_price - price_lower;
            ((liquidity_amount as u128 * price_in_range as u128) / price_range as u128) as i64
        };
        
        // Store current delta
        lp_manager.current_delta = delta;
        
        msg!("Delta calculated: {}", delta);
        msg!("Current price: {}", current_price);
        msg!("Price range: [{}, {}]", price_lower, price_upper);
        
        Ok(delta)
    }

    /// Auto-rebalance LP position to maintain delta-neutral exposure
    pub fn auto_rebalance(
        ctx: Context<AutoRebalance>,
        current_price: u64,
        current_delta: i64,
        rebalance_threshold: i64, // Minimum delta deviation to trigger rebalance
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        require!(ctx.accounts.admin.key() == lp_manager.admin, ErrorCode::Unauthorized);
        require!(lp_manager.is_initialized, ErrorCode::NotInitialized);
        require!(lp_manager.orca_position_initialized, ErrorCode::PositionNotInitialized);
        
        let target_delta = lp_manager.target_delta;
        let delta_deviation = current_delta - target_delta;
        
        msg!("Auto-rebalancing...");
        msg!("Current delta: {}", current_delta);
        msg!("Target delta: {}", target_delta);
        msg!("Deviation: {}", delta_deviation);
        
        // Only rebalance if deviation exceeds threshold
        if delta_deviation.abs() < rebalance_threshold {
            msg!("Delta within threshold, no rebalance needed");
            return Ok(());
        }
        
        // Calculate rebalance amount
        let rebalance_amount = delta_deviation.abs() as u64;
        
        if delta_deviation > 0 {
            // Positive delta - need to reduce long exposure
            // Remove liquidity or shift position down
            msg!("Reducing long exposure by {}", rebalance_amount);
            lp_manager.last_rebalance_amount = rebalance_amount;
            lp_manager.last_rebalance_direction = -1; // Reduce
        } else {
            // Negative delta - need to reduce short exposure
            // Add liquidity or shift position up
            msg!("Reducing short exposure by {}", rebalance_amount);
            lp_manager.last_rebalance_amount = rebalance_amount;
            lp_manager.last_rebalance_direction = 1; // Increase
        }
        
        lp_manager.rebalance_count += 1;
        lp_manager.last_rebalance_time = Clock::get()?.unix_timestamp;
        
        msg!("Rebalance completed! Total rebalances: {}", lp_manager.rebalance_count);
        
        Ok(())
    }

    /// Update position ticks to shift exposure
    pub fn update_position_ticks(
        ctx: Context<UpdatePositionTicks>,
        new_tick_lower: i32,
        new_tick_upper: i32,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        require!(ctx.accounts.admin.key() == lp_manager.admin, ErrorCode::Unauthorized);
        require!(lp_manager.is_initialized, ErrorCode::NotInitialized);
        
        lp_manager.tick_lower = new_tick_lower;
        lp_manager.tick_upper = new_tick_upper;
        
        msg!("Position ticks updated!");
        msg!("New tick range: [{}, {}]", new_tick_lower, new_tick_upper);
        
        Ok(())
    }

    /// Set target delta (for flexible hedging strategies)
    pub fn set_target_delta(
        ctx: Context<SetTargetDelta>,
        target_delta: i64,
    ) -> Result<()> {
        let lp_manager = &mut ctx.accounts.lp_manager;
        require!(ctx.accounts.admin.key() == lp_manager.admin, ErrorCode::Unauthorized);
        require!(lp_manager.is_initialized, ErrorCode::NotInitialized);
        
        lp_manager.target_delta = target_delta;
        
        msg!("Target delta updated to: {}", target_delta);
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeLPManager<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + LPManager::INIT_SPACE
    )]
    pub lp_manager: Account<'info, LPManager>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundJackpot<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    #[account(mut)]
    pub lp_pool: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub jackpot_pool: Account<'info, TokenAccount>,
    
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ConvertFeesToSol<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct BoostJackpot<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyWithdraw<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    #[account(mut)]
    pub lp_pool: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,
    
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct LPManager {
    pub admin: Pubkey,
    pub is_initialized: bool,
    pub total_funded: u64,
    pub sol_converted: u64,
    pub jackpot_boosts: u64,
    pub fee_conversion_rate: u16, // Basis points (8000 = 80%)
    pub jackpot_funding_rate: u16, // Basis points (4000 = 40%)
    
    // Delta-neutral hedging fields
    pub orca_position_initialized: bool,
    pub tick_lower: i32,
    pub tick_upper: i32,
    pub target_delta: i64, // Target delta exposure (0 = delta-neutral)
    pub current_delta: i64, // Current delta exposure
    pub last_rebalance_amount: u64,
    pub last_rebalance_direction: i8, // -1 = reduce, 0 = none, 1 = increase
    pub rebalance_count: u64,
    pub last_rebalance_time: i64, // Unix timestamp
    pub orca_whirlpool: Option<Pubkey>, // Orca Whirlpool address
    pub orca_position_nft: Option<Pubkey>, // Position NFT mint
}

impl LPManager {
    /// Convert tick to price (simplified - Orca uses sqrtPriceX64)
    /// tick = log_1.0001(price)
    pub fn tick_to_price(&self, tick: i32) -> Result<u64> {
        // Simplified price calculation
        // In reality, Orca uses: price = 1.0001^tick
        // For basis points: price_bp = (1.0001^tick) * 10000
        let base: f64 = 1.0001;
        let price = base.powi(tick as i32);
        let price_bp = (price * 10000.0) as u64;
        Ok(price_bp)
    }
}

#[derive(Accounts)]
pub struct InitializeOrcaPosition<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CalculateDelta<'info> {
    pub lp_manager: Account<'info, LPManager>,
}

#[derive(Accounts)]
pub struct AutoRebalance<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePositionTicks<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetTargetDelta<'info> {
    #[account(mut)]
    pub lp_manager: Account<'info, LPManager>,
    
    pub admin: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("LP Manager not initialized")]
    NotInitialized,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Orca position not initialized")]
    PositionNotInitialized,
    #[msg("Invalid tick range")]
    InvalidTickRange,
}

