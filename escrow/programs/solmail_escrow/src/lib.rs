use anchor_lang::prelude::*;

declare_id!("Cx6XKyjVT5oipy3gdko2A7R4oJYc5ENUqgMapBF7zxkb");

/// The escrow program powering SolMail's incentivized replies.
///
/// Step 1: we only scaffold the data structures and a no-op initialize
/// instruction so you can ensure the program compiles and deploys.
/// In the next step we will wire in real SOL transfers and the 15-day expiry.
#[program]
pub mod solmail_escrow {
    use super::*;

    /// Placeholder initialize instruction so you can test build/deploy wiring.
    pub fn initialize_placeholder(_ctx: Context<InitializePlaceholder>) -> Result<()> {
        Ok(())
    }
}

/// Empty context for now; we will replace this with real accounts in the next step.
#[derive(Accounts)]
pub struct InitializePlaceholder {}


