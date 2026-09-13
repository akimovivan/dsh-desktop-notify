# 01: Extract a shared group helper in the settings card

**What to build:** The settings card's three groups (When to notify, Sound,
Advanced) are produced by one shared helper instead of three hand-written blocks.
Nothing about the rendered card changes: same groups, same titles, same controls,
same order, same DOM. This is the "make the change easy" step so the following
disclosure ticket edits one site instead of three.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One shared helper renders a group from its title key and its child rows; the three groups call it
- [ ] The card renders identically to before — same groups, titles, controls, and order, with no visual or behavioural change
- [ ] No test file is modified, and all six suites pass (each suite run directly as `node test/<file>.mjs`; the directory form of the runner is broken in this repo)

## Comments

- Extracted because the group blocks are near-identical; without it the disclosure
  change would have to be applied in three places with three chances to drift.
