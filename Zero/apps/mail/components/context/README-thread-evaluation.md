# Thread Evaluation Context — Workflow & How the Status Tag Updates

This document describes how **thread evaluation** works: where evaluation results (RELEASE/WITHHOLD + score) are stored, how they flow from the reply-composer into the UI, and why the status tag (Awaiting Evaluation → Approved / Attempts remaining) updates when email scoring completes.

---

## 1. What Thread Evaluation Is

For **inbox** threads that have **escrow headers**, we show a status tag on each thread:

- **Awaiting Evaluation** — The user has sent a reply; it has not been scored yet.
- **Approved** — The latest reply was scored and the escrow decision was **RELEASE** (score ≥ 70).
- **Attempts Remaining: 2 / 1 / 0** — The latest reply was **WITHHOLD** (score &lt; 70); we show how many attempts are left.

The **thread evaluation context** holds, in memory:

- **Per-thread, per-message** evaluation results: `threadId → (messageId → 'good' | 'bad' | number)`.
- A **version counter** (`evaluationVersion`) that increments whenever any evaluation is set, so memoized list/display components can re-render and show the updated tag.

Scoring happens in the **reply-composer** after the user sends a reply (find escrow → score reply → settle). The result is written into this context so that both the **mail list** and the **thread view** can read it and pass it into `getEmailStatus(...)` to derive the tag.

---

## 2. Data Model & Context API

**File:** `thread-evaluation-context.tsx`

- **State**
  - `byThread`: `Record<threadId, Record<messageId, EvaluationValue>>`
    - `EvaluationValue` = `number | 'good' | 'bad'`
    - RELEASE → we store `'good'`; WITHHOLD → we store the numeric `score` (used for attempts logic and for display).
  - `evaluationVersion`: number, incremented every time `setThreadEvaluation` is called.

- **Context value**
  - `evaluationVersion` — Consumed by list/thread UI so they can pass it as a prop and force memoized children to re-render.
  - `getEvaluationsForThread(threadId)` — Returns `Map<messageId, EvaluationValue>` for that thread (for `getEmailStatus(..., aiEvaluationResults)`).
  - `setThreadEvaluation(threadId, messageId, value)` — Writes one evaluation and bumps `evaluationVersion`.

- **Hooks**
  - `useThreadEvaluations(threadId)` — Returns the evaluation map for the given thread (memoized).
  - `useSetThreadEvaluation()` — Returns `setThreadEvaluation` (used in reply-composer).
  - `useThreadEvaluationContext()` — Full context (used when you need `evaluationVersion` or both getter/setter).

---

## 3. Where the Provider Lives

**File:** `mail.tsx`

`ThreadEvaluationProvider` wraps the main mail layout that contains both:

- The **mail list** (inbox/sent rows).
- The **thread display** (open thread + reply composer).

So any component that renders the list or the thread view can read/write evaluations and `evaluationVersion` from the same context.

---

## 4. End-to-End Workflow When the User Sends a Reply

All of this runs in **reply-composer** (`reply-composer.tsx`) inside `handleSendEmail`.

### Step 1: Send the email

- `sendEmail(sendParams)` is called; the reply is sent.
- `refetch()` is called so the thread query cache includes the new message (when the server has it).

### Step 2: Run escrow + scoring

- `handleFindAndSettleEscrow({ replyContent, isReplyMode })` runs:
  - Finds escrow from headers, scores the reply (backend), then settles (release or withhold).
- It returns `escrowResult` with `escrowDecision` ('RELEASE' | 'WITHHOLD'), `emailScore`, and optional `recommendations`.

### Step 3: Refetch again and resolve the scored message id

- A **second** `refetch()` is done **after** scoring.
  - The first refetch (right after send) often still has stale thread data (new reply not yet in the thread). The second refetch runs after a delay (scoring), so the thread usually includes the new reply.
- From the refetched data we derive the **message id** of the reply we just scored:
  - `messages = refetched.data?.messages ?? []`
  - Filter to non-draft: `nonDraft = messages.filter(m => !m.isDraft)`
  - `scoredMessageId = nonDraft[nonDraft.length - 1]?.id ?? refetched.data?.latest?.id`
  - This id must match what `getLatestResponse(..., false)` later returns for that thread (the latest message **from the current user**), so the tag lookup finds the evaluation.

### Step 4: Write the evaluation into context

- If we have `threadId`, `scoredMessageId`, and `escrowResult` with `escrowDecision` and `emailScore`:
  - `setThreadEvaluation(threadId, scoredMessageId, value)` where:
    - `value = escrowResult.escrowDecision === 'RELEASE' ? 'good' : escrowResult.emailScore`
  - Context updates:
    - `byThread[threadId][scoredMessageId] = value`
    - `evaluationVersion` is incremented.

### Step 5: Why the tag updates (re-renders)

- **List:** `MailList` reads `evaluationVersion` from context and passes it as a prop to each row (`Thread`). When `evaluationVersion` changes, the prop changes, so `memo(Thread)` re-renders. `Thread` then calls `useThreadEvaluations(message.id)`, gets the new map, and passes it to `getEmailStatus(..., aiEvaluationResults)` → tag recalculates (e.g. Approved).
- **Thread view:** `ThreadDisplay` reads `evaluationVersion` and passes it into `MessageList` → `MailDisplay`. `memo(MailDisplay)` re-renders when `evaluationVersion` changes. `MailDisplay` uses `useThreadEvaluations(emailData.threadId)` and `getEmailStatus(..., aiEvaluationResults)` → same tag logic.

