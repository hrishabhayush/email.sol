import type { ParsedMessage } from '@/types';
import { getEscrowHeaders, hasEscrowHeaders } from '@/hooks/use-escrow-monitor';
import { FOLDERS } from './utils';

/**
 * Email status types based on folder context
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
 * Status configuration for display
 */
export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon?: string;
  description?: string;
}

/**
 * Status configurations for Sent folder
 */
export const SENT_STATUS_CONFIGS: Record<NonNullable<SentFolderStatus>, StatusConfig> = {
  good_response_received: {
    id: 'good_response_received',
    label: 'Good Response',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '✓',
    description: 'Recipient sent a good response, payment sent',
  },
  bad_response_received: {
    id: 'bad_response_received',
    label: 'Bad Response',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: '⚠',
    description: 'Recipient sent a bad response, payment refunded',
  },
  no_response_received: {
    id: 'no_response_received',
    label: 'No Response',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    icon: '⏳',
    description: 'No response received, payment refunded',
  },
  awaiting_response: {
    id: 'awaiting_response',
    label: 'Awaiting Response',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '⏳',
    description: 'Waiting for recipient to respond',
  },
};

/**
 * Status configurations for Inbox folder
 */
export const INBOX_STATUS_CONFIGS: Record<NonNullable<InboxFolderStatus>, StatusConfig> = {
  good_response_sent: {
    id: 'good_response_sent',
    label: 'Good Response',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '✓',
    description: 'Your response was good, payment received',
  },
  bad_response_sent_retry_available: {
    id: 'bad_response_sent_retry_available',
    label: 'Bad Response - Retry Available',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: '🔄',
    description: 'Your response was bad, you can send one follow-up to improve',
  },
  bad_response_sent_no_retries: {
    id: 'bad_response_sent_no_retries',
    label: 'Bad Response - No Retries',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '✗',
    description: 'Your response was bad and retry already used, payment refunded',
  },
  awaiting_ai_evaluation: {
    id: 'awaiting_ai_evaluation',
    label: 'Awaiting Evaluation',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '⏳',
    description: 'Your response is being evaluated by AI',
  },
  no_response_yet: {
    id: 'no_response_yet',
    label: 'No Response Yet',
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
    icon: '📧',
    description: 'You haven\'t responded to this email yet',
  },
};

/**
 * Get status filter options for a folder
 */
export function getStatusFilters(folder: string): StatusConfig[] {
  // Normalize folder - handle undefined/empty as inbox
  const normalizedFolder = folder || FOLDERS.INBOX;
  
  if (normalizedFolder === FOLDERS.SENT) {
    return Object.values(SENT_STATUS_CONFIGS);
  }
  if (normalizedFolder === FOLDERS.INBOX) {
    return Object.values(INBOX_STATUS_CONFIGS);
  }
  return [];
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
  
  // For sent folder, find the latest message that's NOT from the user
  // For inbox folder, find the latest message that IS from the user
  const relevantMessages = messages.slice(1).reverse(); // Skip first message, check from latest
  
  if (isSentFolder) {
    return relevantMessages.find((msg) => !isMessageFromUser(msg, userEmail)) || null;
  } else {
    return relevantMessages.find((msg) => isMessageFromUser(msg, userEmail)) || null;
  }
}

/**
 * Check if user has already used their retry for a thread
 * 
 * Retry logic:
 * - User gets ONE chance to send a follow-up after a bad response
 * - If user sends a bad response, they can send one follow-up
 * - After follow-up is evaluated, if it's still bad, no more retries
 * 
 * This would ideally be tracked in the database with a field like:
 * - retryUsed: boolean
 * - retryMessageId: string | null
 * 
 * For now, we check if there are multiple responses from the user after the first bad response
 */
function hasUsedRetry(messages: ParsedMessage[], userEmail: string): boolean {
  if (messages.length <= 1) return false;
  
  // Find all user responses (excluding the first message if it's from the user)
  const userResponses = messages.filter((msg, index) => {
    // Skip the first message (original email)
    if (index === 0) return false;
    return isMessageFromUser(msg, userEmail);
  });
  
  // If user has sent more than 1 response, retry was likely used
  // More accurate: check if there's a response after a bad evaluation
  // For now, simple heuristic: if user sent 2+ responses, retry was used
  return userResponses.length > 1;
}

