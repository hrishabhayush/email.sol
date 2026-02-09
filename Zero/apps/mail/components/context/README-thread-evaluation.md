# How Thread Evaluation and Scoring Statistics Work (Plain-Language Guide)

This document explains how the app keeps track of email “scores” and “recommendations” after you send a reply, and how that information gets to the screen so you see things like “Attempts Remaining: 1” and improvement suggestions in real time—without needing to refresh the page.

---

## The Big Picture

When you reply to an email that has a special “escrow” (a kind of payment hold), the app:

1. Sends your reply right away.
2. Runs a **scoring** step that checks how good your reply is and decides whether to release the payment.
3. **Saves** that score and any improvement tips (“recommendations”) in a central place.
4. **Pushes** that saved information to the list and the open email view so the UI can show “Approved,” “Attempts Remaining: 2/1/0,” and the suggestions.

All of this is designed so that **as soon as scoring is done**, the badges and recommendations update on screen without a full page reload.

---

## Part 1: What Gets Stored (The “Thread Evaluation” Storage)

The app keeps two kinds of information per email **thread** (a thread is one conversation: the original email plus all replies):

### 1. Scores per message

For each reply you send in that thread, the app stores:

- **Which message** it was (by message ID).
- **How it was rated**: either a number (the score) or a simple “good” or “bad” label.

So for a given thread, the app has a small table: “message A → good,” “message B → 45,” etc. That’s what we call **evaluations by thread**.

### 2. Recommendations per thread

For each thread, the app also stores a **list of short text suggestions** (the “recommendations”). These are the improvement tips returned by the scoring system for the **latest** scored reply in that thread (e.g. “Be more specific,” “Include a clear call to action”). Only one set of recommendations is kept per thread—the one for the most recently scored message.

### Where it’s stored

- **In memory** while you use the app: so the list and the email view can read it instantly.
- **In the browser’s local storage** (under a key like `solmail-thread-evaluations`): so if you refresh the page or come back later, the app can load the same scores and recommendations and show the right “Attempts Remaining” and “Approved” badges without calling the server again.

Whenever a new score or new recommendations are saved, the app also increases an internal “version” number. That version is used so that any part of the UI that shows badges or recommendations knows “something changed” and can refresh what it displays.

---

## Part 2: When Does Scoring Happen? (Reply Composer Flow)

The place where you type and send a reply is the **reply composer**. When you hit send, the following happens in order:

### Step 1: Send the email

Your reply is sent immediately. So the other person gets the email right away; nothing waits on scoring.

### Step 2: Run the scoring process

Right after the send, the app runs the “find and settle escrow” process. An important part of that is **scoring your reply**:

- The app takes the **content of the reply** you just sent and the **rest of the thread** (previous emails in the conversation).
- It sends that to a **backend scoring service**. That service uses its own rules to give your reply a **score** (e.g. 0–100), a **decision** (e.g. “RELEASE” payment or “WITHHOLD” it), and a list of **recommendations** (short improvement tips) when the score is not good enough.
- The reply composer receives back: the **score**, the **decision** (RELEASE or WITHHOLD), and the **recommendations** (if any).

So by the end of this step, the reply composer has in hand: “this message got score X, decision Y, and these recommendations Z.”

### Step 3: Figure out which message was just scored

After sending, the thread on the server now includes your new reply. The app **refetches** the thread so it has the latest list of messages. From that list it finds the **newest non-draft message**—that’s the reply you just sent—and gets its **message ID**. So we now know exactly which message in the thread corresponds to the score we just received.

### Step 4: Save score and recommendations into the central storage

The reply composer then calls a single “save” function (from the thread evaluation context), passing:

- The **thread ID** (which conversation),
- The **message ID** (which reply),
- The **evaluation**: if the decision was “RELEASE” we store “good”; otherwise we store the numeric score (so the UI can show “Attempts Remaining” and use the same rules everywhere),
- The **recommendations** list (the improvement tips).

That save function:

