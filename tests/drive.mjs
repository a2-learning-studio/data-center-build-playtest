// Shared headless controls for order and playthrough checks.
import { createRequire } from "node:module";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("/tmp/shots/node_modules/playwright/index.mjs"));
}

const require = createRequire("/tmp/shots/package.json");
export const axeSource = require("axe-core").source;
export { chromium };

export function launch() {
  return chromium.launch({
    channel: "chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
}

export function watch(page, bucket) {
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" || /clearcoat/i.test(text)) bucket.push(`${m.type()}: ${text}`);
  });
  page.on("pageerror", (e) => bucket.push(String(e)));
}

export async function openGame(page) {
  await page.goto("file:///workspace/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__voiceRate = 16;
    window.__idleMs = 1e9;
  });
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
      hold: { ...s.hold },
      holdWhy: { ...s.holdWhy },
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
