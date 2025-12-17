use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use anchor_lang::solana_program::clock::Clock;

declare_id!("8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7");

#[program]
pub mod lottery {
    use super::*;

    pub fn initialize_lottery(
        ctx: Context<InitializeLottery>,
        jackpot_amount: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        
        require!(jackpot_amount > 0, ErrorCode::InvalidConfig);
        require!(jackpot_amount <= 1_000_000 * 1_000_000_000, ErrorCode::InvalidConfig);
        
        lottery.jackpot_amount = jackpot_amount;
        lottery.carry_over_amount = 0;
        lottery.last_snapshot = Clock::get()?.unix_timestamp;
        lottery.base_snapshot_interval = 72 * 60 * 60;
        lottery.fast_snapshot_interval = 48 * 60 * 60;
        lottery.fast_mode_threshold = 200 * 1_000_000_000;
        lottery.fees_collected = 0;
        lottery.is_fast_mode = false;
        lottery.is_active = true;
        lottery.admin = ctx.accounts.admin.key();
        lottery.total_participants = 0;
        lottery.total_tickets = 0;
        lottery.total_snapshots = 0;
        lottery.rollover_count = 0;
        lottery.pepe_ball_count = 0;
        
        msg!("PEPEBALL Lottery initialized!");
        msg!("Initial Jackpot: {} SOL", jackpot_amount / 1_000_000_000);
        msg!("Admin: {}", ctx.accounts.admin.key());
        msg!("Lottery PDA: {}", lottery.key());
        msg!("Scalable architecture: Separate participant accounts");
        msg!("50/50 Rollover mechanic: Odd Pepe balls = payout, Even = rollover");
        
        Ok(())
    }

    pub fn enter_lottery_with_usd_value(
        ctx: Context<EnterLottery>,
        usd_value: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        let ticket_count = calculate_tickets_from_usd_value(usd_value);
        require!(ticket_count > 0, ErrorCode::InsufficientValue);
        
        let participant_wallet = ctx.accounts.participant.key();
        let entry_time = Clock::get()?.unix_timestamp;
        
        // Initialize new participant account (will fail if already exists, use update_participant instead)
        ctx.accounts.participant_account.lottery = lottery.key();
        ctx.accounts.participant_account.wallet = participant_wallet;
        ctx.accounts.participant_account.ticket_count = ticket_count;
        ctx.accounts.participant_account.usd_value = usd_value;
        ctx.accounts.participant_account.entry_time = entry_time;
        
        lottery.total_participants += 1;
        lottery.total_tickets += ticket_count as u64;
        
        msg!("New participant entered: {} tickets (${}.{})", 
             ticket_count, 
             usd_value / 100, 
             usd_value % 100);
        msg!("Total unique participants: {}", lottery.total_participants);
        msg!("Total tickets in lottery: {}", lottery.total_tickets);
        
        Ok(())
    }

    pub fn enter_lottery(
        ctx: Context<EnterLottery>,
        ticket_count: u32,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        let participant_wallet = ctx.accounts.participant.key();
        let entry_time = Clock::get()?.unix_timestamp;
        
        // Initialize new participant account
        ctx.accounts.participant_account.lottery = lottery.key();
        ctx.accounts.participant_account.wallet = participant_wallet;
        ctx.accounts.participant_account.ticket_count = ticket_count;
        ctx.accounts.participant_account.usd_value = 0;
        ctx.accounts.participant_account.entry_time = entry_time;
        
        lottery.total_participants += 1;
        lottery.total_tickets += ticket_count as u64;
        
        msg!("New participant entered: {} tickets", ticket_count);
        
        Ok(())
    }

    pub fn update_participant_tickets(
        ctx: Context<UpdateParticipant>,
        ticket_count: u32,
        usd_value: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        require!(
            ctx.accounts.participant_account.lottery == lottery.key(),
            ErrorCode::Unauthorized
        );
        
        ctx.accounts.participant_account.ticket_count += ticket_count;
        ctx.accounts.participant_account.usd_value += usd_value;
        lottery.total_tickets += ticket_count as u64;
        
        msg!("Participant added {} more tickets (total: {}, ${}.{} total)", 
             ticket_count,
             ctx.accounts.participant_account.ticket_count,
             ctx.accounts.participant_account.usd_value / 100,
             ctx.accounts.participant_account.usd_value % 100);
        
        Ok(())
    }

