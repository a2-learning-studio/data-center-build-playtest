// UI/UX round checks (October 2026 repair): (BTC-UX-06) a mouse resting on a Neighbors row leaves the fact, its box
// and the rows still, at a laptop and a projector size; (BTC-UX-49) on a phone, Keep this summary sits on the
// countdown's line, nothing moves when it goes, and a second tap where it was keeps the summary; (BTC-UX-X04) the
// idle prompt's Start a new game can be reached by keyboard, and by a mouse already over the prompt; (BTC-UX-09) a
// short phone has no blank band under the Build panel, and Look at the campus shows the map; (BTC-UX-30) Enter on a
// locked step says why and keeps focus there.
// Run: node tests/ux-check.mjs (see drive.mjs for the browser and paths).
import { launch, watch, openGame } from "./drive.mjs";

const browser = await launch();
const fails = [];
const check = (name, ok, extra = "") => {
  const line = `${ok ? "PASS" : "FAIL"} ${name} ${extra}`;
  console.log(line);
  if (!ok) fails.push(line);
};
// The kiosk countdowns read performance.now(); window.__skew moves it forward, as in session-check.
const skew = () => {
  const o = performance.now.bind(performance);
  performance.now = () => o() + (window.__skew || 0);
};
async function page(w, h, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const p = await ctx.newPage();
  await p.addInitScript(skew);
  const errors = [];
  watch(p, errors);
  await openGame(p, opts.query || "");
  return { ctx, p, errors };
}
const rect = (p, sel) => p.evaluate((s) => {
  const n = document.querySelector(s);
  if (!n || n.hidden) return null;
  const b = n.getBoundingClientRect();
  return b.width ? { x: b.left, y: b.top, r: b.right, b: b.bottom } : null;
}, sel);
const finishGame = async (p) => {
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.all({ route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }); });
  await p.waitForTimeout(200);
  await p.evaluate(() => document.querySelector("[data-finish]").click());
  await p.waitForTimeout(500);
};

// 1. A resting mouse on the lowest rows in sight: the fact box keeps one height, so no row slides out from under the
// pointer and back (it flickered about four times a second).
for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const { ctx, p, errors } = await page(w, h);
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("mep"); });
  await p.waitForTimeout(400);
  const keys = await p.evaluate(() => {
    const area = document.querySelector("[data-hood-scroll]").getBoundingClientRect();
    return [...document.querySelectorAll("[data-hood] .hood-row")].filter((r) => { const b = r.getBoundingClientRect(); return b.top >= area.top - 1 && b.bottom <= area.bottom + 1; }).map((r) => r.dataset.key).slice(-2);
  });
  for (const key of keys) {
    const b = await p.locator(`[data-hood] [data-key="${key}"]`).boundingBox();
    const at = [b.x + b.width / 2, b.y + b.height - 4];
    await p.mouse.move(at[0], at[1], { steps: 3 });
    await p.waitForTimeout(300);
    const shown = await p.evaluate(() => {
      window.__writes = 0;
      window.__heights = new Set([document.querySelector("[data-hood-detail]").offsetHeight]);
      window.__obs = new MutationObserver(() => { window.__writes++; window.__heights.add(document.querySelector("[data-hood-detail]").offsetHeight); });
      window.__obs.observe(document.querySelector("[data-hood-detail]"), { childList: true, subtree: true, characterData: true });
      return document.querySelector('[data-hood] [aria-pressed="true"]')?.dataset.key || null;
    });
    await p.waitForTimeout(2500);
    const s = await p.evaluate((at) => {
      window.__obs.disconnect();
      return { writes: window.__writes, heights: window.__heights.size, under: document.elementFromPoint(at[0], at[1])?.closest("[data-key]")?.dataset.key || null };
    }, at);
    check(`${w}x${h}: a mouse resting on the ${key} row leaves its fact and the rows still`, shown === key && s.writes === 0 && s.heights === 1 && s.under === key, JSON.stringify({ shown, ...s }));
    await p.mouse.move(5, Math.round(h / 2));
    await p.waitForTimeout(200);
  }
  check(`${w}x${h} Neighbors: no errors`, !errors.length, errors.join(" | "));
  await ctx.close();
}

// 2. Phone kiosk countdown: Keep on the countdown's line, above Print and Play again; they do not move when it goes,
// and a second tap where Keep was keeps the summary.
{
  const { ctx, p, errors } = await page(390, 844, { touch: true });
  await finishGame(p);
  await p.evaluate(() => { window.__skew = 61000; });
  await p.waitForFunction(() => !document.querySelector("[data-end-keep]").hidden, null, { timeout: 12000 });
  await p.waitForTimeout(200);
  const keep = await rect(p, "[data-end-keep]"), again = await rect(p, "[data-again]");
  const cx = (keep.x + keep.r) / 2, cy = (keep.y + keep.b) / 2;
  await p.touchscreen.tap(cx, cy);
  await p.waitForTimeout(350);
  const again2 = await rect(p, "[data-again]");
  await p.touchscreen.tap(cx, cy);
  await p.waitForTimeout(500);
  const s = await p.evaluate(() => ({ end: document.querySelector("[data-end]").open, intro: document.querySelector("[data-intro]").open, keep: !document.querySelector("[data-end-keep]").hidden }));
  check("390x844 kiosk: Keep sits above Play again, which stays put when Keep goes", keep.b <= again.y && Math.abs(again2.y - again.y) <= 1 && Math.abs(again2.x - again.x) <= 1, JSON.stringify({ keep, again, again2 }));
  check("390x844 kiosk: a second tap where Keep was keeps the summary", s.end && !s.intro && !s.keep, JSON.stringify(s));
  check("390x844 countdown: no errors", !errors.length, errors.join(" | "));
  await ctx.close();
}

