// N-key play that waits for the final design, and still reaches turnover.
import { launch, watch, openGame, snapshot, cardOpen, assert } from "./drive.mjs";

const browser = await launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
watch(page, errors);
await openGame(page);
await page.keyboard.press("n");
let sawHold = false;
let placedDuringHold = false;
let end = false;
for (let i = 0; i < 200; i++) {
  end = await page.locator("[data-end]").evaluate((d) => d.open).catch(() => false);
  if (end) break;
  const intro = await page.locator("[data-intro]").evaluate((d) => d.open).catch(() => false);
  if (intro) { await page.keyboard.press("n"); continue; }
  if (await cardOpen(page)) {
    const title = await page.locator(".card-title").innerText();
    await page.keyboard.press(title.includes("Long-lead") ? "2" : "1");
    await page.waitForTimeout(160);
    continue;
  }
  await page.keyboard.press("n");
  await page.waitForTimeout(120);
  const s = await snapshot(page);
  if (s.hold.substation) {
    sawHold = true;
    if (s.placed.includes("substation")) placedDuringHold = true;
  }
  if (s.placed.includes("substation") && !s.done.includes("shell")) placedDuringHold = true;
}
const final = await snapshot(page);
console.log(JSON.stringify({ end, sawHold, placedDuringHold, done: final.done, cx: final.cx, errors }, null, 2));
await browser.close();
assert(end, "wait path did not reach turnover");
assert(sawHold, "waiting never held the substation");
assert(!placedDuringHold, "substation was placed while waiting or before the shell");
assert(final.placed.includes("L4") && final.placed.includes("L5"), "wait path skipped commissioning");
assert(errors.length === 0, errors.join(" | "));
console.log("wait-path ok");
