use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::Clock;

declare_id!("8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7");

#[program]
pub mod lottery {
    use super::*;

    pub fn initialize_lottery(
        ctx: Context<InitializeLottery>,
        jackpot_amount: u64,
        entry_min_cents: u64,
        tier2_min_cents: u64,
        tier3_min_cents: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        
        require!(jackpot_amount > 0, ErrorCode::InvalidConfig);
        require!(jackpot_amount <= 1_000_000 * 1_000_000_000, ErrorCode::InvalidConfig);
        require!(entry_min_cents > 0 && entry_min_cents < tier2_min_cents && tier2_min_cents < tier3_min_cents, ErrorCode::InvalidConfig);
        
        lottery.jackpot_amount = jackpot_amount;
        lottery.entry_min_cents = entry_min_cents;
        lottery.tier2_min_cents = tier2_min_cents;
        lottery.tier3_min_cents = tier3_min_cents;
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

        Ok(())
    }

    /// Admin: set tier thresholds (e.g. test mode: 50, 100, 500 cents for 0.50/1/5 USDC → 1/4/10 tickets)
    pub fn set_tier_thresholds(
        ctx: Context<UpdateTierThresholds>,
        entry_min_cents: u64,
        tier2_min_cents: u64,
        tier3_min_cents: u64,
    ) -> Result<()> {
        require!(entry_min_cents > 0 && entry_min_cents < tier2_min_cents && tier2_min_cents < tier3_min_cents, ErrorCode::InvalidConfig);
        let lottery = &mut ctx.accounts.lottery;
        lottery.entry_min_cents = entry_min_cents;
        lottery.tier2_min_cents = tier2_min_cents;
        lottery.tier3_min_cents = tier3_min_cents;
        Ok(())
    }

    pub fn enter_lottery_with_usd_value(
        ctx: Context<EnterLottery>,
        usd_value: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.is_active, ErrorCode::LotteryInactive);
        
        let ticket_count = calculate_tickets_from_usd_value(usd_value, lottery.entry_min_cents, lottery.tier2_min_cents, lottery.tier3_min_cents);
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

        if is_odd {
            // ODD = PAYOUT: wait for set_winners + payout_winners
        } else {
            // EVEN = ROLLOVER: extend timer, keep participants
            lottery.rollover_count += 1;
            let extension = if lottery.rollover_count % 2 == 0 {
                72 * 3600
            } else {
                48 * 3600
            };
            lottery.last_snapshot = clock.unix_timestamp + extension as i64;
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

        Ok(())
    }

    pub fn payout_winners(ctx: Context<PayoutWinners>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(lottery.winners.main_winner.is_some(), ErrorCode::NoWinners);
        require!(lottery.pepe_ball_count % 2 == 1, ErrorCode::InvalidConfig); // Must be odd for payout
        
        // 50/50 payout: 50% main, 40% 8 minors, 10% house (enforced off-chain)
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

        Ok(())
    }

    pub fn update_jackpot_amount(
        ctx: Context<UpdateJackpotAmount>,
        new_amount: u64,
    ) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);
        
        lottery.jackpot_amount = new_amount;

        Ok(())
    }

    pub fn close_lottery(ctx: Context<CloseLottery>) -> Result<()> {
        let lottery = &ctx.accounts.lottery;
        require!(ctx.accounts.admin.key() == lottery.admin, ErrorCode::Unauthorized);

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
pub struct UpdateTierThresholds<'info> {
    #[account(mut, has_one = admin)]
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
    /// Min USD cents for 1 ticket (prod: 2000 = $20, test: 50 = $0.50 USDC)
    pub entry_min_cents: u64,
    /// Min USD cents for 4 tickets (prod: 10000 = $100, test: 100 = $1 USDC)
    pub tier2_min_cents: u64,
    /// Min USD cents for 10 tickets (prod: 50000 = $500, test: 500 = $5 USDC)
    pub tier3_min_cents: u64,
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
    pub snapshot_seed: u64,
    pub winners: Winners,
    pub rollover_count: u8,
    pub pepe_ball_count: u8,
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

/// Same ratio as prod: entry_min→1, tier2_min→4, tier3_min→10 tickets.
/// Prod: 2000, 10000, 50000 ($20/$100/$500). Test: 50, 100, 500 (0.50/1/5 USDC).
fn calculate_tickets_from_usd_value(
    usd_value: u64,
    entry_min_cents: u64,
    tier2_min_cents: u64,
    tier3_min_cents: u64,
) -> u32 {
    if usd_value < entry_min_cents {
        return 0;
    }
    if usd_value < tier2_min_cents {
        return 1;
    }
    if usd_value < tier3_min_cents {
        return 4;
    }
    10
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
