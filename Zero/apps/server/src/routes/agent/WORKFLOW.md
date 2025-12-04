x402 Payment workflow:
1. escrow-agent.ts calls scoreEmail()
   ↓
2. email-scoring-tool.ts makes HTTP POST to /api/agent/score-email
   ↓
3. score-email.ts middleware checks for payment
   ↓
4. If no payment → returns 402 Payment Required
   ↓
5. email-scoring-tool.ts (x402-wrapped fetch) detects 402
   ↓
6. Automatically creates payment, submits to facilitator
   ↓
7. Retries request with payment proof
   ↓
8. score-email.ts verifies payment, calls OpenAI
   ↓
9. Returns { score: number } back through the chain