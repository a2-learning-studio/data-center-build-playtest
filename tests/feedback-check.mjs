// Feedback and platform check (I3, I4, I5, I10, I17 and the small bugs in report 3.3).
// node tests/feedback-check.mjs   (see drive.mjs for the browser and paths)
import { launch, watch, openGame, GAME_URL } from "./drive.mjs";

const browser = await launch();
const errors = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
async function page({ w = 1366, h = 768, query = "", init = null, reducedMotion = "no-preference" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion });
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
  // UD-7: the card names 9 and 4 months, so the answer whose finish moves less says why; the others need no note.
  const notes = await p.evaluate(() => [...document.querySelectorAll("[data-card] .opt")].map((o) => o.querySelector(".opt-note")?.textContent || ""));
  check("the wait answer says why the finish moves less than 9 months", /^Why less than 9 months\? The utility work runs alongside grading and building/.test(notes[1]) && !notes[0] && !notes[2], JSON.stringify(notes));
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

// An issue card opens at once, while the line before it is still read, and its own line follows when that clip ends:
// the narration never holds the game up (it used to refuse every click for 3 to 7 s with a "One moment" message), and
// two clips never play together (UD-5, QL-6, AS-3). Locked steps show their reason on the button.
{
  const { ctx, p } = await page({ w: 390, h: 844 });
  await p.evaluate(() => { window.__voiceRate = 4; document.querySelector("[data-start]").click(); window.__dc.upTo("grade", { route: "a", hours: "a", buffer: "a", wall: "a" }); });
  await p.evaluate(() => { const s = window.__dc.state(); s.placed.delete("clear"); s.placed.delete("ponds"); delete s.cards.weather; window.__dc.render(); window.__dc.tab("build"); });
  await p.evaluate(() => window.__dc.state());
  const why = await p.evaluate(() => { window.__dc.hot(null); return document.querySelector('[data-el="clear"] .el-why')?.textContent || ""; });
  check("locked step shows its reason on the button", /silt fence/.test(why), why);
  await p.evaluate(() => document.querySelector('[data-el="ponds"]').click());
  await p.evaluate(() => { if (!window.__dc.state().placed.has("ponds")) document.querySelector("[data-place-set]")?.click(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    // The audio as the card's line takes the caption: ended means the line before it played to its end.
    const c = document.querySelector("[data-caption]");
    window.__cardLine = null;
    new MutationObserver(() => { if (window.__cardLine === null && /^Weather/.test(c.textContent)) window.__cardLine = window.__dc.audio(); }).observe(c, { childList: true, characterData: true, subtree: true });
    document.querySelector('[data-el="clear"]').click();
  });
  await p.waitForTimeout(100);
  const t = await p.evaluate(() => ({ card: document.querySelector("[data-card]").open, title: document.querySelector(".card-title").textContent, focus: document.activeElement.matches("[data-card] .opt"), caption: document.querySelector("[data-caption]").textContent, toast: !document.querySelector("[data-toast]").hidden }));
  check("placing clearing opens the Weather card at once, focused, while clearing's own line is still read", t.card && /^Weather/.test(t.title) && t.focus && /^Trees and topsoil/.test(t.caption) && !t.toast, JSON.stringify(t));
  await p.waitForFunction(() => window.__cardLine !== null, null, { timeout: 15000 }).catch(() => {});
  const line = await p.evaluate(() => window.__cardLine);
  check("the card's own line starts only after that line has ended", line?.ended === true, JSON.stringify(line));
  await p.keyboard.press("1");
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__dc.tab("plan"));
  await p.evaluate(() => document.querySelector('[data-phase="turn"]').click());
  const locked = await p.evaluate(() => document.querySelector("[data-toast]").textContent);
  check("a locked phase explains itself on the Schedule tab", /not ready yet/.test(locked), locked);
  await ctx.close();
}

