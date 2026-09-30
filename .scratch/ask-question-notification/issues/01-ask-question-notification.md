# 01: Notify when the agent asks a question

**What to build:** A desktop notification when a session's agent calls
`ask_user_question` and blocks for the human's answer. A sticky critical popup
plus sound, the same tier as an approval request, with the question text in the
body so the notification is actionable without opening the browser. Gated by a
new `notifyUserQuestion` boolean that defaults to on and is exposed on the
settings card next to the approval toggle.

**Status:** ready-for-agent

- [ ] A `session/event` with `type: "tool/call"` and `name: "ask_user_question"`
      fires a critical popup whose body carries the first question's text, and
      `(+N more)` for a larger batch
- [ ] The question text is collapsed to one line and truncated like every other
      notification body
- [ ] Unreadable `arguments` (malformed JSON, no `questions`, no question text)
      produce no notification, and log nothing scarier than the normal path
- [ ] `notifyUserQuestion: false` silences it; `enabled: false` silences it
- [ ] `notifyUserQuestion` is in `DEFAULTS`, `ConfigSchema`, the JSDoc config
      table (name and type columns still aligned), and `cordis.patch.yml`
- [ ] The settings card shows the toggle in *When to notify*, labelled in both
      en and zh
- [ ] README, its YAML block, and the package description list the new event
- [ ] `settings.test.mjs` and `client-card.test.mjs` cover the new field and the
      new behaviour; all six suites pass (`node test/<file>.mjs`)

## Comments
