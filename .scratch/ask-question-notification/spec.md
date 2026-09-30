# Spec: notify when the agent asks a question

Origin: a user report — "if session waits for my answer i get no notification".

## Problem

Every other "the harness needs *you* right now" event already has a
notification: an approval request pops a sticky 🔔 and a blocked goal pops a
sticky 🛑. An `ask_user_question` call does not. The agent calls the tool, the
tool blocks until the human answers, and the session sits there in silence —
indistinguishable from a session that finished its work. The user finds out
only when they happen to look at the browser tab.

The trigger is also genuinely blocking: `ask_user_question` is the one tool the
model cannot proceed past without a human reply, so it belongs with approvals in
the "needs you now" tier, not in the banner tier.

## Decisions

| # | Decision | Choice |
| --- | --- | --- |
| 1 | Trigger | The `session/event` firehose, `type === "tool/call"` with `data.name === "ask_user_question"` |
| 2 | Why not a dedicated event | The harness has no "question asked" host event; the tool call *is* the only logged fact that a wait began. One `tool/call` case covers both the blocking legacy tool and the opt-in timed one |
| 3 | Severity | `alert` — sticky critical popup + sound, the same tier as an approval |
| 4 | Configuration | New `notifyUserQuestion` boolean, default `true`, next to `notifyApproval` |
| 5 | Message body | The first question's text, one line, truncated; `(+N more)` when the batch is larger |
| 6 | Unreadable arguments | Stay silent — a malformed call never reaches the tool, so nothing waits, and the existing ⚠ tool-failure banner already covers it |
| 7 | Cooldown | None — each call blocks, so a second call means the agent is waiting again |
| 8 | Subagent sessions | Notify, same as approvals and turn ends; a blocked subagent is equally invisible |
| 9 | Surface parity | New row on the GUI card's *When to notify* group, in both locales |

## Why these choices

- **Severity follows the blocking.** The plugin's existing split is "banner =
  informational, alert = needs a human". A blocked question is unambiguously the
  latter, and reusing `alert` means it inherits the sound toggle, the
  `resolveAppName` handling, and the platform strategy table with no new plumbing.
- **No new dependency.** `questionsOf` parses the same raw `arguments` JSON
  string the projection in `@deepseek-ai/dsh-user-questions` already reads. The
  plugin keeps its zero-runtime-dependency rule rather than importing a DSH
  package for one `JSON.parse`.
- **Silence on malformed arguments, by design.** Notifying on a call that never
  ran would claim the session is blocked when it is not, and would double up
  with the tool-failure banner for the same event.

## Non-goals

- Answering the question from the notification — out of scope for a notifier.
- Re-notifying on `tool/result` when a timed call returns `pending`; that
  question is already covered by the alert its call raised.
