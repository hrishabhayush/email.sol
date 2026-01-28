import type { ParsedMessage } from '../types';
import { FOLDERS } from './utils';

/**
 * Email status types (shared with client)
 * Badge states for the refined tagging/filtering system
 */
export type SentFolderStatus =
  | 'on_hold'
  | 'paid'
  | 'refunded'
  | null;

export type InboxFolderStatus =
  | 'awaiting_evaluation'
  | 'approved'
  | 'attempts_remaining_2'
  | 'attempts_remaining_1'
  | 'attempts_remaining_0'
  | null;

export type EmailStatus = SentFolderStatus | InboxFolderStatus;

/**
 * Check if a message has escrow headers
 */
function hasEscrowHeaders(message: ParsedMessage): boolean {
  const headers = message.headers || {};
  return !!(
    (headers['X-Solmail-Thread-Id'] || headers['x-solmail-thread-id'] || headers['X-SOLMAIL-THREAD-ID']) &&
    (headers['X-Solmail-Sender-Pubkey'] || headers['x-solmail-sender-pubkey'] || headers['X-SOLMAIL-SENDER-PUBKEY'])
  );
}

/**
 * Check if a message is from the current user
 */
function isMessageFromUser(message: ParsedMessage, userEmail: string): boolean {
  return message.sender?.email?.toLowerCase() === userEmail.toLowerCase();
}

/**
 * Check if a message is to the current user
 */
function isMessageToUser(message: ParsedMessage, userEmail: string): boolean {
  return (
    message.to?.some((recipient) => recipient.email?.toLowerCase() === userEmail.toLowerCase()) ||
    message.cc?.some((recipient) => recipient.email?.toLowerCase() === userEmail.toLowerCase()) ||
    false
  );
}

/**
 * Get the latest response in a thread (excluding the original message)
 */
function getLatestResponse(messages: ParsedMessage[], userEmail: string, isSentFolder: boolean): ParsedMessage | null {
  if (messages.length <= 1) return null;

  const relevantMessages = messages.slice(1).reverse();

  if (isSentFolder) {
    return relevantMessages.find((msg) => !isMessageFromUser(msg, userEmail)) || null;
  } else {
    return relevantMessages.find((msg) => isMessageFromUser(msg, userEmail)) || null;
  }
}

/**
 * Calculate attempts remaining based on user responses and their scores
 */
function calculateAttemptsRemaining(
  messages: ParsedMessage[],
  userEmail: string,
  aiEvaluationResults?: Map<string, number | 'good' | 'bad'>,
): number {
  let attemptsRemaining = 2;

  const userResponses = messages.filter((msg, index) => {
    if (index === 0) return false;
    return isMessageFromUser(msg, userEmail);
  });

  for (const response of userResponses) {
    if (aiEvaluationResults) {
      const result = aiEvaluationResults.get(response.id);
      if (result !== undefined) {
        if (typeof result === 'number') {
          if (result < 70) {
            attemptsRemaining = Math.max(0, attemptsRemaining - 1);
          } else {
            return attemptsRemaining;
          }
        } else if (result === 'bad') {
          attemptsRemaining = Math.max(0, attemptsRemaining - 1);
        } else if (result === 'good') {
          return attemptsRemaining;
        }
      }
    }
  }

  return attemptsRemaining;
}

/**
 * Get badge status for inbox folder based on attempts and evaluation results
 */
function getInboxBadgeStatus(
  messages: ParsedMessage[],
  userEmail: string,
  hasEscrow: boolean,
  aiEvaluationResults?: Map<string, number | 'good' | 'bad'>,
  latestUserResponse?: ParsedMessage | null,
): InboxFolderStatus | null {
  if (!hasEscrow) return null;

  if (!latestUserResponse) {
    return 'attempts_remaining_2';
  }

  if (latestUserResponse && aiEvaluationResults) {
    const result = aiEvaluationResults.get(latestUserResponse.id);

    if (result !== undefined) {
      const isGood = typeof result === 'number' ? result >= 70 : result === 'good';

      if (isGood) {
        return 'approved';
      } else {
        const attempts = calculateAttemptsRemaining(messages, userEmail, aiEvaluationResults);
        if (attempts === 2) return 'attempts_remaining_2';
        if (attempts === 1) return 'attempts_remaining_1';
        return 'attempts_remaining_0';
      }
    }
  }

  return 'awaiting_evaluation';
}

/**
 * Determine email status based on folder context (server-side version)
 * Returns badge states for the refined tagging/filtering system
 * 
 * Sender Mode (Sent folder): on_hold, paid, refunded
 * Receiver Mode (Inbox folder): awaiting_evaluation, approved, attempts_remaining_N
 */
export function getEmailStatus(
  messages: ParsedMessage[],
  folder: string,
  userEmail: string,
  escrowStatus?: 'pending' | 'claimed' | 'refunded' | null,
  aiEvaluationResult?: 'good' | 'bad' | 'pending' | number | null,
  aiEvaluationResults?: Map<string, number | 'good' | 'bad'>, // Map of message IDs to scores
): EmailStatus {
  if (!messages || messages.length === 0) return null;

  const isSentFolder = folder === FOLDERS.SENT;
  const isInboxFolder = folder === FOLDERS.INBOX || !folder;

  const firstMessage = messages[0];
  const hasEscrow = hasEscrowHeaders(firstMessage);

  // Only show badges for emails with escrow
  if (!hasEscrow) return null;

  // For Sent folder (Sender Mode - Micropayment-Centric)
  if (isSentFolder) {
    const latestResponse = getLatestResponse(messages, userEmail, true);

    if (!latestResponse) {
      return 'on_hold';
    }

    if (escrowStatus === 'claimed') {
      return 'paid';
    }
    if (escrowStatus === 'refunded') {
      return 'refunded';
    }

    // Fallback: check evaluation result if escrow status not available
    if (aiEvaluationResult === 'good' || (typeof aiEvaluationResult === 'number' && aiEvaluationResult >= 70)) {
      return 'paid';
    }
    if (aiEvaluationResult === 'bad' || (typeof aiEvaluationResult === 'number' && aiEvaluationResult < 70)) {
      return 'refunded';
    }

    return 'on_hold';
  }

  // For Inbox folder (Receiver Mode - Quality-Centric, Attempts-Based)
  if (isInboxFolder) {
    const latestUserResponse = getLatestResponse(messages, userEmail, false);

    // Build evaluation results map if provided
    const evaluationMap = aiEvaluationResults || new Map<string, number | 'good' | 'bad'>();

    // If we have a single evaluation result, add it to the map for the latest response
    if (latestUserResponse && aiEvaluationResult !== undefined && aiEvaluationResult !== null) {
      if (typeof aiEvaluationResult === 'number') {
        evaluationMap.set(latestUserResponse.id, aiEvaluationResult);
      } else {
        evaluationMap.set(latestUserResponse.id, aiEvaluationResult);
      }
    }

    return getInboxBadgeStatus(messages, userEmail, hasEscrow, evaluationMap, latestUserResponse);
  }

  return null;
}