// I10: presenter view hides the side panels, enlarges the map, is remembered in class mode, and the URL switch works.
// On a kiosk it lasts one game (PA-1; session-check covers the resets).
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
  check("on a kiosk a reload starts without presenter view", !(await p.evaluate(() => document.body.hasAttribute("data-present"))));
  await ctx.close();
  const c = await page({ w: 1024, h: 768, query: "?mode=class" });
  await c.p.evaluate(() => { document.querySelector("[data-start]").click(); document.querySelector('[data-cam-act="present"]').click(); });
  await c.p.reload();
  await c.p.waitForTimeout(500);
  check("presenter view is remembered on the device in class mode", await c.p.evaluate(() => document.body.hasAttribute("data-present")));
  await c.ctx.close();
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
  // FE-2: the note is drawn on top, over the open map, not under the Schedule panel; the blank canvas steps aside.
  const onTop = () => p.evaluate(() => {
    const n = document.querySelector(".nogl"), r = n.getBoundingClientRect();
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 6, r.top + 6], [r.right - 6, r.top + 6], [r.left + 6, r.bottom - 6], [r.right - 6, r.bottom - 6]];
    return { onTop: r.width > 0 && pts.every(([x, y]) => n.contains(document.elementFromPoint(x, y))), canvas: getComputedStyle(document.querySelector("[data-scene]")).visibility };
  });
  const big = await onTop();
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.waitForTimeout(400);
  const laptop = await onTop();
  check("no-WebGL: the note is in sight over the open map at 1366x768 and 1280x720, and the blank canvas is hidden", big.onTop && laptop.onTop && big.canvas === "hidden", JSON.stringify({ big, laptop }));
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

// FE-3: with reduced motion nothing on the map moves, so once it has settled no frame is drawn, with the effects on,
// and no frame callback runs at all (the "Built:" tag used to follow its part every frame for the life of the page).
{
  const init = () => {
    window.__raf = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (f) => { window.__raf += 1; return raf(f); };
  };
  const { ctx, p } = await page({ init, reducedMotion: "reduce" });
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("fitout", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }); });
  await p.evaluate(() => document.querySelector("[data-build] [data-el]:not([disabled]):not([data-done])")?.click());
  await p.waitForTimeout(4500);
  const idle = await p.evaluate(async () => {
    const gl = document.querySelector("[data-scene]").getContext("webgl2");
    let n = 0;
    const orig = gl.clear.bind(gl);
    gl.clear = (...a) => { n += 1; return orig(...a); };
    const raf0 = window.__raf;
    await new Promise((r) => setTimeout(r, 2000));
    gl.clear = orig;
    return { effects: document.querySelector("[data-fx]").getAttribute("aria-pressed"), draws: n, callbacks: window.__raf - raf0 };
  });
  check("reduced motion: once settled, no frames are drawn and no frame callbacks run", idle.effects === "true" && idle.draws === 0 && idle.callbacks === 0, JSON.stringify(idle));
  await ctx.close();
}

// FE-1: a frame that throws (here one failed draw call) no longer freezes the map for the rest of the game: the next
// change draws again. The thrown error is expected, so this page is not watched.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const pageErrors = [];
  p.on("pageerror", (e) => pageErrors.push(String(e)));
  await openGame(p);
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("fitout", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }); });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const gl = document.querySelector("[data-scene]").getContext("webgl2");
    const draw = gl.drawElements;
    let armed = true, draws = 0;
    gl.drawElements = function (...a) {
      if (armed) { armed = false; throw new Error("injected draw failure"); }
      draws += 1;
      return draw.apply(this, a);
    };
    window.__dc.act("in");
    await new Promise((res) => setTimeout(res, 800));
    draws = 0;
    window.__dc.act("out");
    await new Promise((res) => setTimeout(res, 1200));
    gl.drawElements = draw;
    return { threw: !armed, draws };
  });
  check("one frame that throws does not freeze the map: the next change draws again", r.threw && r.draws > 0 && pageErrors.length === 1 && /injected/.test(pageErrors[0]), JSON.stringify({ ...r, pageErrors }));
  await ctx.close();
}

