# 05: Client polish: readable preview tones + visible errors

**What to build:** The in-browser preview tone data becomes self-describing objects instead of positional arrays, so the tone[3] || 'sine' style index access disappears. The deliberately-swallowed failures in card field writes and audio preview are logged at warn level instead of silently dropped, while remaining best-effort (never breaking the card).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Preview tone data expressed as named fields; no positional index access remains
- [ ] Field-write and audio-preview failures emit a warn log instead of vanishing
- [ ] Preview behaviour unchanged and the client-card test still passes
