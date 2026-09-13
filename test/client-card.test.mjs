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

// --- Teardown effects dispose cleanly -------------------------------------------
for (const d of effects) if (typeof d === "function") d();
console.log("client-card: all assertions passed");
