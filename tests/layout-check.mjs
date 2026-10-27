// Layout check (I3, I9, I10): at phone, tablet, laptop, projector and kiosk sizes, no control is covered by another
// control or by the toolbar hint, nothing scrolls sideways, the dashboard words are not cut off, and in presenter
// view and on kiosk screens no visible text is smaller than 16 px.
// node tests/layout-check.mjs            (see drive.mjs for the browser and paths; SIZES="1024x768,375x812" narrows it)
import { launch, watch, openGame, shot } from "./drive.mjs";

const ALL = ["320x568", "375x667", "375x812", "390x844", "667x375", "844x390", "761x900", "800x1280", "834x1194", "900x700", "911x683", "960x540", "1024x600", "1024x768", "1100x800", "1180x820", "1240x800", "1280x720", "1280x800", "1366x768", "1440x900", "1920x1080",
  // Laptop browser windows under 700 px tall (1280 x 720 and 1366 x 768 screens, or 125-175% zoom), a landscape
  // phone, and 400% zoom on a 1280 x 1024 screen (WCAG 1.4.10), where the page scrolls up and down instead.
  "1093x614", "1280x631", "1366x625", "568x320", "320x256"];
const PRESENT = ["375x812", "768x1024", "834x1194", "1024x768", "1280x720", "1366x768", "1920x1080"];
const SIZES = process.env.SIZES ? process.env.SIZES.split(",") : ALL;

const browser = await launch();
const problems = [];
const errors = [];

async function inspect(page, label, { present = false, overview = false } = {}) {
  // Two animation frames, so the layout measured in game.js (ResizeObserver) has settled. Software rendering can
  // take most of a second per frame.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const out = await page.evaluate(({ present, overview }) => {
    const res = [];
    const vw = innerWidth, vh = innerHeight;
    const shown = (n) => {
      if (!n.isConnected) return false;
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      const dlgOpen = n.closest("dialog");
      if (dlgOpen && !dlgOpen.open) return false;
      return n.getClientRects().length > 0;
    };
    // The part of an element that is really on screen: clipped by the window and by scrolling ancestors.
    const visibleRect = (n) => {
      let r = n.getBoundingClientRect();
      let x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(vw, r.right), y1 = Math.min(vh, r.bottom);
      for (let a = n.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflow === "visible" && cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const ar = a.getBoundingClientRect();
        x0 = Math.max(x0, ar.left); y0 = Math.max(y0, ar.top); x1 = Math.min(x1, ar.right); y1 = Math.min(y1, ar.bottom);
      }
      return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
    };
    const name = (n) => (n ? `${n.tagName.toLowerCase()}${n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).join(".") : ""}${n.dataset?.camAct ? `[${n.dataset.camAct}]` : ""}${n.textContent ? ` "${n.textContent.trim().slice(0, 24)}"` : ""}` : "nothing");
    const modal = [...document.querySelectorAll("dialog")].find((d) => d.open);
    const root = modal || document.querySelector(".app");
    const controls = [...root.querySelectorAll("button, a[href], input, canvas[tabindex]")].filter(shown);
    for (const c of controls) {
      const r = visibleRect(c);
      if (r.w < 6 || r.h < 6) continue;
      if (c.tagName === "CANVAS") continue;
      // The centre and the middle of each edge (not the corners, which rounded buttons do not fill).
      const ins = Math.min(3, r.w / 4, r.h / 4), mx = (r.x0 + r.x1) / 2, my = (r.y0 + r.y1) / 2;
      const pts = [[mx, my], [r.x0 + ins, my], [r.x1 - ins, my], [mx, r.y0 + ins], [mx, r.y1 - ins]];
      const bad = [];
      for (const [x, y] of pts) {
        const hit = document.elementFromPoint(x, y);
        // A parent at the point means the point is outside the control's own shape, not that something covers it.
        if (!hit || hit === c || c.contains(hit) || hit.contains(c) || (c.tagName === "INPUT" && hit.closest("label")?.contains(c))) continue;
        // A dialog's pinned button row sits over the text that scrolls under it; that is scrolling, not covering.
        if (hit.closest(".intro-btns, .dlg-foot") && !c.closest(".intro-btns, .dlg-foot")) continue;
        bad.push(name(hit));
      }
      if (bad.length) res.push(`covered: ${name(c)} by ${[...new Set(bad)].join(" / ")}`);
    }
    // Text drawn over the map must not sit on top of a control either (the hint has no pointer events).
    for (const t of [...document.querySelectorAll(".hint")].filter(shown)) {
      const tr = t.getBoundingClientRect();
      for (const c of controls) {
        if (t.parentElement.contains(c) || c.tagName === "CANVAS") continue;
        const r = visibleRect(c);
        if (r.w < 6 || r.h < 6) continue;
        const ox = Math.min(tr.right, r.x1) - Math.max(tr.left, r.x0), oy = Math.min(tr.bottom, r.y1) - Math.max(tr.top, r.y0);
        if (ox > 2 && oy > 2) res.push(`hint over ${name(c)}`);
      }
    }
    if (document.documentElement.scrollWidth > vw + 1) res.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
    if (!modal) {
      for (const n of document.querySelectorAll(".kpi-label, .kpi-val, .kpi-word")) {
        if (!shown(n)) { res.push(`dashboard part hidden: ${name(n)}`); continue; }
        if (n.scrollWidth > n.clientWidth + 1) res.push(`dashboard text cut: ${name(n)} ${n.scrollWidth}>${n.clientWidth}`);
      }
      const badge = document.querySelector(".badge");
      if (!shown(badge)) res.push("version badge hidden");
      const foot = document.querySelector(".foot");
      const scrolls = getComputedStyle(document.documentElement).overflowY === "auto" && document.documentElement.scrollHeight > vh + 1;
      if (!shown(foot) || (!scrolls && foot.getBoundingClientRect().bottom > vh + 1)) res.push("credit footer not on screen");
      // The longest narration line heard during play fits between the toolbar and the map buttons (the probe is an
      // invisible copy of the caption without its height cap). Landscape phones are too short for it.
      const probe = document.querySelector(".caption:not([data-caption])");
      const landscapePhone = vw <= 1100 && vh <= 500 && vw > vh;
      if (probe && !probe.hidden && !landscapePhone) {
        const pr = probe.getBoundingClientRect(), cam = document.querySelector(".cam").getBoundingClientRect(), tools = document.querySelector(".tools").getBoundingClientRect();
        if (pr.bottom > cam.top + 1 || pr.top < tools.bottom - 1) res.push(`narration caption has no room: ${Math.round(pr.top)}-${Math.round(pr.bottom)} between toolbar ${Math.round(tools.bottom)} and map buttons ${Math.round(cam.top)}`);
      }
      // UD-1: beside the panels, the open map between the toolbar and the map buttons is at least a quarter of the
      // stage's height, unless the player has opened the schedule's timeline (it was a 76 px strip at 1280 x 720).
      const sideLayout = getComputedStyle(document.querySelector(".tabs")).display === "none" && !document.body.hasAttribute("data-present");
      if (overview && sideLayout && !document.body.hasAttribute("data-plan-open")) {
        const stage = document.querySelector(".stage").getBoundingClientRect(), cam = document.querySelector(".cam").getBoundingClientRect(), tools = document.querySelector(".tools").getBoundingClientRect();
        const open = cam.top - tools.bottom;
        if (open < stage.height / 4) res.push(`map squeezed: ${Math.round(open)} px open between toolbar and map buttons, in a ${Math.round(stage.height)} px stage`);
      }
    }
    // Presenter view's 16 px text is for projectors and kiosks: the side-panel layout and portrait tablets (AS-9).
    // Phones keep phone sizes.
    const tabbed = getComputedStyle(document.querySelector(".tabs")).display !== "none";
    const tablet = tabbed && vw >= 761 && vh >= vw;
    if ((present && (!tabbed || tablet)) || (vw >= 1900 && vh >= 1000)) {
      const small = new Set();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
        if (!tn.textContent.trim()) continue;
        const n = tn.parentElement;
        if (!shown(n) || n.closest(".sr, [aria-hidden=true], .nogl, svg")) continue;
        const r = n.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        if (fs < 15.95) small.add(`${name(n)} ${fs.toFixed(1)}px`);
      }
      for (const s of small) res.push(`text under 16 px: ${s}`);
    }
    return res;
  }, { present, overview });
  for (const p of out) problems.push(`${label}: ${p}`);
  return out.length;
}

