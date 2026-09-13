/**
 * End-to-end host-side test against the REAL @deepseek-ai/dsh-settings service
 * (not a fake): proves that apply() registers the "desktop-notify" namespace,
 * that resolution layers schema defaults ← row config ← user document, and
 * that a simulated GUI write (settings.update) flows back into the event
 * handlers through the scope getter — i.e. live editing without restart.
 */
import assert from "node:assert/strict";

// Never spawn real desktop notification processes during the test.
Object.defineProperty(process, "platform", { value: "win32" });

const CORDIS_PATH = "/home/uvaw/.nvm/versions/node/v24.14.0/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/cordis/lib/index.js";
const SETTINGS_PATH = "/home/uvaw/.dsh/profiles/web/node_modules/@deepseek-ai/dsh-settings/lib/index.js";

const { Service } = await import(CORDIS_PATH);
const { Settings } = await import(SETTINGS_PATH);

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
