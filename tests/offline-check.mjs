// Offline checks (critic, FE-4, PA-7, SA-2, BTC-80). The offline kiosk file opens from file://, starts, and plays its
// narration from the clips inside it, with no request and no console error. The web page, served here on 127.0.0.1,
// has its service worker keep the page once and every clip; reload offline with narration; carry unchanged clips over
// to a new build; take that build in a tab first opened before any worker existed (at Start over, not mid-game); not
// reload a tab already on the new build; and never serve a saved page or clip that another page swapped. It keeps the
// clips a first visit loaded before its worker took control, and opens the saved page when the host answers with an
// error or does not answer, but never gives up on the network while nothing is saved (review).
// node tests/offline-check.mjs   (see drive.mjs for the browser and paths)
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, watch } from "./drive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const browser = await launch();
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
// Every play() the page asks for, with the start of its source and whether it played.
const hookPlay = () => {
  window.__plays = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const rec = { src: String(this.src).slice(0, 16), ok: null };
    window.__plays.push(rec);
    const r = play.call(this);
    r?.then(() => { rec.ok = true; }, () => { rec.ok = false; });
    return r;
  };
};
// Polls from here: page.waitForFunction takes a returned promise as a true value.
const until = async (fn, ms = 60000) => {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await new Promise((r) => setTimeout(r, 250))) if (await fn()) return true;
  return false;
};
const played = (p, prefix, n = 1) => p.waitForFunction(({ prefix, n }) => window.__plays.filter((x) => x.ok && x.src.startsWith(prefix)).length >= n, { prefix, n }, { timeout: 45000 }).then(() => true, () => false);

