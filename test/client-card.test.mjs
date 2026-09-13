/**
 * Client-half test with FAITHFUL runtime shims:
 * - the scope controller is a real class whose methods use `this`
 *   (mirroring SettingsScopeController), and the React shim calls
 *   subscribe/getSnapshot as PLAIN functions — exactly how React does.
 * - window.__ModuleLoader__ / document are minimal browser stand-ins.
 * Proves: the bundle materializes, apply() registers the slot entry,
 * Card renders through loading → ready without throwing, and checkbox
 * changes reach scope.set with the right field/value.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// --- Minimal React shim -------------------------------------------------------
const elements = [];
function createElement(type, props, ...children) {
	const el = { type, props: props ?? {}, children };
	elements.push(el);
	return el;
}
let storeSnapshots = []; // one entry per render
function useSyncExternalStore(subscribe, getSnapshot) {
	// React calls both as plain functions (no receiver).
	storeSnapshots.push(getSnapshot());
	subscribe(() => {});
	return storeSnapshots.at(-1);
}
const React = { createElement, useSyncExternalStore };

// --- Browser stand-ins ---------------------------------------------------------
const loaded = [];
globalThis.window = { __ModuleLoader__: { load: (reg) => loaded.push(reg) } };
globalThis.document = {
	getElementById: () => null,
	createElement: (tag) => ({ tag, id: "", textContent: "", parentNode: null }),
	head: {
		appendChild: (el) => { el.parentNode = globalThis.document.head; },
		removeChild: (el) => { el.parentNode = null; }
	}
};

// --- Scope controller mirror (class methods using `this`) ----------------------
class FakeScopeController {
	constructor() {
		this.store = {
			snapshot: { status: "loading", value: void 0, writable: false },
			listeners: new Set()
		};
	}
	getSnapshot() { return this.store.snapshot; }
	subscribe(listener) {
		this.store.listeners.add(listener);
		return () => this.store.listeners.delete(listener);
	}
	set(field, value) {
		const next = { ...this.store.snapshot, status: "ready", writable: true, value: { ...(this.store.snapshot.value ?? {}), [field]: value } };
		this.store.snapshot = next;
		for (const l of this.store.listeners) l();
	}
}

// --- Materialize the bundle -----------------------------------------------------
const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
new Function(source)(); // executes window.__ModuleLoader__.load(...)
assert.equal(loaded.length, 1, "bundle registered with the module loader");
assert.equal(loaded[0].id, "dsh-desktop-notify");

const plugin = loaded[0].factory((spec) => {
	if (spec === "react") return React;
	throw new Error(`unexpected require("${spec}")`);
});
assert.equal(plugin.name, "dsh-desktop-notify");
assert.deepEqual(plugin.inject, ["slots", "locale"]);

// --- Drive apply() with a fake client ctx ---------------------------------------
const scope = new FakeScopeController();
let settingsScopeCb = null;
let slotEntry = null;
const effects = [];
const ctx = {
	locale: { register: () => () => {}, bind: () => (key) => key }, // identity translator
	inject: (names, cb) => { if (names.includes("settingsScope")) settingsScopeCb = cb; },
	effect: (fn) => effects.push(fn()),
	slots: {
		inject: (slotName, registerFn) => {
			assert.equal(slotName, "settings.plugin.item");
			slotEntry = registerFn();
			return () => {};
		},
		register: (options, render) => ({ options, render })
	}
};

plugin.apply(ctx);
assert.ok(settingsScopeCb, "deferred settingsScope inject registered");
settingsScopeCb({ settingsScope: { bind: (spec) => { assert.equal(spec.namespace, "desktop-notify"); return scope; } }, slots: ctx.slots });
assert.ok(slotEntry, "slot entry registered");
assert.equal(slotEntry.options.name, "settings.plugin.item");
assert.equal(slotEntry.options.key, "desktop-notify");

// --- Render through loading → ready ---------------------------------------------
// React calls component functions during render; emulate that one level deep.
function renderTree(node) {
	if (node === null || node === undefined) return node;
	if (typeof node.type === "function") return renderTree(node.type(node.props));
	return node;
}

let tree = renderTree(slotEntry.render({}));
assert.equal(tree, null, "loading status renders null");

scope.set("enabled", true); // flips to ready with a value
tree = renderTree(slotEntry.render({}));
assert.ok(tree && tree.type === "li" && tree.props.className === "dnd-card", "ready status renders the card");
const texts = elements.flatMap((e) => e.children).filter((c) => typeof c === "string");
assert.ok(texts.includes("title"), "card title rendered via locale key");

// --- Checkbox change reaches scope.set ------------------------------------------
const before = scope.getSnapshot();
const checkbox = elements.find((e) => e.type === "input" && e.props.type === "checkbox");
assert.ok(checkbox, "master checkbox present");
checkbox.props.onChange({ target: { checked: false } });
assert.equal(scope.getSnapshot().value.enabled, false, "onChange wrote field 'enabled' through the scope");
assert.notEqual(scope.getSnapshot(), before, "snapshot advanced");

// --- New text fields (ticket 04): toolErrorAllowlist ----------------------------
// Seed the new fields with realistic values, then re-render fresh.
scope.set("toolErrorAllowlist", ["bash"]);
scope.set("toolErrorCooldownMs", 30000);
scope.set("appName", "DeepSeek Harness");
scope.set("soundFile", "");

function renderFresh() {
	const start = elements.length;
	const tree = renderTree(slotEntry.render({}));
	return { tree, els: elements.slice(start) };
}

/** Pair each dnd-row's label key with its control by walking the rendered tree. */
function rowsOf(tree) {
	const rows = [];
	(function walk(node) {
		if (!node || typeof node !== "object") return;
		if (node.type === "div" && String(node.props.className ?? "").includes("dnd-row")) {
			const labelEl = node.children.find((c) => c && c.type === "span" && c.props?.className === "dnd-label");
			const control = node.children.find((c) => c && (c.type === "input" || c.type === "select"));
			rows.push({ key: labelEl ? labelEl.children.find((c) => typeof c === "string") : null, control });
		}
		for (const child of node.children ?? []) walk(child);
	})(tree);
	return rows;
}

