# 03: Document the collapsible card in the README

**What to build:** The README's Web GUI paragraph states that the card's three
groups are collapsible sections and start collapsed, so a reader knows the fields
are still all there behind a click. The configuration contract is untouched: no
field is added, renamed, or removed, and the documented YAML block and config
table stay exactly as they are.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The README's GUI paragraph notes that the groups are collapsible sections, collapsed by default
- [ ] The README YAML block, the config table, and the settings contract are unchanged
- [ ] All six suites pass, including the docs consistency suite (each suite run directly as `node test/<file>.mjs`)

## Comments

- Blocked by 02 because the README describes shipped behaviour, not intended work.
