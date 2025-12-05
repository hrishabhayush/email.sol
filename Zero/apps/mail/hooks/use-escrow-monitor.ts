import { useEffect, useRef } from 'react';
import type { ParsedMessage } from '@/types';

/**
 * Hook to continuously monitor and log escrow headers in emails
 * This helps debug header storage and retrieval issues
 */
export function useEscrowMonitor(messages?: ParsedMessage[]) {
  const lastLogTime = useRef<number>(0);
  const logInterval = 5000; // Log every 5 seconds max

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const now = Date.now();
    if (now - lastLogTime.current < logInterval) return;
    lastLogTime.current = now;

    // Check all messages for escrow headers
    const messagesWithEscrow = messages.filter((msg) => {
      const headers = msg.headers || {};
      const hasThreadId = !!(
        headers['X-Solmail-Thread-Id'] ||
        headers['x-solmail-thread-id'] ||
        headers['X-SOLMAIL-THREAD-ID']
      );
      const hasSenderPubkey = !!(
        headers['X-Solmail-Sender-Pubkey'] ||
        headers['x-solmail-sender-pubkey'] ||
        headers['X-SOLMAIL-SENDER-PUBKEY']
      );
      return hasThreadId || hasSenderPubkey;
    });

    if (messagesWithEscrow.length > 0) {
      console.log('[ESCROW MONITOR] Found emails with escrow headers:', {
        timestamp: new Date().toISOString(),
        totalMessages: messages.length,
        messagesWithEscrow: messagesWithEscrow.length,
        details: messagesWithEscrow.map((msg) => ({
          id: msg.id,
          subject: msg.subject,
          sender: msg.sender.email,
          hasThreadId: !!(
            msg.headers?.['X-Solmail-Thread-Id'] ||
            msg.headers?.['x-solmail-thread-id']
          ),
          hasSenderPubkey: !!(
            msg.headers?.['X-Solmail-Sender-Pubkey'] ||
            msg.headers?.['x-solmail-sender-pubkey']
          ),
          threadId: msg.headers?.['X-Solmail-Thread-Id'] || msg.headers?.['x-solmail-thread-id'] || 'NOT FOUND',
          senderPubkey: msg.headers?.['X-Solmail-Sender-Pubkey'] || msg.headers?.['x-solmail-sender-pubkey'] || 'NOT FOUND',
          allHeaderKeys: Object.keys(msg.headers || {}),
        })),
      });
    } else {
      console.log('[ESCROW MONITOR] No emails with escrow headers found:', {
        timestamp: new Date().toISOString(),
        totalMessages: messages.length,
        sampleMessage: messages[0] ? {
          id: messages[0].id,
          subject: messages[0].subject,
          hasHeaders: !!messages[0].headers,
          headerKeys: messages[0].headers ? Object.keys(messages[0].headers) : [],
        } : null,
      });
    }
  }, [messages]);
}

/**
 * Utility function to check if a message has escrow headers
 */
export function hasEscrowHeaders(message: ParsedMessage): boolean {
  const headers = message.headers || {};
  const hasThreadId = !!(
    headers['X-Solmail-Thread-Id'] ||
    headers['x-solmail-thread-id'] ||
    headers['X-SOLMAIL-THREAD-ID']
  );
  const hasSenderPubkey = !!(
    headers['X-Solmail-Sender-Pubkey'] ||
    headers['x-solmail-sender-pubkey'] ||
    headers['X-SOLMAIL-SENDER-PUBKEY']
  );
  return hasThreadId && hasSenderPubkey;
}

/**
 * Utility function to extract escrow headers from a message
 */
export function getEscrowHeaders(message: ParsedMessage): {
  threadId?: string;
  senderPubkey?: string;
} {
  const headers = message.headers || {};
  const threadId =
    headers['X-Solmail-Thread-Id'] ||
    headers['x-solmail-thread-id'] ||
    headers['X-SOLMAIL-THREAD-ID'] ||
    headers['X-Solmail-Thread-ID'];
  const senderPubkey =
    headers['X-Solmail-Sender-Pubkey'] ||
    headers['x-solmail-sender-pubkey'] ||
    headers['X-SOLMAIL-SENDER-PUBKEY'] ||
    headers['X-Solmail-Sender-PUBKEY'];

  return {
    threadId: threadId || undefined,
    senderPubkey: senderPubkey || undefined,
  };
}

