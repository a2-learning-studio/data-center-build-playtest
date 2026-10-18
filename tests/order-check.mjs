// Headless checks for commissioning order, procurement, and the live-verification lows.
// Run: NODE_PATH=/tmp/shots/node_modules node tests/order-check.mjs
import { mkdirSync } from "node:fs";
import { launch, watch, openGame, answerCard, snapshot, finishPhases, axe, assert, cardOpen } from "./drive.mjs";

mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
const browser = await launch();
const fails = [];
function check(cond, msg) {
  if (!cond) fails.push(msg);
}

async function fresh(width, height, extra = {}) {
  const errors = [];
  const page = await browser.newPage({ viewport: { width, height }, ...extra });
  watch(page, errors);
  await openGame(page);
  return { page, errors };
}

// ---------- owner repro: phase buttons, utilities never opened ----------
{
  const { page, errors } = await fresh(1366, 768);
  await page.keyboard.press("n");
  await page.waitForTimeout(200);
  const log = await finishPhases(page, ["site", "grade", "found", "shell", "mep"]);
  const s = await snapshot(page);
  console.log("owner", JSON.stringify({ placed: s.placed, done: s.done, cx: s.cx, xfmr: s.xfmr, cards: s.cards, track: s.track }, null, 2));
  console.log("owner log", log.filter((l) => l.includes("longlead") || l.startsWith("mep:")).join(" | "));
  check(!s.placed.includes("substation"), "owner: substation was placed");
  check(!s.placed.includes("transmission"), "owner: transmission was placed");
  check(!s.done.includes("util"), "owner: utilities phase finished");
  check(s.xfmr === 0, "owner: transformer factory test recorded without utilities");
  check(!s.placed.includes("L3") && !s.placed.includes("L4"), "owner: L3 or L4 awarded without power");
  check(Object.values(s.cx).every((n) => n <= 2), `owner: a system passed start-up without power ${JSON.stringify(s.cx)}`);
  check(s.placed.includes("switchgear") && s.cx.switchgear === 2, "owner: switchgear was not installed at level 2");
  check(s.track.L1?.includes("Done") && s.track.L2?.includes("Done"), "owner: installed gear should be factory-tested and set");
  check(s.track.L3?.includes("Not yet") && s.track.L4?.includes("Not yet"), `owner track still skips ahead: ${s.track.L3} | ${s.track.L4}`);
  check(!/Done/.test(s.track.L4 || ""), "owner: L4 row says Done");
  const track = page.locator("[data-build] .cx");
  if (await track.count()) await track.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/after-commissioning-track.png" });
  const box = await page.locator("[data-build]").boundingBox();
  if (box) await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/after-commissioning-panel.png", clip: box });
  await page.locator('[data-side-tab="choices"]').click();
  const lock = await page.locator(".lock").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check(lock >= 12, `choices lock label ${lock}px`);
  check(errors.length === 0, `owner console: ${errors.join(" | ")}`);
  await page.close();
}

// ---------- procurement is before placement, and no answer awards a level ----------
for (const key of ["1", "2", "3"]) {
  const { page, errors } = await fresh(1366, 768);
  await page.keyboard.press("n");
  await finishPhases(page, ["site"]);
  await page.locator('[data-phase="util"]').click();
  await page.waitForTimeout(200);
  const before = await snapshot(page);
  await page.locator('[data-el="substation"]').click();
  await page.waitForTimeout(250);
  check(await cardOpen(page), `procure ${key}: card did not open before placement`);
  const mid = await snapshot(page);
  check(!mid.placed.includes("substation"), `procure ${key}: substation placed before the answer`);
  check(!mid.placed.includes("L1") && mid.xfmr === 0, `procure ${key}: level already recorded`);
  const title = await answerCard(page, () => key);
  const after = await snapshot(page);
  console.log("procure", key, title, { durU: after.dur.util - before.dur.util, durM: after.dur.mep - before.dur.mep, hold: after.hold, xfmr: after.xfmr });
  check(!after.placed.includes("substation"), `procure ${key}: answering placed the substation`);
  check(after.xfmr === 0 && !after.placed.includes("L1"), `procure ${key}: answering awarded L1`);
  check(Object.values(after.cx).every((n) => n === 0), `procure ${key}: answering moved equipment`);
  if (key === "2") {
    check(after.dur.util - before.dur.util === 9, `wait did not add 9 months to utilities (${after.dur.util - before.dur.util})`);
    check(after.dur.mep - before.dur.mep === 4, `wait did not add 4 months to MEP (${after.dur.mep - before.dur.mep})`);
    check(after.hold.substation && after.hold.switchgear, "wait did not hold the substation and switchgear");
    const sub = page.locator('[data-el="substation"]');
    check(await sub.isDisabled(), "substation stayed available after waiting");
  }
  if (key === "3") {
    check(after.dur.mep - before.dur.mep === 4, "switchgear-later did not add 4 months to MEP");
    check(!after.hold.substation && after.hold.switchgear, "option c should hold switchgear only");
    check(!(await page.locator('[data-el="substation"]').isDisabled()), "transformers ordered now should allow the factory test");
  }
  if (key === "1") {
    check(after.dur.util === before.dur.util && after.dur.mep === before.dur.mep, "order-now changed the schedule");
    check(!after.hold.substation && !after.hold.switchgear, "order-now held equipment");
    await page.locator('[data-el="substation"]').click();
    await page.waitForTimeout(150);
    const tested = await snapshot(page);
    check(tested.xfmr === 1 && !tested.placed.includes("substation"), "factory test did not record L1 before placement");
    check(!tested.placed.includes("L1"), "transformer test marked every system level 1");
    await page.locator('[data-el="substation"]').click();
    await page.waitForTimeout(200);
    const placed = await snapshot(page);
    check(placed.placed.includes("substation"), "substation did not place after its factory test");
  }
  check(errors.length === 0, `procure ${key} console: ${errors.join(" | ")}`);
  await page.close();
}

