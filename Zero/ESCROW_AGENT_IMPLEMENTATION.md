# SendAI Escrow Agent Implementation

## Overview
This implementation provides a SendAI Agent that automatically processes email replies, scores them using OpenAI mini model, and triggers escrow contract decisions on Solana based on the score.

## Files Created

### Core Agent Files
1. **`apps/server/src/routes/agent/escrow-agent.ts`**
   - Main SendAI agent implementation
   - Initializes solana-agent-kit with wallet and plugins
   - Processes email replies with streaming callbacks
   - Entry point: `processEmailReply()`

2. **`apps/server/src/routes/agent/email-scoring-tool.ts`**
   - LangChain tool wrapper for OpenAI mini model
   - Scores email content (0-100)
   - Handles malformed responses gracefully

3. **`apps/server/src/routes/agent/escrow-decision.ts`**
   - Pure decision logic function
   - `decide(score)`: Returns "RELEASE" if score >= 70, "WITHHOLD" otherwise
   - No side effects, deterministic

4. **`apps/server/src/routes/agent/escrow-actions.ts`**
   - Escrow contract interaction functions
   - `createEscrowAction()`: Creates escrow (idempotent)
   - `releaseEscrowAction()`: Releases funds to recipient
   - `withholdEscrowAction()`: Returns funds to sender
   - `executeEscrowAction()`: Executes based on decision

### Smart Contract
5. **`programs/escrow/src/lib.rs`**
   - Anchor program for escrow management
   - Instructions: `create_escrow`, `release`, `withhold`
   - Uses `msg_id` as PDA seed for idempotency

6. **`programs/escrow/Cargo.toml`**
   - Rust dependencies for Anchor program

7. **`programs/escrow/Anchor.toml`**
   - Anchor configuration

### Integration
8. **`apps/server/src/trpc/routes/mail.ts`** (modified)
   - Added hook in `send` endpoint to trigger escrow agent
   - Processes email replies automatically

## Environment Variables Required

Add these to your `.env` file:

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com  # Or your RPC endpoint
SOLANA_PRIVATE_KEY=your_base58_encoded_private_key
OPENAI_API_KEY=your_openai_api_key  # Filler key acceptable
OPENAI_MINI_MODEL=gpt-4o-mini  # Already exists in env.ts
```

## Usage

### Basic Usage

```typescript
import { processEmailReply } from './routes/agent/escrow-agent';

// Process an email reply
const result = await processEmailReply({
  emailContent: '<html>Email content here</html>',
  msgId: 'unique-message-id',
  streamCallback: (step, data) => {
    console.log(`[Step] ${step}`, data);
  },
});

console.log('Result:', result);
// { success: true, score: 85, decision: 'RELEASE', signature: '...' }
```

### Streaming Callbacks

The agent streams execution steps for testing visibility:

- `initializing` - Agent initialization
- `agent_initialized` - Agent ready
- `scoring_email_start` - LLM scoring started
- `scoring_email_complete` - Score received
- `making_decision_start` - Decision logic started
- `making_decision_complete` - Decision made
- `creating_escrow_start` - Escrow creation started
- `creating_escrow_complete` - Escrow created/exists
- `executing_escrow_start` - Escrow action started
- `executing_escrow_complete` - Escrow action completed
- `process_complete` - All steps completed
- `process_error` - Error occurred

## Workflow

1. **Email Reply Received**: When a recipient replies to an email
2. **LLM Scoring**: Email content is sent to OpenAI mini model for scoring (0-100)
3. **Decision**: Pure function decides RELEASE (>=70) or WITHHOLD (<70)
4. **Escrow Creation**: Escrow is created if it doesn't exist (idempotent)
5. **Escrow Action**: Based on decision, funds are either released or withheld

## Key Features

- **Idempotency**: Uses `msg_id` as unique identifier, prevents duplicate transactions
- **Streaming**: Real-time callbacks for testing visibility
- **Error Handling**: Graceful error handling, doesn't block email sending
- **Pure Decision Logic**: No LLM calls or randomness in decision function
- **Automatic Processing**: Triggers automatically when emails are sent/received

## Testing

1. Set up environment variables
2. Install dependencies: `pnpm install`
3. Build Anchor program: `anchor build` (in `programs/escrow/`)
4. Deploy program: `anchor deploy`
5. Send an email reply and watch console logs for streaming callbacks

## Notes

- The escrow program ID is currently a placeholder. Update `ESCROW_PROGRAM_ID` in `escrow-actions.ts` after deployment.
- The IDL is currently a placeholder. Load the actual IDL after building the program.
- Streaming callbacks currently log to console. For production, consider using Server-Sent Events or WebSockets.

