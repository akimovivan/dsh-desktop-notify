/**
 * dsh-desktop-notify — server-side DSH host plugin.
 *
 * Fires a system-level desktop notification when notable things happen in
 * the harness, so you don't have to keep staring at the browser page:
 *
 *   - a root session's turn ends                        → ✅ "task finished" banner
 *   - a root turn fails (reason=error)                  → ❌ critical popup + sound
 *   - a root turn is interrupted (aborted/max-tokens/blocked) → ⏹ banner
 *   - an approval is asked, policy "ask"                 → 🔔 critical popup + sound
 *   - an approval is asked, policy "never"               → 🚫 banner (auto-rejected)
 *   - a single tool call fails (tools/result isError)    → ⚠ banner (cooldown + allowlist)
 *   - a goal completes / blocks (goal/changed)           → 🏁 banner / 🛑 critical popup
 *   - a workflow run ends (tool-workflow/run-end)        → 📦 banner
 *   - a subagent turn ends                               → 🤖 banner (off by default)
 *
 * Notifications are fire-and-forget: the notifier command is spawned
 * detached and never blocks or crashes the harness.
 *
 *   - Linux: `notify-send` (banner) / `notify-send -u critical` (sticky popup;
 *     swaync's timeout-critical=0 keeps it until dismissed) — works with
 *     swaync, dunst, mako, fnott, ...
 *   - macOS: `osascript` notification / modal `display alert`
 *   - other platforms: log only
 *
 * Configuration — DSH Web GUI → Settings → Plugins → Plugin configuration
 * (the "Desktop notifications" card), persisted in the settings document;
 * equivalently via the profile's bundle layer or a user cordis.patch.yml row
 * override by id "desktop-notify":
 *   enabled              boolean  default true    — master switch for everything
 *   notifyTurnEnd        boolean  default true    — banner when a root turn ends
 *   notifyTurnError        boolean  default true    — popup/banner when a root turn fails
 *   notifyApproval       boolean  default true    — popup when an approval is asked
 *   notifyToolError        boolean  default true    — banner when a tool call fails
 *   toolErrorAllowlist   string[] default []      — only these tool names notify ([] = all)
 *   toolErrorCooldownMs  number   default 60000   — min ms between tool-failure banners per session
 *   notifyWorkflowEnd    boolean  default true     — banner when a workflow run ends
 *   notifyGoalComplete   boolean  default true    — banner when a goal completes
 *   notifyGoalBlocked    boolean  default true     — popup when a goal blocks
 *   notifySubagentEnd    boolean  default false   — banner when a subagent turn ends
 *   sound                boolean  default true    — play a sound with critical popups
 *   appName              string   default "DeepSeek Harness" — notification source name
 *   soundName            string   default "complete" — named sound preset (see SOUND_PRESETS)
 *   soundFile            string   default ""       — custom sound file; empty = use the preset
 *
 * @module dsh-desktop-notify
 */

import { spawn } from "node:child_process";
import z from "@deepseek-ai/schemastery";

/** Plugin display name. */
export const name = "dsh-desktop-notify";

const DEFAULTS = {
	enabled: true,
	notifyTurnEnd: true,
	notifyTurnError: true,
	notifyApproval: true,
	notifyToolError: true,
	toolErrorAllowlist: [],
	toolErrorCooldownMs: 60000,
	notifyWorkflowEnd: true,
	notifyGoalComplete: true,
	notifyGoalBlocked: true,
	notifySubagentEnd: false,
	sound: true,
	appName: "DeepSeek Harness",
	soundName: "complete",
	soundFile: "",
};

/**
 * Named sound presets. Linux paths are the freedesktop-sound-theme set
 * (present on most desktop distros); macOS paths are the stock system sounds.
 * Keep in sync with the PRESETS list in lib/client.js (the settings card).
 */
export const SOUND_PRESETS = {
	complete: { linux: "/usr/share/sounds/freedesktop/stereo/complete.oga", mac: "Glass.aiff" },
	bell: { linux: "/usr/share/sounds/freedesktop/stereo/bell.oga", mac: "Ping.aiff" },
	attention: { linux: "/usr/share/sounds/freedesktop/stereo/window-attention.oga", mac: "Hero.aiff" },
	message: { linux: "/usr/share/sounds/freedesktop/stereo/message.oga", mac: "Pop.aiff" },
	warning: { linux: "/usr/share/sounds/freedesktop/stereo/dialog-warning.oga", mac: "Submarine.aiff" },
	error: { linux: "/usr/share/sounds/freedesktop/stereo/dialog-error.oga", mac: "Basso.aiff" },
};