// ---------- the offline kiosk file ----------
{
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addInitScript(hookPlay);
  const p = await ctx.newPage();
  watch(p, errors);
  const net = [];
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  await p.goto(pathToFileURL(join(ROOT, "build-the-campus-offline.html")).href, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(400);
  const intro = await p.evaluate(() => ({ intro: document.querySelector("[data-intro]").open, note: !!document.querySelector("[data-nojs]"), offline: !!document.querySelector('[data-t="kioskNoteOffline"]') }));
  check("the kiosk file opens on its intro, with its own About note and no 'cannot run' note", intro.intro && !intro.note && intro.offline, JSON.stringify(intro));
  await p.locator("[data-start]").focus();
  await p.keyboard.press("Enter");
  const first = await played(p, "data:audio/mpeg");
  // A second narrated step: the cooling question, then zoning.
  await p.locator('[data-el="zoning"]').click();
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.querySelector("[data-card]").open)) await p.keyboard.press("1");
  const second = await played(p, "data:audio/mpeg", 2);
  const plays = await p.evaluate(() => window.__plays);
  check("the kiosk file plays two narrated steps from the clips inside it (data: URLs)", first && second, JSON.stringify(plays));
  check("the kiosk file makes no network request", net.length === 0, net.join(" "));
  check("the kiosk file logs no console error or CSP violation", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ---------- the web page and its service worker, served on 127.0.0.1 ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mp3": "audio/mpeg", ".json": "application/json", ".jpg": "image/jpeg", ".txt": "text/plain; charset=utf-8" };
const served = [];
const override = new Map();
let down = false;
// held: worker scripts wait here until released (a slow network on a first visit). stalled: the game page is never
// answered (a stalled connection). slow: the game page is answered this many ms late.
let holdSw = false, stall = false, slow = 0;
const held = [], stalled = [];
const server = createServer((req, res) => {
  // Offline: the connection drops, as with no network.
  if (down) { req.socket.destroy(); return; }
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  served.push(req.url);
  const name = path === "/" ? "/index.html" : path;
  if (holdSw && name.startsWith("/sw-")) { held.push(() => serve(name, res)); return; }
  if (stall && name === "/index.html") { stalled.push(res); return; }
  if (slow && name === "/index.html") { setTimeout(() => serve(name, res), slow); return; }
  serve(name, res);
});
function serve(name, res) {
  if (override.has(name)) {
    const body = override.get(name);
    if (body === null) { res.writeHead(404); res.end(); return; }
    if (typeof body === "number") { res.writeHead(body); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[extname(name)] || "application/octet-stream" });
    res.end(body);
    return;
  }
  const file = normalize(join(ROOT, name));
  if (!file.startsWith(ROOT + sep) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
}
await new Promise((r) => server.listen(0, "127.0.0.1", r));
// Class mode, so no idle reset starts a game over while the checks wait.
const SITE = `http://127.0.0.1:${server.address().port}/`;
const BASE = `${SITE}?mode=class`;

// This build's cache name (build-the-campus-vN), and the next one, for the update.
const NOW = readFileSync(join(ROOT, "sw.js"), "utf8").match(/const CACHE = "([^"]+)"/)[1];
const NEXT = NOW.replace(/\d+$/, (n) => String(Number(n) + 1));
const swNow = readFileSync(join(ROOT, `sw-${NOW}.js`), "utf8");
const DIGESTS = JSON.parse(swNow.match(/const DIGESTS = (\{.*\});/)[1]);
const CLIPS = Object.keys(DIGESTS).filter((k) => k.startsWith("voice/"));
const CLIP = CLIPS.find((k) => k.includes("phase-site"));
const cacheState = (p) => p.evaluate(async () => {
  const out = {};
  for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname.slice(1) + new URL(r.url).search);
  return out;
});
const summary = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, { clips: v.filter((x) => x.startsWith("voice/")).length, other: v.filter((x) => !x.startsWith("voice/")) }]));
const navCount = (p) => {
  const n = { count: 0 };
  p.on("framenavigated", (f) => { if (f === p.mainFrame()) n.count += 1; });
  return n;
};
// Privacy (critic): every clip is asked for in one fixed batch, so the host never learns which answer was picked. A clip
// that failed in the batch used to be fetched on its own when its line came up, seconds after the answer it narrates.
// Now it is asked for again with the next narration, whatever that is. No worker here, as in the critic's run.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
  const p = await ctx.newPage();
  let aborted = 0;
  await p.route("**/opt-longlead-b.mp3*", (route) => (aborted++ ? route.continue() : route.abort()));
  const asked = () => served.filter((u) => u.includes("opt-longlead-b")).length;
  await p.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.locator("[data-start]").click();
  await until(() => served.filter((u) => u.includes("/voice/")).length >= CLIPS.length - 1, 30000);
  const batch = asked();
  await p.locator('[data-el="zoning"]').click();
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.querySelector("[data-card]").open)) await p.keyboard.press("1");
  await until(() => asked() > batch, 5000);
  const atZoning = asked();
  await p.locator('[data-el="capacity"]').click();
  await p.waitForTimeout(500);
  await p.keyboard.press("2");
  await p.waitForTimeout(1500);
  const answered = await p.evaluate(() => document.querySelector("[data-card]").open ? "" : "b");
  const atAnswer = asked();
  check("a clip that failed is asked for again with the next narration, not when its own answer is picked", aborted >= 1 && batch === 0 && atZoning === 1 && answered === "b" && atAnswer === 1, JSON.stringify({ aborted, batch, atZoning, answered, atAnswer }));
  await ctx.close();
}

// A first visit on a slow network (review): narration starts before the worker controls the page, so its clips went
// past the worker and none was kept. Once the worker takes control, the page asks for them again through it.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(hookPlay);
  const p = await ctx.newPage();
  const clips = () => served.filter((u) => u.includes("/voice/")).length;
  const v0 = clips();
  holdSw = true;
  // A kiosk, so the reload below starts a new game (class mode would offer to resume this one).
  await p.goto(SITE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.locator("[data-start]").click();
  await until(() => clips() - v0 >= CLIPS.length, 60000);
  const early = await p.evaluate(() => !navigator.serviceWorker.controller);
  holdSw = false;
  for (const go of held.splice(0)) go();
  const ctl = await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 }).then(() => true, () => false);
  await until(async () => summary(await cacheState(p))[NOW]?.clips >= CLIPS.length, 60000);
  const kept = summary(await cacheState(p))[NOW]?.clips || 0;
  down = true;
  await p.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await p.locator("[data-start]").click();
  const offline = await played(p, "blob:");
  down = false;
  check("slow first visit: clips loaded before the worker took control are kept, and play offline", early && ctl && kept === CLIPS.length && offline, JSON.stringify({ early, ctl, kept, of: CLIPS.length, offline }));
  await ctx.close();
}

