use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub sender: Pubkey,           // Email sender wallet
    pub recipient: Pubkey,        // Email recipient wallet
    pub platform: Pubkey,         // Platform wallet (for fees)
    pub amount: u64,              // SOL amount in lamports
    #[max_len(256)]
    pub email_id: String,         // Unique email identifier
    pub status: EscrowStatus,     // Current status
    pub created_at: i64,          // Timestamp when escrow was created
    pub expires_at: i64,          // Timestamp when escrow expires (30 days)
    pub bump: u8,                 // PDA bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub enum EscrowStatus {
    Pending,      // Waiting for reply or timeout
    Released,     // Funds released to recipient (reply received)
    Refunded,     // Funds refunded to sender (invalid/timeout)
}

impl Escrow {
    pub fn is_expired(&self, current_time: i64) -> bool {
        current_time >= self.expires_at
    }
    
    pub fn calculate_platform_fee(&self) -> u64 {
        (self.amount as u128 * 200u128 / 10000u128) as u64 // 2%
    }
    
    pub fn calculate_recipient_amount(&self) -> u64 {
        self.amount - self.calculate_platform_fee()
    }
}

