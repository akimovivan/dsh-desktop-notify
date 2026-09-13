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

**Status:** ready-for-agent

- [ ] The card opens with all three groups collapsed
- [ ] Clicking or keyboard-activating a group header expands and collapses that group, independently of the others
- [ ] Group children stay mounted while collapsed, so an in-progress edit in an uncontrolled text field survives a collapse/expand cycle
- [ ] Each header shows a chevron that reflects the state, the default marker is gone, and focus is visible
- [ ] Collapse state is not persisted anywhere and no configuration field or settings-document write is introduced; a reload returns to all-collapsed
- [ ] Headers reuse the existing group-title locale keys, and no dictionary entry is added
- [ ] Headers remain operable when the settings scope is read-only and when the master switch is off
- [ ] The client-card suite is extended to assert: three disclosures render, none is open on first render, each header carries its group-title key, and every control still renders inside the collapsed groups — with the existing "one control per README-documented field" and ten-checkbox assertions still passing
- [ ] All six suites pass (each suite run directly as `node test/<file>.mjs`)

## Comments

- Native `<details>`/`<summary>` is the mechanism specifically because the card's
  text fields are uncontrolled: conditional rendering would unmount them on
  collapse and discard in-progress edits.
- No open-state background change: the design tokens stop at `bg-layer-3`, so
  there is nowhere lighter to go, and three groups all shifting background would
  read as a pressed state.
