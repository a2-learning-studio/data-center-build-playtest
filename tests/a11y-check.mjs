// Accessibility and layout check (October 2026 persona audit: AS-1, AS-2, AS-5, AS-6, AS-7, AS-10, AS-11, UD-1, UD-4,
// UD-6, UD-8): the skip link, Voice before the panels and on the intro, siting feedback that is read out and readable,
// the Neighbors fact written only when it changes, the longest caption at 320 x 568, pinned dialog buttons at 400%
// zoom, lane names with text spacing, touch siting help, one meter ink, the schedule as a row of phases on short
// laptop windows, and axe-core in the states the checks pass through.
// node tests/a11y-check.mjs   (see drive.mjs for the browser and paths)
import { launch, watch, openGame, axe } from "./drive.mjs";

const browser = await launch();
const errors = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
async function page({ w = 1366, h = 768, query = "", touch = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  watch(p, errors);
  await openGame(p, query);
  return { ctx, p };
}
const ALL_CHOICES = { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" };
const start = (p) => p.evaluate(() => document.querySelector("[data-start]").click());
// Siting the sediment basins: the first piece of grading that is sited on the map with no question first.
async function siteBasins(p) {
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("grade", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a" }); window.__dc.tab("build"); });
  await p.evaluate(() => document.querySelector('[data-el="ponds"]').click());
  await p.waitForTimeout(250);
}
// WCAG contrast of an element's text against the first opaque background behind it.
const contrast = (p, sel) => p.evaluate((sel) => {
  const rgb = (s) => s.match(/[\d.]+/g).map(Number);
  const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const n = document.querySelector(sel);
  let bg = [255, 255, 255];
  for (let a = n; a; a = a.parentElement) {
    const c = rgb(getComputedStyle(a).backgroundColor);
    if (c.length === 3 || c[3] === 1) { bg = c; break; }
  }
  const [x, y] = [lum(rgb(getComputedStyle(n).color)), lum(bg)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}, sel);
// n arrow-key presses in one burst, as fast as a held key, so a busy machine cannot spread them past the debounce.
const nudge = (p, key, n) => p.evaluate(({ key, n }) => { for (let i = 0; i < n; i++) document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); }, { key, n });
const axeOk = async (p, label) => {
  const v = await axe(p, label);
  check(`axe-core: no violations, ${label}`, v.length === 0, JSON.stringify(v));
};

// AS-10 and AS-11: the skip link is the first stop and goes to the Build panel; Voice comes a few stops later, before
// the panels, while the toolbar stays on the map.
{
  const { ctx, p } = await page();
  await start(p);
  await p.waitForTimeout(200);
  const order = await p.evaluate(() => {
    const stops = [...document.querySelectorAll(".app a[href], .app button, .app [tabindex]")].filter((n) => n.tabIndex >= 0 && !n.disabled && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden");
    const tools = document.querySelector(".tools").getBoundingClientRect(), stage = document.querySelector(".stage").getBoundingClientRect(), build = document.querySelector(".p-build").getBoundingClientRect();
    return { skip: stops[0]?.matches("[data-skip]"), voice: stops.findIndex((n) => n.matches("[data-voice]")), build: stops.findIndex((n) => n.closest(".p-build")), onMap: tools.top - stage.top < 24 && tools.left > build.right };
  });
  check("the skip link is the first stop, and Voice comes before the Build panel", order.skip && order.voice > 0 && order.voice <= 5 && order.voice < order.build, JSON.stringify(order));
  check("the toolbar stays at the top of the map", order.onMap);
  const hidden = await p.evaluate(() => document.querySelector("[data-skip]").getBoundingClientRect().width <= 1);
  await p.locator("[data-skip]").focus();
  const shown = await p.evaluate(() => { const r = document.querySelector("[data-skip]").getBoundingClientRect(); return r.width > 40 && r.height >= 24 && r.top >= 0; });
  await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  const went = await p.evaluate(() => ({ panel: document.activeElement === document.querySelector(".p-build"), hash: location.hash }));
  check("the skip link is out of sight until focused, then moves focus to the Build panel", hidden && shown && went.panel && !went.hash, JSON.stringify({ hidden, shown, ...went }));
  await p.keyboard.press("Tab");
  check("Tab from there reaches the Build panel's first button", await p.evaluate(() => !!document.activeElement.closest("[data-build]")));
  await ctx.close();
}
{
  const { ctx, p } = await page({ w: 390, h: 844, touch: true });
  await start(p);
  await p.evaluate(() => window.__dc.tab("plan"));
  await p.locator("[data-skip]").focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  const s = await p.evaluate(() => ({ view: document.body.dataset.view, panel: document.activeElement === document.querySelector(".p-build"), shown: document.querySelector(".p-build").getClientRects().length > 0 }));
  check("on a phone the skip link opens the Build tab first", s.view === "build" && s.panel && s.shown, JSON.stringify(s));
  await ctx.close();
}

// AS-11: the intro tells screen-reader users how to keep the recorded voice from talking over them, before it starts.
{
  const { ctx, p } = await page();
  await axeOk(p, "intro 1366x768");
  const intro = await p.evaluate(() => {
    const d = document.querySelector("[data-intro]");
    const b = d.querySelector("[data-voice-intro]");
    return { described: d.getAttribute("aria-describedby").split(" ").includes("intro-sr"), shown: b.getClientRects().length > 0, pressed: b.getAttribute("aria-pressed"), text: document.getElementById("intro-sr").textContent };
  });
  check("the intro offers the Voice switch, and its line is part of the dialog's description", intro.described && intro.shown && intro.pressed === "true" && /screen reader/.test(intro.text), JSON.stringify(intro));
  await p.evaluate(() => document.querySelector("[data-voice-intro]").click());
  const off = await p.evaluate(() => [document.querySelector("[data-voice-intro]").getAttribute("aria-pressed"), document.querySelector("[data-voice]").getAttribute("aria-pressed")]);
  await start(p);
  await p.waitForTimeout(400);
  const quiet = await p.evaluate(() => document.querySelector("[data-caption]").hidden);
  check("Voice off on the intro keeps the first narration from playing", off[0] === "false" && off[1] === "false" && quiet, JSON.stringify({ off, quiet }));
  await p.evaluate(() => { document.querySelector("[data-restart]").click(); document.querySelector("[data-confirm-yes]").click(); });
  await p.waitForTimeout(200);
  check("on a kiosk that switch is for one game: the next player starts with the voice on", (await p.evaluate(() => document.querySelector("[data-voice-intro]").getAttribute("aria-pressed"))) === "true");
  await ctx.close();
}

// AS-1: the siting message has AA contrast, Set it here is described by it, and the status line reads it out once the
// footprint stops moving, only when it says something new. UD-8: a mouse and keyboard get the arrow-key line.
{
  const { ctx, p } = await page();
  await siteBasins(p);
  const set = await p.evaluate(() => ({ described: document.querySelector("[data-place-set]").getAttribute("aria-describedby"), why: document.getElementById("place-why")?.textContent, keys: getComputedStyle(document.querySelector(".place-keys")).display !== "none", touch: getComputedStyle(document.querySelector(".place-touch")).display !== "none" }));
  check("Set it here is described by the fit message", set.described === "place-why" && set.why === "This spot fits.", JSON.stringify(set));
  check("with a mouse and keyboard the siting box shows the arrow-key line, not the touch line", set.keys && !set.touch);
  const fits = await contrast(p, "[data-place-why]");
  check("'This spot fits.' has at least 4.5:1 contrast", fits >= 4.5, fits.toFixed(2));
  await axeOk(p, "siting 1366x768");
  await p.evaluate(() => {
    window.__said = [];
    const s = document.querySelector("[data-status]");
    new MutationObserver(() => window.__said.push(s.textContent)).observe(s, { childList: true, characterData: true, subtree: true });
  });
  await p.locator("[data-place-set]").focus();
  await nudge(p, "ArrowUp", 8);
  await p.waitForTimeout(1200);
  const bad = await p.evaluate(() => ({ said: window.__said.slice(), why: document.querySelector("[data-place-why]").textContent }));
  check("the setback message is read out once, after the nudges stop", bad.said.length === 1 && bad.said[0] === bad.why && /setback/.test(bad.why), JSON.stringify(bad));
  const reason = await contrast(p, "[data-place-why]");
  check("the setback message has at least 4.5:1 contrast", reason >= 4.5, reason.toFixed(2));
  await axeOk(p, "siting, spot does not fit, 1366x768");
  await p.keyboard.press("ArrowUp");
  await p.waitForTimeout(1200);
  check("a nudge that keeps the same message is not read again", (await p.evaluate(() => window.__said.length)) === 1);
  await nudge(p, "ArrowDown", 9);
  await p.waitForTimeout(1200);
  const back = await p.evaluate(() => window.__said.slice());
  check("back on a spot that fits, 'This spot fits.' is read out", back.length === 2 && back[1] === "This spot fits.", JSON.stringify(back));
  // Setting the piece ends the siting: no message from it is left to be read out afterwards.
  await p.keyboard.press("ArrowUp");
  await p.evaluate(() => document.querySelector("[data-place-set]").click());
  await p.waitForTimeout(1200);
  const after = await p.evaluate(() => ({ said: window.__said.slice(2), placed: window.__dc.state().placed.has("ponds") }));
  check("after Set it here only the site log line is read, not a late fit message", after.placed && !after.said.includes("This spot fits."), JSON.stringify(after));
  await ctx.close();
}

// UD-8: on a touch screen the siting box gives the touch line instead of mouse and arrow-key help.
{
  const { ctx, p } = await page({ w: 375, h: 667, touch: true });
  await siteBasins(p);
  const s = await p.evaluate(() => ({ text: document.querySelector("[data-place-box]").innerText, touch: getComputedStyle(document.querySelector(".place-touch")).display !== "none" }));
  check("touch screens get the touch line and no mouse or arrow-key help", s.touch && /two fingers/.test(s.text) && !/Arrow keys|Right-drag|Shift-drag/.test(s.text), s.text);
  await axeOk(p, "siting 375x667 touch");
  await p.evaluate(() => { document.querySelector("[data-place-cancel]").click(); window.__dc.tab("hood"); });
  const pressed = () => p.evaluate(() => document.querySelector('[data-hood] [aria-pressed="true"]')?.dataset.key || null);
  await p.locator('[data-key="storm"]').tap();
  const first = await pressed();
  await p.locator('[data-key="storm"]').tap();
  check("on a touch screen a tap on a Neighbors row shows it and a second tap clears it", first === "storm" && (await pressed()) === null, String(first));
  await ctx.close();
}

// AS-2: the Neighbors fact is a live region, so it is written only when its words change, and focusing a row does not
// rebuild the list (one focus event per Tab, on the same row). UD-6: every meter fills in one ink.
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("mep", { route: "b", hours: "b", buffer: "a", wall: "a", cool: "a", light: "a" }); });
  await p.locator('[data-key="noise"]').focus();
  await p.waitForTimeout(100);
  await p.evaluate(() => {
    window.__writes = 0;
    window.__focus = 0;
    new MutationObserver(() => window.__writes++).observe(document.querySelector("[data-hood-detail]"), { childList: true, characterData: true, subtree: true });
    document.querySelector("[data-hood]").addEventListener("focusin", () => window.__focus++);
  });
  // Actions that leave the noise fact as it was: a choice about another row (generator testing), then re-renders.
  await p.evaluate(() => { document.querySelector('[data-choice="test"][data-v="a"]').click(); window.__dc.render(); window.__dc.render(); });
  await p.waitForTimeout(100);
  const same = await p.evaluate(() => ({ writes: window.__writes, chosen: window.__dc.state().choice.test }));
  check("re-renders that leave the fact unchanged do not write it again", same.writes === 0 && same.chosen === "a", JSON.stringify(same));
  await p.locator('[data-key="noise"]').focus();
  await p.evaluate(() => { window.__writes = 0; window.__focus = 0; window.__next = document.querySelector('[data-key="dust"]'); });
  await p.keyboard.press("Tab");
  await p.waitForTimeout(100);
  const tab = await p.evaluate(() => ({ writes: window.__writes, focus: window.__focus, same: document.activeElement === window.__next, pressed: window.__next.getAttribute("aria-pressed"), text: document.querySelector("[data-hood-detail]").innerText }));
  check("Tab to the next row: one focus event on that same row, and the fact is written once", tab.writes === 1 && tab.focus === 1 && tab.same && tab.pressed === "true" && /Dust/.test(tab.text), JSON.stringify(tab));
  // A press keeps the row that hover or focus showed, and a second press on it clears it (it used to clear at once).
  const shown = () => p.evaluate(() => document.querySelector('[data-hood] [aria-pressed="true"]')?.dataset.key || null);
  await p.keyboard.press("Enter");
  const kept = await shown();
  await p.keyboard.press("Enter");
  const cleared = await shown();
  await p.locator('[data-key="storm"]').hover();
  await p.locator('[data-key="storm"]').click();
  const clicked = await shown();
  check("Enter keeps the focused row shown and a second Enter clears it; a click on a hovered row keeps it shown", kept === "dust" && cleared === null && clicked === "storm", JSON.stringify({ kept, cleared, clicked }));
  const fills = await p.evaluate(() => [...new Set([...document.querySelectorAll(".meter i[data-on]")].map((n) => getComputedStyle(n).backgroundColor))]);
  const lit = await p.evaluate(() => document.querySelectorAll(".meter i[data-on]").length);
  check("every Neighbors meter fills in one ink, apart from the dashboard's status colours", lit > 8 && fills.length === 1, JSON.stringify(fills));
  await axeOk(p, "Neighbors 1366x768");
  await ctx.close();
}

// AS-5: at 320 x 568, once the web font is in, the longest caption heard during play fits whole above the map buttons.
{
  const { ctx, p } = await page({ w: 320, h: 568, touch: true });
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("fitout", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }); });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(500);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const cap = await p.evaluate(() => {
    const longest = document.querySelector(".caption:not([data-caption])").textContent;
    const c = document.querySelector("[data-caption]");
    c.textContent = longest;
    c.hidden = false;
    const r = c.getBoundingClientRect(), cam = document.querySelector(".cam").getBoundingClientRect(), tools = document.querySelector(".tools").getBoundingClientRect();
    return { chars: longest.length, cut: c.scrollHeight > c.clientHeight + 1, clear: r.bottom <= cam.top + 1 && r.top >= tools.bottom - 1 };
  });
  check("the longest caption is not cut off and sits between the toolbar and the map buttons", cap.chars > 100 && !cap.cut && cap.clear, JSON.stringify(cap));
  await ctx.close();
}

