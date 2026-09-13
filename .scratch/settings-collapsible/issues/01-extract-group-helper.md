# 01: Extract a shared group helper in the settings card

**What to build:** The settings card's three groups (When to notify, Sound,
Advanced) are produced by one shared helper instead of three hand-written blocks.
Nothing about the rendered card changes: same groups, same titles, same controls,
same order, same DOM. This is the "make the change easy" step so the following
disclosure ticket edits one site instead of three.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] One shared helper renders a group from its title key and its child rows; the three groups call it
- [x] The card renders identically to before — same groups, titles, controls, and order, with no visual or behavioural change
- [x] No test file is modified, and all six suites pass (each suite run directly as `node test/<file>.mjs`; the directory form of the runner is broken in this repo)

## Comments

- Extracted because the group blocks are near-identical; without it the disclosure
  change would have to be applied in three places with three chances to drift.
- 2026-09-13 — Implemented in 5ae845a. `group(titleKey, rows)` in `lib/client.js`
  renders the bordered section and its uppercase title; the three call sites pass
  their rows as an array, spread into flat children with `createElement.apply` so
  the rendered DOM matches the old hand-written blocks exactly. Verified by
  serializing the rendered tree from the pre- and post-refactor bundles through
  the client-card React/scope shim — byte-identical. No test file touched; all six
  suites run green individually (`node test/<file>.mjs`).