// 3. The idle prompt: Tab reaches Start a new game without closing the prompt, and Enter starts one; a mouse over the
// prompt does not close it, and a click on Start a new game starts one.
{
  const { ctx, p, errors } = await page(1366, 768);
  const prompt = async () => {
    await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("shell"); window.__idleMs = 1500; });
    await p.waitForFunction(() => document.querySelector("[data-idle]").open, null, { timeout: 15000 });
    await p.evaluate(() => { window.__idleMs = 1e9; });
  };
  const state = () => p.evaluate(() => ({ idle: document.querySelector("[data-idle]").open, intro: document.querySelector("[data-intro]").open, placed: window.__dc.state().placed.size, newFocus: !!document.activeElement?.matches("[data-idle-new]") }));
  await prompt();
  await p.keyboard.press("Tab");
  await p.waitForTimeout(150);
  const tabbed = await state();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);
  const started = await state();
  check("idle prompt: Tab reaches Start a new game and Enter starts one", tabbed.idle && tabbed.newFocus && !started.idle && started.intro && started.placed === 0, JSON.stringify({ tabbed, started }));
  await prompt();
  const d = await rect(p, "[data-idle]"), n = await rect(p, "[data-idle-new]");
  await p.mouse.move(d.x + 12, d.y + 12);
  await p.mouse.move((n.x + n.r) / 2, (n.y + n.b) / 2, { steps: 4 });
  await p.waitForTimeout(150);
  const over = await state();
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(400);
  const clicked = await state();
  check("idle prompt: a mouse over the prompt keeps it, and Start a new game starts one", over.idle && !clicked.idle && clicked.intro && clicked.placed === 0, JSON.stringify({ over, clicked }));
  check("idle prompt: no errors", !errors.length, errors.join(" | "));
  await ctx.close();
}

// 4. A short phone held upright: the page ends with the footer right under the Build panel, and Look at the campus
// brings the map into view after the player scrolled down to Finish.
for (const [w, h] of [[360, 640], [360, 560]]) {
  const { ctx, p, errors } = await page(w, h, { touch: true });
  await p.evaluate(() => document.querySelector("[data-start]").click());
  await p.waitForTimeout(400);
  const band = await p.evaluate(() => {
    const stage = document.querySelector(".stage").getBoundingClientRect(), foot = document.querySelector(".foot").getBoundingClientRect();
    return { gap: Math.round(foot.top - stage.bottom), page: document.scrollingElement.scrollHeight, app: Math.round(document.querySelector(".app").getBoundingClientRect().height) };
  });
  check(`${w}x${h}: no blank band under the Build panel`, Math.abs(band.gap) <= 1 && Math.abs(band.page - band.app) <= 1, JSON.stringify(band));
  await p.evaluate(() => window.__dc.all({ route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }));
  await p.waitForTimeout(200);
  await p.locator("[data-finish]").scrollIntoViewIfNeeded();
  await p.locator("[data-finish]").tap();
  await p.waitForTimeout(600);
  await p.locator("[data-end-look]").tap();
  await p.waitForTimeout(500);
  const map = await p.evaluate(() => { const b = document.querySelector("canvas").getBoundingClientRect(); return Math.round((Math.max(0, Math.min(innerHeight, b.bottom) - Math.max(0, b.top)) / b.height) * 100); });
  check(`${w}x${h}: Look at the campus shows the map`, map >= 90, `${map}% of the map in view`);
  check(`${w}x${h}: no errors`, !errors.length, errors.join(" | "));
  await ctx.close();
}

// 5. Enter on a locked step: it says why, and focus stays on that step instead of falling to the page.
{
  const { ctx, p, errors } = await page(1366, 768);
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("grade"); });
  await p.waitForTimeout(300);
  const key = await p.evaluate(() => document.querySelector('[data-build] [data-el][aria-disabled="true"]')?.dataset.el || null);
  await p.locator(`[data-build] [data-el="${key}"]`).focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(250);
  const s = await p.evaluate(() => ({ focus: document.activeElement?.dataset?.el || document.activeElement?.tagName, toast: !document.querySelector("[data-toast]").hidden }));
  check("Enter on a locked step says why and keeps focus on it", !!key && s.focus === key && s.toast, JSON.stringify({ key, ...s }));
  check("locked step: no errors", !errors.length, errors.join(" | "));
  await ctx.close();
}

await browser.close();
if (fails.length) {
  console.error(`ux-check: ${fails.length} failed`);
  process.exit(1);
}
console.log("ux-check ok");
