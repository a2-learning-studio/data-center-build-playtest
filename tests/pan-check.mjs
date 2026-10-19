// Map navigation (report section 3.0b, C2 and I16) at phone, tablet, laptop and desktop widths.
// Run: node tests/pan-check.mjs (see drive.mjs for the browser and paths)
import { launch, watch, openGame, startGame } from "./drive.mjs";

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };
const browser = await launch();
// Waits until the camera has caught up with where it is headed (software rendering can be slow).
const settle = async (page, ms = 700) => {
  await page.waitForTimeout(Math.min(ms, 300));
  await page.waitForFunction(() => {
    const c = window.__dc.cam();
    return Math.abs(c.vdist - c.dist) < 0.6 && Math.abs(c.vaz - c.az) < 2e-3 && Math.abs(c.vel - c.el) < 2e-3 && Math.hypot(c.vx - c.x, c.vz - c.z) < 0.6;
  }, null, { timeout: 15000, polling: 100 }).catch(() => {});
};

for (const [w, h] of [[375, 812], [834, 1194], [1366, 768], [1920, 1080]]) {
  const tag = `${w}x${h}`;
  const touch = w < 1000;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch });
  const page = await ctx.newPage();
  const errors = [];
  watch(page, errors);
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => window.__dc.upTo("fitout", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }));
  await settle(page);
  const cam = () => page.evaluate(() => window.__dc.cam());
  const box = await page.locator("[data-scene]").boundingBox();
  // A point in the open part of the map, clear of the panels, the toolbar and the map buttons.
  const safe = await page.evaluate(() => {
    const c = document.querySelector("[data-scene]").getBoundingClientRect();
    const tabbed = getComputedStyle(document.querySelector(".tabs")).display !== "none";
    if (tabbed) return { x: c.left + c.width / 2, y: c.top + c.height * 0.55 };
    const b = document.querySelector(".p-build").getBoundingClientRect(), s = document.querySelector(".p-side").getBoundingClientRect(), p = document.querySelector(".p-plan").getBoundingClientRect();
    return { x: (b.right + s.left) / 2, y: (document.querySelector(".tools").getBoundingClientRect().bottom + p.top) / 2 + 30 };
  });
  const home = await cam();

  // Overview: a plain drag turns.
  await page.mouse.move(safe.x, safe.y);
  await page.mouse.down();
  await page.mouse.move(safe.x + 60, safe.y, { steps: 4 });
  await page.mouse.up();
  let c = await cam();
  check(Math.abs(c.az - home.az) > 0.1 && Math.abs(c.x - home.x) < 0.01, `${tag}: overview drag should turn, not move`);
  check(!(await page.locator("[data-cam-move]").isVisible()), `${tag}: move buttons shown at the overview`);
  await page.click("[data-reset]");
  await settle(page);

  // Wheel zooms toward the pointer: the ground under it stays put.
  const px = safe.x + 50, py = safe.y - 20;
  const g0 = await page.evaluate(([x, y]) => window.__dc.groundAt(x, y), [px, py]);
  await page.mouse.move(px, py);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
  await settle(page, 1500);
  const g1 = await page.evaluate(([x, y]) => window.__dc.groundAt(x, y), [px, py]);
  c = await cam();
  check(c.zoomed, `${tag}: wheel did not zoom in (${c.dist.toFixed(0)} of ${c.fitDist.toFixed(0)})`);
  check(g0 && g1 && Math.hypot(g1.x - g0.x, g1.z - g0.z) < 6, `${tag}: zoom drifted from the pointer by ${g0 && g1 ? Math.hypot(g1.x - g0.x, g1.z - g0.z).toFixed(1) : "?"} m`);
  check(await page.locator("[data-cam-move]").isVisible(), `${tag}: move buttons hidden when zoomed`);
  const hint = await page.locator("[data-hint]").innerText();
  check(/Drag to move/.test(hint) && (await page.locator("[data-hint]").isVisible()), `${tag}: zoomed hint wrong or hidden: ${hint}`);

  // Zoomed: a plain drag moves, and the ground follows the pointer.
  const before = await cam();
  const ga = await page.evaluate(([x, y]) => window.__dc.groundAt(x, y), [safe.x, safe.y]);
  await page.mouse.move(safe.x, safe.y);
  await page.mouse.down();
  await page.mouse.move(safe.x + 40, safe.y + 25, { steps: 5 });
  await page.mouse.up();
  await settle(page, 1200);
  c = await cam();
  const gb = await page.evaluate(([x, y]) => window.__dc.groundAt(x, y), [safe.x + 40, safe.y + 25]);
  check(Math.abs(c.az - before.az) < 1e-6 && Math.hypot(c.x - before.x, c.z - before.z) > 3, `${tag}: zoomed drag did not move the view`);
  check(ga && gb && Math.hypot(ga.x - gb.x, ga.z - gb.z) < 4, `${tag}: the ground did not stay under the pointer (${ga && gb ? Math.hypot(ga.x - gb.x, ga.z - gb.z).toFixed(1) : "?"} m)`);

  // Right-drag and Shift-drag turn, even when zoomed; the context menu is suppressed.
  let b2 = await cam();
  await page.mouse.move(safe.x, safe.y);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(safe.x + 50, safe.y, { steps: 4 });
  await page.mouse.up({ button: "right" });
  c = await cam();
  check(Math.abs(c.az - b2.az) > 0.1 && Math.hypot(c.x - b2.x, c.z - b2.z) < 0.01, `${tag}: right-drag should turn`);
  b2 = c;
  await page.keyboard.down("Shift");
  await page.mouse.move(safe.x, safe.y);
  await page.mouse.down();
  await page.mouse.move(safe.x - 50, safe.y, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  c = await cam();
  check(Math.abs(c.az - b2.az) > 0.1 && Math.hypot(c.x - b2.x, c.z - b2.z) < 0.01, `${tag}: Shift-drag should turn`);

  // Keys on the focused canvas: arrows turn, Shift+arrows move, + and - zoom.
  await page.locator("[data-scene]").focus();
  b2 = await cam();
  await page.keyboard.press("ArrowLeft");
  c = await cam();
  check(c.az > b2.az && Math.hypot(c.x - b2.x, c.z - b2.z) < 0.01, `${tag}: ArrowLeft should turn`);
  b2 = c;
  await page.keyboard.press("Shift+ArrowRight");
  c = await cam();
  check(Math.hypot(c.x - b2.x, c.z - b2.z) > 1 && c.az === b2.az, `${tag}: Shift+ArrowRight should move`);
  b2 = c;
  await page.keyboard.press("+");
  c = await cam();
  check(c.dist < b2.dist, `${tag}: + should zoom in`);

  // Buttons: named, at least 24 px, and they do the same things.
  const btns = await page.evaluate(() => [...document.querySelectorAll("[data-cam] button")].filter((b) => b.offsetParent).map((b) => ({ name: b.getAttribute("aria-label") || b.textContent.trim(), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
  check(btns.length >= 9 && btns.every((b) => b.name && b.w >= 24 && b.h >= 24), `${tag}: map buttons unnamed or under 24 px ${JSON.stringify(btns)}`);
  check(await page.evaluate(() => document.querySelector("[data-cam]").getAttribute("role") === "group" && !!document.querySelector("[data-cam]").getAttribute("aria-label")), `${tag}: map buttons not grouped`);
  b2 = await cam();
  await page.locator('[data-cam-act="panU"]').click();
  c = await cam();
  check(Math.hypot(c.x - b2.x, c.z - b2.z) > 1, `${tag}: move button did nothing`);
  b2 = c;
  await page.locator('[data-cam-act="right"]').click();
  c = await cam();
  check(c.az < b2.az, `${tag}: turn button did nothing`);

  // Bounds: the view stays on the site, and full zoom reaches the homes, the basins and the noise wall.
  for (let i = 0; i < 6; i++) await page.locator('[data-cam-act="in"]').click();
  for (let i = 0; i < 40; i++) await page.evaluate(() => window.__dc.act("panD"));
  c = await cam();
  check(c.x >= -240 && c.x <= 240 && c.z >= -160 && c.z <= 160, `${tag}: view left the site ${c.x.toFixed(0)},${c.z.toFixed(0)}`);
  check(c.bounds.z1 >= 118 && c.bounds.x0 <= -200 && c.bounds.x1 >= 180, `${tag}: full zoom cannot reach the edges ${JSON.stringify(c.bounds)}`);

  // Placing a part right after a manual move does not yank the view (10 s pause).
  const held = await cam();
  await page.evaluate(() => document.querySelector("[data-build] [data-el]:not([disabled]):not([data-done])")?.click());
  await settle(page, 300);
  c = await cam();
  check(Math.hypot(c.x - held.x, c.z - held.z) < 0.5, `${tag}: the game moved the view during the pause after manual input`);

  // Zooming out eases the view home.
  await page.mouse.move(safe.x, safe.y);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(40); }
  c = await cam();
  check(!c.zoomed && Math.abs(c.x - home.x) < 1 && Math.abs(c.z - home.z) < 1, `${tag}: zooming out did not return home (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);

  // Touch: a pinch zooms; lifting one finger and moving the other does not swing the view (I16).
  if (touch) {
    const cdp = await ctx.newCDPSession(page);
    const t = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
    await page.click("[data-reset]");
    await settle(page);
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const z0 = await cam();
    await t("touchStart", [[cx - 30, cy], [cx + 30, cy]]);
    for (let k = 1; k <= 6; k++) await t("touchMove", [[cx - 30 - k * 12, cy], [cx + 30 + k * 12, cy]]);
    c = await cam();
    check(c.dist < z0.dist * 0.8, `${tag}: pinch did not zoom (${z0.dist.toFixed(0)} -> ${c.dist.toFixed(0)})`);
    const azPinch = c.az;
    // lift the second finger, then move the first one a little
    await t("touchMove", [[cx - 102, cy]]);
    await t("touchMove", [[cx - 96, cy + 4]]);
    c = await cam();
    check(Math.abs(c.az - azPinch) < 0.2, `${tag}: lifting a finger swung the view by ${(c.az - azPinch).toFixed(2)} rad`);
    await t("touchEnd", []);
    // One finger, zoomed: the drag moves the view.
    const m0 = await cam();
    if (m0.zoomed) {
      await t("touchStart", [[cx, cy]]);
      for (let k = 1; k <= 5; k++) await t("touchMove", [[cx + k * 8, cy + k * 5]]);
      await t("touchEnd", []);
      c = await cam();
      check(Math.hypot(c.x - m0.x, c.z - m0.z) > 2 && Math.abs(c.az - m0.az) < 1e-6, `${tag}: one-finger drag did not move when zoomed`);
    }
  }

  await page.click("[data-reset]");
  c = await cam();
  check(c.x === home.x && c.z === home.z && !c.zoomed, `${tag}: Reset view did not return home`);
  check(errors.length === 0, `${tag}: console ${errors.join(" | ")}`);
  console.log(tag, "checked");
  await ctx.close();
}

await browser.close();
if (fails.length) {
  console.log("FAILS\n" + fails.map((f) => "- " + f).join("\n"));
  process.exit(1);
}
console.log("pan-check ok");
