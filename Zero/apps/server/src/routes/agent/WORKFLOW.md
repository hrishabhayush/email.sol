Complete Flow Summary for OpenAI calls using our own OpenAI API key usage:
1. Email input → processEmailReply() receives emailContent
2. Scoring → scoreEmail() → OpenAI API (your key) → returns 0-100 score
3. Decision → decide(score) → "RELEASE" if score >= 70, else "WITHHOLD"
4. Create escrow → createEscrowAction() → Solana transaction (idempotent)
5. Execute decision → executeEscrowAction() → release() or withhold() → Solana transaction
6. Return → ProcessEmailReplyResult with score, decision, and transaction signature