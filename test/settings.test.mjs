// Functional test for dsh-desktop-notify's settings integration:
// schema defaults, namespace identity, and live config swaps (GUI edits).
// Run: node test/settings.test.mjs
import assert from "node:assert/strict";
import { apply, name, ConfigSchema, SOUND_PRESETS, SETTINGS_NAMESPACE, resolveAppName } from "../lib/index.js";

// ---- 1. schema: defaults complete, union enforced -------------------------
const resolved = ConfigSchema({});
for (const key of ["enabled", "notifyTurnEnd", "notifyTurnError", "notifyApproval", "notifyToolError", "toolErrorAllowlist", "toolErrorCooldownMs", "notifyWorkflowEnd", "notifyGoalComplete", "notifyGoalBlocked", "notifySubagentEnd", "sound", "appName", "soundName", "soundFile"]) {
	assert.ok(key in resolved, `schema default missing: ${key}`);
}
assert.equal(resolved.enabled, true);
assert.equal(resolved.soundName, "complete");
assert.equal(resolved.soundFile, "");
assert.deepEqual(resolved.toolErrorAllowlist, []);
for (const preset of Object.keys(SOUND_PRESETS)) {
	assert.equal(ConfigSchema({ soundName: preset }).soundName, preset);
}
assert.throws(() => ConfigSchema({ soundName: "nope" }));
assert.throws(() => ConfigSchema({ enabled: "yes" }));
console.log("schema defaults + union: ok");

// ---- 1b. empty app name means "use the default" (like soundFile = preset) ---
assert.equal(resolveAppName(""), "DeepSeek Harness", "empty app name falls back to the default");
assert.equal(resolveAppName("   "), "DeepSeek Harness", "whitespace-only app name falls back to the default");
assert.equal(resolveAppName(undefined), "DeepSeek Harness", "absent app name falls back to the default");
assert.equal(resolveAppName("My DSH"), "My DSH", "a real app name passes through untouched");
console.log("app name fallback: ok");

// ---- 2. namespace identity matches the client card key ---------------------
assert.equal(SETTINGS_NAMESPACE, "desktop-notify");
assert.equal(name, "dsh-desktop-notify");
console.log("namespace identity: ok");

// ---- 3. live config swaps through a fake settings service ------------------
// Mimics the @deepseek-ai/dsh-settings `Settings.register` contract:
//   register(ns, schema, { base }) → { get, watch, update, replace }
// resolution = schema(mergeLayers(base, userSection)); writes merge into the
// per-namespace user section and re-resolve (live, no restart).
const mergeLayers = (under, over) => {
	if (over === undefined) return under;
	const isObj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
	if (!isObj(under) || !isObj(over)) return over;
	const merged = { ...under };
	for (const [key, value] of Object.entries(over)) merged[key] = key in merged ? mergeLayers(merged[key], value) : value;
	return merged;
};
const logs = [];
const fakeSettings = { document: {}, lastScope: null };
fakeSettings.register = function (ns, schema, options = {}) {
	assert.equal(ns, "desktop-notify");
	const doc = this.document; // user document section store (closure)
	const registration = { base: options.base };
	const reResolve = () => {
		registration.resolved = Object.freeze(schema(mergeLayers(registration.base, doc[ns])));
	};
	reResolve();
	const scope = {
		get: () => registration.resolved,
		watch: () => () => {},
		update(patch) { doc[ns] = mergeLayers(doc[ns] ?? {}, patch); reResolve(); return Promise.resolve(); },
		replace(section) { doc[ns] = section; reResolve(); return Promise.resolve(); },
	};
	this.lastScope = scope;
	return scope;
};
const fakeCtx = {
	logger: { info: (m) => logs.push(m), warn: (m) => logs.push(`warn: ${m}`) },
	handlers: {},
	on(ev, fn) { this.handlers[ev] = fn; },
	inject(names, cb) { cb({ settings: fakeSettings }); },
};

apply(fakeCtx, {});
assert.ok(fakeSettings.lastScope, "plugin must register its namespace");
const session = { id: "sess-1", header: { id: "sess-1" }, events: [{ type: "session/title", data: { title: "Test Session" } }] };
const fire = (event) => fakeCtx.handlers["session/event"](session, event);
const notifications = () => logs.filter((l) => /dsh-desktop-notify\] (banner|alert):/.test(l));

// master off → silent
fakeSettings.lastScope.update({ enabled: false });
fire({ type: "turn/end", data: { reason: { kind: "completed" } } });
assert.equal(notifications().length, 0, "master switch must silence everything");

// master on, turn end → banner
fakeSettings.lastScope.update({ enabled: true });
fire({ type: "turn/end", data: { reason: { kind: "completed" } } });
assert.equal(notifications().length, 1);
assert.match(notifications()[0], /banner: .*task finished/);

// per-event toggle off → silent again
fakeSettings.lastScope.update({ notifyTurnEnd: false });
fire({ type: "turn/end", data: { reason: { kind: "completed" } } });
assert.equal(notifications().length, 1, "notifyTurnEnd=false must silence turn-end banners");

// approval alert path still fires with master on
fakeSettings.lastScope.update({ notifyTurnEnd: true });
fire({ type: "approval/asked", data: { toolName: "bash", reason: "rm -rf" } });
assert.equal(notifications().length, 2);
assert.match(notifications()[1], /alert: .*approval needed/);

// sound toggle must not throw and must stay silent in the log (spawn only)
fakeSettings.lastScope.update({ notifyTurnError: true, sound: true });
fire({ type: "turn/end", data: { reason: { kind: "error" } } });
assert.equal(notifications().length, 3);

// goal + workflow paths
fakeSettings.lastScope.update({ notifyWorkflowEnd: false, notifyGoalComplete: true });
fakeCtx.handlers["goal/changed"]({ agent: { session }, change: { goal: { phase: "complete", objective: "ship it" } } });
assert.equal(notifications().length, 4);
fakeCtx.handlers["session/event"](session, { type: "tool-workflow/run-end", data: { runId: "abc123", stopReason: "done" } });
assert.equal(notifications().length, 4, "notifyWorkflowEnd=false must silence workflow banners");

// sound preset swap flows through the resolved value
fakeSettings.lastScope.update({ soundName: "bell", soundFile: "" });
assert.equal(fakeSettings.lastScope.get().soundName, "bell");

console.log("live config swaps: ok");
console.log(`\nall checks passed (${notifications().length} notifications observed)`);
