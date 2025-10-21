use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use solana_program::clock::Clock;

declare_id!("LOTTERY111111111111111111111111111111111111");

#[program]
pub mod lottery {
    use super::*;

    pub fn initialize_lottery(
        ctx: Context<InitializeLottery>,
        jackpot_amount: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        lottery.jackpot_amount = jackpot_amount;
        lottery.last_draw = Clock::get()?.unix_timestamp;
        lottery.base_draw_interval = 72 * 60 * 60; // 72 hours in seconds
        lottery.fast_draw_interval = 36 * 60 * 60; // 36 hours in seconds
        lottery.fast_draw_threshold = 200 * 1_000_000_000; // 200 SOL in lamports
        lottery.is_active = true;
        lottery.admin = ctx.accounts.admin.key();
        lottery.total_participants = 0;
        lottery.total_draws = 0;
        
        msg!("PEPEBALL Lottery initialized!");
        msg!("Initial Jackpot: {} SOL", jackpot_amount / 1_000_000_000);
        msg!("Draw Timing: 72 hours (< 200 SOL), 36 hours (≥ 200 SOL)");
        
        Ok(())
    }

    pub fn enter_lottery_with_usd_value(
        ctx: Context<EnterLottery>,
        usd_value: u64, // USD value in cents (e.g., 2000 = $20.00)
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        // Calculate tickets based on USD value
        let ticket_count = calculate_tickets_from_usd_value(usd_value);
        require!(ticket_count > 0, ErrorCode::InsufficientValue);
        
        // Add participant
        let participant = Participant {
            wallet: ctx.accounts.participant.key(),
            ticket_count,
            usd_value,
            entry_time: Clock::get()?.unix_timestamp,
        };
        
        lottery.participants.push(participant);
        lottery.total_participants += 1;
        
        msg!("Participant entered lottery with {} tickets (${}.{})", 
             ticket_count, 
             usd_value / 100, 
             usd_value % 100);
        msg!("Total participants: {}", lottery.total_participants);
        
        Ok(())
    }

    pub fn enter_lottery(
        ctx: Context<EnterLottery>,
        ticket_count: u32,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        // Add participant
        let participant = Participant {
            wallet: ctx.accounts.participant.key(),
            ticket_count,
            usd_value: 0, // Legacy entry without USD tracking
            entry_time: Clock::get()?.unix_timestamp,
        };
        
        lottery.participants.push(participant);
        lottery.total_participants += 1;
        
        msg!("Participant entered lottery with {} tickets", ticket_count);
        msg!("Total participants: {}", lottery.total_participants);
        
        Ok(())
    }

    pub fn draw_winners(ctx: Context<DrawWinners>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        let clock = Clock::get()?;
        
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        // Dynamic timing based on jackpot size
        let draw_interval = if lottery.jackpot_amount >= lottery.fast_draw_threshold {
            lottery.fast_draw_interval // 36 hours for 200+ SOL
        } else {
            lottery.base_draw_interval  // 72 hours for < 200 SOL
        };
        
        require!(
            clock.unix_timestamp - lottery.last_draw >= draw_interval as i64,
            ErrorCode::DrawTooEarly
        );
        
        require!(lottery.participants.len() >= 6, ErrorCode::NotEnoughParticipants);
        
        // Simple random number generation (replace with Chainlink VRF later)
        let seed = clock.unix_timestamp as u64;
        let random = (seed % 1000) as u32;
        
        // Select winners (simplified for MVP)
        lottery.winners.main_winner = Some(lottery.participants[0].wallet);
        for i in 1..6 {
            lottery.winners.minor_winners.push(lottery.participants[i].wallet);
        }
        
        lottery.last_draw = clock.unix_timestamp;
        lottery.total_draws += 1;
        
        // Log the draw
        let timing = if lottery.jackpot_amount >= lottery.fast_draw_threshold {
            "36-hour"
        } else {
            "72-hour"
        };
        
        msg!("🎰 LOTTERY DRAW COMPLETE! 🎰");
        msg!("Jackpot: {} SOL", lottery.jackpot_amount / 1_000_000_000);
        msg!("Timing: {} draws", timing);
        msg!("Main Winner: {}", lottery.winners.main_winner.unwrap());
        msg!("Minor Winners: {}", lottery.winners.minor_winners.len());
        
        lottery.participants.clear();
        
        Ok(())
    }