let r = renderFresh();
const freshTexts = r.els.flatMap((e) => e.children).filter((c) => typeof c === "string");
assert.ok(freshTexts.includes("advancedTitle"), "Advanced group title rendered via locale key");

const allowRow = rowsOf(r.tree).find((row) => row.key === "toolErrorAllowlist");
assert.ok(allowRow, "toolErrorAllowlist field row rendered");
assert.equal(allowRow.control.type, "input", "allowlist is a text input");
assert.equal(allowRow.control.props.type, "text");
assert.equal(allowRow.control.props.defaultValue, "bash", "input shows the current allowlist");
allowRow.control.props.onChange({ target: { value: "bash, web_search" } });
assert.deepEqual(scope.getSnapshot().value.toolErrorAllowlist, ["bash", "web_search"], "comma-separated edit wrote a string array through the scope");

// --- New text fields (ticket 04): cooldown, appName, soundFile ------------------
r = renderFresh();
const rows = rowsOf(r.tree);

const coolRow = rows.find((row) => row.key === "toolErrorCooldownMs");
assert.ok(coolRow, "toolErrorCooldownMs field row rendered");
assert.equal(coolRow.control.props.defaultValue, "30000", "cooldown input shows the current value");
coolRow.control.props.onChange({ target: { value: "abc" } });
assert.equal(scope.getSnapshot().value.toolErrorCooldownMs, 30000, "non-numeric text must not write");
coolRow.control.props.onChange({ target: { value: "" } });
assert.equal(scope.getSnapshot().value.toolErrorCooldownMs, 30000, "empty text must not write");
coolRow.control.props.onChange({ target: { value: "-5" } });
assert.equal(scope.getSnapshot().value.toolErrorCooldownMs, 30000, "negative cooldown must not write");
coolRow.control.props.onChange({ target: { value: "45000" } });
const cool = scope.getSnapshot().value.toolErrorCooldownMs;
assert.equal(cool, 45000, "numeric edit wrote milliseconds through the scope");
assert.equal(typeof cool, "number", "cooldown is stored as a number");

