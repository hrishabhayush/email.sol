use anchor_lang::prelude::*;
use crate::state::escrow::{Escrow, EscrowStatus};
use crate::constant::ESCROW_SEED;
use crate::error::ErrorCode;

pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;
    
    require!(
        matches!(escrow.status, EscrowStatus::Pending),
        ErrorCode::EscrowNotPending
    );
    
    // Check if sender is requesting refund (invalid address case)
    // OR if timeout has been reached (30 days)
    let is_sender = escrow.sender == ctx.accounts.refunder.key();
    let is_expired = escrow.is_expired(clock.unix_timestamp);
    
    require!(
        is_sender || is_expired,
        ErrorCode::EscrowTimeoutNotReached
    );
    
    if is_sender {
        require!(
            escrow.sender == ctx.accounts.refunder.key(),
            ErrorCode::InvalidSender
        );
    }
    
    // Store amount before updating status
    let refund_amount = escrow.amount;
    
    // Update escrow status
    escrow.status = EscrowStatus::Refunded;
    
    // Refund full amount to sender
    **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
    **ctx.accounts.sender.to_account_info().try_borrow_mut_lamports()? += refund_amount;
    
    msg!(
        "Escrow refunded: {} SOL returned to sender (reason: {})",
        refund_amount as f64 / 1_000_000_000.0,
        if is_expired { "timeout" } else { "invalid address" }
    );
    
    Ok(())
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    /// Can be sender (for invalid address) or anyone (for timeout)
    pub refunder: Signer<'info>,
    
    #[account(
        mut,
        seeds = [ESCROW_SEED, escrow.email_id.as_bytes(), escrow.sender.as_ref()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    /// CHECK: Sender wallet (receives refund) - must match escrow sender
    #[account(
        mut,
        constraint = sender.key() == escrow.sender @ ErrorCode::InvalidSender
    )]
    pub sender: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