// UD-4: About's Close button is on screen without scrolling, and a click outside closes About too.
for (const [w, h, touch] of [[390, 844, true], [1366, 768, false]]) {
  const { ctx, p } = await page({ w, h, touch });
  await start(p);
  await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector("[data-about]").click());
  await p.waitForTimeout(200);
  const a = await p.evaluate(() => {
    const d = document.querySelector("[data-about-dlg]"), b = d.querySelector("[data-about-close]");
    const dr = d.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { long: d.scrollHeight > d.clientHeight * 2, top: d.scrollTop, inside: br.top >= dr.top && br.bottom <= dr.bottom + 0.5, hit: document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2) === b };
  });
  check(`About's Close button is on screen without scrolling (${w}x${h})`, a.long && a.top === 0 && a.inside && a.hit, JSON.stringify(a));
  await axeOk(p, `About ${w}x${h}`);
  await p.locator("[data-about-close]").click();
  check(`Close closes About (${w}x${h})`, !(await p.evaluate(() => document.querySelector("[data-about-dlg]").open)));
  await p.evaluate(() => document.querySelector("[data-about]").click());
  await p.waitForTimeout(150);
  await p.mouse.click(4, h - 4);
  await p.waitForTimeout(150);
  check(`a click outside About closes it (${w}x${h})`, !(await p.evaluate(() => document.querySelector("[data-about-dlg]").open)));
  await ctx.close();
}