Without passing `evaluationVersion` as a prop, the list/display components would stay memoized and would not re-render when only the context’s evaluation map changed; the tag would stay “Awaiting Evaluation” even after scoring.

---

## 5. How the Tag Value Is Computed (`getEmailStatus`)

**File:** `lib/email-status.ts`

For **inbox** (and default folder), the tag is determined as follows.

1. **Escrow check**  
   If the first message in the thread has no escrow headers, `getEmailStatus` returns `null` (no tag).

2. **Latest user response**  
   `latestUserResponse = getLatestResponse(messages, userEmail, false)`  
   - Skips the first message; from the rest, takes the **latest message that is from the current user** (inbox = “receiver” = our replies).  
   - If there is no user response yet → status `'attempts_remaining_2'` (no “Awaiting Eval” yet).

3. **Lookup in evaluation map**  
   `result = aiEvaluationResults.get(latestUserResponse.id)`  
   - `aiEvaluationResults` is the map from `useThreadEvaluations(threadId)` (same thread id used when calling `setThreadEvaluation`).  
   - Keys are **message ids**; we stored under `scoredMessageId`, which we made equal to the new reply’s message id (last non-draft after second refetch).

4. **Branch on result**
   - **No entry** (`result === undefined`) → **Awaiting Evaluation**.  
     So: thread has a latest user reply, but we haven’t stored an evaluation for that message id yet (e.g. before scoring finishes, or if we never called `setThreadEvaluation`).
   - **Has entry**
     - If **good** (result is `'good'` or numeric ≥ 70) → **Approved**.
     - Otherwise (result is `'bad'` or numeric &lt; 70) → **Attempts remaining**: `calculateAttemptsRemaining(...)` returns 2, 1, or 0 based on prior user replies and their scores; status is `attempts_remaining_2`, `attempts_remaining_1`, or `attempts_remaining_0`.

So:

- **“Awaiting Eval”** = latest message from user exists, but `aiEvaluationResults.get(latestUserResponse.id)` is undefined.
- **“Approved”** = we stored `'good'` (or a score ≥ 70) for that message id after RELEASE.
- **“Attempts remaining: N”** = we stored a score &lt; 70 (or `'bad'`) for that message id after WITHHOLD; N comes from `calculateAttemptsRemaining`.

---

## 6. Why “Awaiting Eval” Appears Before Scoring

- After send, we **refetch** the thread; the React Query cache updates.  
- The **thread view** (and list, if it re-renders for other reasons) then has **new messages** including the new reply.  
- When they call `getEmailStatus(threadData.messages, ..., aiEvaluationResults)`:
  - `getLatestResponse` returns the **new reply** (latest from user).
  - We have **not** called `setThreadEvaluation` yet (scoring hasn’t finished), so `aiEvaluationResults.get(newReply.id)` is **undefined**.  
- So `getInboxBadgeStatus` hits the “response exists but not yet evaluated” branch and returns **`'awaiting_evaluation'`**.  
- So the tag shows “Awaiting Eval” without any special “optimistic” state; it’s just “we have a reply, we don’t have an evaluation for it yet.”

---

## 7. Summary: When the Tag Changes

| Moment | Thread data (messages) | Evaluation map (context) | Tag |
|--------|------------------------|---------------------------|-----|
| Before user replies | No new reply | — | e.g. Attempts remaining: 2 (or no tag if no escrow) |
| Right after send + refetch | New reply is latest from user | No entry for that message id | **Awaiting Evaluation** |
| After scoring + `setThreadEvaluation` + refetch | Same (new reply still latest) | Entry for that message id ('good' or score) | **Approved** or **Attempts remaining: N** |

The important detail is that we **refetch again after scoring** and derive `scoredMessageId` from that refetch, so the id we store in the context is the same id that `getLatestResponse` later returns. If we used the first refetch only, the new reply might not be in the thread yet and we’d store under the wrong message id; the lookup would stay undefined and the tag would stay “Awaiting Eval.”

---

## 8. Files Involved

| Role | File |
|------|------|
| Context definition & provider | `context/thread-evaluation-context.tsx` |
| Writes evaluation after scoring | `mail/reply-composer.tsx` |
| Reads evaluations + passes `evaluationVersion` to list rows | `mail/mail-list.tsx` |
| Reads evaluations + receives `evaluationVersion` for thread view | `mail/mail-display.tsx` |
| Passes `evaluationVersion` into MessageList / MailDisplay | `mail/thread-display.tsx` |
| Tag computation (status from messages + evaluation map) | `lib/email-status.ts` |
| Provider mounted | `mail/mail.tsx` |

---

## 9. Hooks Usage Cheat Sheet

- **Reply composer (writer):**  
  `useSetThreadEvaluation()` → call with `(threadId, scoredMessageId, 'good' | score)` after scoring.

- **List row / thread view (readers):**  
  `useThreadEvaluations(threadId)` → pass the returned map as `aiEvaluationResults` to `getEmailStatus(messages, folder, userEmail, undefined, undefined, aiEvaluationResults)`.

- **List / thread view (force re-render):**  
  `useThreadEvaluationContext().evaluationVersion` → pass as prop `evaluationVersion` into memoized `Thread` / `MailDisplay` so they re-render when any evaluation is set.
