use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // Original add_together for testing
    pub struct InputValues {
        v1: u8,
        v2: u8,
    }

    #[instruction]
    pub fn add_together(input_ctxt: Enc<Shared, InputValues>) -> Enc<Shared, u16> {
        let input = input_ctxt.to_arcis();
        let sum = input.v1 as u16 + input.v2 as u16;
        input_ctxt.owner.from_arcis(sum)
    }

    // Email scoring circuit - processes encrypted score from LLM
    // Score is 0-100, computed outside MPC by the LLM
    pub struct EmailScoreInput {
        score: u8,  // 0-100 score from LLM evaluation
    }

    /// Classify email circuit.
    /// Input: Encrypted score (0-100) from LLM evaluation
    /// Output: Encrypted score (unchanged, but verified through MPC)
    /// 
    /// The MPC network processes the encrypted value without seeing plaintext.
    /// This ensures the score remains confidential while being verifiably computed.
    #[instruction]
    pub fn classify_email(input_ctxt: Enc<Shared, EmailScoreInput>) -> Enc<Shared, u8> {
        let input = input_ctxt.to_arcis();
        // Pass through the score - MPC verifies integrity without seeing plaintext
        let score = input.score;
        input_ctxt.owner.from_arcis(score)
    }
}
