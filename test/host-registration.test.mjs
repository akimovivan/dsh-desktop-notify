/**
 * End-to-end host-side test against the REAL @deepseek-ai/cordis service and
 * the REAL @deepseek-ai/dsh-settings service (not fakes): proves that apply()
 * registers the "desktop-notify" namespace, that resolution layers schema
 * defaults ← row config ← user document, and that a simulated GUI write
 * (settings.update) flows back into the event handlers through the scope
 * getter — i.e. live editing without restart.
 *
 * Host modules are resolved from an installed DSH, so this test runs on any
 * machine with DSH installed (no hardcoded paths). Resolution order:
 *   1. $DSH_DESKTOP_NOTIFY_DSH — explicit override: any file or directory
 *      inside the installed @deepseek-ai/dsh package.
 *   2. The global npm install: `npm root -g` → @deepseek-ai/dsh.
 *   3. The `dsh` binary on PATH (realpath, walk up to the package root).
 *
 * The settings service is taken from DSH's own node_modules — the copy the
 * running host actually serves plugins; if that is missing it falls back to a
 * profile install under $DSH_HOME/profiles.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

/** Walk up from a file or directory to the @deepseek-ai/dsh package root. */
function dshPackageRoot(start) {
	let dir;
	try {
		const real = realpathSync(start);
		dir = statSync(real).isDirectory() ? real : path.dirname(real);
	} catch {
		return null;
	}
	for (let i = 0; i < 16; i += 1) {
		const pkgPath = path.join(dir, "package.json");
		if (existsSync(pkgPath)) {
			try {
				if (JSON.parse(readFileSync(pkgPath, "utf8")).name === "@deepseek-ai/dsh") return dir;
			} catch { /* unreadable package.json — keep walking */ }
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

/** Resolve the installed @deepseek-ai/dsh package root (see file header). */
function resolveDshRoot() {
	const tried = [];
	const candidates = [];
	if (process.env.DSH_DESKTOP_NOTIFY_DSH) {
		tried.push("`$DSH_DESKTOP_NOTIFY_DSH=" + process.env.DSH_DESKTOP_NOTIFY_DSH + "`");
		candidates.push(process.env.DSH_DESKTOP_NOTIFY_DSH);
	}
	try {
		const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
		tried.push("`npm root -g` → " + path.join(globalRoot, "@deepseek-ai/dsh"));
		candidates.push(path.join(globalRoot, "@deepseek-ai", "dsh"));
	} catch {
		tried.push("`npm root -g` (no npm on PATH)");
	}
	for (const which of ["which", "where"]) {
		try {
			const bin = execFileSync(which, ["dsh"], { encoding: "utf8" }).trim().split(/\r?\n/)[0];
			if (!bin) continue;
			tried.push("`" + which + " dsh` → " + bin);
			candidates.push(bin);
			break;
		} catch { /* not found with this tool */ }
	}
	for (const candidate of candidates) {
		const root = dshPackageRoot(candidate);
		if (root) return root;
	}
	throw new Error(
		"Cannot find an installed @deepseek-ai/dsh package. Tried:\n  - " + tried.join("\n  - ") +
		"\nInstall DSH globally (npm i -g @deepseek-ai/dsh) or point the test at it:\n"
		+ "  DSH_DESKTOP_NOTIFY_DSH=/path/to/@deepseek-ai/dsh",
	);
}

const DSH_ROOT = resolveDshRoot();

/** Resolve a module entry inside the installed DSH (or, for settings, a profile). */
function resolveHostModule(packageName, label) {
	const rel = path.join("node_modules", "@deepseek-ai", packageName, "lib", "index.js");
	const candidates = [path.join(DSH_ROOT, rel)];
	if (packageName === "dsh-settings" && process.env.DSH_HOME) {
		const profilesDir = path.join(process.env.DSH_HOME, "profiles");
		try {
			for (const profile of readdirSync(profilesDir)) {
				candidates.push(path.join(profilesDir, profile, rel));
			}
		} catch { /* no profiles directory */ }
	}
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	throw new Error(
		"Cannot find the @deepseek-ai/" + packageName + " module (" + label + "). Tried:\n  - "
		+ candidates.join("\n  - ") + "\nSet DSH_DESKTOP_NOTIFY_DSH to a working @deepseek-ai/dsh install.",
	);
}

const CORDIS_PATH = resolveHostModule("cordis", "the cordis service");
const SETTINGS_PATH = resolveHostModule("dsh-settings", "the settings service");

const { Service } = await import(CORDIS_PATH);
const settingsModule = await import(SETTINGS_PATH);
// The class was renamed Settings → SettingsProvider across dsh-settings releases.
const Settings = settingsModule.Settings ?? settingsModule.default;

/** In-memory stand-in for the file provider (same abstract contract). */
class FakeSettings extends Settings {
	#doc = {};
	constructor(ctx) { super(ctx); }
	get writable() { return true; }
	async load() { return this.#doc; }
	persist(ns, section) { if (section === void 0) delete this.#doc[ns]; else this.#doc[ns] = section; }
}

/** One isolated boot: fresh service + fresh plugin ctx, apply(config). */
async function boot(rowConfig) {
	const disposes = [];
	const serviceCtx = {
		reflect: { provide() {} },
		logger: { warn() {} },
		events: { dispatch() { return []; } },
		effect(fn, _label) { const d = fn(); if (typeof d === "function") disposes.push(d); }
	};
	const settings = new FakeSettings(serviceCtx);
	const gen = settings[Service.init]();
	await gen.next(); // yields the write-drain teardown
	await gen.next(); // publish(await load())

	const logs = [];
	const handlers = new Map();
	let injected = false;
	const pluginCtx = {
		logger: { info: (m) => logs.push(m), warn: (m) => logs.push(`WARN ${m}`) },
		inject(_names, cb) { injected = true; cb({ settings }); },
		on(type, fn) { handlers.set(type, fn); },
		effect(fn) { const d = fn(); if (typeof d === "function") disposes.push(d); }
	};

	const { apply } = await import("../lib/index.js");
	apply(pluginCtx, rowConfig);

	return { settings, logs, handlers, injected };
}

const dn = (settings) => settings.describe().find((d) => d.ns === "desktop-notify");
const turnEnd = (handler, session) => handler(session ?? { id: "sess-12345678-abcd" }, { type: "turn/end", data: { reason: { kind: "completed" } } });

// Never spawn real desktop notification processes during this test: pretend to
// be on Windows, where lib/index.js only logs. The override is applied after
// module resolution (which inspects the real platform) and restored in the
// finally block below, so it cannot leak into any other test in this process.
const REAL_PLATFORM = process.platform;
Object.defineProperty(process, "platform", { value: "win32", configurable: true });

try {
	// 1. Boot with no row config: namespace is served, schema defaults resolve.
	{
		const { settings, injected } = await boot({});
		assert.ok(injected, "settings inject callback ran");
		const d = dn(settings);
		assert.ok(d, `namespace registered (served: ${JSON.stringify(settings.describe().map((x) => x.ns))})`);
		assert.equal(d.value.enabled, true);
		assert.equal(d.value.soundName, "complete");
		assert.equal(d.value.toolErrorCooldownMs, 60000);
		console.log("ok 1 — namespace served with schema defaults");
	}

	// 2. Boot with the cordis.patch.yml row config: base layer wins over defaults.
	{
		const { settings } = await boot({ enabled: true, soundName: "bell", notifySubagentEnd: false });
		const d = dn(settings);
		assert.equal(d.value.soundName, "bell");
		assert.equal(d.value.notifySubagentEnd, false);
		assert.ok(d.base && d.base.soundName === "bell", "base layer exposed in describe");
		console.log("ok 2 — row config base layer applied");
	}

	// 3. A GUI write (settings.update) re-resolves and reaches the handlers live.
	{
		const { settings, logs, handlers } = await boot({});
		const onEvent = handlers.get("session/event");
		assert.ok(onEvent, "session/event handler registered");

		await settings.update("desktop-notify", { soundName: "bell" });
		assert.equal(settings.get("desktop-notify").soundName, "bell");

		turnEnd(onEvent);
		assert.ok(logs.some((l) => l.includes("banner:") && l.includes("task finished")), "turn-end banner fired with live config");

		// Master switch off — no restart, handlers re-read fresh.
		await settings.update("desktop-notify", { enabled: false });
		logs.length = 0;
		turnEnd(onEvent);
		assert.ok(!logs.some((l) => l.includes("banner:")), "master off suppresses banners");

		// Per-event toggle: master back on, notifyTurnEnd off.
		await settings.update("desktop-notify", { enabled: true, notifyTurnEnd: false });
		logs.length = 0;
		turnEnd(onEvent);
		assert.ok(!logs.some((l) => l.includes("banner:")), "per-event off suppresses banners");

		// Approval popup path with live sound toggle.
		await settings.update("desktop-notify", { notifyApproval: true });
		logs.length = 0;
		onEvent({ id: "sess-12345678-abcd" }, { type: "approval/asked", data: { toolName: "bash", reason: "needs approval" } });
		assert.ok(logs.some((l) => l.includes("alert:") && l.includes("approval needed")), "approval alert fired");

		console.log("ok 3 — live writes reach handlers without restart");
	}

	console.log("host-registration: all assertions passed");
} finally {
	Object.defineProperty(process, "platform", { value: REAL_PLATFORM, configurable: true });
}
