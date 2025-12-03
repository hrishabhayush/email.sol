# Manual Testing Guide for x402 Integration

This guide provides step-by-step instructions for manually testing the x402 payment integration with OpenAI API calls in the email scoring workflow.

## Prerequisites

1. **Environment Setup**
   - Node.js and pnpm installed
   - Solana wallet with testnet SOL (for testing)
   - OpenAI API key
   - Access to Solana testnet/devnet RPC endpoint

2. **Environment Variables**
   ```bash
   SOLANA_PRIVATE_KEY=<your-test-wallet-private-key>
   SOLANA_RPC_URL=https://api.testnet.solana.com
   X402_NETWORK=testnet
   X402_API_URL=https://x402-proxy.example.com  # Optional: x402 proxy endpoint
   X402_FEE_PERCENTAGE=2
   OPENAI_API_KEY=<your-openai-api-key>
   OPENAI_MINI_MODEL=gpt-4o-mini
   ```

## Testing Steps

### 1. Test x402 Client Initialization

**Objective**: Verify x402 client can be initialized with Solana wallet.

**Steps**:
1. Start the server: `pnpm --filter=@zero/server dev`
2. Check logs for x402 client initialization
3. Verify no errors in console

**Expected Result**:
- Server starts successfully
- Log shows: `[x402] Client initialized with network: testnet`
- No initialization errors

---

### 2. Test Email Scoring with x402 Payment

**Objective**: Verify email scoring triggers x402 payment flow.

**Steps**:
1. Send a test email reply through the system
2. Monitor server logs for:
   - `[EscrowAgent] x402_client_initialized`
   - `[EscrowAgent] scoring_email_start`
   - `[x402] Payment required, processing payment...`
   - `[x402] Payment successful: <signature>`
   - `[EscrowAgent] scoring_email_complete`

**Expected Result**:
- Email is scored successfully
- x402 payment transaction is created
- Payment signature is logged
- Score is returned (0-100)

**Verify on Solana Explorer**:
- Check transaction signature on Solana Explorer (testnet)
- Verify payment was sent to correct recipient
- Verify payment amount matches API call cost

---

### 3. Test API Fee Calculation

**Objective**: Verify 2% API fee is deducted from escrow amount.

**Steps**:
1. Process an email with escrow amount: 1,000,000 lamports (0.001 SOL)
2. Check logs for: `[createEscrowAction] API fee deducted: 20000 lamports`
3. Verify escrow creation uses: 980,000 lamports (1M - 20K)

**Expected Result**:
- API fee of 20,000 lamports (2% of 1M) is calculated
- Escrow is created with 980,000 lamports
- Fee is logged for tracking

**Calculation Verification**:
```
Total Amount: 1,000,000 lamports
API Fee (2%): 20,000 lamports
Escrow Amount: 980,000 lamports
```

---

### 4. Test x402 Payment Failure and Fallback

**Objective**: Verify system falls back to direct OpenAI API if x402 fails.

**Steps**:
1. Temporarily break x402 client (e.g., invalid wallet)
2. Process an email reply
3. Monitor logs for fallback messages

**Expected Result**:
- Log shows: `[EscrowAgent] x402_client_fallback`
- System continues with direct OpenAI API
- Email is still scored successfully
- No user-facing errors

---

### 5. Test End-to-End Flow

**Objective**: Verify complete email processing workflow with x402.

**Steps**:
1. Send an email reply through the system
2. Monitor the complete flow:
   - Email received
   - x402 client initialized
   - Email scored (with x402 payment)
   - Decision made (RELEASE/WITHHOLD)
   - Escrow created (with API fee deduction)
   - Escrow executed based on decision

**Expected Result**:
- All steps complete successfully
- Stream callbacks fire for each step
- Final result shows: `success: true, score: <number>, decision: <RELEASE|WITHHOLD>`
- Transaction signatures are logged

**Check Stream Callbacks**:
```javascript
{
  step: 'initializing',
  step: 'x402_client_initialized',
  step: 'scoring_email_start',
  step: 'scoring_email_complete',
  step: 'making_decision_start',
  step: 'making_decision_complete',
  step: 'api_fee_calculated',
  step: 'creating_escrow_start',
  step: 'creating_escrow_complete',
  step: 'executing_escrow_start',
  step: 'executing_escrow_complete',
  step: 'process_complete'
}
```