// Waiting blocks the substation until the shell is finished, then the factory test is its own step.
{
  const { page, errors } = await fresh(1366, 768);
  await page.keyboard.press("n");
  await finishPhases(page, ["site"]);
  await page.locator('[data-phase="util"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-el="substation"]').click();
  await answerCard(page, (title) => (title.includes("Long-lead") ? "2" : "1"));
  await finishPhases(page, ["grade", "found"]);
  let s = await snapshot(page);
  check(s.hold.substation && !s.placed.includes("substation"), "substation became available before the shell");
  await finishPhases(page, ["shell"]);
  s = await snapshot(page);
  check(!s.hold.substation, "substation stayed on hold after the shell");
  check(s.hold.switchgear, "switchgear was released at the same moment as the substation");
  await page.locator('[data-phase="util"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-el="substation"]:not([disabled])').click();
  s = await snapshot(page);
  check(s.xfmr === 1 && !s.placed.includes("substation") && !s.placed.includes("L1"), "shell release skipped the factory test or awarded global L1");
  check(errors.length === 0, `wait-shell console: ${errors.join(" | ")}`);
  await page.close();
}

// ---------- clearing requires the construction exit on the click path ----------
{
  const { page, errors } = await fresh(1366, 768);
  await page.keyboard.press("n");
  await finishPhases(page, ["site"]);
  await page.locator('[data-phase="grade"]').click();
  await page.waitForTimeout(150);
  for (const id of ["erosion", "ponds"]) {
    for (let n = 0; n < 6; n++) {
      if (await answerCard(page)) continue;
      const btn = page.locator(`[data-el="${id}"]:not([disabled]):not([data-done])`);
      if (!(await btn.count())) break;
      await btn.click();
      await page.waitForTimeout(200);
    }
  }
  const clear = page.locator('[data-el="clear"]');
  check(await clear.isDisabled(), "clear was enabled with no construction exit");
  await page.evaluate(() => {
    const b = document.querySelector('[data-el="clear"]');
    b.disabled = false;
    b.click();
  });
  let s = await snapshot(page);
  check(!s.placed.includes("clear"), "place(clear) succeeded without the construction exit");
  check((await clear.getAttribute("title"))?.includes("construction exit"), "clear tooltip omits the construction exit");
  for (let n = 0; n < 4; n++) {
    if (await answerCard(page)) continue;
    const roads = page.locator('[data-el="roads"]:not([disabled]):not([data-done])');
    if (!(await roads.count())) break;
    await roads.click();
    await page.waitForTimeout(200);
  }
  check(!(await page.locator('[data-el="clear"]').isDisabled()), "clear stayed locked after the exit was built");
  check(errors.length === 0, `clear console: ${errors.join(" | ")}`);
  await page.close();
}

