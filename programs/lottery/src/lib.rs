use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use solana_program::clock::Clock;

declare_id!("ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1");

#[program]
pub mod lottery {
    use super::*;

    pub fn initialize_lottery(
        ctx: Context<InitializeLottery>,
        jackpot_amount: u64,
    ) -> Result<()> {
        // Security: Verify PDA is correctly derived from seeds
        let lottery = &mut ctx.accounts.lottery;
        
        // Security: Validate initial jackpot amount (must be reasonable)
        require!(jackpot_amount > 0, ErrorCode::InvalidConfig);
        require!(jackpot_amount <= 1_000_000 * 1_000_000_000, ErrorCode::InvalidConfig); // Max 1M SOL
        
        // Initialize lottery state
        lottery.jackpot_amount = jackpot_amount;
        lottery.carry_over_amount = 0; // Initialize carry-over
        lottery.last_snapshot = Clock::get()?.unix_timestamp;
        lottery.base_snapshot_interval = 72 * 60 * 60; // 72 hours in seconds
        lottery.fast_snapshot_interval = 48 * 60 * 60; // 48 hours in seconds
        lottery.fast_mode_threshold = 200 * 1_000_000_000; // 200 SOL in lamports
        lottery.fees_collected = 0;
        lottery.is_fast_mode = false;
        lottery.is_active = true;
        lottery.admin = ctx.accounts.admin.key();
        lottery.total_participants = 0;
        lottery.total_snapshots = 0;
        
        msg!("PEPEBALL Lottery initialized!");
        msg!("Initial Jackpot: {} SOL", jackpot_amount / 1_000_000_000);
        msg!("Admin: {}", ctx.accounts.admin.key());
        msg!("Lottery PDA: {}", lottery.key());
        msg!("Snapshot Timing: 72 hours (< 200 SOL fees), 48 hours (≥ 200 SOL fees)");
        
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

    pub fn take_snapshot(ctx: Context<TakeSnapshot>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        let clock = Clock::get()?;
        
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        // Dynamic timing based on fees collected
        let snapshot_interval = if lottery.fees_collected >= lottery.fast_mode_threshold {
            lottery.fast_snapshot_interval // 48 hours for 200+ SOL fees
        } else {
            lottery.base_snapshot_interval  // 72 hours for < 200 SOL fees
        };
        
        require!(
            clock.unix_timestamp - lottery.last_snapshot >= snapshot_interval as i64,
            ErrorCode::DrawTooEarly
        );
        
        require!(lottery.participants.len() >= 9, ErrorCode::NotEnoughParticipants); // Need 9 for 1 main + 8 minor
        
        // CRITICAL FIX 4: Improved randomness using clock data (weighted by ticket count)
        let seed = clock.slot
            .wrapping_mul(clock.unix_timestamp as u64)
            .wrapping_add(lottery.participants.len() as u64)
            .wrapping_add(lottery.total_snapshots);
        
        // Weighted selection based on ticket count
        let total_tickets: u32 = lottery.participants.iter()
            .map(|p| p.ticket_count)
            .sum();
        
        require!(total_tickets > 0, ErrorCode::NotEnoughParticipants);
        
        // Select main winner (weighted by tickets)
        let main_winner_ticket = (seed % total_tickets as u64) as u32;
        let mut accumulated = 0u32;
        let mut main_winner_idx = 0;
        
        for (idx, participant) in lottery.participants.iter().enumerate() {
            accumulated += participant.ticket_count;
            if accumulated > main_winner_ticket {
                main_winner_idx = idx;
                break;
            }
        }
        
        lottery.winners.main_winner = Some(lottery.participants[main_winner_idx].wallet);
        
        // Select 8 minor winners (excluding main winner, with different randomness)
        let mut minor_indices = Vec::new();
        let mut remaining_seed = seed.wrapping_mul(7); // Different seed for minor winners
        
        for _ in 0..8 {
            let available: Vec<usize> = (0..lottery.participants.len())
                .filter(|&i| i != main_winner_idx && !minor_indices.contains(&i))
                .collect();
            
            if available.is_empty() {
                break;
            }
            
            let winner_idx = available[(remaining_seed as usize) % available.len()];
            minor_indices.push(winner_idx);
            remaining_seed = remaining_seed.wrapping_mul(13).wrapping_add(1);
        }
        
        let mut minor_winners = Vec::with_capacity(8);
        for idx in minor_indices {
            minor_winners.push(lottery.participants[idx].wallet);
        }
        lottery.winners.minor_winners = minor_winners;
        
        lottery.last_snapshot = clock.unix_timestamp;
        lottery.total_snapshots += 1;
        
        // Update fast mode status
        lottery.is_fast_mode = lottery.fees_collected >= lottery.fast_mode_threshold;
        
        // Log the snapshot
        let timing = if lottery.is_fast_mode {
            "48-hour"
        } else {
            "72-hour"
        };
        
        msg!("📸 SNAPSHOT TAKEN! 📸");
        msg!("Jackpot: {} SOL", lottery.jackpot_amount / 1_000_000_000);
        msg!("Fees Collected: {} SOL", lottery.fees_collected / 1_000_000_000);
        msg!("Timing: {} snapshots", timing);
        msg!("Main Winner: {}", lottery.winners.main_winner.unwrap());
        msg!("Minor Winners: {}", lottery.winners.minor_winners.len());
        
        lottery.participants.clear();
        
        Ok(())
    }

    pub fn payout_winners(ctx: Context<PayoutWinners>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.winners.main_winner.is_some(), ErrorCode::NoWinners);
        
        // NEW PAYOUT STRUCTURE: 68% Grand Prize, 8% Carry-over, 8 winners at 3% each
        let total_jackpot = lottery.jackpot_amount + lottery.carry_over_amount; // Include carry-over
        let grand_prize = (total_jackpot * 68) / 100; // 68% to grand prize winner
        let carry_over = (total_jackpot * 8) / 100; // 8% carry-over to next round
        let minor_payout_per_winner = (total_jackpot * 3) / 100; // 3% to each of 8 minor winners
        
        msg!("💰 PAYOUT DISTRIBUTION 💰");
        msg!("Total Jackpot: {} SOL", total_jackpot / 1_000_000_000);
        msg!("Grand Prize Winner: {} SOL (68%)", grand_prize / 1_000_000_000);
        msg!("Carry-over to Next Round: {} SOL (8%)", carry_over / 1_000_000_000);
        msg!("Each Minor Winner: {} SOL (3%)", minor_payout_per_winner / 1_000_000_000);
        msg!("Total Minor Winners: {}", lottery.winners.minor_winners.len());
        
        // Update carry-over for next round
        lottery.carry_over_amount = carry_over;
        
        // Transfer SOL to winners (simplified - would need proper SOL transfer logic)
        // This is a placeholder - actual implementation would transfer SOL
        
        // Clear winners after payout
        lottery.winners.main_winner = None;
        lottery.winners.minor_winners.clear();
        
        // Reset jackpot to carry-over amount for next round
        lottery.jackpot_amount = carry_over;
        
        Ok(())
    }

