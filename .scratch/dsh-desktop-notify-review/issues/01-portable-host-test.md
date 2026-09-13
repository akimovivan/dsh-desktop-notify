# 01: Make the host-registration test portable

**What to build:** The host-registration test passes on any machine with DSH installed, not just the author's. It resolves the cordis service and settings-service modules relative to an installed DSH (or via an explicit env-var override) instead of hardcoded absolute paths, and the platform faking used to avoid spawning real desktop processes is scoped so it cannot leak into other tests.

**Blocked by:** None (can start immediately)

**Status:** resolved

## Comments

- 2026-09-13 — Implemented in c46d100. Resolution order: `DSH_DESKTOP_NOTIFY_DSH` env override → `npm root -g` → `dsh` binary on PATH (realpath + walk-up). Settings service prefers DSH's bundled copy (the one the running host serves plugins) with a `$DSH_HOME/profiles` fallback and a `Settings ?? default` shim for the class rename in newer releases. Platform fake applied after resolution, restored in `finally`; verified no leak into later same-process code and a clear failure message when DSH is absent.

- [x] No machine-specific absolute paths remain in the committed test source
- [x] Host modules are resolved relative to an installed DSH entry point, with a clear failure message when DSH is not found
- [x] The platform override used to suppress real notification spawns is explicit and confined to this test
- [x] The host-registration test still passes end-to-end in the current environment
