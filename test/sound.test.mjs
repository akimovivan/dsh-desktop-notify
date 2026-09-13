/**
 * Sound-path and preset-sync tests for dsh-desktop-notify (ticket 02).
 * Proves the documented sound behaviour without playing real audio:
 *   1. all six preset-to-file mappings match the README table on linux + darwin
 *   2. a non-empty custom soundFile wins over the preset; empty/whitespace falls back
 *   3. player fallbacks fire when the primary player fails to spawn
 *      (linux: pw-play -> paplay, darwin: afplay -> osascript beep) — stubbed spawns
 *   4. the client bundle's PRESETS list stays in sync with host SOUND_PRESETS
 * Run: node test/sound.test.mjs
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolveSoundFile, createNotifier, SOUND_PRESETS } from "../lib/index.js";

// Platform override (same pattern as host-registration.test.mjs): applied per
// assertion group, restored in the finally block so it cannot leak.
const REAL_PLATFORM = process.platform;
function onPlatform(platform) {
	Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

/** One macrotask tick — lets stubbed spawn error handlers run. */
const tick = () => new Promise((resolve) => setImmediate(resolve));

// A backticked cell in the README table, e.g. `complete` or `stereo/bell.oga`.
const CELL = new RegExp('`([^`]+)`');

try {
	// ---- 1. preset-to-file mapping asserted against the README table -------
	const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
	const section = readme.split("### Sound presets")[1].split("\n## ")[0];
	const tableLines = section.split(/\r?\n/).filter((line) => line.startsWith("|"));
	assert.ok(tableLines.length >= 3, "README sound preset table not found");
	const rows = [];
	for (const line of tableLines.slice(2)) { // skip header + separator rows
		const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
		const name = CELL.exec(cells[0]);
		const linux = CELL.exec(cells[1]);
		const mac = CELL.exec(cells[2]);
		if (name && linux && mac) rows.push({ name: name[1], linux: linux[1], mac: mac[1] });
	}
	assert.equal(rows.length, 6, "README sound preset table must have six data rows");
	assert.deepEqual(
		rows.map((row) => row.name).sort(),
		Object.keys(SOUND_PRESETS).sort(),
		"README preset names drift from host SOUND_PRESETS",
	);
	for (const row of rows) {
		const opts = { soundName: row.name, soundFile: "" };
		onPlatform("linux");
		assert.equal(resolveSoundFile(opts), "/usr/share/sounds/freedesktop/" + row.linux, "linux mapping for " + row.name + " must match the README table");
		onPlatform("darwin");
		assert.equal(resolveSoundFile(opts), "/System/Library/Sounds/" + row.mac, "macOS mapping for " + row.name + " must match the README table");
	}
	console.log("1. preset-to-file mapping (README table, linux + darwin): ok");

	// ---- 2. custom soundFile precedence; empty value falls back ------------
	onPlatform("linux");
	assert.equal(resolveSoundFile({ soundName: "complete", soundFile: "/tmp/custom.ogg" }), "/tmp/custom.ogg", "non-empty custom file must win on linux");
	onPlatform("darwin");
	assert.equal(resolveSoundFile({ soundName: "error", soundFile: "/tmp/custom.wav" }), "/tmp/custom.wav", "non-empty custom file must win on darwin");
	onPlatform("linux");
	assert.equal(resolveSoundFile({ soundName: "bell", soundFile: "" }), SOUND_PRESETS.bell.linux, "empty soundFile must fall back to the preset (linux)");
	assert.equal(resolveSoundFile({ soundName: "bell", soundFile: "   " }), SOUND_PRESETS.bell.linux, "whitespace-only soundFile must fall back to the preset");
	onPlatform("darwin");
	assert.equal(resolveSoundFile({ soundName: "bell", soundFile: "" }), "/System/Library/Sounds/" + SOUND_PRESETS.bell.mac, "empty soundFile must fall back to the preset (darwin)");
	onPlatform("linux");
	assert.equal(resolveSoundFile({ soundName: "nope", soundFile: "" }), SOUND_PRESETS.complete.linux, "unknown preset name must fall back to complete");
	console.log("2. custom file precedence + empty/whitespace fallback: ok");

	// ---- 3. player fallbacks with stubbed spawns (no real audio) -----------
	/** Stub spawn: records every call; listed commands fail to spawn (ENOENT). */
	function makeSpawn(calls, failing) {
		return (command, args) => {
			calls.push({ command: command, args: args });
			const child = new EventEmitter();
			child.unref = () => {};
			if (failing.has(command)) {
				setImmediate(() => {
					const error = new Error("spawn " + command + " ENOENT");
					error.code = "ENOENT";
					child.emit("error", error);
				});
			}
			return child;
		};
	}
	function makeNotifier(failing) {
		const calls = [];
		const ctx = { logger: { info: () => {}, warn: () => {} } };
		const config = { appName: "Test App", sound: true, soundName: "complete", soundFile: "" };
		const notifier = createNotifier(ctx, () => config, { spawn: makeSpawn(calls, failing) });
		return { notifier: notifier, calls: calls, config: config };
	}

	onPlatform("linux");
	{
		// primary player fails to spawn -> paplay fallback with the same file
		const env = makeNotifier(new Set(["pw-play"]));
		const file = resolveSoundFile(env.config);
		assert.equal(file, SOUND_PRESETS.complete.linux);
		env.notifier.alert("❌ boom", "task failed");
		assert.deepEqual(env.calls.map((call) => call.command), ["notify-send", "pw-play"], "alert must spawn notify-send critical then pw-play");
		assert.deepEqual(env.calls[0].args, ["-a", env.config.appName, "-u", "critical", "❌ boom", "task failed"]);
		assert.deepEqual(env.calls[1].args, [file], "pw-play must receive the resolved sound file");
		await tick();
		assert.deepEqual(env.calls.map((call) => call.command), ["notify-send", "pw-play", "paplay"], "paplay fallback must fire when pw-play fails to spawn");
		assert.deepEqual(env.calls[2].args, [file], "paplay fallback must receive the same file");
	}
	{
		// primary player spawns fine -> no fallback
		const env = makeNotifier(new Set());
		env.notifier.alert("❌ boom", "task failed");
		await tick();
		assert.deepEqual(env.calls.map((call) => call.command), ["notify-send", "pw-play"], "no paplay fallback when pw-play spawns fine");
	}
	{
		// custom soundFile wins end-to-end through the alert playback path
		const env = makeNotifier(new Set(["pw-play"]));
		env.config.soundFile = "/tmp/custom.ogg";
		env.notifier.alert("❌ boom", "task failed");
		await tick();
		assert.deepEqual(env.calls[1].args, ["/tmp/custom.ogg"], "custom soundFile must win over the preset in playback");
		assert.deepEqual(env.calls[2].args, ["/tmp/custom.ogg"], "fallback must play the custom file too");
	}
	{
		// banners never play sounds
		const env = makeNotifier(new Set());
		env.notifier.banner("✅ done", "task finished");
		await tick();
		assert.deepEqual(env.calls.map((call) => call.command), ["notify-send"], "banners must not play sounds (linux)");
		assert.ok(!env.calls[0].args.includes("-u"), "banners must not be critical");
	}

	onPlatform("darwin");
	{
		// primary player fails to spawn -> osascript beep fallback
		const env = makeNotifier(new Set(["afplay"]));
		const file = resolveSoundFile(env.config);
		assert.equal(file, "/System/Library/Sounds/" + SOUND_PRESETS.complete.mac);
		env.notifier.alert("🔔 approval", "needed");
		assert.deepEqual(env.calls.map((call) => call.command), ["osascript", "afplay"], "alert must spawn osascript display alert then afplay");
		assert.match(env.calls[0].args.join(" "), /display alert/);
		assert.deepEqual(env.calls[1].args, [file], "afplay must receive the resolved sound file");
		await tick();
		assert.deepEqual(env.calls.map((call) => call.command), ["osascript", "afplay", "osascript"], "beep fallback must fire when afplay fails to spawn");
		assert.deepEqual(env.calls[2].args, ["-e", "beep"], "fallback must be osascript beep");
	}
	{
		// primary player spawns fine -> no beep fallback
		const env = makeNotifier(new Set());
		env.notifier.alert("🔔 approval", "needed");
		await tick();
		assert.deepEqual(env.calls.map((call) => call.command), ["osascript", "afplay"], "no beep fallback when afplay spawns fine");
	}
	{
		// banners never play sounds
		const env = makeNotifier(new Set());
		env.notifier.banner("✅ done", "task finished");
		await tick();
		assert.deepEqual(env.calls.map((call) => call.command), ["osascript"], "banners must not play sounds (darwin)");
		assert.match(env.calls[0].args.join(" "), /display notification/);
	}
	console.log("3. player fallbacks (stubbed spawns, linux + darwin): ok");

	// ---- 4. client bundle PRESETS list stays in sync with the host ---------
	const clientSource = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
	const presetsMatch = clientSource.match(/var PRESETS = \[([^\]]*)\]/);
	assert.ok(presetsMatch, "client bundle must declare a PRESETS list");
	const clientPresets = [...presetsMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
	assert.equal(clientPresets.length, 6, "client PRESETS must list six presets");
	assert.deepEqual(
		clientPresets.slice().sort(),
		Object.keys(SOUND_PRESETS).sort(),
		"client bundle PRESETS drift from host SOUND_PRESETS keys",
	);
	// the picker renders t('sounds_<preset>') in both locales — every preset needs a label
	for (const dict of ["DICT_EN", "DICT_ZH"]) {
		const blockMatch = clientSource.match(new RegExp("var " + dict + " = \\{([\\s\\S]*?)\\n    \\}"));
		assert.ok(blockMatch, "client bundle must declare " + dict);
		for (const preset of clientPresets) {
			assert.ok(blockMatch[1].includes("sounds_" + preset + ":"), dict + " must label preset '" + preset + "'");
		}
	}
	console.log("4. client bundle PRESETS in sync with host SOUND_PRESETS: ok");

	console.log("\nsound: all assertions passed");
} finally {
	onPlatform(REAL_PLATFORM);
}
