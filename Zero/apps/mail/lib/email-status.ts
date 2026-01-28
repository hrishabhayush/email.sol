import type { ParsedMessage } from '@/types';
import { getEscrowHeaders, hasEscrowHeaders } from '@/hooks/use-escrow-monitor';
import { FOLDERS } from './utils';

/**
 * Email status types based on folder context
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
 * Status configuration for display
 */
export interface StatusConfig {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon?: string;
  description?: string;
  badgeIcon?: string; // Emoji icon for badge display
  attemptsCount?: number; // For attempts remaining badges
}

/**
 * Status configurations for Sent folder (Sender Mode - Micropayment-Centric)
 */
export const SENT_STATUS_CONFIGS: Record<NonNullable<SentFolderStatus>, StatusConfig> = {
  on_hold: {
    id: 'on_hold',
    label: 'On Hold',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '⏳',
    badgeIcon: '🕒',
    description: 'Escrow pending, awaiting response',
  },
  paid: {
    id: 'paid',
    label: 'Paid',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '✓',
    badgeIcon: '✅',
    description: 'Micropayment released',
  },
  refunded: {
    id: 'refunded',
    label: 'Refunded',
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    icon: '↩',
    badgeIcon: '↩️',
    description: 'Micropayment returned',
  },
};

/**
 * Status configurations for Inbox folder (Receiver Mode - Quality-Centric, Attempts-Based)
 */
export const INBOX_STATUS_CONFIGS: Record<NonNullable<InboxFolderStatus>, StatusConfig> = {
  awaiting_evaluation: {
    id: 'awaiting_evaluation',
    label: 'Awaiting Evaluation',
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: '⏳',
    badgeIcon: '🕒',
    description: 'Response sent, being evaluated by AI',
  },
  approved: {
    id: 'approved',
    label: 'Approved',
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: '✓',
    badgeIcon: '✅',
    description: 'Response approved, payment received',
  },
  attempts_remaining_2: {
    id: 'attempts_remaining_2',
    label: 'Attempts Remaining: 2',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '❌',
    badgeIcon: '❌',
    attemptsCount: 2,
    description: '2 attempts remaining',
  },
  attempts_remaining_1: {
    id: 'attempts_remaining_1',
    label: 'Attempts Remaining: 1',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '❌',
    badgeIcon: '❌',
    attemptsCount: 1,
    description: '1 attempt remaining',
  },
  attempts_remaining_0: {
    id: 'attempts_remaining_0',
    label: 'Attempts Remaining: 0',
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: '❌',
    badgeIcon: '❌',
    attemptsCount: 0,
    description: 'No attempts remaining',
  },
};

/**
 * Get status filter options for a folder
 * For inbox, combines all "attempts_remaining" states into a single filter
 */
export function getStatusFilters(folder: string): StatusConfig[] {
  // Normalize folder - handle undefined/empty as inbox
  const normalizedFolder = folder || FOLDERS.INBOX;

  if (normalizedFolder === FOLDERS.SENT) {
    return Object.values(SENT_STATUS_CONFIGS);
  }
  if (normalizedFolder === FOLDERS.INBOX) {
    // Combine all attempts_remaining states into a single filter option
    const filters: StatusConfig[] = [];

    // Add non-attempts filters
    filters.push(INBOX_STATUS_CONFIGS.awaiting_evaluation);
    filters.push(INBOX_STATUS_CONFIGS.approved);

    // Add combined attempts remaining filter
    filters.push({
      id: 'attempts_remaining',
      label: 'Attempts Remaining',
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      icon: '❌',
      badgeIcon: '❌',
      description: 'Has attempts remaining (2, 1, or 0)',
    });

    return filters;
  }
  return [];
}

/**
 * Get badge status for display (returns the badge icon and label)
 */
export function getBadgeStatus(
  status: EmailStatus,
  folder: string,
): { icon: string; label: string; attemptsCount?: number } | null {
  if (!status) return null;

  const config = getStatusConfig(status, folder);
  if (!config) return null;

  return {
    icon: config.badgeIcon || config.icon || '',
    label: config.label,
    attemptsCount: config.attemptsCount,
  };
}

