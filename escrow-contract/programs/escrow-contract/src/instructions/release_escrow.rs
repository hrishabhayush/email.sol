use anchor_lang::prelude::*;
use crate::state::escrow::{Escrow, EscrowStatus};
use crate::constant::ESCROW_SEED;
use crate::error::ErrorCode;

pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;
    
    require!(
        matches!(escrow.status, EscrowStatus::Pending),
        ErrorCode::EscrowNotPending
    );
    
    require!(
        !escrow.is_expired(clock.unix_timestamp),
        ErrorCode::EscrowExpired
    );
    
    require!(
        escrow.recipient == ctx.accounts.recipient.key(),
        ErrorCode::InvalidRecipient
    );
    
    // Calculate amounts before updating status
    let total_amount = escrow.amount;
    let platform_fee = escrow.calculate_platform_fee();
    let recipient_amount = escrow.calculate_recipient_amount();
    
    // Update escrow status
    escrow.status = EscrowStatus::Released;
    
    // Transfer funds
    **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= total_amount;
    **ctx.accounts.platform.to_account_info().try_borrow_mut_lamports()? += platform_fee;
    **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += recipient_amount;
    
    msg!(
        "Escrow released: {} SOL to recipient, {} SOL platform fee",
        recipient_amount as f64 / 1_000_000_000.0,
        platform_fee as f64 / 1_000_000_000.0
    );
    
    Ok(())
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    /// CHECK: Recipient must sign (proving they replied)
    #[account(mut)]
    pub recipient: Signer<'info>,
    
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.email_id.as_bytes(), escrow.sender.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    /// CHECK: Platform wallet for fees - must match escrow platform
    #[account(
        mut,
        constraint = platform.key() == escrow.platform @ ErrorCode::InvalidPlatform
    )]
    pub platform: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

