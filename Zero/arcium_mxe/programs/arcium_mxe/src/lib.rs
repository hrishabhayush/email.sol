use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

// Custom getrandom backend for Solana BPF target (getrandom 0.3.x)
// When getrandom_backend="custom" is set via rustflags, getrandom expects this function
#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(_dest: *mut u8, _len: usize) -> u32 {
    // Return error code 1 (UNSUPPORTED) - randomness is not available on Solana BPF
    // This is fine because quinn/networking code won't actually be called on-chain
    1
}

const COMP_DEF_OFFSET_ADD_TOGETHER: u32 = comp_def_offset("add_together");
const COMP_DEF_OFFSET_CLASSIFY_EMAIL: u32 = comp_def_offset("classify_email");

declare_id!("3zCEhhfBEYKiGDYw2tBrz7tVYa1QCDMWTdQFjyLMrWHp");

#[arcium_program]
pub mod arcium_mxe {
    use super::*;

    // ============================================
    // ADD_TOGETHER - Original test computation
    // ============================================

    pub fn init_add_together_comp_def(ctx: Context<InitAddTogetherCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, 0, None, None)?;
        Ok(())
    }

    pub fn add_together(
        ctx: Context<AddTogether>,
        computation_offset: u64,
        ciphertext_0: [u8; 32],
        ciphertext_1: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU8(ciphertext_0),
            Argument::EncryptedU8(ciphertext_1),
        ];
        queue_computation(ctx.accounts, computation_offset, args, None, vec![AddTogetherCallback::callback_ix(&[])], 1)?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "add_together")]
    pub fn add_together_callback(
        ctx: Context<AddTogetherCallback>,
        output: ComputationOutputs<AddTogetherOutput>,
    ) -> Result<()> {
        let o = match output {
            ComputationOutputs::Success(AddTogetherOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(SumEvent {
            sum: o.ciphertexts[0],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }

    // ============================================
    // CLASSIFY_EMAIL - Email scoring computation
    // ============================================

    /// Initialize the classify_email computation definition.
    /// Must be called once before any classify_email computations.
    pub fn init_classify_email_comp_def(ctx: Context<InitClassifyEmailCompDef>) -> Result<()> {
        init_comp_def(ctx.accounts, 0, None, None)?;
        Ok(())
    }

    /// Submit an encrypted email score for MPC processing.
    /// 
    /// # Arguments
    /// * `computation_offset` - Unique offset for this computation
    /// * `encrypted_score` - The encrypted score (0-100) from LLM evaluation
    /// * `pub_key` - x25519 public key for encryption
    /// * `nonce` - Nonce used for encryption
    pub fn classify_email(
        ctx: Context<ClassifyEmail>,
        computation_offset: u64,
        encrypted_score: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        let args = vec![
            Argument::ArcisPubkey(pub_key),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU8(encrypted_score),
        ];
        queue_computation(
            ctx.accounts, 
            computation_offset, 
            args, 
            None, 
            vec![ClassifyEmailCallback::callback_ix(&[])], 
            1
        )?;
        Ok(())
    }

    /// Callback invoked by MPC network after processing the encrypted score.
    /// Emits a ScoreEvent with the encrypted result.
    #[arcium_callback(encrypted_ix = "classify_email")]
    pub fn classify_email_callback(
        ctx: Context<ClassifyEmailCallback>,
        output: ComputationOutputs<ClassifyEmailOutput>,
    ) -> Result<()> {
        let o = match output {
            ComputationOutputs::Success(ClassifyEmailOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(ScoreEvent {
            score: o.ciphertexts[0],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }
}

// ============================================
// ADD_TOGETHER Account Structures
// ============================================

#[queue_computation_accounts("add_together", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct AddTogether<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_ADD_TOGETHER)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("add_together")]
#[derive(Accounts)]
pub struct AddTogetherCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_ADD_TOGETHER)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("add_together", payer)]
#[derive(Accounts)]
pub struct InitAddTogetherCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    /// Can't check it here as it's not initialized yet.
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// ============================================
// CLASSIFY_EMAIL Account Structures
// ============================================

#[queue_computation_accounts("classify_email", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ClassifyEmail<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, SignerAccount>,
    #[account(
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        mut,
        address = derive_mempool_pda!()
    )]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_execpool_pda!()
    )]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(
        mut,
        address = derive_comp_pda!(computation_offset)
    )]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CLASSIFY_EMAIL)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(
        mut,
        address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet)
    )]
    pub cluster_account: Account<'info, Cluster>,
    #[account(
        mut,
        address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS,
    )]
    pub pool_account: Account<'info, FeePool>,
    #[account(
        address = ARCIUM_CLOCK_ACCOUNT_ADDRESS
    )]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("classify_email")]
#[derive(Accounts)]
pub struct ClassifyEmailCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(
        address = derive_comp_def_pda!(COMP_DEF_OFFSET_CLASSIFY_EMAIL)
    )]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("classify_email", payer)]
#[derive(Accounts)]
pub struct InitClassifyEmailCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        address = derive_mxe_pda!()
    )]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    /// Can't check it here as it's not initialized yet.
    pub comp_def_account: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// ============================================
// Events
// ============================================

#[event]
pub struct SumEvent {
    pub sum: [u8; 32],
    pub nonce: [u8; 16],
}

/// Event emitted when email scoring computation completes.
/// Contains the encrypted score that can be decrypted client-side.
#[event]
pub struct ScoreEvent {
    /// Encrypted score (0-100) ciphertext
    pub score: [u8; 32],
    /// Nonce used for decryption
    pub nonce: [u8; 16],
}

// ============================================
// Error Codes
// ============================================

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
