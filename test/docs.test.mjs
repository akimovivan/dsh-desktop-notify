// Ticket 06: docs consistency — the README's prose agrees with its commands,
// the client bundle's no-build/ES5 style decision is documented, and the
// host entry's JSDoc config table stays column-aligned and in sync with
// DEFAULTS. Like sound.test.mjs, this reads the shipped files as data.
import { readFileSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const hostSrc = readFileSync(new URL("../lib/index.js", import.meta.url), "utf8");

let failures = 0;
function check(label, ok) {
  console.log((ok ? "ok" : "FAIL") + " — " + label);
  if (!ok) failures += 1;
}

// 1. Installation: the live-edit example must be a real local-directory/link
//    install (pnpm symlinks directories into node_modules), not another
//    github: snapshot spec that would contradict the prose around it.
const install = readme.slice(readme.indexOf("## Installation"), readme.indexOf("## Removal"));
// (space-delimited "add" — this Node build miscompiles repeated \b regex literals)
const addCommands = [...install.matchAll(/dsh plugin[^\n]*? add [^\n]*/g)].map((m) => m[0].trim());
check("installation section shows the github: snapshot install", addCommands.some((c) => c.includes("github:")));
const liveAdds = addCommands.filter((c) => !c.includes("github:"));
check(
  "link-install example is a local-directory or link:/file: spec, not github:",
  liveAdds.length > 0 && liveAdds.every((c) => / add (?:\.|link:|file:|\/)/.test(c)),
);

// 2. The client bundle's style decision is documented in the README so a
//    future contributor does not "fix" the no-build ES5/indent style.
const notes = readme.slice(readme.indexOf("## Notes"));
check(
  "README documents lib/client.js as no-build, ES5-flavoured, with its own indent",
  /lib\/client\.js/.test(notes) && /no build step/i.test(notes) && /ES5/.test(notes),
);

// 3. The JSDoc config table in the host entry: every row's name and type
//    columns end at the same positions (a long default value may push its
//    dash right, so only the two leading columns are asserted).
const rows = hostSrc.split("\n").filter((line) => /^ \*\s{2,}[a-z]\w+\s+\S+\s+default /.test(line));
check("JSDoc config table has one row per documented field", rows.length >= 10);
const parsed = rows.map((raw) => {
  const body = raw.replace(/^ \*\s+/, "");
  const m = /^(\S+)\s+(\S+)\s+default /.exec(body);
  return m ? [m[1], body.indexOf(m[2]), body.indexOf("default")] : null;
});
check("every config row parses as name / type / default", parsed.every((p) => p !== null));
const nameEnds = new Set(parsed.filter(Boolean).map((p) => p[1]));
const typeEnds = new Set(parsed.filter(Boolean).map((p) => p[2]));
check("name column aligned across all config rows", nameEnds.size === 1);
check("type column aligned across all config rows", typeEnds.size === 1);

// The documented rows must cover exactly the live config fields (DEFAULTS keys),
// so the table cannot drift from the schema it documents.
const defaultsBlock = hostSrc.slice(hostSrc.indexOf("const DEFAULTS"), hostSrc.indexOf("};", hostSrc.indexOf("const DEFAULTS")));
const defaultKeys = [...defaultsBlock.matchAll(/^\t(\w+):/gm)].map((m) => m[1]);
const docKeys = parsed.filter(Boolean).map((p) => p[0]);
check(
  "JSDoc table rows match the DEFAULTS keys exactly",
  defaultKeys.length > 0 && defaultKeys.every((k) => docKeys.includes(k)) && docKeys.every((k) => defaultKeys.includes(k)),
);

if (failures > 0) {
  console.error("docs: " + failures + " check(s) failed");
  process.exit(1);
}
console.log("docs: all checks passed");
