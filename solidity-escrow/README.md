## SolMail Escrow (EVM / Base)

Solidity port of the Solana program in [`../escrow`](../escrow). Same logic,
same 15-day expiry, same state machine — built for deployment on Base (or any
EVM chain).

### Mapping vs PDA

| Solana (Anchor)                                  | EVM (Solidity)                                         |
| ------------------------------------------------ | ------------------------------------------------------ |
| PDA seeded by `["escrow", sender, thread_id]`    | `escrows[sender][threadId]` mapping entry              |
| Account `close = <recipient>` returns rent       | `delete escrows[...]` (gas refund, entry becomes None) |
| `Clock::get()?.unix_timestamp`                   | `block.timestamp`                                      |
| `system_instruction::transfer` (lamports)        | `call{value: amount}("")` (native ETH)                 |
| Anchor discriminator + typed accounts            | `status` enum + struct in mapping                      |

### Functions

- `initializeEscrow(bytes32 threadId, uint256 amount)` — payable; sender
  locks `msg.value` (must equal `amount`) against the given thread.
- `registerAndClaim(address sender, bytes32 threadId)` — receiver (caller)
  claims the funds. Checks Pending status, matching sender & thread id.
- `refundEscrow(bytes32 threadId)` — original sender reclaims after the
  15-day expiry if no receiver has claimed.

### Layout

```
solidity-escrow/
├── src/SolmailEscrow.sol      ← the contract
├── test/SolmailEscrow.t.sol   ← Foundry tests mirroring the Rust behaviour
├── script/Deploy.s.sol        ← deployment script
└── foundry.toml
```

### Building

Install [Foundry](https://book.getfoundry.sh/getting-started/installation):

```
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

From this folder:

```
forge install foundry-rs/forge-std --no-commit
forge build
forge test -vvv
```

### Deploying to Base Sepolia

```
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export DEPLOYER_KEY=0x...
export BASESCAN_API_KEY=...

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia \
  --private-key $DEPLOYER_KEY \
  --broadcast --verify
```

Swap `base_sepolia` for `base` (and use `https://mainnet.base.org` or an RPC
provider) for mainnet.

### Notes for the frontend

- Replace the Solana escrow call in
  `Zero/apps/mail/components/create/email-composer.tsx` with a Base
  transaction via viem/wagmi. The `threadId` derivation logic stays identical
  (hash the thread key to `bytes32`).
- Wallet connection on Base: wagmi + Coinbase Wallet / MetaMask / Rainbow.
- The frontend must keep the (sender, threadId) uniqueness invariant — the
  contract enforces it, but you want to catch it in the UI before the tx.
