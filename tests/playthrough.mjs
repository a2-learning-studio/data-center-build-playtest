// Full keyboard play at 1366×768 and touch play at 390×844.
// Run: node tests/playthrough.mjs (see drive.mjs for the browser and paths)
import { launch, watch, openGame, snapshot, axe, assert, cardOpen, shot } from "./drive.mjs";

function invariant(s) {
  const levels = Object.values(s.cx);
  if (levels.some((n) => n >= 4) && levels.some((n) => n < 3)) return "L4 before every L3";
  if (s.placed.includes("L4") && levels.some((n) => n < 4)) return "L4 flag early";
  if (s.placed.includes("L3") && levels.some((n) => n < 3)) return "L3 flag early";
  if ((s.placed.includes("L3") || s.placed.includes("L4")) && !(s.placed.includes("substation") && s.placed.includes("transmission"))) return "level without power";
  if (s.placed.includes("L5") && !s.placed.includes("L4")) return "L5 before L4";
  if (s.placed.includes("clear") && !["erosion", "roads", "ponds"].every((id) => s.placed.includes(id))) return "clear out of order";
  return "";
}

async function runKeyboard(browser) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  watch(page, errors);
  await openGame(page);
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight === document.documentElement.clientHeight);
  const introAxe = await axe(page, "play-intro");
  // Shortcut keys do not act inside dialogs (I2): Enter presses the focused Start button.
  await page.keyboard.press("Enter");
  const order = [];
  let bad = "";
  let end = false;
  for (let i = 0; i < 180; i++) {
    end = await page.locator("[data-end]").evaluate((d) => d.open).catch(() => false);
    if (end) break;
    const intro = await page.locator("[data-intro]").evaluate((d) => d.open).catch(() => false);
    if (intro) { await page.keyboard.press("Enter"); await page.waitForTimeout(150); continue; }
    if (await cardOpen(page)) {
      const beforeCard = await snapshot(page);
      await page.keyboard.press("1");
      await page.waitForTimeout(160);
      const afterCard = await snapshot(page);
      for (const id of afterCard.placed) if (!beforeCard.placed.includes(id)) order.push(id);
      bad = bad || invariant(afterCard);
      continue;
    }
    const before = await snapshot(page);
    await page.keyboard.press("n");
    await page.waitForTimeout(140);
    const start = Date.now();
    while (Date.now() - start < 1200 && !(await cardOpen(page))) await page.waitForTimeout(80);
    const after = await snapshot(page);
    for (const id of after.placed) if (!before.placed.includes(id)) order.push(id);
    bad = bad || invariant(after);
  }
  const final = await snapshot(page);
  bad = bad || invariant(final);
  const endAxe = end ? await axe(page, "play-end") : [{ id: "no-end" }];
  const scrollEnd = await page.evaluate(() => document.documentElement.scrollHeight === document.documentElement.clientHeight);
  if (end) await page.screenshot({ path: shot("play-keyboard-end.png") });
  console.log("keyboard", JSON.stringify({ end, steps: order.length, order, done: final.done, cx: final.cx, bad, errors, introAxe, endAxe, scroll, scrollEnd }));
  await page.close();
  assert(end, "keyboard play did not reach turnover");
  assert(!bad, bad);
  assert(errors.length === 0, errors.join(" | "));
  assert(introAxe.length === 0 && endAxe.length === 0, "axe " + JSON.stringify([...introAxe, ...endAxe]));
  assert(scroll && scrollEnd, "page scrolled");
  assert(final.done.includes("turn") && final.placed.includes("L5") && final.placed.includes("L4"), "turnover missing levels");
  const g = order.indexOf("erosion"), r = order.indexOf("roads"), p = order.indexOf("ponds"), c = order.indexOf("clear");
  assert(g < r && r < p && p < c, `grade order ${order.join(",")}`);
  assert(order.indexOf("L5") > order.indexOf("L4"), "L5 before L4 in the log");
}

async function runTouch(browser) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  watch(page, errors);
  await openGame(page);
  const scroll = await page.evaluate(() => document.documentElement.scrollHeight === document.documentElement.clientHeight);
  const label = await page.locator(".kpi-label").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  let bad = "";
  let end = false;
  const order = [];
  for (let i = 0; i < 200; i++) {
    end = await page.locator("[data-end]").evaluate((d) => d.open).catch(() => false);
    if (end) break;
    const target = await page.evaluate(() => {
      const pick = (sel) => {
        const b = document.querySelector(sel);
        if (!b) return null;
        const r = b.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 24) };
      };
      if (document.querySelector("[data-card]")?.open) return pick("[data-card] .opt");
      if (document.querySelector("[data-intro]")?.open) return pick("[data-start]");
      if (document.querySelector("[data-end]")?.open) return null;
      // Undo and Start over sit in the build panel too; the play-through never presses them.
      const next = "[data-build] button:not([disabled]):not([data-done]):not([data-undo]):not([data-restart])";
      const b = document.querySelector(next);
      if (b) b.scrollIntoView({ block: "nearest" });
      return pick(next);
    });
    if (!target) break;
    const before = await snapshot(page);
    await page.touchscreen.tap(target.x, target.y);
    await page.waitForTimeout(160);
    const start = Date.now();
    while (Date.now() - start < 1000 && !(await cardOpen(page))) await page.waitForTimeout(80);
    const after = await snapshot(page);
    for (const id of after.placed) if (!before.placed.includes(id)) order.push(id);
    bad = bad || invariant(after);
  }
  const final = await snapshot(page);
  bad = bad || invariant(final);
  const scrollEnd = await page.evaluate(() => document.documentElement.scrollHeight === document.documentElement.clientHeight);
  if (end) await page.screenshot({ path: shot("play-touch-end.png") });
  console.log("touch", JSON.stringify({ end, order, done: final.done, cx: final.cx, bad, errors, label, scroll, scrollEnd }));
  await page.close();
  assert(end, "touch play did not reach turnover");
  assert(!bad, bad);
  assert(errors.length === 0, errors.join(" | "));
  assert(label >= 12, `phone label ${label}`);
  assert(scroll && scrollEnd, "phone page scrolled");
  assert(final.placed.includes("L5") && final.placed.includes("L4"), "touch turnover missing levels");
  const g = order.indexOf("erosion"), r = order.indexOf("roads"), p = order.indexOf("ponds"), c = order.indexOf("clear");
  assert(g < r && r < p && p < c, `touch grade order ${order.join(",")}`);
}

const browser = await launch();
await runKeyboard(browser);
await runTouch(browser);
await browser.close();
console.log("playthrough ok");
