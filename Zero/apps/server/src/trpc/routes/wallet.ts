import { privateProcedure, router } from '../trpc';
import { z } from 'zod';
import { createDb } from '../../db';
import { emailWallet } from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { env } from '../../env';

export const walletRouter = router({
  // Get wallet address for an email
  getByEmail: privateProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const { db, conn } = createDb(env.DATABASE_URL);
      try {
        const result = await db
          .select()
          .from(emailWallet)
          .where(eq(emailWallet.email, input.email.toLowerCase()))
          .limit(1);

        if (result.length === 0) {
          return { walletAddress: null, verified: false };
        }

        return {
          walletAddress: result[0].walletAddress,
          verified: result[0].verified,
        };
      } finally {
        await conn.end();
      }
    }),

  // Get wallet addresses for multiple emails
  getByEmails: privateProcedure
    .input(z.object({ emails: z.array(z.string().email()) }))
    .query(async ({ ctx, input }) => {
      const { db, conn } = createDb(env.DATABASE_URL);
      try {
        const lowerEmails = input.emails.map((e) => e.toLowerCase());
        console.log('[Backend] Looking up wallets for emails:', lowerEmails);
        
        const results = await db
          .select()
          .from(emailWallet)
          .where(inArray(emailWallet.email, lowerEmails));

        console.log('[Backend] Database query results:', results);
        console.log('[Backend] Found', results.length, 'wallets in database');

        const walletMap: Record<string, { walletAddress: string; verified: boolean } | null> = {};
        
        // Initialize all emails as null
        for (const email of lowerEmails) {
          walletMap[email] = null;
        }

        // Fill in found wallets
        for (const result of results) {
          console.log('[Backend] Found wallet for', result.email, ':', result.walletAddress);
          walletMap[result.email] = {
            walletAddress: result.walletAddress,
            verified: result.verified,
          };
        }

        console.log('[Backend] Returning wallet map:', walletMap);
        return walletMap;
      } finally {
        await conn.end();
      }
    }),

  // Set or update wallet address for an email
  setWallet: privateProcedure
    .input(
      z.object({
        email: z.string().email(),
        walletAddress: z.string().min(32).max(44), // Solana addresses are base58, typically 32-44 chars
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, conn } = createDb(env.DATABASE_URL);
      try {
        const email = input.email.toLowerCase();
        const now = new Date();

        // Check if wallet already exists
        const existing = await db
          .select()
          .from(emailWallet)
          .where(eq(emailWallet.email, email))
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(emailWallet)
            .set({
              walletAddress: input.walletAddress,
              updatedAt: now,
              // Keep verified status unless explicitly changed
            })
            .where(eq(emailWallet.email, email));

          return { success: true, message: 'Wallet address updated' };
        } else {
          // Create new
          await db.insert(emailWallet).values({
            id: crypto.randomUUID(),
            email,
            walletAddress: input.walletAddress,
            verified: false,
            createdAt: now,
            updatedAt: now,
          });

          return { success: true, message: 'Wallet address set' };
        }
      } finally {
        await conn.end();
      }
    }),

  // Set wallet for current user's email
  setMyWallet: privateProcedure
    .input(
      z.object({
        walletAddress: z.string().min(32).max(44),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, conn } = createDb(env.DATABASE_URL);
      try {
        const email = ctx.sessionUser.email.toLowerCase();
        const now = new Date();

        // Check if wallet already exists
        const existing = await db
          .select()
          .from(emailWallet)
          .where(eq(emailWallet.email, email))
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(emailWallet)
            .set({
              walletAddress: input.walletAddress,
              updatedAt: now,
            })
            .where(eq(emailWallet.email, email));

          return { success: true, message: 'Wallet address updated' };
        } else {
          // Create new
          await db.insert(emailWallet).values({
            id: crypto.randomUUID(),
            email,
            walletAddress: input.walletAddress,
            verified: false,
            createdAt: now,
            updatedAt: now,
          });

          return { success: true, message: 'Wallet address set' };
        }
      } finally {
        await conn.end();
      }
    }),

  // Get current user's wallet
  getMyWallet: privateProcedure.query(async ({ ctx }) => {
    const { db, conn } = createDb(env.DATABASE_URL);
    try {
      const email = ctx.sessionUser.email.toLowerCase();
      const result = await db
        .select()
        .from(emailWallet)
        .where(eq(emailWallet.email, email))
        .limit(1);

      if (result.length === 0) {
        return { walletAddress: null, verified: false };
      }

      return {
        walletAddress: result[0].walletAddress,
        verified: result[0].verified,
      };
    } finally {
      await conn.end();
    }
  }),
});

