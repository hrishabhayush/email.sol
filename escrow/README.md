## SolMail Escrow Program

This folder contains the Solana program that powers SolMail's **incentivized reply escrow**.

High‑level behavior:

- When a sender chooses to “send with incentive”, their wallet funds an **escrow account**.
- The escrow is linked to:
  - the sender wallet
  - a `thread_id` (derived from the email thread / message)
  - an optional receiver wallet (initially unset)
- If the receiver replies within **15 days**, they can claim the escrow to their wallet.
- If there is no qualifying reply after 15 days, the sender can **refund** the escrow.

This is implemented as a separate Anchor‑style program so it can evolve independently of the main web app in `Zero/`.

### Layout

- `Anchor.toml` – Anchor configuration (program name, cluster, etc.).
- `Cargo.toml` – workspace configuration for the escrow program.
- `programs/solmail_escrow/` – on‑chain program code.
- `tests/` – TypeScript tests (can be expanded as we go).

### Local development (you)

On your machine (outside of Cursor), you can:

1. Install Rust + Solana + Anchor (if you haven’t already), following the Anchor docs.
2. From the repo root:
   - `cd escrow`
   - `anchor build`
   - `anchor test`
3. Point your wallet + front‑end to the localnet deployment when testing.

We’ll fill in the actual program logic step‑by‑step so you can test each stage.