    pub fn payout_winners(ctx: Context<PayoutWinners>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.winners.main_winner.is_some(), ErrorCode::NoWinners);
        
        // Calculate payouts (simplified)
        let total_jackpot = lottery.jackpot_amount;
        let main_payout = (total_jackpot * 60) / 100; // 60% to main winner
        let minor_payout = (total_jackpot * 40) / 100 / 5; // 40% split among 5 minor winners
        
        msg!("💰 PAYOUT DISTRIBUTION 💰");
        msg!("Total Jackpot: {} SOL", total_jackpot / 1_000_000_000);
        msg!("Main Winner: {} SOL (60%)", main_payout / 1_000_000_000);
        msg!("Each Minor Winner: {} SOL (8%)", minor_payout / 1_000_000_000);
        
        // Transfer SOL to winners (simplified - would need proper SOL transfer logic)
        // This is a placeholder - actual implementation would transfer SOL
        
        lottery.winners.main_winner = None;
        lottery.winners.minor_winners.clear();
        
        Ok(())
    }

    pub fn update_jackpot_amount(
        ctx: Context<UpdateJackpotAmount>,
        new_amount: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        let old_amount = lottery.jackpot_amount;
        lottery.jackpot_amount = new_amount;
        
        // Log the timing change if threshold is crossed
        if new_amount >= lottery.fast_draw_threshold && old_amount < lottery.fast_draw_threshold {
            msg!("🚀 JACKPOT REACHED {} SOL! Switching to 36-hour draws! 🚀", new_amount / 1_000_000_000);
        } else if new_amount < lottery.fast_draw_threshold && old_amount >= lottery.fast_draw_threshold {
            msg!("📉 Jackpot dropped to {} SOL. Back to 72-hour draws.", new_amount / 1_000_000_000);
        } else {
            msg!("Jackpot updated to {} SOL", new_amount / 1_000_000_000);
        }
        
        Ok(())
    }

    pub fn emergency_pause_lottery(ctx: Context<EmergencyPauseLottery>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);
        
        lottery.is_active = !lottery.is_active;
        
        if lottery.is_active {
            msg!("Lottery resumed!");
        } else {
            msg!("EMERGENCY PAUSE - Lottery halted!");
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeLottery<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Lottery::INIT_SPACE
    )]
    pub lottery: Account<'info, Lottery>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterLottery<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
pub struct DrawWinners<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct PayoutWinners<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateJackpotAmount<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyPauseLottery<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Lottery {
    pub jackpot_amount: u64,
    pub last_draw: i64,
    pub base_draw_interval: u64,    // 72 hours in seconds
    pub fast_draw_interval: u64,    // 36 hours in seconds
    pub fast_draw_threshold: u64,   // 200 SOL threshold
    pub is_active: bool,
    pub admin: Pubkey,
    pub participants: Vec<Participant>,
    pub winners: Winners,
    pub total_participants: u64,
    pub total_draws: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Participant {
    pub wallet: Pubkey,
    pub ticket_count: u32,
    pub usd_value: u64, // USD value in cents
    pub entry_time: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Winners {
    pub main_winner: Option<Pubkey>,
    pub minor_winners: Vec<Pubkey>,
}

// Helper function to calculate tickets from USD value
fn calculate_tickets_from_usd_value(usd_value: u64) -> u32 {
    match usd_value {
        // $20.00 = 1 ticket
        2000..=9999 => 1,
        // $100.00 = 4 tickets (25% bonus)
        10000..=49999 => 4,
        // $500.00 = 10 tickets (100% bonus)
        50000..=u64::MAX => 10,
        // Less than $20 = 0 tickets
        _ => 0,
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Lottery is not active")]
    LotteryInactive,
    #[msg("Draw is too early")]
    DrawTooEarly,
    #[msg("No winners to payout")]
    NoWinners,
    #[msg("Not enough participants")]
    NotEnoughParticipants,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Insufficient USD value - minimum $20 required")]
    InsufficientValue,
}

