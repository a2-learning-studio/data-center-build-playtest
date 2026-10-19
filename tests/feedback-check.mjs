// Feedback and platform check (I3, I4, I5, I10, I17 and the small bugs in report 3.3).
// node tests/feedback-check.mjs   (see drive.mjs for the browser and paths)
import { launch, watch, openGame } from "./drive.mjs";

const browser = await launch();
const errors = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
async function page({ w = 1366, h = 768, query = "", init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  watch(p, errors);
  await openGame(p, query);
  return { ctx, p };
}
const chipTexts = (p) => p.evaluate(() => [...document.querySelectorAll("[data-card] .opt")].map((o) => [...o.querySelectorAll(".chip")].map((c) => c.textContent)));

// I5: schedule chips are the real change in the finish date. I4: neighbor points say when they start.
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("grade"); });
  // upTo places part of grading; undo that so the hours question is asked at the start of grading.
  await p.evaluate(() => { const s = window.__dc.state(); for (const e of ["erosion", "roads", "ponds", "clear"]) s.placed.delete(e); s.choice.route = null; s.choice.hours = null; window.__dc.render(); });
  await p.evaluate(() => document.querySelector('[data-el="erosion"]').click());
  await p.waitForTimeout(200);
  const route = await chipTexts(p);
  check("route chips: neighbor points count from grading", route[0].some((c) => /Neighbor relations \+10 · counts from grading/.test(c)), JSON.stringify(route));
  await p.keyboard.press("1");
  await p.waitForTimeout(200);
  const hours = await chipTexts(p);
  const before = await p.evaluate(() => window.__dc.schedule().total);
  check("daytime hours chip shows the real finish change (+1 mo, not +0.5)", hours[0].includes("Finish +1 mo") && hours[1].includes("Finish unchanged"), JSON.stringify(hours));
  await p.keyboard.press("1");
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => window.__dc.schedule().total);
  check("the finish really moved by that much", Math.abs(after - before - 1) < 1e-9, `${before} -> ${after}`);
  await ctx.close();
}
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("util"); delete window.__dc.state().cards.longlead; window.__dc.card("longlead"); });
  await p.waitForTimeout(200);
  const ll = await chipTexts(p);
  const want = await p.evaluate(() => {
    const s = window.__dc.state();
    const base = window.__dc.schedule().total;
    s.cards.longlead = "b";
    const b = window.__dc.schedule().total;
    delete s.cards.longlead;
    return Math.round((b - base) * 2) / 2;
  });
  check("'wait for the final design' chip equals the schedule difference", ll[1].includes(`Finish +${want} mo`) && want !== 9, `${JSON.stringify(ll)} want +${want}`);
  await ctx.close();
}

// I4: the score breakdown, the choices note and the dot on the Neighbors tab. I3: words on every tile.
{
  const { ctx, p } = await page({ w: 1280, h: 800 });
  await p.evaluate(() => { document.querySelector("[data-start]").click(); });
  const pre = await p.evaluate(() => ({ brk: document.querySelector(".hood-break").textContent, word: document.querySelector('[data-dash="hood"] .kpi-word').textContent, note: !!document.querySelector(".choices-note") }));
  check("before grading the breakdown says the score has not started", /Not counted yet/.test(pre.brk) && /Starts at grading/.test(pre.word) && pre.note, JSON.stringify(pre));
  await p.evaluate(() => document.querySelector('[data-side-tab="choices"]').click());
  await p.evaluate(() => window.__dc.upTo("grade", { route: "a", hours: "a" }));
  const mid = await p.evaluate(() => ({ brk: document.querySelector(".hood-break").textContent, dot: document.querySelector('[data-side-tab="hood"]').hasAttribute("data-new"), score: window.__dc.scores().hood }));
  check("at grading the breakdown adds up to the tile", mid.brk.startsWith(`Now ${mid.score}/100: 35 to start, +18 from choices`), mid.brk);
  check("the Neighbors tab is marked when it changes out of sight", mid.dot);
  await p.evaluate(() => document.querySelector('[data-side-tab="hood"]').click());
  check("the mark clears once the panel is seen", !(await p.evaluate(() => document.querySelector('[data-side-tab="hood"]').hasAttribute("data-new"))));
  for (const w of [1280, 1024, 375]) {
    await p.setViewportSize({ width: w, height: 800 });
    await p.waitForTimeout(150);
    const words = await p.evaluate(() => [...document.querySelectorAll(".kpi-word")].map((n) => (n.offsetWidth > 0 ? n.innerText.trim() : "")));
    check(`rating words visible at ${w} px`, words.every(Boolean), JSON.stringify(words));
  }
  const crit = await p.evaluate(() => getComputedStyle(document.querySelector('.gbar[data-crit="1"]')).backgroundImage);
  check("critical-path bars are hatched, not only red", /repeating-linear-gradient/.test(crit));
  await ctx.close();
}