- Updates the in-memory “scores per thread” and “recommendations per thread.”
- Writes the same data to the browser’s local storage (so it survives refresh).
- Bumps the “evaluation version” so the UI knows something changed.

So: **right after scoring finishes**, the central storage already has the new score and recommendations for the reply you just sent.

---

## Part 3: How the UI Gets the Data (Real-Time Display)

The app has a **shared context** (think of it as a shared notice board) that wraps the mail layout. Every screen that shows the list of threads or the open email view can read from this notice board.

### What the list and the email view read

- **Scores for the thread**  
  They ask: “For this thread ID, what are the stored scores per message?” They get back a map: message ID → score or “good”/“bad.”  
  They use this when deciding which **badge** to show (e.g. “Approved,” “Attempts Remaining: 2,” “Attempts Remaining: 1,” “Attempts Remaining: 0”).

- **Recommendations for the thread**  
  They ask: “For this thread ID, what are the stored recommendations?” They get back the list of suggestion strings.  
  They pass this list into the **status tag** component so it can show those suggestions when you interact with the badge (e.g. click “Attempts Remaining: 1”).

- **Evaluation version**  
  The list also receives the current “evaluation version” number. When that number changes (because the reply composer just saved a new score), the list knows it should re-check the context and re-compute badges. So the row for that thread updates and shows the new “Attempts Remaining” or “Approved” without you doing anything.

### How “Attempts Remaining” is computed

The logic for “how many attempts are left” lives in the **email status** logic (not in the composer). It uses:

- The **messages in the thread** (who sent what),
- Your **email address** (to know which messages are your replies),
- The **stored scores** for those messages (from the thread evaluation context).

Rules in plain language:

- You start with **2 attempts** for threads that have escrow.
- Each of **your replies** in that thread can be marked as “good” (e.g. score high enough or decision RELEASE) or “bad” (e.g. score too low or WITHHOLD).
- For every “bad” reply, the count goes down by one (2 → 1 → 0).
- If your **latest** reply is “good,” the badge shows **“Approved”** instead of “Attempts Remaining.”
- So the UI can show: “Attempts Remaining: 2,” “Attempts Remaining: 1,” “Attempts Remaining: 0,” or “Approved.”

All of this uses the **same** stored scores that the reply composer wrote right after scoring. So the number of attempts and the “Approved” state are always in sync with what the backend decided.

### How recommendations are shown

The **status tag** component is what actually draws the badge (e.g. “Attempts Remaining: 1”). For the “Attempts Remaining: 1” state, the tag is made **clickable**: when you click it, a small popover opens. That popover is filled with the **recommendations** list that was passed in from the list or the email view—and that list came from the thread evaluation context, which got it when the reply composer saved the scoring result.

So the path is:

1. You send a reply → scoring runs → reply composer gets score + recommendations.
2. Reply composer saves them into the thread evaluation context (and local storage).
3. List and email view read from that context (scores + recommendations).
4. They compute the badge (e.g. “Attempts Remaining: 1”) and pass recommendations into the status tag.
5. You see the updated badge right away; when you click it, you see the recommendations.

---

## Part 4: Why It Feels “Real Time”

- The reply composer **does not** show the score in the composer itself in a special way; instead it **saves** the result into the shared context as soon as scoring returns.
- The **list** and **email view** are already “subscribed” to that context (they use the same shared notice board). When the composer saves a new evaluation, the stored data and the version number change, so those components re-run their logic and re-read the latest scores and recommendations.
- Because the list and email view use the **same** stored data to compute the badge and to pass recommendations to the status tag, the “Attempts Remaining” count and the suggestions always match what the backend just computed—and they appear as soon as the save happens, without a full page refresh.

In short: **send → score on the server → save score and recommendations in one central place → list and email view read from that place and update the badge and the clickable recommendations.** That’s how thread evaluation and the storage of scoring statistics work, and how they get from the reply composer to the UI for real-time display of attempts remaining and recommendations.
