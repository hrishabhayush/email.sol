import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowContract } from "../target/types/escrow_contract";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("escrow-contract", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.escrowContract as Program<EscrowContract>;
  const provider = anchor.AnchorProvider.env();

  // Test accounts
  const sender = provider.wallet;
  const recipient = anchor.web3.Keypair.generate();
  const platform = anchor.web3.Keypair.generate();

  it("Creates an escrow", async () => {
    const emailId = "test-email-123";
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL

    // Airdrop to sender if needed
    try {
      await provider.connection.requestAirdrop(
        sender.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(
        await provider.connection.getLatestBlockhash()
      );
    } catch (e) {
      // Airdrop might fail, continue
    }

    // Airdrop to recipient
    try {
      await provider.connection.requestAirdrop(
        recipient.publicKey,
        0.5 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(
        await provider.connection.getLatestBlockhash()
      );
    } catch (e) {
      // Airdrop might fail, continue
    }

    const [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        Buffer.from(emailId),
        sender.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .createEscrow(emailId, amount)
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey,
        platform: platform.publicKey,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Create escrow transaction signature", tx);

    // Fetch and verify escrow
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    expect(escrowAccount.sender.toString()).to.equal(sender.publicKey.toString());
    expect(escrowAccount.recipient.toString()).to.equal(recipient.publicKey.toString());
    expect(escrowAccount.amount.toNumber()).to.equal(amount.toNumber());
    expect(escrowAccount.emailId).to.equal(emailId);
  });

  it("Releases escrow when recipient replies", async () => {
    const emailId = "test-email-release";
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    const [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        Buffer.from(emailId),
        sender.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Create escrow first
    await program.methods
      .createEscrow(emailId, amount)
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey,
        platform: platform.publicKey,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Get initial balances
    const initialRecipientBalance = await provider.connection.getBalance(recipient.publicKey);
    const initialPlatformBalance = await provider.connection.getBalance(platform.publicKey);

    // Release escrow (recipient signs)
    const releaseTx = await program.methods
      .releaseEscrow()
      .accounts({
        recipient: recipient.publicKey,
        escrow: escrowPda,
        platform: platform.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([recipient])
      .rpc();

    console.log("Release escrow transaction signature", releaseTx);

    // Verify escrow is released
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    expect(escrowAccount.status).to.have.property("released");

    // Verify balances (2% platform fee)
    const finalRecipientBalance = await provider.connection.getBalance(recipient.publicKey);
    const finalPlatformBalance = await provider.connection.getBalance(platform.publicKey);
    
    const platformFee = amount.toNumber() * 0.02;
    const recipientAmount = amount.toNumber() - platformFee;

    expect(finalRecipientBalance - initialRecipientBalance).to.be.closeTo(
      recipientAmount,
      10000 // Allow for transaction fees
    );
    expect(finalPlatformBalance - initialPlatformBalance).to.be.closeTo(
      platformFee,
      10000
    );
  });

  it("Refunds escrow after timeout or invalid address", async () => {
    const emailId = "test-email-refund";
    const amount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

    const [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        Buffer.from(emailId),
        sender.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Create escrow
    await program.methods
      .createEscrow(emailId, amount)
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey,
        platform: platform.publicKey,
        escrow: escrowPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Get initial sender balance
    const initialSenderBalance = await provider.connection.getBalance(sender.publicKey);

    // Refund escrow (sender signs - invalid address case)
    const refundTx = await program.methods
      .refundEscrow()
      .accounts({
        refunder: sender.publicKey,
        escrow: escrowPda,
        sender: sender.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Refund escrow transaction signature", refundTx);

    // Verify escrow is refunded
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    expect(escrowAccount.status).to.have.property("refunded");

    // Verify sender got refund
    const finalSenderBalance = await provider.connection.getBalance(sender.publicKey);
    expect(finalSenderBalance - initialSenderBalance).to.be.closeTo(
      amount.toNumber(),
      10000 // Allow for transaction fees
    );
  });
});
