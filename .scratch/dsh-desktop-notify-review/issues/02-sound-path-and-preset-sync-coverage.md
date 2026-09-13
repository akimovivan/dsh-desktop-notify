# 02: Cover the sound path and preset sync

**What to build:** The documented sound behaviour is proven by tests. The preset-to-file mapping for all six presets is asserted against the README table on both Linux and macOS; a non-empty custom sound file takes precedence over the preset while an empty one falls back to it; the player fallbacks (pw-play → paplay on Linux, afplay → beep on macOS) fire when the primary player fails to spawn — verified with stubbed spawns, not real audio. A further test asserts the client bundle's preset list stays in sync with the host-side SOUND_PRESETS so the two cannot drift silently.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] All six preset mappings asserted for both platforms against the documented values
- [ ] Custom sound file precedence over preset, and empty-value fallback to preset, covered
- [ ] Fallback player spawn verified when the primary player errors (no real audio playback in tests)
- [ ] Client-bundle preset list asserted equal to the host-side preset keys
