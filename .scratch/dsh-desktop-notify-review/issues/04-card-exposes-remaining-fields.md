# 04: Expose the remaining settings on the GUI card

**What to build:** Every config field documented in the README is reachable from the Desktop notifications card. toolErrorAllowlist, toolErrorCooldownMs, and appName gain editable fields with en/zh labels alongside the existing toggles, and edits write through the settings scope exactly like the existing fields — so the recommended GUI path no longer leaves three fields YAML-only.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] toolErrorAllowlist, toolErrorCooldownMs, and appName editable from the card with en/zh labels
- [x] Edits persist through the settings scope like existing toggles (covered by the client-card test)
- [x] Every README-documented config field is reachable from the GUI card

## Comments

- 2026-09-13 — Implemented in a5ec97d. Note: `soundFile` was also YAML-only (the issue named three fields, but criterion 3 required every documented field), so it gained an editable field too — all 15 README fields now have exactly one card control. The four new inputs sit in a new "Advanced" section (plus `soundFile` in the Sound group) and are uncontrolled draft fields: they write through the scope on each edit, but external changes to those fields don't refresh an open input's display, and rejected invalid text (e.g. a non-numeric cooldown) leaves the draft as typed. Review follow-up folded in: empty/whitespace `appName` now resolves to the documented default on the host side (`resolveAppName`) instead of spawning `notify-send -a ""`.