    // Snapshot with 50/50 rollover mechanic
    // For 20k participants, use off-chain indexing + on-chain verification
    pub fn take_snapshot(ctx: Context<TakeSnapshot>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        let clock = Clock::get()?;
        
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        let snapshot_interval = if lottery.fees_collected >= lottery.fast_mode_threshold {
            lottery.fast_snapshot_interval
        } else {
            lottery.base_snapshot_interval
        };
        
        require!(
            clock.unix_timestamp - lottery.last_snapshot >= snapshot_interval as i64,
            ErrorCode::DrawTooEarly
        );
        
        require!(lottery.total_participants >= 9, ErrorCode::NotEnoughParticipants);
        require!(lottery.total_tickets > 0, ErrorCode::NotEnoughParticipants);
        
        // Use deterministic randomness based on blockchain state
        let seed = clock.slot
            .wrapping_mul(clock.unix_timestamp as u64)
            .wrapping_add(lottery.total_participants)
            .wrapping_add(lottery.total_snapshots);
        
        // 50/50 ROLLOVER MECHANIC: Calculate Pepe ball count (1-30)
        // Mix of numbered balls and Pepe balls - use randomness to determine count
        let pepe_count = ((seed % 30) as u8) + 1; // 1-30 balls
        lottery.pepe_ball_count = pepe_count;
        let is_odd = pepe_count % 2 == 1;
        
        lottery.snapshot_seed = seed;
        lottery.last_snapshot = clock.unix_timestamp;
        lottery.total_snapshots += 1;
        lottery.is_fast_mode = lottery.fees_collected >= lottery.fast_mode_threshold;
        
        msg!("📸 SNAPSHOT TAKEN! 📸");
        msg!("Total Participants: {}", lottery.total_participants);
        msg!("Total Tickets: {}", lottery.total_tickets);
        msg!("Snapshot Seed: {}", seed);
        msg!("🐸 Pepe Ball Count: {} ({} balls)", pepe_count, if is_odd { "ODD" } else { "EVEN" });
        
        if is_odd {
            // ODD = PAYOUT: Proceed with winner selection
            msg!("🎉 ODD COUNT - PAYOUT TIME! 🎉");
            msg!("Use off-chain indexer to find winners based on this seed");
            // Don't reset yet - wait for payout to complete
        } else {
            // EVEN = ROLLOVER: Grow jackpot, extend timer, keep participants
            msg!("🚀 EVEN COUNT - ROLLOVER! 🚀");
            lottery.rollover_count += 1;
            
            // Extend timer: 48h for odd rollovers, 72h for even rollovers
            let extension = if lottery.rollover_count % 2 == 0 {
                72 * 3600  // 72 hours
            } else {
                48 * 3600  // 48 hours
            };
            
            lottery.last_snapshot = clock.unix_timestamp + extension as i64;
            
            // Jackpot grows (accumulates from entries, no payout)
            // Participants remain for next draw
            msg!("Rollover #{} - Jackpot grows, timer extended by {} hours", 
                 lottery.rollover_count, extension / 3600);
            msg!("Participants carry over to next draw");
            
            // Reset snapshot seed (no payout this round)
            lottery.snapshot_seed = 0;
        }
        
        Ok(())
    }

    // Verify and set winners (called after off-chain calculation)
    pub fn set_winners(
        ctx: Context<SetWinners>,
        main_winner: Pubkey,
        minor_winners: Vec<Pubkey>,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);
        require!(lottery.snapshot_seed > 0, ErrorCode::NoWinners);
        require!(minor_winners.len() <= 8, ErrorCode::InvalidConfig);
        
        lottery.winners.main_winner = Some(main_winner);
        lottery.winners.minor_winners = minor_winners;
        
        msg!("✅ Winners set!");
        msg!("Main Winner: {}", main_winner);
        msg!("Minor Winners: {}", lottery.winners.minor_winners.len());
        
