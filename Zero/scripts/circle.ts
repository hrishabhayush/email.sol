#!/usr/bin/env tsx

/**
 * Register Entity Secret with Circle
 * 
 * Usage:
 *   CIRCLE_API_KEY=your-key pnpm tsx scripts/circle.ts
 */

import { generateEntitySecret, registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.CIRCLE_API_KEY || '';

if (!apiKey) {
  console.error('❌ CIRCLE_API_KEY environment variable is required');
  process.exit(1);
}

// Step 1: Generate Entity Secret
// const entitySecret = await generateEntitySecret();

// Step 2: Register Entity Secret
// recoveryFileDownloadPath must be a DIRECTORY, not a file path
const recoveryFileDownloadPath = path.join(__dirname, '..'); // Parent directory

await registerEntitySecretCiphertext({
  apiKey,
  entitySecret: "aa524f31b701776a58e0e80a7df222bb0fe1dad89116319b0c1acb6ff9ada242",
  recoveryFileDownloadPath,
});

// console.log(entitySecret);
// console.log('✅ Entity Secret registered successfully!');
// console.log(`📁 Recovery file saved to: ${recoveryFileDownloadPath}`);
// console.log(`\n🔐 Entity Secret: ${entitySecret}`);
// console.log('\n⚠️  IMPORTANT: Store this Entity Secret securely!');
// console.log('   Add it to your .env file as CIRCLE_ENTITY_SECRET');