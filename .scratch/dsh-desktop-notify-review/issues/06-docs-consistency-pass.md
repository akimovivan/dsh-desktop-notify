# 06: Docs consistency pass

**What to build:** The documentation tells the truth and records its decisions. The README "link install" section's prose and command actually agree (the link-install example uses a real link install, or the prose is corrected); the client bundle's no-build ES5/indent style decision is documented so future contributors don't "fix" it; the JSDoc config table in the host entry is re-aligned.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] README link-install section: prose and command agree
- [x] Client bundle style decision (no build step, ES5, its own indent) documented in the README
- [x] JSDoc config table alignment restored in the host entry

## Comments

- 2026-09-13 — Implemented in 61d344e. The Installation section now states what each install actually does — `github:` materializes a snapshot (re-run `add` to refresh), while a local-directory install is pnpm-linked so source edits propagate without re-running — and the live-edit example is the real link install `dsh plugin --profile web add .` instead of the old duplicated `github:` command. The client bundle style decision (no build step, ES5-flavoured, 2-space indent, loaded verbatim via `window.__ModuleLoader__.load`) is documented in the README Notes with a pointer from the `lib/client.js` header so future contributors don't "modernise" it. The JSDoc config table in `lib/index.js` is re-aligned (name/type columns uniform; five rows fixed). Regression coverage added in test/docs.test.mjs (d6f3bbc), which fails on the pre-fix state for exactly these three items.