// Work hours lock once grading is finished (its months freeze then).
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("found", { route: "a", hours: "a", buffer: "a", wall: "a" }); window.__dc.tab("choices"); });
  const s = await p.evaluate(() => ({ hours: !!document.querySelector('[data-choice="hours"][data-v="b"]').disabled, route: !!document.querySelector('[data-choice="route"][data-v="b"]').disabled }));
  check("hours locked after grading, route still open in foundations", s.hours && !s.route, JSON.stringify(s));
  await ctx.close();
}

// A click while an issue card is on its way shows a visible message; locked steps show their reason on the button.
{
  const { ctx, p } = await page({ w: 390, h: 844 });
  await p.evaluate(() => { window.__voiceRate = 0.5; document.querySelector("[data-start]").click(); window.__dc.upTo("grade", { route: "a", hours: "a", buffer: "a", wall: "a" }); });
  await p.evaluate(() => { const s = window.__dc.state(); s.placed.delete("clear"); s.placed.delete("ponds"); delete s.cards.weather; window.__dc.render(); window.__dc.tab("build"); });
  await p.evaluate(() => window.__dc.state());
  const why = await p.evaluate(() => { window.__dc.hot(null); return document.querySelector('[data-el="clear"] .el-why')?.textContent || ""; });
  check("locked step shows its reason on the button", /silt fence/.test(why), why);
  await p.evaluate(() => document.querySelector('[data-el="ponds"]').click());
  await p.evaluate(() => document.querySelector('[data-el="clear"]').click());
  await p.waitForTimeout(100);
  await p.keyboard.press("n");
  await p.waitForTimeout(100);
  const t = await p.evaluate(() => ({ shown: !document.querySelector("[data-toast]").hidden, text: document.querySelector("[data-toast]").textContent, card: document.querySelector("[data-card]").open }));
  check("N while the weather card waits shows a waiting message", t.shown && /issue card/.test(t.text) && !t.card, JSON.stringify(t));
  await p.evaluate(() => window.__dc.tab("plan"));
  await p.evaluate(() => document.querySelector('[data-phase="turn"]').click());
  const locked = await p.evaluate(() => document.querySelector("[data-toast]").textContent);
  check("a locked phase explains itself on the Schedule tab", /not ready yet/.test(locked), locked);
  await ctx.close();
}

// I10: presenter view hides the side panels, enlarges the map, is remembered, and the URL switch works.
{
  const { ctx, p } = await page({ w: 1024, h: 768 });
  await p.evaluate(() => document.querySelector("[data-start]").click());
  const area = () => p.evaluate(() => { const c = window.__dc.cam(); return { fit: c.fitDist, side: document.querySelector(".p-side").offsetWidth, plan: document.querySelector(".p-plan").offsetWidth }; });
  const a0 = await area();
  await p.evaluate(() => document.querySelector('[data-cam-act="present"]').click());
  await p.waitForTimeout(400);
  const a1 = await area();
  check("presenter view hides the side panel and the schedule", a1.side === 0 && a1.plan === 0 && a0.side > 0, JSON.stringify([a0, a1]));
  check("presenter view gives the map more room (closer overview)", a1.fit < a0.fit, `${a0.fit.toFixed(0)} -> ${a1.fit.toFixed(0)}`);
  const pressed = await p.evaluate(() => document.querySelector('[data-cam-act="present"]').getAttribute("aria-pressed"));
  check("the button reports its state", pressed === "true");
  await p.reload();
  await p.waitForTimeout(500);
  check("presenter view is remembered on the device", await p.evaluate(() => document.body.hasAttribute("data-present")));
  await ctx.close();
  const q = await page({ w: 1366, h: 768, query: "?view=presenter" });
  check("?view=presenter starts in presenter view", await q.p.evaluate(() => document.body.hasAttribute("data-present")));
  await q.ctx.close();
}

