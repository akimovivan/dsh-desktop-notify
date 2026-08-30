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
dsh plugin --profile web add /home/uvaw/dsh/dsh-desktop-notify
```

Then restart the profile (`dsh web`) for the bundle to load. The same command
works for any other profile (e.g. `--profile tui`).

A plain-directory install is a snapshot copy into the profile's
`node_modules`: after editing the source here, re-run the `add` command to
refresh it. For live-edit propagation use a link install instead:

```sh
dsh plugin --profile web add link:/home/uvaw/dsh/dsh-desktop-notify
```

## Removal

```sh
dsh plugin --profile web remove dsh-desktop-notify
```

## Configuration

Defaults live in this package's `cordis.patch.yml`; override them per profile
in `~/.dsh/profiles/<name>/cordis.patch.yml` by targeting the row id
`desktop-notify`:

```yaml
- id: desktop-notify
  config:
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
    sound: true                # play a sound on critical popups (Linux pw-play, macOS beep)
    appName: DeepSeek Harness  # shown as the notification's application name
    soundFile: /usr/share/sounds/freedesktop/stereo/complete.oga
```

## Notification severity

| Severity | Trigger | Linux | macOS |
| --- | --- | --- | --- |
| banner | completions, interruptions, auto-rejections, tool failures | `notify-send` | `display notification` |
| critical | task error, approval needed, goal blocked | `notify-send -u critical` + `pw-play` | `display alert … as critical` + beep |

## Notes

- The notifier command is spawned detached (`stdio: ignore`, `unref`), so it
  can never block or crash the harness; every handler is wrapped in
  try/catch.
- On swaync, enabling Do-Not-Disturb queues popups in the control center
  instead of showing them immediately.
- This plugin has zero dependencies (only `node:child_process`).

## License

MIT
