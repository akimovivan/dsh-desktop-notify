# 04: Expose the remaining settings on the GUI card

**What to build:** Every config field documented in the README is reachable from the Desktop notifications card. toolErrorAllowlist, toolErrorCooldownMs, and appName gain editable fields with en/zh labels alongside the existing toggles, and edits write through the settings scope exactly like the existing fields — so the recommended GUI path no longer leaves three fields YAML-only.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] toolErrorAllowlist, toolErrorCooldownMs, and appName editable from the card with en/zh labels
- [ ] Edits persist through the settings scope like existing toggles (covered by the client-card test)
- [ ] Every README-documented config field is reachable from the GUI card
