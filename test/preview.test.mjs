/**
 * Ticket 05 client-polish tests.
 *
 * Two client changes, each verified here:
 *   1. In-browser preview tones are self-describing objects (named fields)
 *      instead of positional arrays, so no `tone[N]` index access remains.
 *   2. The deliberately-swallowed failures in card field writes and audio
 *      preview are logged at warn level instead of vanishing, while staying
 *      best-effort (never breaking the card).
 *
 * The tone-data checks are source-level (the bundle is read as text); the warn
 * checks render the card through the same FAITHFUL shims as client-card.test.mjs
 * so setField() and previewSound() actually run.
 *
 * Run: node test/preview.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clientSource = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// --- 1. Preview tones are named objects; no positional index access remains ----
// The positional accessor pattern (tone[N]) must be gone from the bundle.
assert.ok(!/\btone\[\d+\]/.test(clientSource), "client bundle must not use positional tone[N] access");

const previewMatch = clientSource.match(/var PREVIEW = (\{[\s\S]*?\n    \})/);
assert.ok(previewMatch, "client bundle must declare PREVIEW");
const preview = new Function("return " + previewMatch[1] + ";")();

// Each tone is an object with named fields, not a positional array.
for (const tones of Object.values(preview)) {
	for (const tone of tones) {
		assert.equal(typeof tone, "object", "each tone is an object");
		assert.equal(typeof tone.freq, "number", "tone has named field freq");
		assert.equal(typeof tone.offsetSec, "number", "tone has named field offsetSec");
		assert.equal(typeof tone.durSec, "number", "tone has named field durSec");
	}
}
assert.ok("waveType" in preview.error[0], "tone has named field waveType");

// Behaviour is unchanged: the named-object form must decode to the exact old
// positional arrays [freq, offsetSec, durSec, waveType?].
const positionalOf = (tone) => {
	const arr = [tone.freq, tone.offsetSec, tone.durSec];
	if (tone.waveType !== undefined) arr.push(tone.waveType);
	return arr;
};
const expectedPreview = {
	complete: [[880, 0, 0.18], [1318.5, 0.16, 0.28]],
	bell: [[987.77, 0, 0.5]],
	attention: [[659.25, 0, 0.12], [659.25, 0.18, 0.12], [659.25, 0.36, 0.2]],
	message: [[523.25, 0, 0.25]],
	warning: [[440, 0, 0.15, "square"], [440, 0.2, 0.2, "square"]],
	error: [[196, 0, 0.25, "sawtooth"], [147, 0.28, 0.35, "sawtooth"]]
};
for (const preset of Object.keys(expectedPreview)) {
	assert.deepEqual(preview[preset].map(positionalOf), expectedPreview[preset], "preview '" + preset + "' unchanged");
}
console.log("1. preview tones named objects, no positional access, behaviour unchanged: ok");

// --- Faithful runtime shims (mirror client-card.test.mjs) -----------------------
const elements = [];
function createElement(type, props, ...children) {
	const el = { type, props: props ?? {}, children };
	elements.push(el);
	return el;
}
let storeSnapshots = [];
function useSyncExternalStore(subscribe, getSnapshot) {
	// React calls both as plain functions (no receiver).
	storeSnapshots.push(getSnapshot());
	subscribe(() => {});
	return storeSnapshots.at(-1);
}
const React = { createElement, useSyncExternalStore };

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
new Function(clientSource)();
assert.equal(loaded.length, 1, "bundle registered with the module loader");

const plugin = loaded[0].factory((spec) => {
	if (spec === "react") return React;
	throw new Error(`unexpected require("${spec}")`);
});

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
settingsScopeCb({
	settingsScope: { bind: (spec) => { assert.equal(spec.namespace, "desktop-notify"); return scope; } },
	slots: ctx.slots
});
assert.ok(slotEntry, "slot entry registered");

// --- Render the card through loading -> ready -----------------------------------
function renderTree(node) {
	if (node === null || node === undefined) return node;
	if (typeof node.type === "function") return renderTree(node.type(node.props));
	return node;
}

function renderFresh() {
	const start = elements.length;
	const tree = renderTree(slotEntry.render({}));
	return { tree, els: elements.slice(start) };
}

scope.set("enabled", true); // flips to ready with a value
renderFresh();

const checkbox = elements.find((e) => e.type === "input" && e.props.type === "checkbox");
assert.ok(checkbox, "master checkbox present");
const previewButton = [...elements].reverse().find((e) => e.props && e.props.className === "dnd-preview");
assert.ok(previewButton, "preview button present");

// --- 2. Field-write failures log at warn level (best-effort, never break) ------
const origWarn = console.warn;
const warned = [];
console.warn = function () { warned.push(Array.prototype.slice.call(arguments)); };
const origSet = scope.set;
scope.set = function () { throw new Error("fenced write failed"); };
// A failed write must warn, and must NOT throw out of the onChange handler.
assert.doesNotThrow(() => checkbox.props.onChange({ target: { checked: false } }), "onChange must not throw when the write fails");
assert.ok(warned.length >= 1, "a failed field write must log at warn level");
assert.match(warned[0][0], /\[dsh-desktop-notify\] field write failed/);
scope.set = origSet;
console.warn = origWarn;

// --- 3. Audio-preview failures log at warn level (best-effort, never break) ----
const origWarn2 = console.warn;
const warned2 = [];
console.warn = function () { warned2.push(Array.prototype.slice.call(arguments)); };
const origAC = globalThis.window.AudioContext;
globalThis.window.AudioContext = function () { throw new Error("no AudioContext"); };
// A failed preview must warn, and must NOT throw out of the onClick handler.
assert.doesNotThrow(() => previewButton.props.onClick(), "preview must not throw when audio fails");
assert.ok(warned2.length >= 1, "a failed preview must log at warn level");
assert.match(warned2[0][0], /\[dsh-desktop-notify\] preview failed/);
console.warn = origWarn2;
globalThis.window.AudioContext = origAC;

console.log("2. field-write + audio-preview failures warn instead of vanishing: ok");
console.log("\npreview: all assertions passed");
