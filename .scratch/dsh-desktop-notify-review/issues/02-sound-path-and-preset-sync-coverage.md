# 02: Cover the sound path and preset sync

**What to build:** The documented sound behaviour is proven by tests. The preset-to-file mapping for all six presets is asserted against the README table on both Linux and macOS; a non-empty custom sound file takes precedence over the preset while an empty one falls back to it; the player fallbacks (pw-play → paplay on Linux, afplay → beep on macOS) fire when the primary player fails to spawn — verified with stubbed spawns, not real audio. A further test asserts the client bundle's preset list stays in sync with the host-side SOUND_PRESETS so the two cannot drift silently.

**Blocked by:** None (can start immediately)

**Status:** resolved

## Comments

- 2026-09-13 — Implemented in 608d832. New `test/sound.test.mjs`: (1) parses the README preset table and asserts all six linux + darwin mappings against it; (2) custom `soundFile` precedence over the preset, with empty/whitespace falling back; (3) stubbed-spawn verification of the `pw-play` → `paplay` and `afplay` → `osascript beep` fallbacks, plus negative cases (no fallback when the primary succeeds, banners play no sound); (4) client bundle `PRESETS` list asserted equal to host `SOUND_PRESETS` keys, with per-locale labels. Minimal `@internal` seam: `resolveSoundFile` exported, `createNotifier` accepts a `deps.spawn` override. Both drift mutations (host preset path, client preset drop) verified caught; full suite green.

- [x] All six preset mappings asserted for both platforms against the documented values
- [x] Custom sound file precedence over preset, and empty-value fallback to preset, covered
- [x] Fallback player spawn verified when the primary player errors (no real audio playback in tests)
- [x] Client-bundle preset list asserted equal to the host-side preset keys
