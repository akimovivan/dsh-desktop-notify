# 03: Consolidate platform branching into one strategy

**What to build:** The four scattered process.platform cascades in the host notifier (sound resolution, sound playback, banner, alert) collapse into a single per-platform strategy table looked up once, so adding or changing a platform touches one place. Behaviour is identical — ticket 02's sound tests and the existing suites stay green without modification as the proof.

**Blocked by:** 02 (Cover the sound path and preset sync)

**Status:** ready-for-agent

- [ ] Platform branching in sound resolution, playback, banner, and alert consolidated into one per-platform lookup
- [ ] No process.platform cascade remains duplicated across the four functions
- [ ] All existing tests plus ticket 02's sound tests pass unchanged
