// Shared headless controls for order, playthrough, map and session checks.
// Runs with any Playwright install: `npm i -D playwright` in the repo, or set PLAYWRIGHT_MODULE to a playwright
// package folder. The browser is Playwright's own Chromium with a fresh temporary profile; set PW_EXECUTABLE (a
// browser binary) or PW_CHANNEL to use another. GAME_URL overrides the page (default: ../index.html as a file).
// SHOTS_DIR is where screenshots go (default: the system temp folder). axe-core is optional.
// The default page is index.test.html, the build that keeps the test hooks (node build.mjs writes it).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const tryImport = async (spec) => {
  try { return await import(spec); } catch { return null; }
};
const pw =
  (await tryImport("playwright")) ||
  (process.env.PLAYWRIGHT_MODULE ? await tryImport(pathToFileURL(join(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href) : null) ||
  (await tryImport("/tmp/shots/node_modules/playwright/index.mjs"));
if (!pw) throw new Error("Playwright not found: npm i -D playwright, or set PLAYWRIGHT_MODULE");
export const chromium = pw.chromium || pw.default?.chromium;

let axeSrc = null;
for (const base of [join(HERE, "..", "package.json"), "/tmp/shots/package.json"]) {
  try { axeSrc = createRequire(base)("axe-core").source; break; } catch { /* optional */ }
}
export const axeSource = axeSrc;

export const GAME_URL = process.env.GAME_URL || pathToFileURL(join(HERE, "..", "index.test.html")).href;
export const SHOTS = process.env.SHOTS_DIR || join(tmpdir(), "build-the-campus-shots");
mkdirSync(SHOTS, { recursive: true });
export const shot = (name) => join(SHOTS, name);

export function launch() {
  const args = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
  if (process.env.PW_EXECUTABLE) return chromium.launch({ executablePath: process.env.PW_EXECUTABLE, args });
  if (process.env.PW_CHANNEL) return chromium.launch({ channel: process.env.PW_CHANNEL, args });
  return chromium.launch({ args });
}

export function watch(page, bucket) {
  // CSP violations (I13) count as errors in every check.
  page.addInitScript(() => addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`))).catch(() => {});
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" || /clearcoat/i.test(text)) bucket.push(`${m.type()}: ${text}`);
  });
  page.on("pageerror", (e) => bucket.push(String(e)));
}

export async function openGame(page, query = "") {
  // A busy machine can take well over Playwright's default 30 s to parse the 1 MB page under software rendering.
  await page.goto(GAME_URL + query, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__voiceRate = 16;
    window.__idleMs = 1e9;
  });
}

// Start from the intro. Shortcut keys do not act inside dialogs, so this presses Enter on the focused Start button.
export async function startGame(page) {
  await page.locator("[data-start]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
}

export async function cardOpen(page) {
  return page.locator("[data-card]").evaluate((d) => d.open).catch(() => false);
}

export async function answerCard(page, pick = () => "1") {
  if (!(await cardOpen(page))) return null;
  const title = await page.locator(".card-title").innerText();
  const key = pick(title);
  await page.evaluate((k) => document.querySelector(`[data-card] .opt[data-key="${k}"]`)?.click(), key);
  await page.waitForTimeout(180);
  return `${title} → ${key}`;
}

export async function snapshot(page) {
  return page.evaluate(() => {
    const s = window.__dc.state();
    const track = {};
    for (const li of document.querySelectorAll(".cx [data-cx]")) track[li.dataset.cx] = li.innerText.replace(/\s+/g, " ").trim();
    return {
      placed: [...s.placed],
      done: [...s.done],
      focus: s.focus,
      cx: { ...s.cx },
      xfmr: s.xfmr,
      cards: { ...s.cards },
      choice: { ...s.choice },
      dur: window.__dc.schedule().dur,
      track,
      voice: document.querySelector("[data-voice]")?.getAttribute("aria-pressed"),
    };
  });
}

async function waitCard(page) {
  const start = Date.now();
  while (Date.now() - start < 1600) {
    if (await cardOpen(page)) return;
    await page.waitForTimeout(80);
  }
}

// Finish phases by clicking their schedule buttons and the build-panel actions. Never presses N.
export async function finishPhases(page, ids, pick = () => "1") {
  const log = [];
  for (const id of ids) {
    for (let step = 0; step < 80; step++) {
      const answered = await answerCard(page, pick);
      if (answered) { log.push(answered); continue; }
      const snap = await page.evaluate(() => ({ focus: window.__dc.state().focus, done: [...window.__dc.state().done] }));
      if (snap.done.includes(id) && snap.focus !== id) break;
      if (snap.focus !== id) {
        await page.locator(`[data-phase="${id}"]`).click();
        await page.waitForTimeout(160);
        continue;
      }
      if (snap.done.includes(id)) break;
      const action = await page.evaluate(() => {
        if (document.querySelector("[data-card]")?.open) return "card";
        const elBtn = document.querySelector("[data-build] [data-el]:not([disabled]):not([data-done])");
        if (elBtn) { elBtn.click(); return "el:" + elBtn.dataset.el; }
        const fin = document.querySelector("[data-build] [data-finish]:not([disabled])");
        if (fin) { fin.click(); return "fin"; }
        return "none";
      });
      log.push(`${id}:${action}`);
      if (action.startsWith("el:")) { await waitCard(page); continue; }
      if (action === "fin") { await page.waitForTimeout(160); continue; }
      if (action === "card") continue;
      break;
    }
  }
  return log;
}

export async function axe(page, label) {
  if (!axeSource) {
    console.log(`AXE ${label}: skipped (axe-core is not installed)`);
    return [];
  }
  await page.evaluate(axeSource);
  const result = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes[0]?.target }));
  });
  if (result.length) console.log("AXE", label, JSON.stringify(result));
  return result;
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