/** Settings namespace served to the Web GUI (Settings → Plugins card key). */
export const SETTINGS_NAMESPACE = "desktop-notify";

/**
 * The settings section schema — also the wire envelope the browser scope
 * validates against, so it must stay JSON-serializable and default-complete.
 */
export const ConfigSchema = z.object({
	enabled: z.boolean().default(DEFAULTS.enabled),
	notifyTurnEnd: z.boolean().default(DEFAULTS.notifyTurnEnd),
	notifyTurnError: z.boolean().default(DEFAULTS.notifyTurnError),
	notifyApproval: z.boolean().default(DEFAULTS.notifyApproval),
	notifyToolError: z.boolean().default(DEFAULTS.notifyToolError),
	toolErrorAllowlist: z.array(z.string()).default(DEFAULTS.toolErrorAllowlist),
	toolErrorCooldownMs: z.number().default(DEFAULTS.toolErrorCooldownMs),
	notifyWorkflowEnd: z.boolean().default(DEFAULTS.notifyWorkflowEnd),
	notifyGoalComplete: z.boolean().default(DEFAULTS.notifyGoalComplete),
	notifyGoalBlocked: z.boolean().default(DEFAULTS.notifyGoalBlocked),
	notifySubagentEnd: z.boolean().default(DEFAULTS.notifySubagentEnd),
	sound: z.boolean().default(DEFAULTS.sound),
	appName: z.string().default(DEFAULTS.appName),
	soundName: z.union(Object.keys(SOUND_PRESETS)).default(DEFAULTS.soundName),
	soundFile: z.string().default(DEFAULTS.soundFile),
});

/**
 * Resolve the sound file for the current options (custom path wins over preset).
 * @internal exported so the sound path can be tested at this seam.
 */
export function resolveSoundFile(opts) {
	const custom = typeof opts.soundFile === "string" ? opts.soundFile.trim() : "";
	if (custom !== "") return custom;
	const preset = SOUND_PRESETS[opts.soundName] ?? SOUND_PRESETS.complete;
	return process.platform === "darwin" ? `/System/Library/Sounds/${preset.mac}` : preset.linux;
}

