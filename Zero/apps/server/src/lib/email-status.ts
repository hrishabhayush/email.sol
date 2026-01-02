import type { ParsedMessage } from '../types';
import { FOLDERS } from './utils';

/**
 * Email status types (shared with client)
 */
export type SentFolderStatus = 
  | 'good_response_received'
  | 'bad_response_received'
  | 'no_response_received'
  | 'awaiting_response'
  | null;

export type InboxFolderStatus =
  | 'good_response_sent'
  | 'bad_response_sent_retry_available'
  | 'bad_response_sent_no_retries'
  | 'awaiting_ai_evaluation'
  | 'no_response_yet'
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
 * Check if user has already used their retry for a thread
 */
function hasUsedRetry(messages: ParsedMessage[], userEmail: string): boolean {
  if (messages.length <= 1) return false;
  
  const userResponses = messages.filter((msg, index) => {
    if (index === 0) return false;
    return isMessageFromUser(msg, userEmail);
  });
  
  return userResponses.length > 1;
}

/**
 * Determine email status based on folder context (server-side version)
 */
export function getEmailStatus(
  messages: ParsedMessage[],
  folder: string,
  userEmail: string,
  escrowStatus?: 'pending' | 'claimed' | 'refunded' | null,
  aiEvaluationResult?: 'good' | 'bad' | 'pending' | null,
): EmailStatus {
  if (!messages || messages.length === 0) return null;

  const isSentFolder = folder === FOLDERS.SENT;
  const isInboxFolder = folder === FOLDERS.INBOX || !folder;

  const firstMessage = messages[0];
  const hasEscrow = hasEscrowHeaders(firstMessage);

  // For now, show status even without escrow headers for testing/demo purposes
  // if (!hasEscrow) return null;

  // For Sent folder: check if recipient responded and quality
  if (isSentFolder) {
    const latestResponse = getLatestResponse(messages, userEmail, true);
    
    if (!latestResponse) {
      if (escrowStatus === 'pending') {
        return 'awaiting_response';
      }
      if (escrowStatus === 'refunded') {
        return 'no_response_received';
      }
      return hasEscrow ? 'awaiting_response' : null;
    }

    if (aiEvaluationResult === 'good') {
      return 'good_response_received';
    }
    if (aiEvaluationResult === 'bad') {
      return 'bad_response_received';
    }
    if (escrowStatus === 'refunded') {
      return 'bad_response_received';
    }
    if (escrowStatus === 'claimed') {
      return 'good_response_received';
    }
    
    return hasEscrow ? 'awaiting_response' : null;
  }

  // For Inbox folder: check if user responded and quality
  if (isInboxFolder) {
    const latestUserResponse = getLatestResponse(messages, userEmail, false);
    
    if (!latestUserResponse) {
      return hasEscrow ? 'no_response_yet' : null;
    }

    const retryUsed = hasUsedRetry(messages, userEmail);

    if (aiEvaluationResult === 'good') {
      return 'good_response_sent';
    }
    if (aiEvaluationResult === 'bad') {
      if (retryUsed) {
        return 'bad_response_sent_no_retries';
      }
      return 'bad_response_sent_retry_available';
    }
    if (!aiEvaluationResult || aiEvaluationResult === 'pending') {
      return 'awaiting_ai_evaluation';
    }

    if (escrowStatus === 'claimed') {
      return 'good_response_sent';
    }
    if (escrowStatus === 'refunded' && retryUsed) {
      return 'bad_response_sent_no_retries';
    }
    if (escrowStatus === 'refunded') {
      return 'bad_response_sent_retry_available';
    }

    return hasEscrow ? 'awaiting_ai_evaluation' : null;
  }

  return null;
}

