# 03: Consolidate platform branching into one strategy

**What to build:** The four scattered process.platform cascades in the host notifier (sound resolution, sound playback, banner, alert) collapse into a single per-platform strategy table looked up once, so adding or changing a platform touches one place. Behaviour is identical — ticket 02's sound tests and the existing suites stay green without modification as the proof.

**Blocked by:** 02 (Cover the sound path and preset sync)

**Status:** resolved

## Comments

- 2026-09-13 — Implemented in 31bb456. The four cascades (sound resolution, playback, banner, alert) now each do a single lookup of one module-level `PLATFORMS` strategy table — `linux`/`darwin` entries plus a log-only `LOG_ONLY` fallback for unsupported platforms — so adding or changing a platform touches only that table. The sole remaining `process.platform` reference is inside the shared `platformStrategy()` lookup; no cascade is duplicated across the four functions. Proof of identical behaviour: settings, client-card, host-registration, and ticket 02's sound tests all pass unmodified, and a throwaway win32 check confirmed log-only behaviour (no spawns, same resolved file) on unsupported platforms.

- [x] Platform branching in sound resolution, playback, banner, and alert consolidated into one per-platform lookup
- [x] No process.platform cascade remains duplicated across the four functions
- [x] All existing tests plus ticket 02's sound tests pass unchanged
