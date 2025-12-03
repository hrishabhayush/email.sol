use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Escrow has expired")]
    EscrowExpired,
    #[msg("Escrow is not in pending state")]
    EscrowNotPending,
    #[msg("Escrow already released")]
    EscrowAlreadyReleased,
    #[msg("Escrow already refunded")]
    EscrowAlreadyRefunded,
    #[msg("Invalid recipient")]
    InvalidRecipient,
    #[msg("Invalid sender")]
    InvalidSender,
    #[msg("Invalid platform")]
    InvalidPlatform,
    #[msg("Escrow timeout not reached")]
    EscrowTimeoutNotReached,
    #[msg("Invalid email ID")]
    InvalidEmailId,
}
