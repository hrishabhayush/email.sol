# Solana Lamport Manipulation Pitfall

## The Problem: Direct Lamport Manipulation on Foreign Accounts

### What Happens

In Solana, you can only directly manipulate lamports on accounts **owned by your program**. Attempting to modify lamports on accounts owned by other programs (like the System Program) will **silently fail** at runtime, leading to `UnbalancedInstruction` errors.

### Example of the Pitfall

```rust
// ❌ WRONG: This silently fails if receiver is owned by System Program
**ctx.accounts.receiver.to_account_info().try_borrow_mut_lamports()? += transfer_amount;
**ctx.accounts.escrow.to_account_info().try_borrow_mut_lamports()? -= transfer_amount;
```

**What happens:**
- Escrow loses lamports ✅ (your program owns it, so change applies)
- Receiver gains nothing ❌ (System Program owns it, so change is **silently ignored**)
- Result: `UnbalancedInstruction` error 💥

The runtime doesn't throw an error - it just **ignores** the lamport change on accounts you don't own. Your code continues executing, but the lamports don't actually move.

### Why This Happens

In Solana, every account has an **owner** (a program ID):

- **User wallets** → Owned by `System Program` (`11111111111111111111111111111111`)
- **Your PDAs** → Owned by **your program** (e.g., `DQgzwnMGkmgB5kC92ES28Kgw9gqfcpSnXgy8ogjjLuvd`)

**Rule:** You can only directly modify lamports (`+=`, `-=`) on accounts where:
```rust
account.owner == your_program_id
```

For all other accounts, you **must** use proper transfer instructions.

### The Solution: Use System Instruction Transfer

```rust
// ✅ CORRECT: Use system_instruction::transfer for accounts not owned by your program
let ix = system_instruction::transfer(
    &ctx.accounts.escrow.key(),      // from (your PDA - you can modify)
    &ctx.accounts.receiver.key(),   // to (user wallet - System Program owns)
    transfer_amount
);
anchor_lang::solana_program::program::invoke(
    &ix,
    &[
        ctx.accounts.escrow.to_account_info(),
        ctx.accounts.receiver.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ],
)?;
```

This uses the **System Program** to perform the transfer, which works for any account.

### When to Use Each Approach

| Account Owner | Method | Example |
|--------------|--------|---------|
| **Your program** | Direct manipulation (`+=`, `-=`) | `**escrow.lamports() -= amount;` |
| **System Program** | `system_instruction::transfer` | `invoke(&transfer_ix, &accounts)?;` |
| **Other program** | That program's transfer instruction | Use that program's API |

### Real-World Example

In this escrow program:

**✅ Correct (in `initialize_escrow`):**
```rust
// Sender (System Program owned) → Escrow (your program owned)
let ix = system_instruction::transfer(&sender.key(), &escrow.key(), amount);
invoke(&ix, &[sender, escrow, system_program])?;
```

**✅ Correct (in `register_and_claim`):**
```rust
// Escrow (your program owned) → Receiver (System Program owned)
let ix = system_instruction::transfer(&escrow.key(), &receiver.key(), amount);
invoke(&ix, &[escrow, receiver, system_program])?;
```

**❌ Wrong (what we fixed):**
```rust
// This fails silently - receiver is owned by System Program
**escrow.lamports() -= amount;  // ✅ Works (your program owns escrow)
**receiver.lamports() += amount; // ❌ Silently ignored (System Program owns receiver)
```

### How to Debug

1. **Check account ownership:**
   ```rust
   msg!("Account owner: {}", account.owner);
   msg!("My program ID: {}", program_id);
   ```

2. **Use simulation logs:**
   ```rust
   let sim = connection.simulateTransaction(tx);
   console.log(sim.value.logs); // Shows msg! output
   ```

3. **Look for `UnbalancedInstruction` errors:**
   - If you see this, check if you're directly manipulating lamports on foreign accounts

### Key Takeaways

1. **Direct lamport manipulation only works on accounts your program owns**
2. **Use `system_instruction::transfer` for user wallets and other System Program accounts**
3. **The runtime silently ignores invalid lamport changes - no error thrown**
4. **Always test with simulation to catch these issues before deployment**

### References

- [Solana Account Model](https://docs.solana.com/developing/programming-model/accounts)
- [Anchor Account Constraints](https://www.anchor-lang.com/docs/account-constraints)
- [System Program Instructions](https://docs.rs/solana-program/latest/solana_program/system_instruction/index.html)