---

### 6. Test Multiple Email Processing

**Objective**: Verify system handles multiple emails in sequence.

**Steps**:
1. Process 3-5 email replies in quick succession
2. Monitor logs for each processing
3. Verify each email:
   - Gets unique x402 payment
   - Has correct API fee calculated
   - Creates separate escrow

**Expected Result**:
- Each email processed independently
- No payment conflicts
- All escrows created successfully
- No race conditions

---

### 7. Test with Different Fee Percentages

**Objective**: Verify API fee calculation works with different percentages.

**Steps**:
1. Set `X402_FEE_PERCENTAGE=5` (5% fee)
2. Process email with 1,000,000 lamports
3. Verify fee is 50,000 lamports (5% of 1M)
4. Set `X402_FEE_PERCENTAGE=1` (1% fee)
5. Process email again
6. Verify fee is 10,000 lamports (1% of 1M)

**Expected Result**:
- Fee percentage is read from env
- Calculation is correct for each percentage
- Escrow amount adjusted accordingly

---

### 8. Test Error Scenarios

#### 8.1 Invalid x402 Payment Response
**Steps**:
1. Mock x402 API to return invalid payment header
2. Process email
3. Verify fallback to direct API

**Expected**: System handles gracefully, falls back

#### 8.2 Solana Transaction Failure
**Steps**:
1. Use wallet with insufficient balance
2. Process email
3. Monitor error handling

**Expected**: Error logged, fallback attempted

#### 8.3 Empty Email Content
**Steps**:
1. Process email with empty content
2. Verify handling

**Expected**: Returns score 0, no crash

---

## Verification Checklist

After completing all tests, verify:

- [ ] x402 client initializes correctly
- [ ] Payments are processed on Solana
- [ ] API fees are calculated correctly (2% default)
- [ ] Escrow amounts are correct after fee deduction
- [ ] Fallback works when x402 fails
- [ ] Multiple emails process correctly
- [ ] Error scenarios handled gracefully
- [ ] All stream callbacks fire
- [ ] Transaction signatures are logged
- [ ] No memory leaks or resource issues

## Troubleshooting

### Issue: x402 client fails to initialize
**Solution**: Check `SOLANA_PRIVATE_KEY` and `SOLANA_RPC_URL` are set correctly

### Issue: Payment transactions fail
**Solution**: 
- Verify wallet has sufficient SOL balance
- Check network (testnet vs mainnet) matches
- Verify RPC endpoint is accessible

### Issue: API fee not deducted
**Solution**: 
- Check `X402_FEE_PERCENTAGE` is set
- Verify `calculateApiFee` is called
- Check logs for fee calculation

### Issue: Fallback not working
**Solution**:
- Verify error handling in `email-scoring-tool.ts`
- Check x402 errors are properly caught
- Ensure direct API call happens after x402 failure

## Test Data

### Sample Email Content for Testing

**High Quality (Expected Score: 80-100)**:
```
Thank you for your email. I've reviewed your proposal and I'm very interested 
in moving forward. Let me provide you with the following details:

1. Timeline: We can start next week
2. Budget: $10,000 as discussed
3. Deliverables: As per the attached document

Please let me know if you have any questions.
Best regards
```

**Medium Quality (Expected Score: 50-79)**:
```
Thanks for the email. I'll get back to you soon.
```

**Low Quality (Expected Score: 0-49)**:
```
ok
```

## Monitoring

### Key Metrics to Track

1. **Payment Success Rate**: % of x402 payments that succeed
2. **Fallback Rate**: % of requests that fall back to direct API
3. **Average API Fee**: Average fee per email processed
4. **Processing Time**: Time from email received to escrow executed
5. **Error Rate**: % of failed processing attempts

### Log Patterns to Watch

- `[x402] Payment required` - Normal payment flow
- `[x402] Payment successful` - Payment completed
- `[EscrowAgent] x402_client_fallback` - Fallback triggered
- `[createEscrowAction] API fee deducted` - Fee calculation
- `[EscrowAgent] process_error` - Processing errors

## Next Steps

After manual testing:
1. Review all test results
2. Fix any issues found
3. Run automated unit tests: `pnpm --filter=@zero/server test`
4. Run integration tests
5. Deploy to staging environment
6. Monitor production metrics

