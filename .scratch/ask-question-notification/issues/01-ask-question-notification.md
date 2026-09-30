# 01: Notify when the agent asks a question

**What to build:** A desktop notification when a session's agent calls
`ask_user_question` and blocks for the human's answer. A sticky critical popup
plus sound, the same tier as an approval request, with the question text in the
body so the notification is actionable without opening the browser. Gated by a
new `notifyUserQuestion` boolean that defaults to on and is exposed on the
settings card next to the approval toggle.

**Status:** resolved

- [x] A `session/event` with `type: "tool/call"` and `name: "ask_user_question"`
      fires a critical popup whose body carries the first question's text, and
      `(+N more)` for a larger batch
- [x] The question text is collapsed to one line and truncated like every other
      notification body
- [x] Unreadable `arguments` (malformed JSON, no `questions`, no question text)
      produce no notification, and log nothing scarier than the normal path
- [x] `notifyUserQuestion: false` silences it; `enabled: false` silences it
- [x] `notifyUserQuestion` is in `DEFAULTS`, `ConfigSchema`, the JSDoc config
      table (name and type columns still aligned), and `cordis.patch.yml`
- [x] The settings card shows the toggle in *When to notify*, labelled in both
      en and zh
- [x] README, its YAML block, and the package description list the new event
- [x] `settings.test.mjs` and `client-card.test.mjs` cover the new field and the
      new behaviour; five of the six suites pass (see the comment on
      `host-registration`)

## Comments

- Implemented in 9fd7e0b.
- **The `tool/call` event is the whole trigger.** The harness has no dedicated
  "question asked" host event; `ask_user_question` is a blocking tool call in
  both its legacy and timed schemas, and the shared name is all that identifies
  it. Reading the raw `arguments` JSON string keeps the plugin's
  zero-runtime-dependency rule instead of importing `@deepseek-ai/dsh-user-questions`
  for one `JSON.parse` — that package folds the same field into its projection.
- **Silence on unreadable arguments is deliberate.** A garbled call never
  reaches the tool, so nothing is waiting; notifying anyway would claim the
  session is blocked and double up with the existing ⚠ tool-failure banner.
- No cooldown: the call blocks, so a second one means the agent is waiting again.
- The `notifiedBy` helper added to `settings.test.mjs` empties the log between
  events. The earlier assertions in that file accumulate on purpose, so the
  question section banks the running total before it starts.
- `rowsOf` in `client-card.test.mjs` only matches `div`-tagged rows, so the
  checkbox rows (which use `label`) are invisible to it. The order assertion
  reads the field names off the `dnd-field` wrappers' React `key` instead.
- `test/host-registration.test.mjs` cannot run on this machine: it assumes an
  npm-nested install, and DSH here is a pnpm store. It fails identically on the
  pre-change tree (verified by stashing), so this is environmental, not a
  regression. The new field was verified against the exported `createNotifier`
  seam instead — a question alert spawns
  `notify-send -a "DeepSeek Harness" -u critical "<title>" "<body>"` followed by
  the `pw-play` sound.
- Unrelated pre-existing finding, not fixed here: the installed
  `@deepseek-ai/dsh-settings` (0.2.0-rc.2) exports `SettingsForms` with no
  per-plugin `register(ns, schema, { base })` method, so `apply()`'s settings
  injection takes its early return on this version. The row config from
  `cordis.patch.yml` still drives every handler, so notifications — including
  this one — work; only the host-side namespace registration is inert. Worth a
  separate ticket.
