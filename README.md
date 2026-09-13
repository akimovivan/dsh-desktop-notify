# dsh-desktop-notify

Desktop notifications for DeepSeek Harness. Pops native OS notifications when
notable things happen in DSH so you don't have to keep staring at the browser:

- ✅ task finished (turn end)
- ❌ task failed (turn ended with an error) — critical popup + sound
- 🔔 approval needed (a tool requests your permission) — critical popup + sound
- 🚫 permission request auto-rejected (approval policy `never`)
- ⚠ tool call failed (throttled + allowlist)
- 📦 workflow run finished
- 🏁 goal completed / 🛑 goal blocked (blocked = critical popup)
- 🤖 subagent turn ended (off by default)

Notifications go through your desktop's notification daemon — on Linux,
`notify-send` (works with swaync, dunst, mako, fnott, …); on macOS,
`osascript`. Critical popups use `-u critical`, which swaync keeps on screen
until dismissed (`timeout-critical: 0`).

## Installation

```sh
dsh plugin --profile web add github:akimovivan/dsh-desktop-notify
```

Then restart the profile (`dsh web`) for the bundle to load. The same command
works for any other profile (e.g. `--profile tui`).

A `github:` install materializes a snapshot into the profile's
`node_modules`: after editing the source here, re-run the `add` command to
refresh it. A local-directory install is different — pnpm symlinks the
directory into the profile's `node_modules`, so edits to the source reach
the installed plugin without re-running `add`. Run it from inside this
repo's checkout (or pass an absolute path / `link:<path>` from elsewhere):

```sh
dsh plugin --profile web add .
```

## Removal

```sh
dsh plugin --profile web remove dsh-desktop-notify
```

## Configuration

### In the Web GUI (recommended)

Open **Settings → Plugins → Plugin configuration** and use the
**Desktop notifications** card: a master on/off switch, one toggle per event
type, the sound picker for critical popups (with an in-browser preview), a
custom sound file field, and editable fields for the tool-failure allowlist,
its cooldown, and the notification app name. Every documented config field is
reachable from the card. Changes are written to the settings document
(`~/.dsh/settings.yaml`) and apply **live — no restart needed**.

### Via YAML

The same fields can be set statically: defaults live in this package's
`cordis.patch.yml`; override them per profile in
`~/.dsh/profiles/<name>/cordis.patch.yml` by targeting the row id
`desktop-notify`, or via the settings document under the `desktop-notify:`
section. YAML values act as the base layer; the settings document (and the
GUI card) override them per field:

```yaml
- id: desktop-notify
  config:
    enabled: true              # master switch for all notifications
    notifyTurnEnd: true        # banner: ✅ "<session>" — task finished
    notifyTurnError: true      # error → ❌ critical popup; aborted/max-tokens/blocked → ⏹ banner
    notifyApproval: true       # policy ask → 🔔 critical "Approval needed"; policy never → 🚫 banner
    notifyToolError: true      # ⚠ banner, per-session cooldown + optional allowlist
    toolErrorAllowlist: []     # only these tool names notify; empty = all (e.g. ["bash"])
    toolErrorCooldownMs: 60000 # min ms between tool-failure banners per session
    notifyWorkflowEnd: true    # 📦 banner when a workflow run finishes
    notifyGoalComplete: true   # 🏁 banner with the goal objective
    notifyGoalBlocked: true    # 🛑 critical popup with the blocked reason
    notifySubagentEnd: false   # 🤖 banner when a subagent turn ends (off: avoids noise)
    sound: true                # play a sound on critical popups (Linux pw-play, macOS afplay)
    appName: DeepSeek Harness  # shown as the notification's application name; empty = default
    soundName: complete        # preset: complete|bell|attention|message|warning|error
    soundFile: ""              # custom sound file override; empty = use the preset above
```

## Notification severity

| Severity | Trigger | Linux | macOS |
| --- | --- | --- | --- |
| banner | completions, interruptions, auto-rejections, tool failures | `notify-send` | `display notification` |
| critical | task error, approval needed, goal blocked | `notify-send -u critical` + sound (`pw-play`, fallback `paplay`) | `display alert … as critical` + sound (`afplay`, fallback `beep`) |

### Sound presets

`soundName` picks one of six named presets (the GUI picker shows a preview):

| `soundName` | Linux (`freedesktop-sound-theme`) | macOS (`/System/Library/Sounds`) |
| --- | --- | --- |
| `complete` (default) | `stereo/complete.oga` | `Glass.aiff` |
| `bell` | `stereo/bell.oga` | `Ping.aiff` |
| `attention` | `stereo/window-attention.oga` | `Hero.aiff` |
| `message` | `stereo/message.oga` | `Pop.aiff` |
| `warning` | `stereo/dialog-warning.oga` | `Submarine.aiff` |
| `error` | `stereo/dialog-error.oga` | `Basso.aiff` |

To play your own file instead of a preset, set `soundFile` to any path
(Linux: anything `pw-play` can open; macOS: anything `afplay` can open) —
it takes precedence over `soundName`.

## Notes

- The notifier command is spawned detached (`stdio: ignore`, `unref`), so it
  can never block or crash the harness; every handler is wrapped in
  try/catch.
- On swaync, enabling Do-Not-Disturb queues popups in the control center
  instead of showing them immediately.
- This plugin has zero runtime dependencies (only `node:child_process` plus
  the DSH-provided `@deepseek-ai/schemastery` for the settings schema).
- `lib/client.js` (the settings card) has no build step on purpose: DSH's
  browser loads it verbatim through the client module loader
  (`window.__ModuleLoader__.load`), so it stays self-contained classic script
  — no JSX, no TypeScript, no static imports (React comes from the injected
  `require`) — and keeps its own ES5-flavoured style (`var`, function
  expressions) with 2-space indent, deliberately different from
  `lib/index.js`'s modern ESM + tabs. Don't "modernise" it or add a bundler
  without changing how the bundle ships.

## License

MIT
