# Spec: dsh-desktop-notify review follow-ups

Origin: two-axis code review of `git diff 3f6f573...HEAD` (initial commit → HEAD). No originating issue exists; the review findings are the spec.

## Standards axis (8 findings)

1. Host-registration test hardcodes absolute paths and mutates process.platform → ticket 01
2. Preset list, namespace string, and default sound duplicated across host entry, client bundle, patch file, and README with no sync assertion → ticket 02
3. Repeated process.platform cascades in the host notifier (sound resolution, playback, banner, alert) → ticket 03
4. Preview tones as positional arrays (tone[3] || 'sine') → ticket 05
5. Shotgun surgery: adding an event type touches ~7 places — structural across the bundle boundary; mitigated by ticket 02's sync test, revisit if the event list grows (not ticketed)
6. Style inconsistency: tabs/ES5 in the client bundle vs modern ESM elsewhere, undocumented decision → ticket 06
7. Swallowed errors in card field writes and audio preview → ticket 05
8. JSDoc config table misalignment in the host entry → ticket 06

## Spec axis (README.md as spec; 5 findings)

a. GUI card does not expose toolErrorAllowlist / toolErrorCooldownMs / appName (YAML-only) → ticket 04
b. Documented sound behaviour has zero test coverage (playback, fallbacks, preset table) → ticket 02
c. README "link install" prose contradicts the github: command shown → ticket 06
d. docs/agents commit is orthogonal to the feature spec — no action needed
e. i18n dictionaries go beyond the README but follow DSH client conventions — no action needed

## Verification baseline

All three test suites pass as of HEAD (settings, client-card, host-registration).
