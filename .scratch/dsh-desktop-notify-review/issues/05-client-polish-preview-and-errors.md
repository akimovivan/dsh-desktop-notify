# 05: Client polish: readable preview tones + visible errors

**What to build:** The in-browser preview tone data becomes self-describing objects instead of positional arrays, so the tone[3] || 'sine' style index access disappears. The deliberately-swallowed failures in card field writes and audio preview are logged at warn level instead of silently dropped, while remaining best-effort (never breaking the card).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Preview tone data expressed as named fields; no positional index access remains
- [x] Field-write and audio-preview failures emit a warn log instead of vanishing
- [x] Preview behaviour unchanged and the client-card test still passes

## Comments

- 2026-09-13 — Implemented in 63a4a6f. Preview tones in lib/client.js became self-describing objects (freq/offsetSec/durSec/waveType), so previewSound reads named fields instead of the old tone[3] || 'sine' positional access; behaviour is unchanged (the named form decodes back to the exact original positional arrays). The deliberately-swallowed field-write (setField) and audio-preview (previewSound) failures now console.warn instead of vanishing, and both stay best-effort — a failed write or preview never breaks the card. Coverage added in test/preview.test.mjs (source-level tone-data checks plus rendered-card warn tests).
