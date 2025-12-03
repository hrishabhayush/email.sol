use anchor_lang::prelude::*;
use instructions::*;

declare_id!("HjyyT5fvNhRHmtMLnmmqi752UPpQEDq7U4Km87Uhu569");

#[program]
pub mod escrow_contract {
    use super::*;

    pub fn create_escrow(
        ctx: Context<CreateEscrow>,
        email_id: String,
        amount: u64,
    ) -> Result<()> {
        instructions::create_escrow::create_escrow(ctx, email_id, amount)
    }

    pub fn release_escrow(ctx: Context<ReleaseEscrow>) -> Result<()> {
        instructions::release_escrow::release_escrow(ctx)
    }

    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        instructions::refund_escrow::refund_escrow(ctx)
    }
}

pub mod constant;
pub mod error;
pub mod instructions;
pub mod state;
