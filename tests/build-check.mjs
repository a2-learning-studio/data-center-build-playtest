// Build reproducibility, the release gate and what GitHub Pages publishes (DE-8, PA-6, ES-3, PA-4, BTC-71). No
// browser: copies of the sources build in a scratch folder under SHOTS_DIR (default: the system temp folder).
// - A CRLF checkout (core.autocrlf=true) builds the same pages, byte for byte and with the same CSP hash, as LF.
// - node build.mjs --strict stops, before it writes anything, while an English narration line has no clip; without
//   --strict the same gap is a warning.
// - _config.yml keeps the sources, tests, package files and CI out of the site: every root entry is either excluded
//   or on the published list below.
// node tests/build-check.mjs
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
// Everything build.mjs reads. If it starts to read another file, the copies stop building until it is listed here.
const SOURCES = ["build.mjs", "game.js", "scene.js", "model.mjs", "strings.mjs", "voice-lines.mjs", "style.css", "sw.js", "educator.html", "social-preview.jpg", "vendor", "voice"];
const BINARY = [".mp3", ".woff2", ".jpg", ".png"];
const copy = (from, to, eol) => {
  if (statSync(from).isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) copy(join(from, name), join(to, name), eol);
  } else if (BINARY.includes(extname(from))) copyFileSync(from, to);
  else writeFileSync(to, readFileSync(from, "utf8").replace(/\r\n?/g, "\n").replace(/\n/g, eol));
};
const base = process.env.SHOTS_DIR || tmpdir();
mkdirSync(base, { recursive: true });
const TMP = mkdtempSync(join(base, "build-check-"));
const tree = (name, eol = "\n") => {
  const dir = join(TMP, name);
  mkdirSync(dir);
  for (const f of SOURCES) copy(join(ROOT, f), join(dir, f), eol);
  return dir;
};
const build = (dir, ...args) => spawnSync(process.execPath, [join(dir, "build.mjs"), ...args], { cwd: dir, encoding: "utf8" });
const tail = (r) => `${r.stderr}${r.stdout}`.trim().split("\n").slice(-2).join(" / ").slice(0, 300);
const result = (name, ok, r) => check(name, ok, ok ? "" : tail(r));
const manifest = (dir, edit) => {
  const file = join(dir, "voice/en/manifest.json");
  const man = JSON.parse(readFileSync(file, "utf8"));
  edit(man, readdirSync(dirname(file)).find((f) => f.endsWith(".mp3")));
  writeFileSync(file, JSON.stringify(man));
};

// ---------- a CRLF checkout builds what an LF one does (DE-8, PA-6) ----------
const lf = tree("lf"), crlf = tree("crlf", "\r\n");
const a = build(lf), b = build(crlf);
result("the LF copy builds", a.status === 0, a);
result("the CRLF copy builds", b.status === 0, b);
const sw = (dir) => readdirSync(dir).filter((f) => f.startsWith("sw-build-the-campus-"));
const outputs = ["index.html", "build-the-campus-offline.html", "index.test.html", "docs/index.html", "docs/build-the-campus-offline.html", "docs/educator.html", ...sw(lf), ...sw(join(lf, "docs")).map((f) => `docs/${f}`)];
const csp = (buf) => buf.toString().match(/script-src '(sha256-[^']+)'/)?.[1] || "no CSP";
for (const f of outputs) {
  const [x, y] = [lf, crlf].map((dir) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f)) : null));
  const same = !!(x && y && x.equals(y));
  check(`${f}: the CRLF copy builds it byte for byte as LF does`, same, same ? "" : !x || !y ? "missing" : `${x.length} vs ${y.length} bytes, ${csp(x)} vs ${csp(y)}`);
}

// ---------- --strict: an English narration line with no clip stops the build (ES-3) ----------
// One copy loses the intro clip; another has a clip for every line, whatever is recorded today.
const gap = tree("gap");
manifest(gap, (man) => delete man.intro);
const s1 = build(gap, "--strict");
result("--strict stops when an English narration line has no clip, and names it", s1.status === 1 && /no matching clip[^\n]*\bintro\b/.test(s1.stderr), s1);
check("--strict writes nothing when it stops", !["index.html", "index.test.html", "docs"].some((f) => existsSync(join(gap, f))));
const s2 = build(gap);
result("without --strict the same gap is a warning and the pages are written", s2.status === 0 && /warning: narration lines with no matching clip[^\n]*\bintro\b/.test(s2.stderr) && existsSync(join(gap, "index.html")), s2);
const full = tree("full");
const { STRINGS } = await import(pathToFileURL(join(full, "strings.mjs")).href);
const { lines, speakable } = await import(pathToFileURL(join(full, "voice-lines.mjs")).href);
manifest(full, (man, file) => {
  for (const [key, text] of Object.entries(lines(STRINGS.en))) if (man[key]?.text !== speakable(text)) man[key] = { file, text: speakable(text) };
});
const s3 = build(full, "--strict");
result("--strict passes once every English narration line has a clip", s3.status === 0 && !/no matching clip/.test(s3.stderr) && existsSync(join(full, "index.html")), s3);

// ---------- what GitHub Pages publishes (PA-4, BTC-71) ----------
// Pages builds the repo root with Jekyll, which skips dot and underscore entries and the _config.yml excludes and
// publishes everything else. A new root file or folder therefore has to be excluded or added to this list.
const PUBLISHED = ["index.html", "build-the-campus-offline.html", "educator.html", "social-preview.jpg", "LICENSE", "LICENSE-CONTENT", "vendor", "voice"];
const cfg = readFileSync(join(ROOT, "_config.yml"), "utf8");
const excluded = new Set([...cfg.matchAll(/^\s+- (\S+?)\/?\s*$/gm)].map((m) => m[1]));
for (const f of ["package.json", "package-lock.json", ".github", "node_modules", "tests", "docs"]) check(`_config.yml keeps ${f} out of the site`, excluded.has(f));
const git = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
if (git.status !== 0) console.log("skip the published root entries (git is not available)");
else {
  const roots = [...new Set(git.stdout.split("\n").filter(Boolean).map((f) => f.split("/")[0]))];
  const published = roots.filter((f) => !/^[._#]|~$/.test(f) && !excluded.has(f));
  const extra = published.filter((f) => !PUBLISHED.includes(f) && !/^sw-build-the-campus-v\d+\.js$/.test(f));
  const withheld = PUBLISHED.filter((f) => !published.includes(f));
  const ok = !extra.length && !withheld.length && published.some((f) => /^sw-build-the-campus-v\d+\.js$/.test(f));
  check("the site publishes exactly the game files at the root", ok, ok ? "" : `published but not listed: ${extra.join(", ") || "none"}; listed but not published: ${withheld.join(", ") || "none"}`);
}

if (failed) {
  console.log(`build-check: ${failed} failed (copies kept in ${TMP})`);
  process.exit(1);
}
rmSync(TMP, { recursive: true, force: true });
console.log("build-check ok");