const problems = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(hookPlay);
// Each change of worker a page sees, for the report when a hand-off check fails.
await ctx.addInitScript(() => {
  window.__ctlLog = [];
  navigator.serviceWorker?.addEventListener("controllerchange", () => window.__ctlLog.push((navigator.serviceWorker.controller?.scriptURL || "none").replace(/^.*\//, "")));
});
const tab = async () => {
  const p = await ctx.newPage();
  p.on("pageerror", (e) => problems.push(String(e)));
  p.on("crash", () => problems.push(`page crashed: ${p.url()}`));
  p.on("console", (m) => { if (/CSP violation/.test(m.text())) problems.push(m.text()); });
  await p.addInitScript(() => addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
  return p;
};

// First visit: the worker takes control without reloading the page, and keeps the page once (BTC-80) and every clip.
const a = await tab();
await a.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
const navA = navCount(a);
await a.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
await a.locator("[data-start]").click();
await until(async () => summary(await cacheState(a))[NOW]?.clips >= CLIPS.length, 120000);
const c1 = summary(await cacheState(a));
check("first visit: the worker took control without reloading the page", navA.count === 0, `${navA.count} navigations`);
check("first visit: the page is saved once and every clip is saved", JSON.stringify(c1) === JSON.stringify({ [NOW]: { clips: CLIPS.length, other: ["index.html"] } }), JSON.stringify(c1));

// The host answers with an error, or not at all (review): a page already saved opens from that copy. With nothing
// saved, the page waits for the network however long it takes.
const TITLE = await a.title();
const opens = async () => {
  const t = await tab();
  const t0 = Date.now();
  const title = await t.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 }).then(() => t.title(), () => "(no page)");
  const ms = Date.now() - t0;
  await t.close();
  return { title, ms };
};
for (const status of [404, 503]) {
  override.set("/index.html", status);
  const o = await opens();
  override.delete("/index.html");
  check(`the host answers ${status}: the saved page opens`, o.title === TITLE, JSON.stringify(o));
}
// With the saved page gone, a host 6 s late is still waited for; the page it sends is saved again.
await a.evaluate(async (name) => (await caches.open(name)).delete(new URL("index.html", location.href).href), NOW);
const gone = !summary(await cacheState(a))[NOW]?.other.includes("index.html");
slow = 6000;
const slowOpen = await opens();
slow = 0;
check("nothing saved: a slow host is waited for, with no time limit", gone && slowOpen.title === TITLE && slowOpen.ms >= 6000, JSON.stringify({ gone, ...slowOpen }));
const resaved = await until(async () => summary(await cacheState(a))[NOW]?.other.includes("index.html"), 15000);
stall = true;
const stalledOpen = await opens();
stall = false;
// The held requests are answered now, so nothing is left waiting on them.
for (const r of stalled.splice(0)) serve("/index.html", r);
check("the host does not answer: the saved page opens after a few seconds", resaved && stalledOpen.title === TITLE && stalledOpen.ms >= 3500, JSON.stringify({ resaved, ...stalledOpen }));

// Offline, a new tab opens the saved page and plays its narration from the saved clips.
down = true;
{
  const b = await tab();
  await b.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await b.locator("[data-start]").click();
  check("offline: the saved page opens and narration plays from the saved clips", await played(b, "blob:"));
  await b.close();
}
down = false;

// A new build (the page's SW_BUILD and the worker's CACHE bumped, the old worker file gone) is published.
const pageNow = readFileSync(join(ROOT, "index.html"), "utf8");
const s0 = pageNow.indexOf('<script type="module">') + '<script type="module">'.length;
const s1 = pageNow.lastIndexOf("</script>");
const scriptNext = pageNow.slice(s0, s1).replace(`const SW_BUILD = "${NOW}"`, `const SW_BUILD = "${NEXT}"`);
const pageNext = pageNow.slice(0, s0).replace(/script-src 'sha256-[^']+'/, `script-src 'sha256-${createHash("sha256").update(scriptNext, "utf8").digest("base64")}'`) + scriptNext + pageNow.slice(s1);
const lfSum = (s) => createHash("sha256").update(s.replace(/\r\n?/g, "\n")).digest("hex");
const swNext = swNow.replace(`const CACHE = "${NOW}"`, `const CACHE = "${NEXT}"`).replace(`"index.html":"${lfSum(pageNow)}"`, `"index.html":"${lfSum(pageNext)}"`);
check("test setup: the next build differs where it should", scriptNext !== pageNow.slice(s0, s1) && swNext.includes(lfSum(pageNext)) && swNext.includes(`"${NEXT}"`));
override.set("/index.html", pageNext);
override.set(`/sw-${NEXT}.js`, swNext);
override.set(`/sw-${NOW}.js`, null);
const navA2 = navCount(a);
const c = await tab();
await c.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
const navC = navCount(c);
// The new worker has taken over once it controls both tabs and its activation has dropped the old cache.
const ctlOf = (p) => p.evaluate(() => navigator.serviceWorker.controller?.scriptURL || "").catch(() => "");
await until(async () => (await ctlOf(a)).endsWith(`sw-${NEXT}.js`) && (await ctlOf(c)).endsWith(`sw-${NEXT}.js`) && Object.keys(await cacheState(c)).join() === NEXT, 120000);
await c.waitForTimeout(500);
const c2 = summary(await cacheState(c));
check("new build: unchanged clips are carried over and the old build's cache is dropped (FE-4)", JSON.stringify(c2) === JSON.stringify({ [NEXT]: { clips: CLIPS.length, other: ["index.html"] } }), JSON.stringify(c2));
const own = await ctlOf(c);
check("new build: a tab already on it is not reloaded when its own worker takes over (PA-7)", own.endsWith(`sw-${NEXT}.js`) && navC.count === 0, `${own} ${navC.count} navigations`);
check("new build: the first-visit tab mid-game is not reloaded", navA2.count === 0, `${navA2.count} navigations`);
const ctlA = await ctlOf(a);
const reloadA = a.waitForEvent("load", { timeout: 90000 }).then(() => true, () => false);
await a.evaluate(() => { document.querySelector("[data-restart]").click(); document.querySelector("[data-confirm-yes]").click(); }).catch(() => {});
const reloaded = await reloadA;
const onNext = reloaded && (await a.evaluate((next) => [...document.scripts].some((s) => s.textContent.includes(`SW_BUILD = "${next}"`)), NEXT));
const afterA = reloaded ? null : await a.evaluate(() => ({ ctlLog: window.__ctlLog, intro: document.querySelector("[data-intro]").open, confirm: document.querySelector("[data-confirm]").open })).catch((e) => String(e));
check("new build: the first-visit tab takes it at Start over (PA-7)", onNext, JSON.stringify({ ctlA, reloaded, afterA }));

// Offline after the update: the reload still has narration, from the carried-over clips.
down = true;
await c.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await c.locator("[data-start]").click();
check("offline after the update: narration plays from the carried-over clips", await played(c, "blob:"));

// SA-2: another page on the origin swaps a saved clip and the saved page.
const swap = (p) => p.evaluate(async ({ clip, cacheName }) => {
  const cache = await caches.open(cacheName);
  await cache.put(new URL(clip, location.href).href, new Response(new Uint8Array(8044).fill(7), { headers: { "content-type": "audio/mpeg" } }));
  for (const key of ["index.html", "./"]) await cache.put(new URL(key, location.href).href, new Response("<!doctype html><title>swapped</title><p>swapped", { headers: { "content-type": "text/html" } }));
}, { clip: CLIP, cacheName: NEXT });
const fetchClip = (p) => p.evaluate(async (clip) => {
  try {
    const b = await (await fetch(clip)).arrayBuffer();
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch { return "failed"; }
}, CLIP);
down = false;
await swap(c);
const before = served.filter((u) => u.includes("phase-site")).length;
const online = await fetchClip(c);
check("a swapped clip is not served: online, the real one comes from the network again (SA-2)", online === DIGESTS[CLIP] && served.filter((u) => u.includes("phase-site")).length > before, online.slice(0, 16));
// The worker saves that real copy again; swap it once that is done, so the swap is what the offline check meets.
const savedClip = () => c.evaluate(async ({ clip, cacheName }) => {
  const r = await (await caches.open(cacheName)).match(new URL(clip, location.href).href);
  return r ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", await r.arrayBuffer()))].map((x) => x.toString(16).padStart(2, "0")).join("") : "";
}, { clip: CLIP, cacheName: NEXT });
await until(async () => (await savedClip()) === DIGESTS[CLIP], 10000);
await swap(c);
down = true;
check("a swapped clip is not served offline either (SA-2)", (await fetchClip(c)) === "failed");
const title = await c.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).then(() => c.title(), () => "(no page)");
check("a swapped page is not served offline (SA-2)", title !== "swapped", title);
check("no page errors or CSP violations", problems.length === 0, problems.join(" | "));
await ctx.close();
server.close();
await browser.close();
if (failed) { console.log(`offline-check: ${failed} failed`); process.exit(1); }
console.log("offline-check ok");
