# Spec: collapsible groups in the Desktop notifications settings card

Origin: a grilling session over "make Settings collapsible". Every decision below
was put to the user and settled; nothing here is assumed.

## Objective

The three titled groups in the plugin's settings card — **When to notify**,
**Sound**, **Advanced** — each become an independently collapsible disclosure,
using native `<details>`/`<summary>`, all collapsed by default. The motivation is
compactness in the Plugin configuration list. No behaviour, configuration, schema,
or host change.

## Decisions

| # | Decision | Choice |
| --- | --- | --- |
| 1 | What is collapsible | Each of the three groups, independently (not just Advanced, not the whole card, not the host Settings page) |
| 2 | Default state | All collapsed on load |
| 3 | Persistence | None — the collapsed state resets on every page load |
| 4 | Mechanism | Native `<details>`/`<summary>`; the browser owns the toggle |
| 5 | Read-only / master-off | Group headers stay operable always; the master switch never force-collapses |
| 6 | Affordance | CSS-drawn chevron rotating on open; default marker removed; `:focus-visible` ring; no open-state background change |
| 7 | Always-visible remainder | Card header (title + master switch) and the description paragraph stay visible |
| 8 | Expand-all / collapse-all | Not built — three native toggles are the whole affordance |
| 9 | Coverage + docs | Extend the existing client-card suite in place; one clause added to the README |

## Why these choices

- **Plugin-local by necessity.** The host's own `PluginCard` is already
  collapsible, but this plugin registers its own card markup rather than wrapping
  itself in `PluginCard`, so nothing host-side applies. Everything here is card work.
- **Native `<details>` respects the uncontrolled inputs.** The card's text fields
  are deliberately uncontrolled (`defaultValue`, so mid-typing edits survive
  snapshot re-renders). Conditional rendering would unmount them on collapse and
  destroy in-progress edits; native details keeps children mounted and hidden.
- **No persistence matches house doctrine.** The host's PluginCard documents
  disclosure as card-local state — "which card a user has open is a reading
  gesture, not something the Host or the section has any stake in" — and no
  settings package uses `localStorage`. Writing view state into the settings
  document would pollute the documented config contract for cosmetics.
- **Summaries stay operable when the card is read-only**, for the same reason:
  disclosure is a reading gesture, not a write.
- **No expand-all** because it requires controlled `open` props or refs, which is
  exactly the machinery native details makes unnecessary.

## Explicitly not changing

- The host half of the plugin — no config field is added, read, or migrated.
- The settings document and schema — no view-state field, no persistence surface.
- The bundle patch file, the README YAML block, and the notification
  severity/sound tables — the configuration contract is untouched.
- The locale dictionaries — group titles already exist in both locales.

## Accepted consequences

- Everything but the header and description starts hidden; the description stays
  visible as the mitigation for that discovery cost.
- A returning user's expand choices are not remembered.

## Repo facts worth keeping

- The card must keep the client bundle's no-build, ES5-flavoured style.
- Design tokens: `--dsw-alias-bg-layer-1/2/3` only (no layer 4 — a built-in card
  dangles on it), `--dsw-alias-border-l1..l4`, `--dsw-alias-label-*`,
  `--dsw-alias-brand-primary`, `--dsw-alias-state-business-primary` for focus.
- Verification runs each test file directly (`node test/<file>.mjs`); the
  directory form of the test runner is broken in this repo.

## Tickets

01 extract a shared group helper (prefactor), 02 native disclosures, 03 README
clause — see `issues/`.