// UD-11: the "Built:" tag shows over its new part, and stays out of sight while the part is under the map toolbar,
// where the tag could not be read (here the toolbar's bottom edge is moved down past every part).
{
  const { ctx, p } = await page();
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("mep", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a" }); });
  await p.waitForTimeout(1000);
  const tagWith = (toolsB) => p.evaluate(async (toolsB) => {
    const root = document.documentElement.style, real = root.getPropertyValue("--tools-b");
    if (toolsB) root.setProperty("--tools-b", toolsB);
    document.querySelector('[data-el="switchgear"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const tag = document.querySelector("[data-tag]");
    const out = { hidden: tag.hidden, text: tag.textContent };
    root.setProperty("--tools-b", real);
    return out;
  }, toolsB);
  const normal = await tagWith(null);
  const under = await tagWith("5000px");
  check("the Built tag shows over its part, and hides while the part is under the toolbar", !normal.hidden && /Switchgear/.test(normal.text) && under.hidden, JSON.stringify({ normal, under }));
  await ctx.close();
}

// BTC-74: at 360 px and below each tile's status dot sits beside its rating word, clear of every word on the tile (at
// the top corner it covered the end of "Neighbors").
for (const [w, h] of [[320, 568], [360, 740]]) {
  const { ctx, p } = await page({ w, h });
  await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("mep", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a" }); });
  await p.waitForTimeout(300);
  const covered = await p.evaluate(() => [...document.querySelectorAll(".kpi")].filter((k) => {
    const kr = k.getBoundingClientRect(), d = getComputedStyle(k, "::before");
    const right = kr.right - parseFloat(d.right), bottom = kr.bottom - parseFloat(d.bottom);
    const dot = { left: right - parseFloat(d.width), right, top: bottom - parseFloat(d.height), bottom };
    const range = document.createRange();
    return [...k.querySelectorAll(".short")].some((n) => {
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      return r.width > 0 && r.left < dot.right && r.right > dot.left && r.top < dot.bottom && r.bottom > dot.top;
    });
  }).map((k) => k.innerText.replace(/\s+/g, " ")));
  check(`at ${w}x${h} no status dot covers a word on its tile`, covered.length === 0, covered.join(" | "));
  await ctx.close();
}

// Where the game cannot run (scripts off, or a browser older than the minimum, with no <dialog>), a note says so and
// names the browsers it needs, instead of leaving a dashboard that does nothing (critic). Once the game runs it is gone.
{
  const note = async (opts, init) => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, ...opts });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    const pageErrors = [];
    p.on("pageerror", (e) => pageErrors.push(String(e)));
    await p.goto(GAME_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(300);
    const n = p.locator("[data-nojs]");
    const out = { shown: (await n.count()) > 0 && (await n.isVisible()), text: (await n.count()) ? await n.innerText() : "", pageErrors };
    await ctx.close();
    return out;
  };
  const noJs = await note({ javaScriptEnabled: false });
  check("scripts off: a note says the game cannot run here and names the browsers it needs", noJs.shown && /JavaScript/.test(noJs.text) && /Chrome or Edge 108/.test(noJs.text), JSON.stringify(noJs));
  const noDialog = await note({}, () => { delete HTMLDialogElement.prototype.showModal; });
  check("no <dialog>: the game stops at once and the note stays", noDialog.shown && noDialog.pageErrors.length === 1 && /no <dialog>/.test(noDialog.pageErrors[0]), JSON.stringify(noDialog));
  const runs = await note({});
  check("where the game runs, the note is gone", !runs.shown && runs.pageErrors.length === 0, JSON.stringify(runs));
}

await browser.close();
const real = errors.filter((e) => !/3D view unavailable|WebGL/.test(e));
for (const e of real) console.log("  console: " + e);
if (failed || real.length) { console.log(`feedback-check: ${failed} failed, ${real.length} console error(s)`); process.exit(1); }
console.log("feedback-check ok");