/**
 * Check if user can still retry (hasn't used their retry yet)
 */
export function canRetry(messages: ParsedMessage[], userEmail: string, currentStatus: InboxFolderStatus): boolean {
  if (currentStatus !== 'bad_response_sent_retry_available') {
    return false;
  }
  return !hasUsedRetry(messages, userEmail);
}

/**
 * Determine email status based on folder context
 * 
 * This is a placeholder implementation. In production, you would:
 * 1. Check escrow status from blockchain or cached data
 * 2. Check AI evaluation results from your evaluation service
 * 3. Track retry usage in database
 * 
 * For now, this provides the structure and logic flow.
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

  // Check if email has escrow (has escrow headers)
  const firstMessage = messages[0];
  const hasEscrow = hasEscrowHeaders(firstMessage);

  // For now, show status even without escrow headers for testing/demo purposes
  // In production, you might want to only show status for emails with escrow
  // if (!hasEscrow) return null;

  // For Sent folder: check if recipient responded and quality
  if (isSentFolder) {
    const latestResponse = getLatestResponse(messages, userEmail, true);
    
    if (!latestResponse) {
      // No response yet
      if (escrowStatus === 'pending') {
        return 'awaiting_response';
      }
      if (escrowStatus === 'refunded') {
        return 'no_response_received';
      }
      // Default: show awaiting response if we have escrow, otherwise null
      return hasEscrow ? 'awaiting_response' : null;
    }

    // Response received - check quality
    if (aiEvaluationResult === 'good') {
      return 'good_response_received';
    }
    if (aiEvaluationResult === 'bad') {
      return 'bad_response_received';
    }
    if (escrowStatus === 'refunded') {
      // If refunded and we have a response, it was likely bad
      return 'bad_response_received';
    }
    if (escrowStatus === 'claimed') {
      // If claimed, response was likely good
      return 'good_response_received';
    }
    
    // Still evaluating - default to awaiting if we have escrow
    return hasEscrow ? 'awaiting_response' : null;
  }

  // For Inbox folder: check if user responded and quality
  if (isInboxFolder) {
    const latestUserResponse = getLatestResponse(messages, userEmail, false);
    
    if (!latestUserResponse) {
      // User hasn't responded yet - show "no response yet" status
      // Only show if email has escrow (otherwise it's just a regular email)
      return hasEscrow ? 'no_response_yet' : null;
    }

    // Check if retry was used
    const retryUsed = hasUsedRetry(messages, userEmail);

    // Check evaluation result
    if (aiEvaluationResult === 'good') {
      return 'good_response_sent';
    }
    if (aiEvaluationResult === 'bad') {
      if (retryUsed) {
        return 'bad_response_sent_no_retries';
      }
      return 'bad_response_sent_retry_available';
    }
    
    // If no evaluation result yet, show awaiting evaluation
    // This will show for emails that have responses but haven't been evaluated yet
    if (!aiEvaluationResult || aiEvaluationResult === 'pending') {
      return 'awaiting_ai_evaluation';
    }

    // Fallback: check escrow status
    if (escrowStatus === 'claimed') {
      return 'good_response_sent';
    }
    if (escrowStatus === 'refunded' && retryUsed) {
      return 'bad_response_sent_no_retries';
    }
    if (escrowStatus === 'refunded') {
      return 'bad_response_sent_retry_available';
    }

    // Default: if we have a response but no evaluation/escrow info, show awaiting
    return hasEscrow ? 'awaiting_ai_evaluation' : null;
  }

  return null;
}

/**
 * Get status config for display
 */
export function getStatusConfig(status: EmailStatus, folder: string): StatusConfig | null {
  if (!status) return null;

  if (folder === FOLDERS.SENT) {
    return SENT_STATUS_CONFIGS[status as NonNullable<SentFolderStatus>] || null;
  }
  if (folder === FOLDERS.INBOX || !folder) {
    return INBOX_STATUS_CONFIGS[status as NonNullable<InboxFolderStatus>] || null;
  }

  return null;
}