// ---------- L3 is per system, and L4 is not the same action ----------
{
  const { page, errors } = await fresh(1366, 768);
  await page.keyboard.press("n");
  await finishPhases(page, ["site", "grade", "found", "shell"]);
  await page.locator('[data-phase="util"]').click();
  await page.waitForTimeout(150);
  await finishPhases(page, ["util"]);
  let s = await snapshot(page);
  check(s.placed.includes("substation") && s.placed.includes("transmission"), "power path did not place the tie-in");
  check(!s.placed.includes("L3") && !s.placed.includes("L4"), "power or the procurement answer awarded a level");
  await page.locator('[data-phase="mep"]').click();
  await page.waitForTimeout(150);
  let sawStartup = false;
  for (let n = 0; n < 12 && (await snapshot(page)).cx.switchgear < 3; n++) {
    if (await answerCard(page)) continue;
    const btn = page.locator('[data-el="switchgear"]:not([disabled]):not([data-done])');
    if (await btn.count()) {
      await btn.click();
      const start = Date.now();
      while (Date.now() - start < 5000 && !(await cardOpen(page)) && (await snapshot(page)).cx.switchgear < 3) {
        await page.waitForTimeout(100);
      }
      continue;
    }
    if (!(await cardOpen(page))) break;
  }
  s = await snapshot(page);
  console.log("first system", s.cx, s.choice.test, s.cards.labor);
  check(s.cx.switchgear === 3, `first system did not start up on its own (${s.cx.switchgear})`);
  check(s.cx.ups === 0 && s.cx.gens === 0 && s.cx.cooling === 0 && s.cx.fire === 0, "first arrival commissioned the other systems");
  check(!s.placed.includes("L3") && !s.placed.includes("L4"), "global L3 or L4 flipped for one system");
  let illegal = "";
  for (let n = 0; n < 40; n++) {
    if (await answerCard(page)) continue;
    s = await snapshot(page);
    const levels = Object.values(s.cx);
    if (levels.some((lv) => lv >= 4) && levels.some((lv) => lv < 3)) illegal = JSON.stringify(s.cx);
    if (s.placed.includes("L4") && levels.some((lv) => lv < 4)) illegal = "L4 flag " + JSON.stringify(s.cx);
    if (levels.every((lv) => lv >= 3) && !s.placed.includes("L4")) sawStartup = true;
    if (s.placed.includes("L4")) break;
    const action = await page.evaluate(() => {
      if (document.querySelector("[data-card]")?.open) return "card";
      const elBtn = document.querySelector("[data-build] [data-el]:not([disabled]):not([data-done])");
      if (elBtn) { elBtn.click(); return "el"; }
      const fin = document.querySelector("[data-build] [data-finish]:not([disabled])");
      if (fin) { fin.click(); return "fin"; }
      const go = document.querySelector("[data-go]");
      if (go) { go.click(); return "go"; }
      return "none";
    });
    if (action === "none") break;
    await page.waitForTimeout(200);
  }
  s = await snapshot(page);
  check(!illegal, `level 4 overtook an unfinished start-up ${illegal}`);
  check(sawStartup, "there was no state where every system was at start-up and level 4 was still ahead");
  check(s.placed.includes("L4") && s.placed.includes("L3"), `level 4 did not follow a completed level 3 ${JSON.stringify(s.cx)}`);
  check(Object.values(s.cx).every((lv) => lv === 4), `level 4 left a system behind ${JSON.stringify(s.cx)}`);
  check(errors.length === 0, `levels console: ${errors.join(" | ")}`);
  await page.close();
}

// ---------- V during a dialog, hood hover and focus, type size, axe ----------
{
  const { page, errors } = await fresh(1366, 768);
  const introAxe = await axe(page, "intro-1366");
  check(introAxe.length === 0, `axe intro: ${JSON.stringify(introAxe)}`);
  const label = await page.locator(".kpi-label").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check(label >= 12, `kpi label ${label}px at 1366`);
  await page.keyboard.press("n");
  await finishPhases(page, ["site"]);
  await page.locator('[data-phase="grade"]').click();
  await page.waitForTimeout(150);
  await page.locator("[data-build] [data-el]:not([disabled])").first().click();
  await page.waitForTimeout(200);
  check(await cardOpen(page), "expected a decision dialog");
  await page.keyboard.press("v");
  await page.waitForTimeout(100);
  let s = await snapshot(page);
  check(s.voice === "false" && (await cardOpen(page)), "V did not toggle voice while the dialog stayed open");
  await page.keyboard.press("v");
  s = await snapshot(page);
  check(s.voice === "true", "V did not turn voice back on");
  for (let n = 0; n < 6 && (await cardOpen(page)); n++) await answerCard(page);
  await page.locator('[data-key="noise"]').evaluate((el) => {
    el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  });
  await page.waitForTimeout(100);
  const hovered = await page.locator("[data-hood-detail]").innerText();
  check(/Earthwork|loudest|fans/.test(hovered), `hover did not show the noise effect: ${hovered}`);
  await page.locator('[data-key="trucks"]').focus();
  await page.waitForTimeout(100);
  const focused = await page.locator("[data-hood-detail]").innerText();
  check(/truck|Route|hours/i.test(focused), `focus did not show the truck effect: ${focused}`);
  await page.locator('[data-key="storm"]').click();
  const clicked = await page.locator("[data-hood-detail]").innerText();
  check(/rain|basin|Storm/i.test(clicked), `click did not show stormwater: ${clicked}`);
  check(errors.length === 0, `desktop lows console: ${errors.join(" | ")}`);
  await page.close();
}

{
  const { page, errors } = await fresh(390, 844, { hasTouch: true, isMobile: true });
  const label = await page.locator(".kpi-label").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check(label >= 12, `kpi label ${label}px at 390`);
  check(errors.length === 0, `phone console: ${errors.join(" | ")}`);
  await page.close();
}

{
  const { page } = await fresh(1000, 700);
  const label = await page.locator(".kpi-label").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check(label >= 12, `kpi label ${label}px at 1000`);
  await page.close();
}

await browser.close();
if (fails.length) {
  console.log("FAILS\n" + fails.map((f) => "- " + f).join("\n"));
  process.exit(1);
}
console.log("order-check ok");
