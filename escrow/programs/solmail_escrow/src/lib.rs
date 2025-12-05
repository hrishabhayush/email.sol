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

    /// Register the receiver's wallet and claim the escrowed funds.
    ///
    /// This is called when the receiver replies to the email thread.
    /// - `sender_pubkey` is needed to derive the escrow PDA.
    /// - `thread_id` must match the one used in `initialize_escrow`.
    pub fn register_and_claim(
        ctx: Context<RegisterAndClaim>,
        sender_pubkey: Pubkey,
        thread_id: [u8; 32],
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;

        // Verify the escrow is in Pending status.
        require!(
            escrow.status == EscrowStatus::Pending,
            EscrowError::InvalidStatus
        );

        // Verify the thread_id matches.
        require!(
            escrow.thread_id == thread_id,
            EscrowError::ThreadIdMismatch
        );

        // Verify the sender matches (security check).
        require!(
            escrow.sender == sender_pubkey,
            EscrowError::SenderMismatch
        );

        // Set the receiver.
        escrow.receiver = ctx.accounts.receiver.key();

        // Mark as completed.
        escrow.status = EscrowStatus::Completed;

        // Transfer all lamports from escrow PDA to receiver.
        let escrow_lamports = ctx.accounts.escrow.to_account_info().lamports();
        let rent_exempt_minimum = Rent::get()?.minimum_balance(8 + Escrow::LEN);
        let transfer_amount = escrow_lamports
            .checked_sub(rent_exempt_minimum)
            .ok_or(EscrowError::InsufficientFunds)?;

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
        **ctx.accounts.receiver.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

        // Close the escrow account (return rent to receiver).
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? = 0;
        ctx.accounts.escrow.to_account_info().assign(&system_program::ID);
        ctx.accounts.escrow.to_account_info().resize(0)?;

        Ok(())
    }

    /// Refund the escrowed funds back to the sender.
    ///
    /// Can only be called by the sender after the 15-day expiry period.
    /// - `thread_id` must match the one used in `initialize_escrow`.
    pub fn refund_escrow(
        ctx: Context<RefundEscrow>,
        thread_id: [u8; 32],
    ) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let clock = Clock::get()?;

        // Verify the escrow is in Pending status (not already completed or refunded).
        require!(
            escrow.status == EscrowStatus::Pending,
            EscrowError::InvalidStatus
        );

        // Verify the thread_id matches.
        require!(
            escrow.thread_id == thread_id,
            EscrowError::ThreadIdMismatch
        );

        // Verify the sender matches.
        require!(
            escrow.sender == ctx.accounts.sender.key(),
            EscrowError::SenderMismatch
        );

        // Verify 15 days have passed.
        require!(
            clock.unix_timestamp >= escrow.expires_at,
            EscrowError::NotExpired
        );

        // Transfer all lamports from escrow PDA back to sender.
        let escrow_lamports = ctx.accounts.escrow.to_account_info().lamports();
        let rent_exempt_minimum = Rent::get()?.minimum_balance(8 + Escrow::LEN);
        let transfer_amount = escrow_lamports
            .checked_sub(rent_exempt_minimum)
            .ok_or(EscrowError::InsufficientFunds)?;

        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
        **ctx.accounts.sender.to_account_info().try_borrow_mut_lamports()? += transfer_amount;

        // Mark as refunded (we'll close in a separate step if needed, but for now just mark it).
        let escrow_mut = &mut ctx.accounts.escrow;
        escrow_mut.status = EscrowStatus::Refunded;

        // Close the escrow account (return rent to sender).
        **ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? = 0;
        ctx.accounts.escrow.to_account_info().assign(&system_program::ID);
        ctx.accounts.escrow.to_account_info().resize(0)?;

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

/// Accounts required to register receiver and claim escrowed funds.
#[derive(Accounts)]
#[instruction(sender_pubkey: Pubkey, thread_id: [u8; 32])]
pub struct RegisterAndClaim<'info> {
    /// The receiver claiming the funds.
    #[account(mut)]
    pub receiver: Signer<'info>,

    /// PDA holding the escrowed lamports and state.
    #[account(
        mut,
        seeds = [b"escrow", sender_pubkey.as_ref(), &thread_id],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// System program for closing the account.
    pub system_program: Program<'info, System>,
}

/// Accounts required to refund escrowed funds.
#[derive(Accounts)]
#[instruction(thread_id: [u8; 32])]
pub struct RefundEscrow<'info> {
    /// The sender who funded the escrow (only they can refund).
    #[account(mut)]
    pub sender: Signer<'info>,

    /// PDA holding the escrowed lamports and state.
    #[account(
        mut,
        seeds = [b"escrow", sender.key().as_ref(), &thread_id],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// System program for closing the account.
    pub system_program: Program<'info, System>,
}

/// Custom error codes for the escrow program.
#[error_code]
pub enum EscrowError {
    #[msg("Escrow is not in a valid status for this operation")]
    InvalidStatus,
    #[msg("Thread ID does not match the escrow")]
    ThreadIdMismatch,
    #[msg("Sender does not match the escrow")]
    SenderMismatch,
    #[msg("Escrow has not expired yet (15 days required)")]
    NotExpired,
    #[msg("Insufficient funds in escrow")]
    InsufficientFunds,
}

