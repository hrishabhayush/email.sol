import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Wallet } from '@solana/wallet-adapter-base';
import idl from './escrow_contract.json';

// Program ID from Anchor.toml
export const ESCROW_PROGRAM_ID = new PublicKey('HjyyT5fvNhRHmtMLnmmqi752UPpQEDq7U4Km87Uhu569');

// Platform wallet address - receives 2% platform fees from escrow releases
// IMPORTANT: This is a regular wallet (not the escrow program)
// The escrow program ID is ESCROW_PROGRAM_ID above
export const PLATFORM_WALLET = new PublicKey(
  import.meta.env.VITE_PLATFORM_WALLET || 'FnfcQcr174DxPXUTpXFdP7eMeocN8SZLyTgD8hAmxsZQ'
);

export interface EscrowClient {
  createEscrow: (params: {
    emailId: string;
    amount: number; // in SOL
    sender: PublicKey;
    recipient: PublicKey;
  }) => Promise<string>; // returns transaction signature

  releaseEscrow: (params: {
    emailId: string;
    sender: PublicKey;
    recipient: PublicKey;
  }) => Promise<string>;

  refundEscrow: (params: {
    emailId: string;
    sender: PublicKey;
    refunder: PublicKey;
  }) => Promise<string>;

  getEscrowPda: (emailId: string, sender: PublicKey) => PublicKey;
}

export function createEscrowClient(
  connection: Connection,
  wallet: Wallet
): EscrowClient {
  const provider = new AnchorProvider(
    connection,
    wallet.adapter as any,
    AnchorProvider.defaultOptions()
  );

  const program = new Program(idl as any, ESCROW_PROGRAM_ID, provider);

  return {
    getEscrowPda: (emailId: string, sender: PublicKey) => {
      const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          Buffer.from(emailId),
          sender.toBuffer(),
        ],
        ESCROW_PROGRAM_ID
      );
      return pda;
    },

    createEscrow: async ({ emailId, amount, sender, recipient }) => {
      const escrowPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          Buffer.from(emailId),
          sender.toBuffer(),
        ],
        ESCROW_PROGRAM_ID
      )[0];

      const amountInLamports = new BN(amount * 1_000_000_000); // Convert SOL to lamports

      const tx = await program.methods
        .createEscrow(emailId, amountInLamports)
        .accounts({
          sender,
          recipient,
          platform: PLATFORM_WALLET,
          escrow: escrowPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    },

    releaseEscrow: async ({ emailId, sender, recipient }) => {
      const escrowPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          Buffer.from(emailId),
          sender.toBuffer(),
        ],
        ESCROW_PROGRAM_ID
      )[0];

      const tx = await program.methods
        .releaseEscrow()
        .accounts({
          recipient,
          escrow: escrowPda,
          platform: PLATFORM_WALLET,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    },

    refundEscrow: async ({ emailId, sender, refunder }) => {
      const escrowPda = PublicKey.findProgramAddressSync(
        [
          Buffer.from('escrow'),
          Buffer.from(emailId),
          sender.toBuffer(),
        ],
        ESCROW_PROGRAM_ID
      )[0];

      const tx = await program.methods
        .refundEscrow()
        .accounts({
          refunder,
          escrow: escrowPda,
          sender,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    },
  };
}

