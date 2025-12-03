use anchor_lang::prelude::*;
use crate::state::escrow::{Escrow, EscrowStatus};
use crate::constant::{ESCROW_SEED, ESCROW_TIMEOUT_SECONDS};
use crate::error::ErrorCode;
use anchor_lang::system_program;

pub fn create_escrow(
    ctx: Context<CreateEscrow>,
    email_id: String,
    amount: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    
    require!(
        email_id.len() <= 256,
        ErrorCode::InvalidEmailId
    );
    
    require!(
        amount > 0,
        anchor_lang::error::ErrorCode::ConstraintRaw
    );
    
    // Transfer SOL from sender to escrow PDA using CPI (before setting escrow data)
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.sender.to_account_info(),
            to: ctx.accounts.escrow.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;
    
    // Set escrow data (account is initialized by Anchor)
    let escrow = &mut ctx.accounts.escrow;
    escrow.sender = ctx.accounts.sender.key();
    escrow.recipient = ctx.accounts.recipient.key();
    escrow.platform = ctx.accounts.platform.key();
    escrow.amount = amount;
    escrow.email_id = email_id.clone();
    escrow.status = EscrowStatus::Pending;
    escrow.created_at = clock.unix_timestamp;
    escrow.expires_at = clock.unix_timestamp + ESCROW_TIMEOUT_SECONDS;
    escrow.bump = ctx.bumps.escrow;
    
    msg!(
        "Escrow created: {} SOL for email {}",
        amount as f64 / 1_000_000_000.0,
        escrow.email_id
    );
    
    Ok(())
}

#[derive(Accounts)]
#[instruction(email_id: String)]
pub struct CreateEscrow<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// CHECK: Recipient wallet (not a signer, just for identification)
    pub recipient: AccountInfo<'info>,
    
    /// CHECK: Platform wallet (not a signer, just for identification)
    pub platform: AccountInfo<'info>,
    
    #[account(
        init,
        payer = sender,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [ESCROW_SEED, email_id.as_bytes(), sender.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    
    pub system_program: Program<'info, System>,
}

