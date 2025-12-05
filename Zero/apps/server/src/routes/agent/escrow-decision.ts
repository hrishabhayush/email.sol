/**
 * Pure decision logic for escrow release/withhold decisions.
 * No LLM calls, randomness, or side-effects.
 */

export type EscrowDecision = 'RELEASE' | 'WITHHOLD';

/**
 * Determines whether to RELEASE or WITHHOLD escrow based on email score.
 * Threshold: score >= 70 = RELEASE, < 70 = WITHHOLD
 *
 * @param score - Email quality score (0-100)
 * @returns "RELEASE" if score >= 70, "WITHHOLD" otherwise
 */
export function decide(score: number): EscrowDecision {
  if (score >= 70) {
    return 'RELEASE';
  }
  return 'WITHHOLD';
}

