// Session checks (C4, C6, I2, I6, I7, I8, I18): countdowns on touch, dialogs and Escape, shortcuts, Library mode,
// saving and Resume, undo and Start over, live score summary, WebGL context loss; and (PA-1, DE-7, FEU-2, FEU-6) kiosk
// settings that last one game, settings from the address, two tabs, and how the mode is read.
// Run: node tests/session-check.mjs (see drive.mjs for the browser and paths). Takes a few minutes: it waits out real countdowns.
import { launch, GAME_URL } from "./drive.mjs";
const URL = GAME_URL;
const b = await launch();
const results = [];
const fails = [];
const check = (name, ok, extra = "") => { const l = `${ok ? "PASS" : "FAIL"} ${name} ${extra}`; results.push(l); console.log(l); if (!ok) fails.push(l); };
const skew = () => {
  const o = performance.now.bind(performance);
  performance.now = () => o() + (window.__skew || 0);
};
async function page(opts = {}, q = "") {
  const ctx = opts.ctx || (await b.newContext({ viewport: { width: opts.w || 1366, height: opts.h || 768 }, hasTouch: !!opts.touch }));
  const p = await ctx.newPage();
  await p.addInitScript(skew);
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(String(e)));
  await p.goto(URL + q);
  await p.waitForTimeout(400);
  await p.evaluate(() => { window.__voiceRate = 16; });
  return { ctx, p };
}
const ev = (p, fn, arg) => p.evaluate(fn, arg);
const finishGame = async (p) => {
  await ev(p, () => { document.querySelector("[data-start]").click(); window.__dc.all({ route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" }); });
  await p.click("[data-finish]");
  await p.waitForTimeout(300);
};
const center = async (p, sel) => { const r = await p.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
// Leave the game idle until the kiosk prompt counts down and the intro opens for the next player.
const idleReset = async (p) => {
  await ev(p, () => { window.__idleMs = 1500; });
  await p.waitForFunction(() => document.querySelector("[data-idle]").open, null, { timeout: 12000 });
  await p.waitForFunction(() => document.querySelector("[data-intro]").open, null, { timeout: 30000 });
  await ev(p, () => { window.__idleMs = 1e9; });
};
// The settings a player can switch, as the next player finds them, and whether anything is stored.
const settings = (p) => ev(p, () => ({
  present: document.body.hasAttribute("data-present"),
  side: document.querySelector(".p-side").offsetWidth,
  plan: document.querySelector(".p-plan").offsetWidth,
  lib: document.querySelector("[data-libmode]").checked,
  voice: document.querySelector("[data-voice]").getAttribute("aria-pressed"),
  keys: document.querySelector("[data-keys-pref]").checked && !document.documentElement.hasAttribute("data-nokeys"),
  stored: localStorage.length + sessionStorage.length,
}));

// 1. Touch: tap Keep this summary keeps the summary (blocker), at three sizes.
for (const [w, h] of [[390, 844], [820, 1180], [1366, 900]]) {
  const { ctx, p } = await page({ w, h, touch: true });
  await finishGame(p);
  await ev(p, () => { window.__skew = 61000; });
  await p.waitForFunction(() => !document.querySelector("[data-end-keep]").hidden, null, { timeout: 8000 });
  const focusKeep = await ev(p, () => document.activeElement === document.querySelector("[data-end-keep]"));
  const [x, y] = await center(p, "[data-end-keep]");
  await p.touchscreen.tap(x, y);
  await p.waitForTimeout(400);
  const s = await ev(p, () => ({ end: document.querySelector("[data-end]").open, intro: document.querySelector("[data-intro]").open, keepHidden: document.querySelector("[data-end-keep]").hidden, started: window.__dc.state().started }));
  check(`touch Keep summary ${w}`, s.end && !s.intro && s.keepHidden && s.started && focusKeep, JSON.stringify(s));
  // one tap on Play again during a countdown starts over
  await ev(p, () => { window.__skew = 122000; });
  await p.waitForFunction(() => !document.querySelector("[data-end-keep]").hidden, null, { timeout: 8000 });
  const [ax, ay] = await center(p, "[data-again]");
  await p.touchscreen.tap(ax, ay);
  await p.waitForTimeout(400);
  const s2 = await ev(p, () => ({ end: document.querySelector("[data-end]").open, intro: document.querySelector("[data-intro]").open }));
  check(`one tap Play again during countdown ${w}`, !s2.end && s2.intro, JSON.stringify(s2));
  check(`no errors ${w}`, !p.errors.length, p.errors.join("|"));
  await ctx.close();
}

// 2. Touch: Keep playing over an issue card does not answer the card.
{
  const { ctx, p } = await page({ w: 1366, h: 900, touch: true });
  await ev(p, () => { document.querySelector("[data-start]").click(); window.__dc.upTo("shell"); delete window.__dc.state().cards.longlead; window.__dc.card("longlead"); window.__idleMs = 2000; });
  await p.waitForFunction(() => document.querySelector("[data-idle]").open, null, { timeout: 12000 });
  const [x, y] = await center(p, "[data-idle-keep]");
  await p.touchscreen.tap(x, y);
  await p.waitForTimeout(400);
  const s = await ev(p, () => ({ idle: document.querySelector("[data-idle]").open, card: document.querySelector("[data-card]").open, longlead: window.__dc.state().cards.longlead ?? null }));
  check("touch Keep playing leaves card unanswered", !s.idle && s.card && s.longlead === null, JSON.stringify(s));
  // key that dismisses idle does nothing else
  await ev(p, () => { window.__idleMs = 2000; });
  await p.waitForFunction(() => document.querySelector("[data-idle]").open, null, { timeout: 12000 });
  await p.keyboard.press("1");
  await p.waitForTimeout(200);
  const s2 = await ev(p, () => ({ idle: document.querySelector("[data-idle]").open, card: document.querySelector("[data-card]").open, longlead: window.__dc.state().cards.longlead ?? null }));
  check("key dismissing idle does not answer card", !s2.idle && s2.card && s2.longlead === null, JSON.stringify(s2));
  await ev(p, () => { window.__idleMs = 1e9; });
  // Escape twice on the card keeps it open
  await p.keyboard.press("Escape");
  await p.waitForTimeout(100);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  check("Escape x2 keeps issue card", await ev(p, () => document.querySelector("[data-card]").open));
  // forced close (script) re-offers the card
  await ev(p, () => document.querySelector("[data-card]").close());
  // The browser can deliver the close event late (seconds under software rendering on a busy machine).
  const reopened = await p.waitForFunction(() => document.querySelector("[data-card]").open, null, { timeout: 15000 }).then(() => true, () => false);
  check("closed card is re-offered", reopened);
  // Late close events never bring back an answered card or change its answer.
  await ev(p, () => document.querySelector('[data-card] .opt[data-key="1"]').click());
  await ev(p, () => { const d = document.querySelector("[data-card]"); d.dispatchEvent(new Event("close")); d.dispatchEvent(new Event("close")); });
  await p.waitForTimeout(600);
  const late = await ev(p, () => ({ open: document.querySelector("[data-card]").open, longlead: window.__dc.state().cards.longlead ?? null }));
  check("late close events keep an answered card closed", !late.open && late.longlead === "a", JSON.stringify(late));
  await ctx.close();
}

// 3. Mouse movement counts as activity and dismisses the idle prompt.
{
  const { ctx, p } = await page();
  await ev(p, () => { document.querySelector("[data-start]").click(); window.__dc.upTo("shell"); window.__idleMs = 2000; });
  await p.waitForFunction(() => document.querySelector("[data-idle]").open, null, { timeout: 12000 });
  await p.mouse.move(400, 300);
  await p.mouse.move(460, 340);
  await p.waitForTimeout(200);
  const placedBefore = await ev(p, () => window.__dc.state().placed.size);
  check("mouse move dismisses idle", !(await ev(p, () => document.querySelector("[data-idle]").open)));
  // hovering keeps the game alive
  await ev(p, () => { window.__idleMs = 6000; });
  for (let i = 0; i < 16; i++) { await p.mouse.move(500 + (i % 2) * 40, 300); await p.waitForTimeout(600); }
  check("hover keeps idle prompt away", !(await ev(p, () => document.querySelector("[data-idle]").open)) && placedBefore === (await ev(p, () => window.__dc.state().placed.size)));
  // idle prompt a11y
  const a = await ev(p, () => ({ idle: document.querySelector("[data-idle]").getAttribute("aria-describedby"), card: document.querySelector("[data-card]").getAttribute("aria-describedby"), end: document.querySelector("[data-end]").getAttribute("aria-describedby"), intro: document.querySelector("[data-intro]").getAttribute("aria-describedby"), about: document.querySelector("[data-about-dlg]").getAttribute("aria-describedby"), canvas: [document.querySelector("canvas").getAttribute("role"), document.querySelector("canvas").getAttribute("aria-label").slice(0, 40)], endRole: document.querySelector("[data-end-clear]").getAttribute("role") }));
  const allIds = await ev(p, () => [...document.querySelectorAll("dialog[aria-describedby]")].every((d) => d.getAttribute("aria-describedby").split(" ").every((id) => document.getElementById(id))));
  check("dialogs described, canvas role", allIds && a.canvas[0] === "application" && !a.endRole, JSON.stringify(a));
  await ctx.close();
}

// 4. Escape never loses the end screen or the intro; singular "1 second".
{
  const { ctx, p } = await page();
  await p.keyboard.press("Escape");
  await p.keyboard.press("Escape");
  check("Escape keeps intro", await ev(p, () => document.querySelector("[data-intro]").open));
  await finishGame(p);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(100);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  check("Escape keeps end screen", await ev(p, () => document.querySelector("[data-end]").open));
  const stats = await ev(p, () => document.querySelector(".end-stats").innerText.replace(/\s+/g, " "));
  check("end stats show schedule word and plan", /Schedule about \d+ months (Strong|Good|Fair|Watch) Plan: 45 months/i.test(stats) && /of plan (Strong|Good|Fair|Watch|Concern)/.test(stats), stats);
  // Every countdown text is recorded as it changes, so a busy machine cannot miss the one-second moment.
  await ev(p, () => {
    const el = document.querySelector("[data-end-clear]");
    window.__seen = [];
    new MutationObserver(() => window.__seen.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
    window.__skew = 61000;
  });
  await p.waitForFunction(() => !document.querySelector("[data-end-keep]").hidden, null, { timeout: 8000 });
  await p.waitForFunction(() => window.__seen.some((x) => /in 1 second for/.test(x)), null, { timeout: 30000 }).catch(() => {});
  const seen = await ev(p, () => window.__seen);
  check("singular 1 second", seen.some((x) => / 1 second for/.test(x)) && !seen.some((x) => / 1 seconds/.test(x)), seen.slice(-3).join(" | "));
  await ctx.close();
}

// 5. Shortcuts: not in dialogs or form controls, not on repeat, and the off switch.
{
  const { ctx, p } = await page();
  await p.keyboard.press("n");
  check("N does not start from intro", await ev(p, () => document.querySelector("[data-intro]").open));
  await p.keyboard.press("Enter");
  await p.waitForTimeout(200);
  // Since I11 the first step asks the cooling question; answer it here so N places an element.
  await ev(p, () => { window.__dc.state().choice.cool = "a"; window.__dc.render(); });
  const placed0 = await ev(p, () => window.__dc.state().placed.size);
  await p.click("[data-about]");
  await p.keyboard.press("n");
  await p.keyboard.press("v");
  const s1 = await ev(p, () => ({ placed: window.__dc.state().placed.size, voice: document.querySelector("[data-voice]").getAttribute("aria-pressed") }));
  check("N and V ignored in About", s1.placed === placed0 && s1.voice === "true", JSON.stringify(s1));
  await p.click("[data-keys-pref]");
  await p.click("[data-about-close]");
  await p.keyboard.press("n");
  check("off switch stops N", (await ev(p, () => window.__dc.state().placed.size)) === placed0);
  // On a kiosk the switch lasts one game (section 10); class and home modes store it (section 12).
  const stored = await ev(p, () => localStorage.getItem("build-the-campus:v1:prefs"));
  check("kiosk: shortcut switch not stored", stored === null, stored);
  // Number keys are single-key shortcuts too: with the switch off they do not answer an open issue card.
  await ev(p, () => { delete window.__dc.state().cards.weather; window.__dc.card("weather"); });
  await p.waitForTimeout(150);
  await p.keyboard.press("1");
  await p.waitForTimeout(150);
  const k1 = await ev(p, () => ({ open: document.querySelector("[data-card]").open, weather: window.__dc.state().cards.weather ?? null, kbd: getComputedStyle(document.querySelector("[data-card] .opt kbd")).display }));
  check("off switch stops number keys on cards", k1.open && k1.weather === null && k1.kbd === "none", JSON.stringify(k1));
  await ev(p, () => document.querySelector('[data-card] .opt[data-key="1"]').click());
  await ev(p, () => { document.querySelector("[data-keys-pref]").click(); });
  await p.keyboard.down("n"); await p.keyboard.down("n"); await p.keyboard.down("n"); await p.keyboard.up("n");
  await p.waitForTimeout(200);
  const placed1 = await ev(p, () => window.__dc.state().placed.size);
  check("key repeat ignored (one step per press)", placed1 === placed0 + 1, `${placed0}->${placed1}`);
  await ev(p, () => document.querySelector("[data-start]").focus());
  await p.keyboard.press('"');
  check("quote key no error", !p.errors.length, p.errors.join("|"));
  await ctx.close();
}

// 6. Library mode persists per device in class mode; a V press does not carry to the next visitor in kiosk use.
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  let { p } = await page({ ctx }, "?mode=class");
  await p.click("[data-libmode]");
  await p.reload();
  await p.waitForTimeout(400);
  const s = await ev(p, () => ({ box: document.querySelector("[data-libmode]").checked, voice: document.querySelector("[data-voice]").getAttribute("aria-pressed") }));
  check("Library mode remembered in class mode", s.box && s.voice === "false", JSON.stringify(s));
  await ctx.close();
  const { ctx: c2, p: p2 } = await page({}, "?mode=library");
  const s2 = await ev(p2, () => ({ box: document.querySelector("[data-libmode]").checked, dis: document.querySelector("[data-libmode]").disabled, voice: document.querySelector("[data-voice]").getAttribute("aria-pressed") }));
  check("?mode=library starts voice off", s2.box && s2.voice === "false", JSON.stringify(s2));
  await p2.keyboard.press("Enter");
  await p2.keyboard.press("v");
  const on = await ev(p2, () => document.querySelector("[data-voice]").getAttribute("aria-pressed"));
  await idleReset(p2);
  const after = await ev(p2, () => document.querySelector("[data-voice]").getAttribute("aria-pressed"));
  check("V is per game on a kiosk", on === "true" && after === "false", `${on} -> ${after}`);
  await c2.close();
}

// 7. Saving: class mode autosaves and offers Resume; Start over clears; kiosk saves nothing.
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const { p } = await page({ ctx }, "?mode=class");
  await p.keyboard.press("Enter");
  for (let i = 0; i < 7; i++) { await p.keyboard.press("n"); await p.waitForTimeout(120); if (await ev(p, () => document.querySelector("[data-card]").open)) await p.keyboard.press("1"); }
  const before = await ev(p, () => [...window.__dc.state().placed].sort().join(","));
  const raw = await ev(p, () => JSON.parse(sessionStorage.getItem("build-the-campus:v1:save")));
  await p.reload();
  await p.waitForTimeout(400);
  const offer = await ev(p, () => ({ resume: !document.querySelector("[data-resume]").hidden, start: document.querySelector("[data-start]").textContent }));
  await p.click("[data-resume]");
  await p.waitForTimeout(200);
  const after = await ev(p, () => [...window.__dc.state().placed].sort().join(","));
  check("class mode resume restores game", raw?.v === 1 && offer.resume && before === after && before.length > 0, `${JSON.stringify(offer)} ${before} | ${after}`);
  // undo
  // A resumed game re-offers an unanswered issue card (the long-lead card follows the capacity study), so answer
  // anything that opens before and after the step being undone.
  for (let i = 0; i < 10; i++) { await p.waitForTimeout(300); if (await ev(p, () => document.querySelector("[data-card]").open)) await p.keyboard.press("1"); }
  const n0 = await ev(p, () => window.__dc.state().placed.size);
  for (let i = 0; i < 6 && (await ev(p, () => window.__dc.state().placed.size)) === n0; i++) {
    await p.keyboard.press("n");
    await p.waitForTimeout(300);
    if (await ev(p, () => document.querySelector("[data-card]").open)) await p.keyboard.press("1");
  }
  for (let i = 0; i < 10; i++) { await p.waitForTimeout(300); if (await ev(p, () => document.querySelector("[data-card]").open)) await p.keyboard.press("1"); }
  const n1 = await ev(p, () => window.__dc.state().placed.size);
  await p.click("[data-undo]");
  await p.waitForTimeout(150);
  const n2 = await ev(p, () => window.__dc.state().placed.size);
  check("undo takes back the last placement", n1 === n0 + 1 && n2 === n0, `${n0} ${n1} ${n2}`);
  // start over asks first
  await p.click("[data-restart]");
  const askOpen = await ev(p, () => document.querySelector("[data-confirm]").open);
  await p.click("[data-confirm-no]");
  const stillPlaying = await ev(p, () => window.__dc.state().started && !document.querySelector("[data-intro]").open);
  await p.click("[data-restart]");
  await p.click("[data-confirm-yes]");
  await p.waitForTimeout(200);
  const cleared = await ev(p, () => ({ intro: document.querySelector("[data-intro]").open, save: sessionStorage.getItem("build-the-campus:v1:save"), resume: !document.querySelector("[data-resume]").hidden }));
  check("Start over confirmed and clears the save", askOpen && stillPlaying && cleared.intro && !cleared.save && !cleared.resume, JSON.stringify(cleared));
  await ctx.close();
  const { ctx: k, p: kp } = await page();
  await kp.keyboard.press("Enter");
  for (let i = 0; i < 4; i++) { await kp.keyboard.press("n"); await kp.waitForTimeout(100); }
  const ks = await ev(kp, () => ({ session: sessionStorage.length, local: Object.keys(localStorage) }));
  check("kiosk saves nothing", ks.session === 0 && ks.local.length === 0, JSON.stringify(ks));
  await k.close();
}

// 8. Score summary is announced politely.
{
  const { ctx, p } = await page();
  await p.keyboard.press("Enter");
  await ev(p, () => window.__dc.upTo("grade", { route: "b", hours: "b" }));
  await ev(p, () => document.querySelector('[data-choice="buffer"][data-v="b"]')?.click());
  await p.waitForTimeout(1300);
  const live = await ev(p, () => document.querySelector("[data-score-live]").textContent);
  check("score live summary", /Neighbor relations: \d+\/100/.test(live) || /: /.test(live), live);
  await ctx.close();
}

// 9. WebGL context loss and restore keep the game (no reload).
{
  const { ctx, p } = await page();
  await p.keyboard.press("Enter");
  await ev(p, () => { window.__marker = 42; window.__dc.upTo("found"); });
  const ok = await ev(p, async () => {
    const gl = document.querySelector("canvas").getContext("webgl2") || document.querySelector("canvas").getContext("webgl");
    const ext = gl.getExtension("WEBGL_lose_context");
    if (!ext) return "no-ext";
    ext.loseContext();
    await new Promise((r) => setTimeout(r, 300));
    ext.restoreContext();
    await new Promise((r) => setTimeout(r, 800));
    return window.__marker === 42 && window.__dc.state().placed.size > 5 && !("nogl" in document.body.dataset);
  });
  check("context loss/restore keeps game", ok === true, String(ok) + " " + p.errors.join("|"));
  await ctx.close();
}

// 10. Kiosk (PA-1): what one visitor switches (Library mode, presenter view, the shortcut switch) lasts their game.
// The idle reset, Play again and a reload give the next visitor the device's settings, and nothing is stored.
{
  const { ctx, p } = await page();
  await p.click("[data-libmode]");
  await p.click("[data-start]");
  await p.waitForTimeout(200);
  await p.click('[data-cam-act="present"]');
  await p.click("[data-about]");
  await p.click("[data-keys-pref]");
  await p.click("[data-about-close]");
  const s1 = await settings(p);
  check("kiosk: a visitor's switches change their game", s1.present && !s1.side && !s1.plan && s1.lib && s1.voice === "false" && !s1.keys && !s1.stored, JSON.stringify(s1));
  await idleReset(p);
  const s2 = await settings(p);
  check("kiosk: the idle reset gives the next visitor the defaults", !s2.present && s2.side > 0 && s2.plan > 0 && !s2.lib && s2.voice === "true" && s2.keys && !s2.stored, JSON.stringify(s2));
  await p.click("[data-start]");
  await p.waitForTimeout(200);
  await p.click('[data-cam-act="present"]');
  await finishGame(p);
  await p.click("[data-again]");
  await p.waitForTimeout(300);
  const s3 = await settings(p);
  check("kiosk: Play again gives the next visitor the defaults", !s3.present && s3.side > 0 && s3.plan > 0 && !s3.stored, JSON.stringify(s3));
  await p.click("[data-start]");
  await p.waitForTimeout(200);
  await p.click('[data-cam-act="present"]');
  await p.reload();
  await p.waitForTimeout(400);
  const s4 = await settings(p);
  check("kiosk: a reload starts from the defaults", !s4.present && !s4.lib && s4.voice === "true" && s4.keys && !s4.stored, JSON.stringify(s4));
  check("kiosk settings: no errors", !p.errors.length, p.errors.join("|"));
  await ctx.close();
}

// 11. The address sets what every game starts with (?view=presenter, ?keys=off, ?voice=off, FEU-6). A visitor who
// switches them gets them back when the game starts over.
{
  const { ctx, p } = await page({}, "?view=presenter&keys=off&voice=off");
  const s0 = await settings(p);
  await p.click("[data-start]");
  await p.waitForTimeout(200);
  await p.click('[data-cam-act="present"]');
  await p.click("[data-voice]");
  await p.click("[data-about]");
  await p.click("[data-keys-pref]");
  await p.click("[data-about-close]");
  const s1 = await settings(p);
  await p.click("[data-restart]");
  await p.click("[data-confirm-yes]");
  await p.waitForTimeout(300);
  const s2 = await settings(p);
  check("the address sets every game's start, and Start over returns to it", s0.present && !s0.keys && s0.voice === "false" && !s1.present && s1.keys && s1.voice === "true" && s2.present && !s2.keys && s2.voice === "false" && !s2.stored, JSON.stringify([s0, s1, s2]));
  await ctx.close();
  const { ctx: c2, p: p2 } = await page({}, "?mode=class&voice=off");
  const v = await ev(p2, () => document.querySelector("[data-voice]").getAttribute("aria-pressed"));
  check("?mode=class&voice=off starts with the voice off", v === "false", v);
  await c2.close();
}

// 12. Class mode remembers presenter view and the shortcut switch on the device. Each tab writes only the setting
// it changed, so two open tabs do not undo each other (DE-7).
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } });
  const { p: a } = await page({ ctx }, "?mode=class");
  const { p: c } = await page({ ctx }, "?mode=class");
  await a.click("[data-start]");
  await a.waitForTimeout(200);
  await a.click('[data-cam-act="present"]');
  await c.click("[data-start]");
  await c.waitForTimeout(200);
  await c.click("[data-about]");
  await c.click("[data-keys-pref]");
  await c.click("[data-about-close]");
  const stored = await ev(c, () => JSON.parse(localStorage.getItem("build-the-campus:v1:prefs") || "{}"));
  check("class mode: two tabs keep each other's settings", stored.present === true && stored.keys === false, JSON.stringify(stored));
  await c.reload();
  await c.waitForTimeout(400);
  const s = await settings(c);
  check("class mode: presenter view and the shortcut switch are remembered", s.present && !s.keys, JSON.stringify(s));
  await ctx.close();
}

// 13. The mode is read without regard to case, spaces or a second "?", and class and home modes say so on the
// intro (FEU-2). A real typo is still the kiosk, with no mode line.
for (const [q, want] of [["?mode=Class", "class"], ["?mode=%20HOME%20", "home"], ["?view=presenter?mode=class", "class"], ["?mode=clas", "kiosk"]]) {
  const { ctx, p } = await page({}, q);
  const s = await ev(p, () => ({ mode: window.__dc.mode, line: [...document.querySelectorAll("[data-intro] [data-mode-line]")].filter((n) => !n.hidden).map((n) => n.textContent).join("|"), present: document.body.hasAttribute("data-present") }));
  const line = { class: /^Class mode: /, home: /^Home mode: /, kiosk: /^$/ }[want];
  check(`mode from ${q}`, s.mode === want && line.test(s.line) && s.present === q.includes("presenter"), JSON.stringify(s));
  await ctx.close();
}


await b.close();
if (fails.length) process.exit(1);
console.log("session-check ok");