// I17: quality override and the graphics guess.
{
  const { ctx, p } = await page({ query: "?quality=high" });
  check("?quality=high forces full detail, even in software rendering", (await p.evaluate(() => window.__dc.info().lowQ)) === false);
  const cases = await p.evaluate(() => {
    const g = window.__dc.lowGpu;
    return {
      irisXe: g("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)", 8, 8),
      uhd620: g("ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)", 8, 8),
      maliG52: g("Mali-G52 MC2", 8, 4),
      adreno618: g("Adreno (TM) 618", 8, 8),
      adreno506: g("Adreno (TM) 506", 8, 4),
      mediatek8core: g("Mali-G57 MC2", 8, 8),
      rtx: g("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)", 4, 8),
      apple: g("Apple M1", 8, 8),
      swift: g("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))", 16, 8),
      small: g("AMD Radeon(TM) Graphics", 4, 4),
    };
  });
  const ok = !cases.irisXe && cases.uhd620 && cases.maliG52 && !cases.adreno618 && cases.adreno506 && cases.mediatek8core && !cases.rtx && !cases.apple && cases.swift && cases.small;
  check("graphics guess: Iris Xe, Adreno 618, NVIDIA and Apple full; old Intel, Mali G52/G57, Adreno 506, software and small machines reduced", ok, JSON.stringify(cases));
  await ctx.close();
  const low = await page({ query: "?quality=low" });
  check("?quality=low forces reduced detail", (await low.p.evaluate(() => window.__dc.info().lowQ)) === true);
  await low.ctx.close();
}

// No WebGL: the message says what still works, the map tools and tag are gone, and the game still plays.
{
  const init = () => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); };
  };
  const { ctx, p } = await page({ init });
  await p.evaluate(() => { document.querySelector("[data-start]").click(); });
  await p.keyboard.press("n");
  await p.waitForTimeout(200);
  // Since I11 the first step asks the cooling question (a design decision) before zoning is placed.
  if (await p.evaluate(() => document.querySelector("[data-card]").open)) { await p.keyboard.press("1"); await p.waitForTimeout(200); }
  const s = await p.evaluate(() => ({
    nogl: "nogl" in document.body.dataset,
    msg: getComputedStyle(document.querySelector(".nogl")).display !== "none" ? document.querySelector(".nogl").textContent : "",
    hint: getComputedStyle(document.querySelector(".hint")).display,
    cam: getComputedStyle(document.querySelector(".cam")).display,
    tag: document.querySelector("[data-tag]").hidden,
    placed: window.__dc.state().placed.size,
  }));
  check("no-WebGL: message names what still works, no map tools, no stuck tag, N still plays", s.nogl && /still work/.test(s.msg) && s.hint === "none" && s.cam === "none" && s.tag && s.placed === 1, JSON.stringify(s));
  await ctx.close();
}

// The quote key in a dialog throws nothing (it used to break a selector).
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("util"); window.__dc.card("longlead"); });
  await p.keyboard.press('"');
  await p.keyboard.press("\\");
  await p.waitForTimeout(100);
  check("the \" key in a dialog throws no error", !errors.some((e) => /SyntaxError|querySelector/.test(e)));
  await ctx.close();
}

// Idle frames are capped near 30 a second once the camera settles mid-game.
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("fitout", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }); });
  await p.waitForTimeout(2500);
  const fps = await p.evaluate(async () => {
    const canvas = document.querySelector("[data-scene]");
    const gl = canvas.getContext("webgl2");
    let n = 0;
    const orig = gl.clear.bind(gl);
    gl.clear = (...a) => { n += 1; return orig(...a); };
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 2000));
    gl.clear = orig;
    return (n / ((performance.now() - t0) / 1000));
  });
  check("idle mid-game frames stay at or under about 30 per second", fps <= 33, `${fps.toFixed(1)} draws/s`);
  await ctx.close();
}

await browser.close();
const real = errors.filter((e) => !/3D view unavailable|WebGL/.test(e));
for (const e of real) console.log("  console: " + e);
if (failed || real.length) { console.log(`feedback-check: ${failed} failed, ${real.length} console error(s)`); process.exit(1); }
console.log("feedback-check ok");