// AS-6: at 400% zoom on a laptop (320 x 180 and 320 x 256) the intro and end buttons scroll with the text instead of
// covering most of it; on a phone they stay pinned.
for (const [w, h, pinned] of [[320, 180, false], [320, 256, false], [390, 844, true]]) {
  const { ctx, p } = await page({ w, h, touch: w < 900 });
  const intro = await p.evaluate(() => getComputedStyle(document.querySelector(".dlg-intro .intro-btns")).position);
  await p.evaluate((all) => { document.querySelector("[data-start]").click(); window.__dc.all(all); }, ALL_CHOICES);
  await p.evaluate(() => document.querySelector("[data-build] [data-finish]").click());
  await p.waitForTimeout(400);
  const end = await p.evaluate(() => ({ open: document.querySelector("[data-end]").open, pos: getComputedStyle(document.querySelector("[data-end] .dlg-foot")).position }));
  const want = pinned ? "sticky" : "static";
  check(`at ${w}x${h} the intro and end buttons are ${pinned ? "pinned" : "part of the scrolling text"}`, intro === want && end.open && end.pos === want, JSON.stringify({ intro, end }));
  if (w === 390) await axeOk(p, "debrief 390x844");
  await ctx.close();
}

// AS-7: with WCAG 1.4.12 text spacing, no schedule lane name is cut off on a phone.
{
  const { ctx, p } = await page({ w: 390, h: 844, touch: true });
  await p.evaluate((all) => { document.querySelector("[data-start]").click(); window.__dc.upTo("fitout", all); window.__dc.tab("plan"); }, ALL_CHOICES);
  await p.addStyleTag({ content: "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}" });
  await p.waitForTimeout(250);
  const cut = await p.evaluate(() => [...document.querySelectorAll(".lane-name")].filter((n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1).map((n) => `${n.textContent} ${n.scrollWidth}>${n.clientWidth}`));
  check("with text spacing every schedule lane name shows whole (390x844)", cut.length === 0, cut.join(", "));
  await ctx.close();
}

// UD-1: in a laptop window up to 900 px tall the schedule starts as a row of phases that still pick a phase; Show
// timeline brings the bars back, and the next player starts with the row again. A 1920 x 1080 kiosk keeps the bars.
{
  const { ctx, p } = await page({ w: 1280, h: 720 });
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("grade", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a" }); });
  await p.waitForTimeout(200);
  const row = await p.evaluate(() => ({ bars: getComputedStyle(document.querySelector(".track")).display, expanded: document.querySelector("[data-plan-toggle]").getAttribute("aria-expanded"), crit: document.querySelectorAll(".lane[data-crit]").length }));
  check("at 1280x720 the schedule starts as a row of phases, critical ones marked", row.bars === "none" && row.expanded === "false" && row.crit > 0, JSON.stringify(row));
  await p.locator('[data-phase="util"]').click();
  check("a phase in the row still opens that phase", (await p.evaluate(() => window.__dc.state().focus)) === "util");
  await p.locator("[data-plan-toggle]").click();
  await p.waitForTimeout(200);
  const open = await p.evaluate(() => ({ bars: getComputedStyle(document.querySelector(".track")).display, expanded: document.querySelector("[data-plan-toggle]").getAttribute("aria-expanded"), focus: document.activeElement.matches("[data-plan-toggle]") }));
  check("Show timeline brings the bars back, and focus stays on the toggle", open.bars !== "none" && open.expanded === "true" && open.focus, JSON.stringify(open));
  await axeOk(p, "schedule timeline open 1280x720");
  await p.evaluate(() => { document.querySelector("[data-restart]").click(); document.querySelector("[data-confirm-yes]").click(); });
  check("the next player starts with the row of phases again", !(await p.evaluate(() => document.body.hasAttribute("data-plan-open"))));
  await ctx.close();
  const big = await page({ w: 1920, h: 1080 });
  await start(big.p);
  const kiosk = await big.p.evaluate(() => ({ bars: getComputedStyle(document.querySelector(".track")).display, toggle: getComputedStyle(document.querySelector("[data-plan-toggle]")).display }));
  check("a 1920x1080 kiosk shows the full timeline and no toggle", kiosk.bars !== "none" && kiosk.toggle === "none", JSON.stringify(kiosk));
  await big.ctx.close();
}

// axe-core on an issue card and the debrief at a laptop size (the intro, siting, Neighbors and About ran above).
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("grade", { route: "a", hours: "a", cool: "a" }); delete window.__dc.state().cards.weather; window.__dc.card("weather"); });
  await p.waitForTimeout(250);
  await axeOk(p, "issue card 1366x768");
  await p.evaluate(() => document.querySelector('[data-card] .opt[data-key="1"]').click());
  await p.evaluate((all) => window.__dc.all(all), ALL_CHOICES);
  await p.evaluate(() => document.querySelector("[data-build] [data-finish]").click());
  await p.waitForTimeout(400);
  await axeOk(p, "debrief 1366x768");
  await ctx.close();
}

await browser.close();
for (const e of errors) console.log("  console: " + e);
if (failed || errors.length) { console.log(`a11y-check: ${failed} failed, ${errors.length} console error(s)`); process.exit(1); }
console.log("a11y-check ok");