/** Truncate long text for notification bodies. */
function truncate(value, max = 120) {
	const text = String(value ?? "");
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Collapse all whitespace runs into single spaces (notification bodies are one line). */
function oneLine(value) {
	return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Human-readable reason for a `turn/end` event. */
function turnReasonText(reason) {
	switch (reason?.kind) {
		case "completed": return "completed";
		case "blocked": return "blocked";
		case "max-tokens": return "token limit reached";
		case "aborted": return "aborted";
		case "error": return "error";
		default: return reason?.kind ?? "ended";
	}
}

/** Fold the last `session/title` from a session's event log for display. */
function sessionLabel(session) {
	const events = session?.events;
	if (Array.isArray(events)) {
		for (let i = events.length - 1; i >= 0; i -= 1) {
			const event = events[i];
			if (event?.type === "session/title" && typeof event.data?.title === "string" && event.data.title.length > 0) {
				return event.data.title;
			}
		}
	}
	const id = session?.id ?? session?.header?.id;
	return typeof id === "string" && id.length > 0 ? id.slice(0, 8) : "(untitled session)";
}

/** Fold the last `approval/policy` from a session's event log (undefined = ask). */
function approvalPolicyOf(session) {
	const events = session?.events;
	if (Array.isArray(events)) {
		for (let i = events.length - 1; i >= 0; i -= 1) {
			const event = events[i];
			if (event?.type === "approval/policy" && typeof event.data?.policy === "string") return event.data.policy;
		}
	}
	return undefined;
}

/** Escape a value for use inside a double-quoted AppleScript string literal. */
function escapeAppleScript(value) {
	return String(value)
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n");
}

/**
 * Create the notifier bound to a cordis context and a live config getter.
 * @param {object} [deps] - test seam; `deps.spawn` overrides node:child_process spawn.
 * @internal exported so playback fallbacks can be tested with stubbed spawns.
 */
export function createNotifier(ctx, cfg, deps = {}) {
	const spawnFn = typeof deps.spawn === "function" ? deps.spawn : spawn;
	const log = (message) => {
		const logger = ctx.logger;
		if (logger?.info) logger.info(`[dsh-desktop-notify] ${message}`);
		else console.log(`[dsh-desktop-notify] ${message}`);
	};
	const warn = (message) => {
		const logger = ctx.logger;
		if (logger?.warn) logger.warn(`[dsh-desktop-notify] ${message}`);
		else console.warn(`[dsh-desktop-notify] ${message}`);
	};

	/** Spawn a command detached; failures are logged, never thrown. */
	const spawnDetached = (command, args) => {
		try {
			const child = spawnFn(command, args, { stdio: "ignore", detached: true });
			child.unref();
			child.on("error", (error) => warn(`${command} spawn failed: ${error.message}`));
		} catch (error) {
			warn(`${command} spawn error: ${String(error)}`);
		}
	};

	/** Play a sound file detached, with a per-platform fallback if the player is missing. */
	const playSound = (file) => {
		try {
			if (process.platform === "linux") {
				const child = spawnFn("pw-play", [file], { stdio: "ignore", detached: true });
				child.unref();
				child.on("error", () => spawnDetached("paplay", [file]));
			} else if (process.platform === "darwin") {
				const child = spawnFn("afplay", [file], { stdio: "ignore", detached: true });
				child.unref();
				child.on("error", () => spawnDetached("osascript", ["-e", "beep"]));
			}
		} catch (error) {
			warn(`sound spawn error: ${String(error)}`);
		}
	};

	/** Informational banner — non-intrusive, times out into the notification center. */
	const banner = (title, message) => {
		log(`banner: ${title} — ${message}`);
		if (process.platform === "darwin") {
			spawnDetached("osascript", ["-e", `display notification "${escapeAppleScript(message)}" with title "${escapeAppleScript(title)}"`]);
		} else if (process.platform === "linux") {
			const c = cfg();
			spawnDetached("notify-send", ["-a", c.appName, title, message]);
		}
	};

	/** Attention-demanding popup: sticky on Linux (swaync timeout-critical=0), modal on macOS. */
	const alert = (title, message) => {
		log(`alert: ${title} — ${message}`);
		const c = cfg();
		if (process.platform === "darwin") {
			const script = `display alert "${escapeAppleScript(title)}" message "${escapeAppleScript(message)}" as critical`;
			spawnDetached("osascript", ["-e", script]);
			if (c.sound) playSound(resolveSoundFile(c));
		} else if (process.platform === "linux") {
			spawnDetached("notify-send", ["-a", c.appName, "-u", "critical", title, message]);
			if (c.sound) playSound(resolveSoundFile(c));
		}
	};

	return { banner, alert, log, warn };
}

/**
 * Plugin entry: subscribe to the session event firehose and translate
 * interesting events into desktop notifications.
 * @param {import("@deepseek-ai/cordis").Context} ctx - host plugin context.
 * @param {object} [config] - plugin configuration (see module docs).
 */
export function apply(ctx, config = {}) {
	// Live configuration: starts from the composition entry and is swapped to
	// the settings-scope getter while a settings provider serves our namespace;
	// every event handler reads it fresh, so GUI edits apply without restart.
	const initial = { ...DEFAULTS, ...config };
	let configGetter = () => initial;
	const cfg = () => {
		let raw;
		try {
			raw = configGetter();
		} catch (error) {
			raw = {};
		}
		return { ...DEFAULTS, ...(raw ?? {}) };
	};

	const { banner, alert, log, warn } = createNotifier(ctx, cfg);

	log(`enabled: ${initial.enabled} turnEnd=${initial.notifyTurnEnd} turnError=${initial.notifyTurnError} approval=${initial.notifyApproval} toolError=${initial.notifyToolError} workflowEnd=${initial.notifyWorkflowEnd} goalComplete=${initial.notifyGoalComplete} goalBlocked=${initial.notifyGoalBlocked} subagentEnd=${initial.notifySubagentEnd} sound=${initial.sound}`);

	// Serve the settings namespace so the Web GUI can edit this plugin live.
	// `register` is an effect on our fiber (removed with us); the scope's
	// getter feeds the event handlers, so edits apply without a restart.
	if (typeof ctx.inject === "function") {
		ctx.inject(["settings"], (sctx) => {
			const settings = sctx.settings;
			if (!settings || typeof settings.register !== "function") return;
			const scope = settings.register(SETTINGS_NAMESPACE, ConfigSchema, { base: initial });
			configGetter = () => scope.get();
		});
	}

	// Short session label for titles: last session/title, else id prefix.
	const labelOf = (session) => {
		const label = session ? sessionLabel(session) : "(unknown session)";
		return label.length > 18 ? `${label.slice(0, 18)}…` : label;
	};

	// Per-session cooldown map for tool-error banners.
	const toolErrorLastAt = Object.create(null);

	ctx.on("session/event", (session, event) => {
		try {
			if (!event || typeof event.type !== "string") return;
			const c = cfg();
			if (!c.enabled) return;
			const label = labelOf(session);
			const isSubagent = session?.header?.origin === "subagent";

			switch (event.type) {
				case "turn/end": {
					const kind = event.data?.reason?.kind;
					const reason = turnReasonText(event.data?.reason);
					if (isSubagent) {
						if (c.notifySubagentEnd) banner(`🤖 ${label} · subtask finished`, `Subagent turn ended (${reason})`);
						break;
					}
					if (kind === "completed") {
						if (c.notifyTurnEnd) banner(`✅ ${label} · task finished`, `Reply completed (${reason}).`);
						break;
					}
					if (!c.notifyTurnError) break;
					if (kind === "error") {
						// Real failure — strongest attention: critical popup + sound.
						alert(`❌ ${label} · task failed`, `Execution ended with an error (${reason}).`);
					} else {
						// Interrupted / token cap — informational banner.
						banner(`⏹ ${label} · task interrupted`, `Turn ended early: ${reason}.`);
					}
					break;
				}
				case "approval/asked": {
					if (!c.notifyApproval) break;
					const toolName = event.data?.toolName ?? "(unknown tool)";
					const reason = oneLine(event.data?.reason ?? "no reason provided");
					const policy = approvalPolicyOf(session) ?? "ask";
					if (policy === "never") {
						// Auto-rejected by policy — informational only, no modal disturbance.
						banner(`🚫 ${label} · permission auto-rejected`, `Tool "${toolName}" requested permission (policy "never"): ${truncate(reason)}`);
					} else {
						alert(`🔔 ${label} · approval needed`, `Tool "${toolName}" requests permission: ${truncate(reason)} — please review it in the DSH interface.`);
					}
					break;
				}
				case "tool-workflow/run-end": {
					if (!c.notifyWorkflowEnd) break;
					const stopReason = event.data?.stopReason ?? "finished";
					const runId = typeof event.data?.runId === "string" ? event.data.runId.slice(0, 8) : "";
					banner(`📦 ${label} · workflow finished`, `Workflow ${runId} ended (${stopReason}).`);
					break;
				}
				default:
					break;
			}
		} catch (error) {
			warn(`session/event handler error: ${String(error)}`);
		}
	});

	// Single tool call failed → informational banner, throttled per session.
	ctx.on("tools/result", (exec, result) => {
		try {
			const c = cfg();
			if (!c.enabled || !c.notifyToolError) return;
			if (!result || result.isError !== true) return;
			const toolName = exec && typeof exec.name === "string" ? exec.name : "(unknown tool)";
			if (Array.isArray(c.toolErrorAllowlist) && c.toolErrorAllowlist.length > 0 && !c.toolErrorAllowlist.includes(toolName)) return;
			const session = exec?.agent?.session;
			const sid = session?.header?.id ? String(session.header.id) : "?";
			const now = Date.now();
			if (typeof toolErrorLastAt[sid] === "number" && now - toolErrorLastAt[sid] < c.toolErrorCooldownMs) return;
			toolErrorLastAt[sid] = now;
			const message = result.error && typeof result.error.message === "string" ? result.error.message : "execution failed";
			banner(`⚠ ${labelOf(session)} · tool failed`, `${toolName}: ${truncate(oneLine(message))}`);
		} catch (error) {
			warn(`tools/result handler error: ${String(error)}`);
		}
	});

	// Goal completed → banner; goal blocked → critical popup (needs human attention).
	ctx.on("goal/changed", (payload) => {
		try {
			const c = cfg();
			if (!c.enabled) return;
			const goal = payload?.change?.goal;
			if (!goal || typeof goal.phase !== "string") return;
			const label = labelOf(payload?.agent?.session);
			if (goal.phase === "complete" && c.notifyGoalComplete) {
				banner(`🏁 ${label} · goal completed`, truncate(oneLine(goal.objective)));
			} else if (goal.phase === "blocked" && c.notifyGoalBlocked) {
				const why = goal.blockedReason?.message ?? "the goal is blocked";
				alert(`🛑 ${label} · goal blocked`, truncate(oneLine(why)));
			}
		} catch (error) {
			warn(`goal/changed handler error: ${String(error)}`);
		}
	});
}
