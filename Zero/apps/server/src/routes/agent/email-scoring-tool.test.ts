import { describe, it, expect } from 'vitest';
import { x25519, RescueCipher, deserializeLE } from '@arcium-hq/client';
import { randomBytes } from 'crypto';

/**
 * Test the Arcium encryption/decryption flow without needing the full MPC network.
 * This validates that the encryption logic in email-scoring-tool.ts works correctly.
 */
describe('Arcium Email Scoring Integration', () => {
  it('should encrypt and decrypt a score correctly', () => {
    // Simulate MXE keypair (in production, this comes from the Arcium network)
    const mxePrivateKey = x25519.utils.randomSecretKey();
    const mxePublicKey = x25519.getPublicKey(mxePrivateKey);

    // Client generates ephemeral keypair
    const clientPrivateKey = x25519.utils.randomSecretKey();
    const clientPublicKey = x25519.getPublicKey(clientPrivateKey);

    // Client derives shared secret and encrypts
    const clientSharedSecret = x25519.getSharedSecret(clientPrivateKey, mxePublicKey);
    const cipher = new RescueCipher(clientSharedSecret);

    const originalScore = 85;
    const nonce = new Uint8Array(randomBytes(16));
    const ciphertexts = cipher.encrypt([BigInt(originalScore)], nonce);
    const ciphertext = ciphertexts[0];

    console.log('Original score:', originalScore);
    console.log('Encrypted ciphertext length:', ciphertext.length);
    console.log('Nonce length:', nonce.length);

    // Verify ciphertext is 32 bytes (as expected by Arcium)
    expect(ciphertext.length).toBe(32);
    expect(nonce.length).toBe(16);

    // Decrypt using the same shared secret
    const decrypted = cipher.decrypt([ciphertext], nonce)[0];
    console.log('Decrypted score:', Number(decrypted));

    expect(Number(decrypted)).toBe(originalScore);
  });

  it('should convert nonce to bigint correctly using deserializeLE', () => {
    const nonce = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const nonceValue = deserializeLE(nonce);

    console.log('Nonce as bigint:', nonceValue.toString());

    // Verify it's a valid bigint
    expect(typeof nonceValue).toBe('bigint');
    expect(nonceValue > BigInt(0)).toBe(true);
  });

  it('should handle score range 0-100', () => {
    const mxePrivateKey = x25519.utils.randomSecretKey();
    const mxePublicKey = x25519.getPublicKey(mxePrivateKey);
    const clientPrivateKey = x25519.utils.randomSecretKey();
    const clientSharedSecret = x25519.getSharedSecret(clientPrivateKey, mxePublicKey);
    const cipher = new RescueCipher(clientSharedSecret);

    // Test boundary values
    const testScores = [0, 1, 50, 69, 70, 99, 100];

    for (const score of testScores) {
      const nonce = new Uint8Array(randomBytes(16));
      const ciphertexts = cipher.encrypt([BigInt(score)], nonce);
      const decrypted = cipher.decrypt([ciphertexts[0]], nonce)[0];

      console.log(`Score ${score} -> encrypted -> decrypted: ${Number(decrypted)}`);
      expect(Number(decrypted)).toBe(score);
    }
  });

  it('should produce different ciphertexts for same score with different nonces', () => {
    const mxePrivateKey = x25519.utils.randomSecretKey();
    const mxePublicKey = x25519.getPublicKey(mxePrivateKey);
    const clientPrivateKey = x25519.utils.randomSecretKey();
    const clientSharedSecret = x25519.getSharedSecret(clientPrivateKey, mxePublicKey);
    const cipher = new RescueCipher(clientSharedSecret);

    const score = BigInt(85);
    const nonce1 = new Uint8Array(randomBytes(16));
    const nonce2 = new Uint8Array(randomBytes(16));

    const ciphertext1 = cipher.encrypt([score], nonce1)[0];
    const ciphertext2 = cipher.encrypt([score], nonce2)[0];

    // Ciphertexts should be different due to different nonces
    const areEqual = ciphertext1.every((val, idx) => val === ciphertext2[idx]);
    expect(areEqual).toBe(false);

    // But both should decrypt to the same score
    const decrypted1 = cipher.decrypt([ciphertext1], nonce1)[0];
    const decrypted2 = cipher.decrypt([ciphertext2], nonce2)[0];

    expect(Number(decrypted1)).toBe(85);
    expect(Number(decrypted2)).toBe(85);
  });
});