/**
 * Check if a status is an "attempts remaining" status
 */
export function isAttemptsRemainingStatus(status: EmailStatus): boolean {
  return status === 'attempts_remaining_2' ||
    status === 'attempts_remaining_1' ||
    status === 'attempts_remaining_0';
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
 * Calculate attempts remaining based on user responses and their scores
 * 
 * Logic:
 * - Start with 2 attempts for emails with escrows
 * - Decrease by 1 for each bad response (score < 70)
 * - If score >= 70, show "Approved" instead of attempts remaining
 * 
 * @param messages - All messages in the thread
 * @param userEmail - Current user's email
 * @param aiEvaluationResults - Map of message IDs to their evaluation results (score or 'good'/'bad')
 * @returns Number of attempts remaining (2, 1, or 0)
 */
function calculateAttemptsRemaining(
  messages: ParsedMessage[],
  userEmail: string,
  aiEvaluationResults?: Map<string, number | 'good' | 'bad'>,
): number {
  // Start with 2 attempts for emails with escrows
  let attemptsRemaining = 2;

  // Find all user responses (excluding the first message)
  const userResponses = messages.filter((msg, index) => {
    if (index === 0) return false; // Skip first message (original email)
    return isMessageFromUser(msg, userEmail);
  });

  // Count bad responses (score < 70)
  for (const response of userResponses) {
    if (aiEvaluationResults) {
      const result = aiEvaluationResults.get(response.id);
      if (result !== undefined) {
        // If we have a numeric score, check if it's < 70
        if (typeof result === 'number') {
          if (result < 70) {
            attemptsRemaining = Math.max(0, attemptsRemaining - 1);
          } else {
            // Good response - return early, will show "Approved" instead
            return attemptsRemaining;
          }
        } else if (result === 'bad') {
          attemptsRemaining = Math.max(0, attemptsRemaining - 1);
        } else if (result === 'good') {
          // Good response - return early, will show "Approved" instead
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

  // If user hasn't responded yet, show default "Attempts Remaining: 2"
  if (!latestUserResponse) {
    return 'attempts_remaining_2';
  }

  // Check if latest response has been evaluated
  if (latestUserResponse && aiEvaluationResults) {
    const result = aiEvaluationResults.get(latestUserResponse.id);

    if (result !== undefined) {
      // Check if response is good (score >= 70 or 'good')
      const isGood = typeof result === 'number' ? result >= 70 : result === 'good';

      if (isGood) {
        return 'approved';
      } else {
        // Bad response - calculate attempts remaining
        const attempts = calculateAttemptsRemaining(messages, userEmail, aiEvaluationResults);
        if (attempts === 2) return 'attempts_remaining_2';
        if (attempts === 1) return 'attempts_remaining_1';
        return 'attempts_remaining_0';
      }
    }
  }

  // If response exists but not yet evaluated, show awaiting evaluation
  // (though in practice this won't occur since scoring happens immediately)
  return 'awaiting_evaluation';
}

/**
 * Determine email status based on folder context
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

  // Check if email has escrow (has escrow headers)
  const firstMessage = messages[0];
  const hasEscrow = hasEscrowHeaders(firstMessage);

  // Only show badges for emails with escrow
  if (!hasEscrow) return null;

  // For Sent folder (Sender Mode - Micropayment-Centric)
  if (isSentFolder) {
    const latestResponse = getLatestResponse(messages, userEmail, true);

    if (!latestResponse) {
      // No response yet - escrow is on hold
      return 'on_hold';
    }

    // Response received - check escrow status
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

    // Still pending - on hold
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
      } else if (aiEvaluationResult === 'good' || aiEvaluationResult === 'bad') {
        // Only add 'good' or 'bad', skip 'pending'
        evaluationMap.set(latestUserResponse.id, aiEvaluationResult);
      }
    }

    return getInboxBadgeStatus(messages, userEmail, hasEscrow, evaluationMap, latestUserResponse);
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