async function run(size, { present = false } = {}) {
  const [w, h] = size.split("x").map(Number);
  const label = `${size}${present ? " presenter" : ""}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900 });
  const page = await ctx.newPage();
  watch(page, errors);
  await openGame(page, present ? "?view=presenter" : "");
  await page.waitForTimeout(400);
  let n = await inspect(page, `${label} intro`, { present });
  await page.evaluate(() => {
    document.querySelector("[data-start]").click();
    window.__dc.upTo("fitout", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" });
  });
  await page.waitForTimeout(500);
  n += await inspect(page, `${label} playing`, { present, overview: true });
  // Laptop windows up to 900 px tall: the schedule's bars, opened with Show timeline, fit too (UD-1).
  if (await page.locator("[data-plan-toggle]").isVisible()) {
    await page.locator("[data-plan-toggle]").click();
    await page.waitForTimeout(400);
    n += await inspect(page, `${label} timeline`, { present });
    await page.locator("[data-plan-toggle]").click();
    await page.waitForTimeout(400);
  }
  // Zoomed in: the move buttons appear.
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__dc.act("in"); });
  await page.waitForTimeout(500);
  n += await inspect(page, `${label} zoomed`, { present });
  // The side panel's other tab, and the phone tabs.
  await page.evaluate(() => { document.querySelector('[data-side-tab="choices"]')?.click(); window.__dc.tab("choices"); });
  await page.waitForTimeout(200);
  n += await inspect(page, `${label} choices`, { present });
  if (n) await page.screenshot({ path: shot(`layout-${label.replace(" ", "-")}.png`) });
  console.log(`${label}: ${n ? `${n} problem(s)` : "ok"}`);
  await ctx.close();
}

// Three pages at a time; each one draws the 3D map in software.
const jobs = [...SIZES.map((s) => [s, {}]), ...PRESENT.filter((x) => !process.env.SIZES || SIZES.includes(x)).map((s) => [s, { present: true }])];
await Promise.all([0, 1, 2].map(async () => { while (jobs.length) { const [s, o] = jobs.shift(); await run(s, o); } }));
await browser.close();
for (const p of problems) console.log("  " + p);
for (const e of errors) console.log("  console: " + e);
if (problems.length || errors.length) { console.log(`layout-check: ${problems.length} problem(s)`); process.exit(1); }
console.log("layout-check ok");
