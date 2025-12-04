use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

declare_id!("Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb");

/// 15 days in seconds.
const FIFTEEN_DAYS: i64 = 15 * 24 * 60 * 60;

/// The escrow program powering SolMail's incentivized replies.
#[program]
pub mod solmail_escrow {
    use super::*;

    /// Initialize an escrow account for a given email thread.
    ///
    /// - `thread_id` is a 32-byte identifier derived from the email thread (e.g. a hash).
    /// - `amount` is the number of lamports the sender wants to escrow.
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        thread_id: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Populate escrow state.
        escrow.sender = ctx.accounts.sender.key();
        escrow.receiver = Pubkey::default(); // will be set when the receiver claims
        escrow.thread_id = thread_id;
        escrow.amount = amount;
        escrow.created_at = clock.unix_timestamp;
        escrow.expires_at = clock.unix_timestamp + FIFTEEN_DAYS;
        escrow.status = EscrowStatus::Pending;
        escrow.bump = ctx.bumps.escrow;

        // Transfer lamports from the sender to the escrow PDA.
        let ix = system_instruction::transfer(&ctx.accounts.sender.key(), &escrow.key(), amount);
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        Ok(())
    }
}

/// Escrow account storing all data needed to manage the incentive.
#[account]
pub struct Escrow {
    /// Wallet that funded the escrow.
    pub sender: Pubkey,
    /// Wallet that will eventually receive the funds (set on claim).
    pub receiver: Pubkey,
    /// Deterministic identifier for the email thread.
    pub thread_id: [u8; 32],
    /// Amount of lamports escrowed.
    pub amount: u64,
    /// Unix timestamp when the escrow was created.
    pub created_at: i64,
    /// Unix timestamp after which the sender can refund.
    pub expires_at: i64,
    /// Current status of the escrow.
    pub status: EscrowStatus,
    /// PDA bump.
    pub bump: u8,
}

impl Escrow {
    /// Size of the Escrow account (excluding the 8-byte Anchor discriminator).
    pub const LEN: usize =
        32 + // sender
        32 + // receiver
        32 + // thread_id
        8 + // amount
        8 + // created_at
        8 + // expires_at
        1 + // status
        1; // bump
}

/// Simple status enum so we can extend behavior later.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    Pending,
    Completed,
    Refunded,
}

/// Accounts required to initialize an escrow.
#[derive(Accounts)]
#[instruction(thread_id: [u8; 32])]
pub struct InitializeEscrow<'info> {
    /// The sender funding the escrow.
    #[account(mut)]
    pub sender: Signer<'info>,

    /// PDA that will hold the escrowed lamports and state.
    #[account(
        init,
        payer = sender,
        space = 8 + Escrow::LEN,
        seeds = [b"escrow", sender.key().as_ref(), &thread_id],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// System program for creating the account and transferring lamports.
    pub system_program: Program<'info, System>,
}

