// N-key play that waits for the final design, and still reaches turnover.
// Since I11 the long-lead question is an issue card during Site & permits (after the utility capacity study) and
// cooling is chosen before zoning or the power study. Waiting holds no equipment back: it adds the in-game wait to
// the schedule (9 months on utilities, 4 on MEP), and the budget pays for the delay.
import { launch, watch, openGame, snapshot, cardOpen, assert } from "./drive.mjs";

const browser = await launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
watch(page, errors);
await openGame(page);
await page.locator("[data-start]").focus();
await page.keyboard.press("Enter");
let end = false;
let longleadDuring = null;
let coolDuring = null;
for (let i = 0; i < 240; i++) {
  end = await page.locator("[data-end]").evaluate((d) => d.open).catch(() => false);
  if (end) break;
  const intro = await page.locator("[data-intro]").evaluate((d) => d.open).catch(() => false);
  if (intro) { await page.locator("[data-start]").focus(); await page.keyboard.press("Enter"); continue; }
  if (await cardOpen(page)) {
    const title = await page.locator(".card-title").innerText();
    const s = await snapshot(page);
    if (title.includes("Long-lead")) longleadDuring = s.done.includes("site") ? "after site" : s.focus;
    if (title.includes("Cooling")) coolDuring = s.done.includes("site") ? "after site" : s.focus;
    await page.keyboard.press(title.includes("Long-lead") ? "2" : "1");
    await page.waitForTimeout(160);
    continue;
  }
  await page.keyboard.press("n");
  await page.waitForTimeout(120);
}
const final = await snapshot(page);
const extra = await page.evaluate(() => {
  const sc = window.__dc.schedule();
  const s = window.__dc.scores();
  return { util: sc.dur.util, mep: sc.dur.mep, budget: s.budget, months: s.months };
});
console.log(JSON.stringify({ end, longleadDuring, coolDuring, cards: final.cards, extra, errors }, null, 2));
await browser.close();
assert(end, "wait path did not reach turnover");
assert(longleadDuring === "site", `the long-lead card was not asked during Site & permits (${longleadDuring})`);
assert(coolDuring === "site", `the cooling choice was not asked during Site & permits (${coolDuring})`);
assert(final.cards.longlead === "b", "the wait answer was not recorded");
assert(extra.util === 24 + 9 && extra.mep >= 9 + 4, `waiting did not add its months (${extra.util}, ${extra.mep})`);
assert(extra.budget > 101, `the delay cost nothing (${extra.budget}%)`);
assert(final.placed.includes("L4") && final.placed.includes("L5"), "wait path skipped commissioning");
assert(errors.length === 0, errors.join(" | "));
console.log("wait-path ok");
