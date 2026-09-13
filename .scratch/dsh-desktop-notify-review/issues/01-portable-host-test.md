# 01: Make the host-registration test portable

**What to build:** The host-registration test passes on any machine with DSH installed, not just the author's. It resolves the cordis service and settings-service modules relative to an installed DSH (or via an explicit env-var override) instead of hardcoded absolute paths, and the platform faking used to avoid spawning real desktop processes is scoped so it cannot leak into other tests.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] No machine-specific absolute paths remain in the committed test source
- [ ] Host modules are resolved relative to an installed DSH entry point, with a clear failure message when DSH is not found
- [ ] The platform override used to suppress real notification spawns is explicit and confined to this test
- [ ] The host-registration test still passes end-to-end in the current environment