const appRow = rows.find((row) => row.key === "appName");
assert.ok(appRow, "appName field row rendered");
assert.equal(appRow.control.props.defaultValue, "DeepSeek Harness", "app name input shows the current value");
appRow.control.props.onChange({ target: { value: "My DSH" } });
assert.equal(scope.getSnapshot().value.appName, "My DSH", "app name edit wrote through the scope");

const fileRow = rows.find((row) => row.key === "soundFile");
assert.ok(fileRow, "soundFile field row rendered in the Sound group");
assert.equal(fileRow.control.props.defaultValue, "", "custom sound input starts empty");
fileRow.control.props.onChange({ target: { value: "/tmp/beep.oga" } });
assert.equal(scope.getSnapshot().value.soundFile, "/tmp/beep.oga", "custom sound file edit wrote through the scope");

const pickRow = rows.find((row) => row.key === "soundName");
assert.ok(pickRow, "soundName picker row rendered in the Sound group");
assert.equal(pickRow.control.type, "select", "soundName is a select control");
pickRow.control.props.onChange({ target: { value: "bell" } });
assert.equal(scope.getSnapshot().value.soundName, "bell", "preset picker wrote through the scope");

// en/zh dictionaries must label every new field in both locales (source-level sync check)
for (const dict of ["DICT_EN", "DICT_ZH"]) {
	const blockMatch = source.match(new RegExp("var " + dict + " = \\{([\\s\\S]*?)\\n    \\}"));
	assert.ok(blockMatch, "client bundle must declare " + dict);
	for (const key of ["advancedTitle", "toolErrorAllowlist", "toolErrorCooldownMs", "appName", "soundFile"]) {
		assert.ok(blockMatch[1].includes(key + ":"), dict + " must label '" + key + "'");
	}
}

// --- Every README-documented field is reachable from the card -------------------
function controlsOf(tree) {
	const out = [];
	(function walk(node) {
		if (!node || typeof node !== "object") return;
		if (node.type === "input" || node.type === "select") out.push(node);
		for (const child of node.children ?? []) walk(child);
	})(tree);
	return out;
}
// Parse the documented fields straight out of the README's YAML block so this
// coverage check stays in sync with the spec instead of a copy of it.
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const yamlBlock = readme.match(/```yaml\n([\s\S]*?)```/);
assert.ok(yamlBlock, "README documents the config block as YAML");
const docFields = [...yamlBlock[1].matchAll(/^\s{4}([A-Za-z_]\w*):/gm)].map((m) => m[1]);
r = renderFresh();
assert.equal(controlsOf(r.tree).length, docFields.length, "one card control per README-documented field");

// Every checkbox is wired to its field: seed false, re-render, flip it on.
const CHECKBOX_FIELDS = ["enabled", "notifyTurnEnd", "notifyTurnError", "notifyApproval", "notifyToolError", "notifyWorkflowEnd", "notifyGoalComplete", "notifyGoalBlocked", "notifySubagentEnd", "sound"];
for (let i = 0; i < CHECKBOX_FIELDS.length; i += 1) {
	const field = CHECKBOX_FIELDS[i];
	scope.set(field, false);
	r = renderFresh();
	const boxes = controlsOf(r.tree).filter((c) => c.type === "input" && c.props.type === "checkbox");
	assert.equal(boxes.length, CHECKBOX_FIELDS.length, "ten checkboxes on the card");
	assert.equal(boxes[i].props.checked, false, field + " checkbox reflects its seeded value");
	boxes[i].props.onChange({ target: { checked: true } });
	assert.equal(scope.getSnapshot().value[field], true, field + " checkbox wrote through the scope");
}

// --- Teardown effects dispose cleanly -------------------------------------------
for (const d of effects) if (typeof d === "function") d();
console.log("client-card: all assertions passed");