    pub fn update_fees_collected(
        ctx: Context<UpdateFeesCollected>,
        new_fees: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        let _old_fees = lottery.fees_collected;
        lottery.fees_collected = new_fees;
        
        // Update fast mode status
        let was_fast_mode = lottery.is_fast_mode;
        lottery.is_fast_mode = lottery.fees_collected >= lottery.fast_mode_threshold;
        
        // Log the mode change if threshold is crossed
        if lottery.is_fast_mode && !was_fast_mode {
            msg!("🚀 FEES REACHED {} SOL! Switching to 48-hour snapshots! 🚀", new_fees / 1_000_000_000);
        } else if !lottery.is_fast_mode && was_fast_mode {
            msg!("📉 Fees dropped to {} SOL. Back to 72-hour snapshots.", new_fees / 1_000_000_000);
        } else {
            msg!("Fees updated to {} SOL", new_fees / 1_000_000_000);
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

    // Admin-only: configure snapshot timing and fast-mode threshold for testing/devnet
    pub fn configure_timing(
        ctx: Context<ConfigureTiming>,
        base_snapshot_interval: u64,
        fast_snapshot_interval: u64,
        fast_mode_threshold: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);

        // Basic sanity checks
        require!(base_snapshot_interval > 0, ErrorCode::InvalidConfig);
        require!(fast_snapshot_interval > 0, ErrorCode::InvalidConfig);

        lottery.base_snapshot_interval = base_snapshot_interval;
        lottery.fast_snapshot_interval = fast_snapshot_interval;
        lottery.fast_mode_threshold = fast_mode_threshold;

        msg!(
            "⏱️ Timing configured: base={}s, fast={}s, threshold={} SOL",
            base_snapshot_interval,
            fast_snapshot_interval,
            fast_mode_threshold / 1_000_000_000
        );

        Ok(())
    }

    pub fn update_jackpot_amount(
        ctx: Context<UpdateJackpotAmount>,
        new_amount: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);
        
        let old_amount = lottery.jackpot_amount;
        lottery.jackpot_amount = new_amount;
        
        msg!("💰 Jackpot updated: {} SOL → {} SOL", 
             old_amount / 1_000_000_000,
             new_amount / 1_000_000_000);
        
        Ok(())
    }
}

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

#[derive(Accounts)]
pub struct EnterLottery<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
pub struct TakeSnapshot<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateFeesCollected<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ConfigureTiming<'info> {
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
        pub carry_over_amount: u64,         // 8% carry-over to next prize
        pub last_snapshot: i64,
        pub base_snapshot_interval: u64,    // 72 hours in seconds
        pub fast_snapshot_interval: u64,     // 48 hours in seconds
        pub fast_mode_threshold: u64,       // 200 SOL threshold
        pub fees_collected: u64,            // Total fees collected in SOL
        pub is_fast_mode: bool,
        pub is_active: bool,
        pub admin: Pubkey,
        #[max_len(1000)]
        pub participants: Vec<Participant>,
        pub winners: Winners,
        pub total_participants: u64,
        pub total_snapshots: u64,
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
    #[max_len(8)]
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
    #[msg("Invalid configuration values")]
    InvalidConfig,
}