        Ok(())
    }

    pub fn payout_winners(ctx: Context<PayoutWinners>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.winners.main_winner.is_some(), ErrorCode::NoWinners);
        require!(lottery.pepe_ball_count % 2 == 1, ErrorCode::InvalidConfig); // Must be odd for payout
        
        let total_jackpot = lottery.jackpot_amount + lottery.carry_over_amount;
        
        // 50/50 ROLLOVER PAYOUT STRUCTURE (when odd):
        // 50% main winner, 40% split 8 minors (5% each), 10% house
        let main_reward = total_jackpot / 2;  // 50%
        let minor_pool = (total_jackpot * 2) / 5;  // 40%
        let minor_each = minor_pool / 8;  // 5% each for 8 winners
        let house_fee = total_jackpot / 10;  // 10%
        
        msg!("💰 50/50 ROLLOVER PAYOUT DISTRIBUTION 💰");
        msg!("Total Jackpot: {} SOL", total_jackpot / 1_000_000_000);
        msg!("Pepe Ball Count: {} (ODD - PAYOUT)", lottery.pepe_ball_count);
        msg!("Main Winner: {} SOL (50%)", main_reward / 1_000_000_000);
        msg!("Minor Winners Pool: {} SOL (40%)", minor_pool / 1_000_000_000);
        msg!("Each Minor Winner: {} SOL (5%)", minor_each / 1_000_000_000);
        msg!("House Fee: {} SOL (10%)", house_fee / 1_000_000_000);
        
        // Reset for next round
        lottery.carry_over_amount = 0;
        lottery.jackpot_amount = 0;  // All paid out (or set to house fee if keeping some)
        lottery.winners.main_winner = None;
        lottery.winners.minor_winners.clear();
        lottery.snapshot_seed = 0;
        lottery.rollover_count = 0;  // Reset rollover counter after payout
        lottery.pepe_ball_count = 0;
        
        // Reset participants for next round
        lottery.total_participants = 0;
        lottery.total_tickets = 0;
        
        Ok(())
    }

    pub fn update_fees_collected(
        ctx: Context<UpdateFeesCollected>,
        new_fees: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        lottery.fees_collected = new_fees;
        lottery.is_fast_mode = lottery.fees_collected >= lottery.fast_mode_threshold;
        
        if lottery.is_fast_mode {
            msg!("🚀 Fast mode active: 48-hour snapshots");
        } else {
            msg!("📉 Standard mode: 72-hour snapshots");
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

    pub fn configure_timing(
        ctx: Context<ConfigureTiming>,
        base_snapshot_interval: u64,
        fast_snapshot_interval: u64,
        fast_mode_threshold: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);
        require!(base_snapshot_interval > 0, ErrorCode::InvalidConfig);
        require!(fast_snapshot_interval > 0, ErrorCode::InvalidConfig);

        lottery.base_snapshot_interval = base_snapshot_interval;
        lottery.fast_snapshot_interval = fast_snapshot_interval;
        lottery.fast_mode_threshold = fast_mode_threshold;

        msg!("⏱️ Timing configured: base={}s, fast={}s, threshold={} SOL",
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
        
        lottery.jackpot_amount = new_amount;
        
        msg!("💰 Jackpot updated: {} SOL", new_amount / 1_000_000_000);
        
        Ok(())
    }

    pub fn close_lottery(ctx: Context<CloseLottery>) -> Result<()> {
        let lottery = &ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);
        
        msg!("Closing lottery account for upgrade...");
        
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
    
    #[account(
        init,
        payer = participant,
        space = 8 + ParticipantAccount::INIT_SPACE,
        seeds = [b"participant", lottery.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub participant_account: Account<'info, ParticipantAccount>,
    
    #[account(mut)]
    pub participant: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateParticipant<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    #[account(
        mut,
        seeds = [b"participant", lottery.key().as_ref(), participant.key().as_ref()],
        bump
    )]
    pub participant_account: Account<'info, ParticipantAccount>,
    
    #[account(mut)]
    pub participant: Signer<'info>,
}

#[derive(Accounts)]
pub struct TakeSnapshot<'info> {
    #[account(mut)]
    pub lottery: Account<'info, Lottery>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetWinners<'info> {
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

#[derive(Accounts)]
pub struct CloseLottery<'info> {
    #[account(
        mut,
        close = admin,
        seeds = [b"lottery"],
        bump
    )]
    pub lottery: Account<'info, Lottery>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
        pub struct Lottery {
        pub jackpot_amount: u64,
    pub carry_over_amount: u64,
        pub last_snapshot: i64,
    pub base_snapshot_interval: u64,
    pub fast_snapshot_interval: u64,
    pub fast_mode_threshold: u64,
    pub fees_collected: u64,
        pub is_fast_mode: bool,
        pub is_active: bool,
        pub admin: Pubkey,
        pub total_participants: u64,
    pub total_tickets: u64,
        pub total_snapshots: u64,
    pub snapshot_seed: u64,  // Seed for winner selection
    pub winners: Winners,
    pub rollover_count: u8,  // Track consecutive rollovers
    pub pepe_ball_count: u8,  // Last draw's Pepe ball count (1-30)
        }

#[account]
#[derive(InitSpace)]
pub struct ParticipantAccount {
    pub lottery: Pubkey,
    pub wallet: Pubkey,
    pub ticket_count: u32,
    pub usd_value: u64,
    pub entry_time: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Winners {
    pub main_winner: Option<Pubkey>,
    #[max_len(8)]
    pub minor_winners: Vec<Pubkey>,
}

fn calculate_tickets_from_usd_value(usd_value: u64) -> u32 {
    match usd_value {
        2000..=9999 => 1,
        10000..=49999 => 4,
        50000..=u64::MAX => 10,
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
    #[msg("Payout only allowed when Pepe ball count is odd")]
    PayoutNotAllowed,
}
