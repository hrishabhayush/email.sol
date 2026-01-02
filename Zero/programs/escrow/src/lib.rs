use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::Pubkey;

declare_id!("Escrow1111111111111111111111111111111111111");

#[program]
pub mod escrow {
    use super::*;

    /// Creates a new escrow account with the given message ID.
    /// Idempotent: if escrow already exists for this msg_id, returns success.
    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        msg_id: String,
        amount: u64,
        recipient: Pubkey,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Check if escrow already exists (idempotency)
        if escrow.status != EscrowStatus::Uninitialized {
            return Ok(()); // Already exists, return success
        }

        escrow.msg_id = msg_id;
        escrow.amount = amount;
        escrow.sender = ctx.accounts.sender.key();
        escrow.recipient = recipient;
        escrow.status = EscrowStatus::Pending;
        escrow.bump = ctx.bumps.escrow;

        Ok(())
    }

    /// Releases the escrow funds to the recipient.
    /// Only works if status is Pending.
    pub fn release(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(
            escrow.status == EscrowStatus::Pending,
            EscrowError::InvalidStatus
        );

        escrow.status = EscrowStatus::Released;

        // Transfer funds from escrow to recipient
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, escrow.amount)?;

        Ok(())
    }

    /// Withholds the escrow funds (returns to sender).
    /// Only works if status is Pending.
    pub fn withhold(ctx: Context<WithholdEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(
            escrow.status == EscrowStatus::Pending,
            EscrowError::InvalidStatus
        );

        escrow.status = EscrowStatus::Withheld;

        // Transfer funds from escrow back to sender
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.sender.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, escrow.amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(msg_id: String)]
pub struct CreateEscrow<'info> {
    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + EscrowAccount::LEN,
        seeds = [b"escrow", msg_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub sender: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.msg_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    /// CHECK: Recipient can be any account
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithholdEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.msg_id.as_bytes()],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, EscrowAccount>,
    
    #[account(mut)]
    pub sender: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct EscrowAccount {
    pub msg_id: String,      // Max 256 chars
    pub amount: u64,
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub status: EscrowStatus,
    pub bump: u8,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + // discriminator
        4 + 256 +             // msg_id (String)
        8 +                   // amount (u64)
        32 +                  // sender (Pubkey)
        32 +                  // recipient (Pubkey)
        1 +                   // status (EscrowStatus)
        1;                    // bump (u8)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EscrowStatus {
    Uninitialized,
    Pending,
    Released,
    Withheld,
}

#[error_code]
pub enum EscrowError {
    #[msg("Escrow is not in Pending status")]
    InvalidStatus,
}

