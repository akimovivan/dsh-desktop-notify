# 02: Turn the three groups into native disclosures

**What to build:** The Desktop notifications card in Settings → Plugins → Plugin
configuration opens with its three groups — When to notify, Sound, Advanced —
collapsed into native disclosure headers. The card header (title plus master
switch) and the description paragraph stay visible. Expanding a group reveals its
controls; collapsing it hides them without destroying anything the user was
typing. The browser owns the toggle: no state management, no persistence, no
expand-all control.

Each group header carries a chevron that reflects the open/closed state, the
browser's default disclosure marker is removed, and the header keeps a visible
focus ring so it is keyboard-operable.

**Blocked by:** 01

**Status:** resolved

- [x] The card opens with all three groups collapsed
- [x] Clicking or keyboard-activating a group header expands and collapses that group, independently of the others
- [x] Group children stay mounted while collapsed, so an in-progress edit in an uncontrolled text field survives a collapse/expand cycle
- [x] Each header shows a chevron that reflects the state, the default marker is gone, and focus is visible
- [x] Collapse state is not persisted anywhere and no configuration field or settings-document write is introduced; a reload returns to all-collapsed
- [x] Headers reuse the existing group-title locale keys, and no dictionary entry is added
- [x] Headers remain operable when the settings scope is read-only and when the master switch is off
- [x] The client-card suite is extended to assert: three disclosures render, none is open on first render, each header carries its group-title key, and every control still renders inside the collapsed groups — with the existing "one control per README-documented field" and ten-checkbox assertions still passing
- [x] All six suites pass (each suite run directly as `node test/<file>.mjs`)

## Comments

- Native `<details>`/`<summary>` is the mechanism specifically because the card's
  text fields are uncontrolled: conditional rendering would unmount them on
  collapse and discard in-progress edits.
- No open-state background change: the design tokens stop at `bg-layer-3`, so
  there is nowhere lighter to go, and three groups all shifting background would
  read as a pressed state.
- 2026-09-13 — Implemented in 24d0ef8. The `group` helper from ticket 01 now
  emits `<details class="dnd-group"><summary class="dnd-group-title">…</summary>`
  with no `open` prop, so all three start collapsed on every load; the browser
  owns the toggle and keeps the rows mounted while hidden. CSS adds a
  `details[open]`-driven chevron, removes the default marker (`display:flex` +
  `::-webkit-details-marker`), and a `:focus-visible` ring using
  `--dsw-alias-state-business-primary`; no background changes on open. No
  dictionary, schema, or settings-write change. The client-card suite grew the
  three-disclosure, none-open, header-key, mounted-controls, and read-only/
  master-off checks; header-key and collapsed assertions were mutation-tested
  (hardcoded literal and default-`open` both fail the suite). Verified visually in
  headless Chromium with a static replica: chevron points right collapsed and down
  open, header/description stay visible, and the focus ring shows.
