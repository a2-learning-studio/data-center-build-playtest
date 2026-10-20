// Runtime for Build the Campus: state, rules, panels and the 3D scene. One screen, no page scroll.
const D = __DATA__;
Object.assign(D.MODEL, (__LAYOUT_FNS__)(D.MODEL));
const STR = __STRINGS__;
let lang = "en";
const T = () => ({ ...STR.en, ...(STR[lang] || {}) });
const fmt = (s, o = {}) => String(s).replace(/\{(\w+)\}/g, (_, key) => o[key] ?? "");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const el = (tag, attrs = {}, html) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  if (html != null) node.innerHTML = html;
  return node;
};
const motionOff = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- modes and device settings ----------
// No mode: a library kiosk. It clears itself after a pause and saves nothing. ?mode=class and ?mode=home suspend
// both resets and keep the game in progress for this tab (sessionStorage). ?mode=library is the kiosk, voice off.
const URL_MODE = new URLSearchParams(location.search).get("mode");
const MODE = ["class", "home", "library"].includes(URL_MODE) ? URL_MODE : "kiosk";
const STAFFED = MODE === "class" || MODE === "home";
const NS = "build-the-campus:v1:";
const SAVE_VERSION = 1;
const store = {
  get(area, key) { try { const v = window[area].getItem(NS + key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(area, key, value) { try { window[area].setItem(NS + key, JSON.stringify(value)); } catch { /* storage can be blocked or full */ } },
  del(area, key) { try { window[area].removeItem(NS + key); } catch { /* storage can be blocked */ } },
};
// Library mode and the shortcut switch are remembered on this device (I8, I2). The voice choice is remembered only
// in class and home modes, so on a kiosk one V press never carries over to the next visitor.
const prefs = (() => {
  const p = store.get("localStorage", "prefs");
  const o = p && typeof p === "object" ? p : {};
  return { library: o.library === true, voice: o.voice !== false, keys: o.keys !== false, present: o.present === true };
})();
// Presenter view (I10): a bigger map and larger text for projectors. ?view=presenter starts in it.
const URL_PRESENT = new URLSearchParams(location.search).get("view") === "presenter";
const savePrefs = () => store.set("localStorage", "prefs", prefs);
const libraryOn = () => MODE === "library" || prefs.library;
const deviceVoice = () => !libraryOn() && (!STAFFED || prefs.voice);
// The model comes from model.mjs through the build (I19).
const M = D.MODEL;
const PH = M.PHASES;
const phaseOf = Object.fromEntries(PH.flatMap((p) => p.els.map((e) => [e, p.id])));
const { CHOICES, MEP, PHASE_START, BEFORE_EL, NEED_FIRST, PHASE_REQUIRED, EFFECT, CARD } = M;
// Test-only settings (idle time, voice speed). The production build strips the hooks that set them.
const testHooks = {};

// ---------- state ----------
let st;
const fresh = () => ({
  placed: new Set(),
  done: new Set(),
  focus: null,
  choice: { route: null, hours: null, buffer: null, wall: null, cool: null, light: null, test: null },
  frozenSched: {},
  cards: {},
  // Commissioning level reached by each MEP item: 0 none, 1 factory, 2 set in place, 3 start-up, 4 functional.
  cx: Object.fromEntries(MEP.map((id) => [id, 0])),
  xfmr: 0,
  log: [],
  ov: true,
  started: false,
  // Offsets, in metres, for pieces the player sited. seed/rolled remember construction-setback draws.
  layout: {},
  seed: (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1,
  rolled: {},
});
const ui = { tab: "build", side: "hood", hot: null, hoodSig: null, hoodNew: false };
// The piece the player is siting on the map, or null. Not saved: a reload returns to the button.
let placing = null;
// Plain copies of the state, for undo and for the class/home autosave.
const snapState = () => ({ ...st, placed: [...st.placed], done: [...st.done] });
function loadState(o) {
  if (!o || typeof o !== "object" || !Array.isArray(o.placed) || !Array.isArray(o.done)) return null;
  const base = fresh();
  const pick = (v, ok) => (ok.includes(v) ? v : null);
  const choice = Object.fromEntries(CHOICES.map((c) => [c, pick(o.choice?.[c], ["a", "b"])]));
  const cards = {};
  for (const [id, v] of Object.entries(o.cards || {})) if (CARD[id]) cards[id] = v == null ? null : pick(v, Object.keys(CARD[id].opts));
  const known = new Set([...PH.flatMap((p) => p.els), ...M.CX_FLAGS]);
  return {
    ...base,
    placed: new Set(o.placed.filter((e) => known.has(e))),
    done: new Set(o.done.filter((id) => PH.some((p) => p.id === id))),
    focus: PH.some((p) => p.id === o.focus) ? o.focus : null,
    choice,
    cards,
    frozenSched: { ...(o.frozenSched || {}) },
    cx: Object.fromEntries(MEP.map((id) => [id, clamp(Number(o.cx?.[id]) || 0, 0, 4)])),
    xfmr: o.xfmr ? 1 : 0,
    log: Array.isArray(o.log) ? o.log.slice(0, 6).map(String) : [],
    ov: o.ov !== false,
    started: true,
    layout: cleanLayout(o.layout),
    seed: Number.isFinite(Number(o.seed)) ? (Number(o.seed) >>> 0) || 1 : 1,
    rolled: cleanRolled(o.rolled),
  };
}
function cleanLayout(raw) {
  const out = {};
  for (const id of Object.keys(M.LAYOUT || {})) {
    const v = raw?.[id];
    const x = Number(v?.x), z = Number(v?.z);
    if (Number.isFinite(x) && Number.isFinite(z)) out[id] = { x, z };
  }
  return out;
}
function cleanRolled(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const p of PH) if (typeof raw[p.id] === "string") out[p.id] = raw[p.id];
  return out;
}
function rng() {
  st.seed = (Math.imul(st.seed, 1664525) + 1013904223) >>> 0;
  return st.seed / 4294967296;
}
let history = [];
function remember() {
  history.push(JSON.stringify(snapState()));
  if (history.length > 30) history.shift();
}
function autosave() {
  if (!STAFFED || !st?.started) return;
  store.set("sessionStorage", "save", { v: SAVE_VERSION, at: Date.now(), state: snapState() });
}
const clearSave = () => store.del("sessionStorage", "save");
function readSave() {
  if (!STAFFED) return null;
  const s = store.get("sessionStorage", "save");
  return s && s.v === SAVE_VERSION && s.state ? s : null;
}
const started = (id) => PH.find((p) => p.id === id).els.some((e) => st.placed.has(e));
const ready = (p) => p.after.every((a) => st.done.has(a));
const powerOn = () => st.placed.has("substation") && st.placed.has("transmission");
const gearAt = (n) => MEP.filter((id) => (st.cx[id] || 0) >= n).length;
function syncCx() {
  for (const [flag, n] of [["L1", 1], ["L2", 2], ["L3", 3], ["L4", 4]]) {
    if (gearAt(n) === MEP.length) st.placed.add(flag);
    else st.placed.delete(flag);
  }
}
// ---------- model ----------
function effects() {
  const sum = { budget: 0, hood: 0, safety: 0, sched: {}, storm: 0, night: 0 };
  const add = (e) => {
    if (!e) return;
    for (const key of ["budget", "hood", "safety", "storm", "night"]) sum[key] += e[key] || 0;
    for (const [p, m] of Object.entries(e.sched || {})) sum.sched[p] = (sum.sched[p] || 0) + m;
  };
  for (const c of CHOICES) if (st.choice[c]) add(EFFECT[c][st.choice[c]]);
  for (const [id, pick] of Object.entries(st.cards)) if (pick) add(CARD[id].opts[pick]);
  return sum;
}
// live: ignore the months frozen when each phase finished (used to say what each answer added, at the end).
function schedule({ live = false, none = false } = {}) {
  const e = none ? { sched: {} } : effects();
  const frozen = (id) => !live && !none && Object.prototype.hasOwnProperty.call(st.frozenSched, id);
  const extra = (id) => (frozen(id) ? st.frozenSched[id] : e.sched[id] || 0);
  const dur = Object.fromEntries(PH.map((p) => [p.id, (p.months[0] + p.months[1]) / 2 + extra(p.id)]));
  const start = {}, finish = {}, via = {};
  for (const p of PH) {
    start[p.id] = 0;
    for (const a of p.after) if (finish[a] > start[p.id]) { start[p.id] = finish[a]; via[p.id] = a; }
    finish[p.id] = start[p.id] + dur[p.id];
  }
  const crit = new Set();
  for (let id = "turn"; id; id = via[id]) crit.add(id);
  return { dur, start, finish, crit, total: finish.turn };
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
// One word scale for every tile: 0 Concern, 1 Watch, 2 Fair, 3 Good, 4 Strong. The dot colour follows the word.
const scoreIdx = (score) => (score < 30 ? 0 : score < 45 ? 1 : score < 60 ? 2 : score < 80 ? 3 : 4);
// Schedule: Strong at or under the plan, Good up to two months over, Fair up to four over, Watch beyond.
const schedIdx = (m) => (m <= M.BASE_MONTHS ? 4 : m <= M.BASE_MONTHS + 2 ? 3 : m <= M.BASE_MONTHS + 4 ? 2 : 1);
// Budget: Strong inside the plan's 3% contingency, then Good, Fair and Watch (M.BUDGET_BANDS).
const budgetIdx = (b) => { const [s, g, f] = M.BUDGET_BANDS; return b <= s ? 4 : b <= g ? 3 : b <= f ? 2 : 1; };
const levelWord = (score) => T().level[scoreIdx(score)];
function choiceLocked(c) {
  if (st.done.has("turn")) return true;
  if (c === "buffer") return st.placed.has("clear");
  if (c === "wall") return st.placed.has("roads");
  // Cooling is a design decision: it locks once the permits are approved.
  if (c === "cool") return st.done.has("site");
  // Work hours lock when grading is finished, because grading's months freeze then; the route stays open
  // through foundations, the other heavy-truck phase.
  if (c === "hours") return st.done.has("grade");
  if (c === "route") return st.done.has("found");
  if (c === "light") return st.done.has("shell");
  if (c === "test") return MEP.some((id) => (st.cx[id] || 0) >= 3);
  return false;
}
function hood() {
  const c = st.choice;
  const e = effects();
  const s = (id) => started(id);
  const d = (id) => st.done.has(id);
  const heavy = s("grade") && !d("shell");
  const building = s("grade") && !d("turn");
  const ops = d("turn");
  // Night work ends when the MEP phase ends. It does not keep glowing through operations.
  const nightWork = (c.hours === "b" || e.night) && s("mep") && !d("mep");
  const L = {};
  const routeMod = c.route === "b" ? 1 : c.route === "a" ? -1 : 0;
  const hoursMod = c.hours === "b" ? 1 : 0;
  L.trucks = !s("grade") ? 0 : ops ? 1 : clamp((heavy ? 3 : 2) + routeMod + hoursMod, 1, 4);
  if (!s("grade")) L.noise = 0;
  else if (ops) {
    let n = c.cool === "a" ? 2 : 1;
    if (c.wall === "a" || c.buffer === "a") n -= 1;
    if (c.test === "b") n += 1;
    L.noise = clamp(n, 1, 4);
  } else L.noise = clamp((heavy ? 3 : 2) + (c.wall === "a" ? -1 : 0) + (nightWork || c.hours === "b" ? 1 : 0), 1, 4);
  // The score keeps a flat operating-noise baseline so cooling is not a point for or against the project.
  L.noiseScore = ops ? 1 : L.noise;
  const dusty = s("grade") && !d("found") ? 3 + (e.storm ? 1 : 0) : 0;
  const glow = (building ? 1 : 0) + (ops ? 1 : 0) + (nightWork ? 1 : 0) + (c.light === "b" ? 1 : 0);
  L.dust = clamp(Math.max(dusty, glow), 0, 4);
  L.storm = !s("grade") ? 0 : st.placed.has("ponds") ? (e.storm ? 2 : 1) : 3 + (e.storm ? 1 : 0);
  L.water = !s("util") ? 0 : ops ? (c.cool === "b" ? 3 : 1) : 1;
  L.power = !s("util") ? 0 : ops ? (c.cool === "a" ? 4 : 3) : 1;
  L.gens = !st.placed.has("gens") ? 0 : clamp((st.cx.gens >= 3 && !ops ? 2 : 1) + (c.test === "b" ? 1 : 0), 1, 4);
  L.jobs = !s("grade") ? 0 : ops ? 1 : s("mep") && !d("fitout") ? 4 : d("fitout") ? 2 : 3;
  L.tax = !d("shell") ? 0 : ops ? 3 : 1;
  L.setback = !st.placed.has("panels") ? (s("grade") ? 1 : 0) : c.buffer === "a" ? 1 : c.buffer === "b" ? 3 : 2;
  L._glow = glow;
  L._dusty = dusty;
  return L;
}
// The midpoint critical path with no added months: the budget's delay cost counts from here (I11).
const PATH_MONTHS = (() => {
  const fin = {};
  for (const p of PH) fin[p.id] = Math.max(0, ...p.after.map((a) => fin[a])) + (p.months[0] + p.months[1]) / 2;
  return fin.turn;
})();
function scores({ live = false } = {}) {
  const e = effects();
  const L = hood();
  const total = schedule({ live }).total;
  const budget = 100 + e.budget + M.DELAY_PCT * Math.max(0, total - PATH_MONTHS);
  const hoodRaw = M.SCORE_START.hood + e.hood - 2 * (L.trucks + L.noiseScore + L.dust);
  return {
    budget: Math.round(budget * 10) / 10,
    safety: clamp(M.SCORE_START.safety + e.safety, 0, 100),
    hood: clamp(hoodRaw, 0, 100),
    months: Math.round(total),
    total,
    budgetRaw: budget,
    safetyRaw: M.SCORE_START.safety + e.safety,
    hoodRaw,
  };
}

// ---------- the 3D scene ----------
const canvas = $("[data-scene]");
let scene = null;
try {
  scene = createScene(canvas, {
    reduced: () => motionOff.matches,
    signs: () => [T().signNotice, T().signNotice2, T().signCampus],
    onMode: (zoomed) => onCamMode(zoomed),
  });
} catch (err) {
  document.body.dataset.nogl = "";
  console.warn("3D view unavailable", err);
}
function paintScene(animate = true) {
  if (!scene) return;
  scene.apply((u) => {
    const optOk = !u.opt || st.choice[u.opt.split(":")[0]] === u.opt.split(":")[1];
    const keepIt = u.keep && st.choice[u.keep.split(":")[0]] === u.keep.split(":")[1];
    const needOk = !u.need || st.placed.has(u.need);
    return (!u.show || st.placed.has(u.show)) && needOk && optOk && !(u.hide && st.placed.has(u.hide) && !keepIt);
  }, animate);
  const L = hood();
  const on = (v) => ({ on: !!v, level: 0 });
  const layers = {
    "route-a": { on: L.trucks > 0 && st.choice.route === "a", level: L.trucks },
    "route-b": { on: L.trucks > 0 && st.choice.route === "b", level: L.trucks },
    noise: { on: L.noise > 0, level: L.noise },
    gens: { on: L.gens > 1, level: L.gens },
    dust: { on: L._dusty > 0, level: L._dusty },
    glow: { on: L._glow > 1, level: L._glow },
    storm: on(st.placed.has("ponds")),
    plume: on(st.placed.has("cooling") && st.choice.cool === "b"),
    power: on(st.placed.has("transmission")),
    setback: on(st.placed.has("zoning")),
  };
  scene.overlays({ on: st.ov, layers, trucks: st.choice.route ? L.trucks : 0, route: st.choice.route || "a", focus: ui.hot ? OV_OF[ui.hot] || [] : null });
  scene.setShifts(shiftMap());
}
const HOT_SPOT = { trucks: [200, 40], noise: [-60, 40], dust: [-40, -60], storm: [-60, 30], water: [55, -47], power: [170, -130], gens: [86, -100], setback: [-60, 92] };
const OV_OF = { trucks: ["route-a", "route-b"], noise: ["noise"], dust: ["dust", "glow"], storm: ["storm"], water: ["plume"], power: ["power"], gens: ["gens"], setback: ["setback"] };

// Keep in step with the tabbed-layout media query in style.css.
const TABBED = matchMedia("(max-width: 1023px), (max-width: 1100px) and (orientation: portrait), (max-width: 1100px) and (max-height: 600px)");
// The longest narration line heard during play (issue cards, the intro and the end are read inside their dialogs).
let capProbe = null;
function captionRoom() {
  const cap = $("[data-caption]");
  if (!capProbe) {
    capProbe = cap.cloneNode(false);
    capProbe.removeAttribute("data-caption");
    capProbe.removeAttribute("aria-live");
    capProbe.setAttribute("aria-hidden", "true");
    Object.assign(capProbe.style, { visibility: "hidden", maxHeight: "none" });
    cap.after(capProbe);
  }
  const lines = Object.entries(D.CAPTIONS[lang] || D.CAPTIONS.en).filter(([k]) => !/^(intro|end|card:)/.test(k)).map(([, v]) => v);
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  if (capProbe.textContent !== longest) capProbe.textContent = longest;
  capProbe.hidden = !longest || !voiceBtnShown();
  return capProbe.hidden ? 0 : capProbe.offsetHeight;
}
const voiceBtnShown = () => Object.keys(D.VOICE.en || {}).length > 0;
function measureSafe() {
  const root = document.documentElement.style;
  const tools = $(".tools");
  const cam = $(".cam");
  const toolsB = tools.offsetTop + tools.offsetHeight;
  // Room for the toolbar, the longest narration caption and the map buttons, so none of them overlap (I9):
  // the side-panel layout caps the schedule's height (it scrolls), the tabbed layout makes the map taller.
  const capH = captionRoom();
  const capGap = capH ? capH + 16 : 8;
  // Both depend only on the width; style.css does the height arithmetic, so the layout is right before this runs.
  root.setProperty("--top-room", `${Math.ceil(toolsB + capGap)}px`);
  root.setProperty("--cam-h", `${cam.offsetHeight}px`);
  if (TABBED.matches) root.setProperty("--scene-min", `${Math.ceil(toolsB + capGap + cam.offsetHeight + 8)}px`);
  else root.removeProperty("--scene-min");
  const p = $(".p-plan").getBoundingClientRect();
  if (!TABBED.matches) root.setProperty("--plan-h", `${p.height}px`);
  // Measured after --plan-h moves the map buttons: the caption fits between the toolbar and those buttons.
  root.setProperty("--tools-b", `${tools.offsetTop + tools.offsetHeight}px`);
  root.setProperty("--cam-t", `${cam.offsetTop}px`);
  pinPad();
  if (!scene) return;
  const c = canvas.getBoundingClientRect();
  if (TABBED.matches) return scene.setSafe({ x: 0, y: 0, w: c.width, h: c.height });
  // The open map area between the panels. Presenter view hides the side panel and the schedule.
  const b = $(".p-build").getBoundingClientRect();
  const s = $(".p-side").getBoundingClientRect();
  const x = b.width ? b.right - c.left : 0;
  const r = s.width ? s.left - c.left : c.width;
  const bottom = p.height ? p.top - c.top : c.height;
  scene.setSafe({ x, y: 0, w: Math.max(200, r - x), h: Math.max(200, bottom) });
}
// Dialogs with a pinned button row keep focused controls clear of it (scroll-padding-bottom, WCAG 2.4.11).
function pinPad() {
  for (const [d, sel] of [[$("[data-intro]"), ".intro-btns"], [$("[data-end]"), ".dlg-foot"]]) {
    const row = d.open && $(sel, d);
    if (row) d.style.setProperty("--pin-h", `${row.offsetHeight + 12}px`);
  }
}
const sizeWatch = new ResizeObserver(measureSafe);
sizeWatch.observe(document.body);
sizeWatch.observe($(".tools"));
sizeWatch.observe($(".p-plan"));
sizeWatch.observe($(".cam"));
// Map buttons (WCAG 2.5.7): every drag, pinch and twist has a button. The move buttons appear when zoomed in.
let zoomTipShown = false;
function onCamMode(zoomed) {
  const t = T();
  // Small phones show the short form, so the hint stays on one line above the map buttons.
  const long = placing ? t.placeDrag : zoomed ? t.dragHintZoomed : t.dragHint;
  const short = placing ? t.placeDragShort : zoomed ? t.dragHintZoomedShort : t.dragHintShort;
  $("[data-hint]").innerHTML = `<span class="long">${esc(long)}</span><span class="short">${esc(short)}</span>`;
  $("[data-cam-move]").hidden = !zoomed;
  if (zoomed && !zoomTipShown) {
    zoomTipShown = true;
    const hint = $("[data-hint]");
    hint.classList.add("hint-new");
    setTimeout(() => hint.classList.remove("hint-new"), 4500);
    $("[data-alert]").textContent = t.zoomTip;
  }
}
$("[data-cam]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cam-act]");
  if (!b) return;
  if (b.dataset.camAct === "present") setPresent(!document.body.hasAttribute("data-present"), true);
  else scene?.act(b.dataset.camAct);
});
// Presenter view (I10): the side panel and the schedule step aside so the map fills the stage, and the text is
// larger for a projector. The Build panel and the scores stay. The device remembers it, like Library mode.
const presentBoxes = () => $$("[data-present-pref]");
function setPresent(on, remember = false) {
  document.body.toggleAttribute("data-present", on);
  document.documentElement.toggleAttribute("data-present", on);
  for (const b of $$("[data-cam-act=present]")) b.setAttribute("aria-pressed", on);
  for (const box of presentBoxes()) box.checked = on;
  if (remember) { prefs.present = on; savePrefs(); }
  measureSafe();
}

// ---------- panels ----------
const status = $("[data-status]");
function say(text) {
  st.log.unshift(text);
  st.log = st.log.slice(0, 6);
  status.textContent = text;
}
// A short visible message for a click that did nothing (a locked phase, or an issue card about to open), so it is
// seen on every tab and on touch screens, where tooltips never show. Screen readers get it from the status line.
const toastEl = $("[data-toast]");
let toastTimer = 0;
function toast(text, { log = false } = {}) {
  if (log) say(text);
  else status.textContent = text;
  toastEl.textContent = text;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), Math.min(9000, Math.max(3500, text.length * 55)));
}
const waitForCard = () => toast(T().waitCard);
const ICON = {
  done: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="currentColor"/><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

function cxState(n) {
  const t = T();
  const k = gearAt(n);
  return k >= MEP.length ? t.cxDone : k ? fmt(t.cxOf, { n: k }) : t.cxWait;
}
function cxTrackHtml() {
  const t = T();
  const show = MEP.some((id) => st.cx[id] > 0) || st.xfmr || started("mep") || ["util", "mep", "fitout", "cx"].includes(st.focus);
  if (!show) return "";
  const row = (id, detail, state) => `<li data-cx="${esc(id)}"><span><b>${esc(t.elements[id].name)}</b> — ${esc(detail)}</span><span>${esc(state)}</span></li>`;
  const gear = MEP.map((id) => `<li data-cx="${esc(id)}"><span><b>${esc(t.elements[id].name)}</b></span><span>${esc(st.cx[id] ? fmt(t.cxLv, { n: st.cx[id] }) : t.cxWait)}</span></li>`);
  const rows = [
    row("L1", t.cxWhen.L1, cxState(1)),
    row("L2", t.cxWhen.L2, cxState(2)),
    row("L3", t.cxWhen.L3, cxState(3)),
    row("L4", t.cxWhen.L4, cxState(4)),
    ...gear,
    row("substation", t.cxWhen.L1, st.xfmr ? t.cxDone : t.cxWait),
    row("L5", t.cxWhen.L5, st.placed.has("L5") ? t.cxDone : t.cxWait),
  ];
  return `<p class="log-h">${esc(t.cxTrackTitle)}</p><ul class="cx">${rows.join("")}</ul><p class="muted">${esc(t.cxTrackNote)}</p>`;
}
// The short form shown on the button itself, so the reason is visible without a tooltip.
function blockShort(e) {
  const t = T();
  const why = blockReason(e);
  if (!why) return "";
  if (why === t.clearWait) return t.clearShort;
  if (why === t.cxNeedL5) return t.cxNeedL5Short;
  return why === t.notYet ? "" : why;
}
function blockReason(e) {
  const t = T();
  if ((NEED_FIRST[e] || []).some((x) => !st.placed.has(x))) return e === "clear" ? t.clearWait : t.notYet;
  if (e === "L5" && !MEP.every((id) => st.cx[id] >= 4)) {
    if (powerOn() && st.choice.test && MEP.every((id) => st.cx[id] >= 3)) return "";
    return t.cxNeedL5;
  }
  return "";
}
function actLabel(e, done) {
  const t = T();
  if (done) return t.placed;
  if (blockReason(e)) return t.notYet;
  if ((e === "substation" || e === "switchgear") && !st.cards.longlead) return t.orderAct;
  if (e === "substation" && !st.xfmr) return t.factoryAct;
  if (MEP.includes(e) && !st.cx[e]) return t.factoryAct;
  if (e === "L5" && MEP.some((id) => st.cx[id] === 3)) return t.cxRunL4;
  if (M.LAYOUT[e]) return placing?.id === e ? t.placeSet : t.placeMap;
  return t.place;
}
function placeBoxHtml() {
  const t = T();
  if (!placing) return "";
  const hint = t.placeHint[placing.id] || "";
  return `<div class="place-box" data-place-box><p class="kicker">${esc(t.placeKicker)}</p><p>${esc(hint)}</p><p class="place-why" data-place-why></p><div class="place-actions"><button type="button" class="btn btn-small" data-place-set>${esc(t.placeSet)}</button><button type="button" class="btn btn-ghost btn-small" data-place-cancel>${esc(t.placeCancel)}</button></div></div>`;
}
function renderBuild() {
  const t = T();
  const box = $("[data-build]");
  const p = PH.find((q) => q.id === st.focus);
  const next = PH.find((q) => ready(q) && !st.done.has(q.id) && !started(q.id)) || PH.find((q) => ready(q) && !st.done.has(q.id));
  let html = "";
  if (!p) {
    if (next) {
      html = `<p class="kicker">${fmt(t.phaseOf, { n: PH.indexOf(next) + 1 })}</p><h2>${esc(t.phases[next.id].name)}</h2><p class="muted">${esc(t.phases[next.id].log)}</p><button type="button" class="btn btn-wide" data-go="${next.id}">${esc(fmt(t.nextHint, { name: t.phases[next.id].name }))}</button>`;
    } else html = `<p class="muted">${esc(t.pickPhase)}</p>`;
  } else {
    const all = p.els.every((e) => st.placed.has(e));
    html = `${placeBoxHtml()}<p class="kicker">${fmt(t.phaseOf, { n: PH.indexOf(p) + 1 })}</p><h2>${esc(t.phases[p.id].name)}</h2>
      <p class="muted">${esc(t.phases[p.id].log)} <span class="range">${p.months[0]}–${p.months[1]} ${esc(t.schedAxis)} · ${esc(t.typical)}</span></p>
      <ul class="els">${p.els
        .map((e) => {
          const done = st.placed.has(e);
          const why = !done ? blockReason(e) : "";
          const title = why || (done ? t.showOnMap : "");
          const short = why ? blockShort(e) : "";
          return `<li><button type="button" class="el" data-el="${e}"${done ? " data-done" : ""}${why ? " disabled" : ""} title="${esc(title)}"><span class="el-mark">${done ? ICON.done : why ? ICON.lock : ICON.plus}</span><span class="el-name">${esc(t.elements[e].name)}${short ? `<span class="el-why">${esc(short)}</span>` : ""}</span><span class="el-act">${esc(actLabel(e, done))}</span></button></li>`;
        })
        .join("")}</ul>
      <button type="button" class="btn btn-wide" data-finish${all ? "" : " disabled"}>${esc(all ? fmt(t.finishPhase, { name: t.phases[p.id].short }) : t.finishNeed)}</button>`;
  }
  html += `${cxTrackHtml()}<p class="log-h">${esc(t.logTitle)}</p><ul class="log">${st.log.slice(0, 3).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  const canUndo = history.length > 0 && !st.done.has("turn");
  html += `<div class="game-btns"><button type="button" class="btn btn-ghost btn-small" data-undo${canUndo ? "" : " disabled"}>${esc(t.undo)}</button><button type="button" class="btn btn-ghost btn-small" data-restart>${esc(t.startOver)}</button></div>`;
  const keep = document.activeElement?.matches?.("[data-undo], [data-restart]") ? (document.activeElement.hasAttribute("data-undo") ? "[data-undo]" : "[data-restart]") : "";
  box.innerHTML = html;
  fillPlaceWhy();
  if (keep) $(keep, box)?.focus({ preventScroll: true });
}
$("[data-build]").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (cardPending && !b.matches("[data-restart], [data-undo], [data-done]")) { waitForCard(); return; }
  if (b.hasAttribute("data-undo")) undo();
  else if (b.hasAttribute("data-restart")) askStartOver();
  else if (b.hasAttribute("data-place-set")) confirmPlace();
  else if (b.hasAttribute("data-place-cancel")) { endPlace(); renderBuild(); focusNext(); }
  else if (b.dataset.el && b.hasAttribute("data-done")) { scene?.focus(b.dataset.el); showTag(b.dataset.el); }
  else if (b.dataset.el) place(b.dataset.el);
  else if (b.hasAttribute("data-finish")) finishPhase(st.focus);
  else if (b.dataset.go) pickPhase(b.dataset.go);
});

function renderPlan() {
  const t = T();
  const sc = schedule();
  const maxM = Math.max(48, Math.ceil((sc.total + 3) / 12) * 12);
  const pct = (m) => `${((m / maxM) * 100).toFixed(2)}%`;
  const lanes = PH.map((p, i) => {
    const state = st.done.has(p.id) ? "done" : !ready(p) ? "locked" : started(p.id) ? "now" : "ready";
    const shown = state === "done" || state === "now" || p.id === st.focus;
    const s0 = sc.start[p.id];
    const bar = shown
      ? `<span class="range-line" style="left:${pct(s0 + p.months[0])};width:${pct(p.months[1] - p.months[0])}"></span><span class="gbar" data-state="${state}" data-crit="${sc.crit.has(p.id) ? 1 : 0}" style="left:${pct(s0)};width:${pct(sc.dur[p.id])}"></span>`
      : "";
    const icon = state === "done" ? ICON.done : state === "locked" ? ICON.lock : `<b>${i + 1}</b>`;
    const sr = [t.laneState[state], sc.crit.has(p.id) && shown ? t.laneCrit : "", shown ? fmt(t.laneMonths, { n: Math.round(sc.dur[p.id]) }) : ""].filter(Boolean).join(" · ");
    const lockedTitle = fmt(t.phaseLocked, { list: p.after.filter((a) => !st.done.has(a)).map((a) => t.phases[a].short).join(", ") });
    return `<li><button type="button" class="lane" data-phase="${p.id}" data-state="${state}" aria-pressed="${st.focus === p.id}" title="${esc(state === "locked" ? `${lockedTitle}. ${t.phases[p.id].why}` : t.phases[p.id].name)}"><span class="lane-icon">${icon}</span><span class="lane-name">${esc(t.phases[p.id].short)}</span><span class="sr"> (${esc(sr)})</span><span class="track">${bar}</span></button></li>`;
  }).join("");
  const ticks = [];
  for (let m = 0; m <= maxM; m += 6) ticks.push(`<span style="left:${pct(m)}">${m}</span>`);
  // The legend stays visible on short screens, where the longer note is hidden; the bar patterns carry the
  // meaning without colour (I3, WCAG 1.4.1).
  const legend = `<p class="legend"><span><i class="sw sw-crit"></i>${esc(t.legendCrit)}</span><span><i class="sw sw-other"></i>${esc(t.legendOther)}</span><span><i class="sw sw-now"></i>${esc(t.legendNow)}</span></p>`;
  $("[data-plan]").innerHTML = `<div class="plan-head"><h2>${esc(t.schedTitle)} <small>(${esc(t.schedAxis)})</small></h2><p class="plan-total">${esc(started("site") ? fmt(t.schedTotal, { n: Math.round(sc.total), base: M.BASE_MONTHS }) : t.schedEmpty)}</p></div>
    <ol class="lanes">${lanes}</ol><div class="axis"><span class="axis-pad"></span><span class="axis-track">${ticks.join("")}</span></div>
    ${legend}<p class="plan-note">${esc(t.schedNote)}</p>`;
}
$("[data-plan]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-phase]");
  if (b) pickPhase(b.dataset.phase);
});

// Effect chips for a choice or an issue-card answer (I4, I5). The schedule chip is the real change in the finish
// date: the schedule with this answer minus the schedule without it, from where the game stands now. Points are
// shown as numbers, and neighbor points say when they start to count.
function withPick(kind, id, o, fn) {
  const box = kind === "card" ? st.cards : st.choice;
  const had = Object.prototype.hasOwnProperty.call(box, id);
  const old = box[id];
  box[id] = o;
  try { return fn(); } finally { if (had) box[id] = old; else delete box[id]; }
}
const signed = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
function chipsFor(kind, id, o) {
  const t = T();
  const all = kind === "card" ? CARD[id].opts : EFFECT[id];
  const e = all[o];
  const base = withPick(kind, id, null, () => schedule().total);
  const delta = (k) => Math.round((withPick(kind, id, k, () => schedule().total) - base) * 2) / 2;
  const d = delta(o);
  const others = Object.keys(all).filter((k) => k !== o);
  const chips = [];
  if (d > 0) chips.push([t.cardChips.sched, `+${fmt(t.dashMonthsShort, { n: d })}`, "bad"]);
  else if (others.some((k) => delta(k) > 0)) chips.push([t.cardChips.sched, t.chipNoDelay, "neutral"]);
  // The budget chip is the real change too: the answer's own cost plus the cost of any delay it causes (I11).
  const money = Math.round((withPick(kind, id, o, () => scores().budgetRaw) - withPick(kind, id, null, () => scores().budgetRaw)) * 10) / 10;
  if (money > 0) chips.push([t.cardChips.budget, `+${money}%`, "bad"]);
  if (e.safety) chips.push([t.cardChips.safety, signed(e.safety), e.safety > 0 ? "good" : "bad"]);
  const later = started("grade") ? "" : ` · ${t.chipFromGrading}`;
  if (e.hood) chips.push([t.cardChips.hood, `${signed(e.hood)}${later}`, e.hood > 0 ? "good" : "bad"]);
  else if (others.some((k) => (all[k].hood || 0) > 0)) chips.push([t.chipNoBonus, "", "neutral"]);
  // Cooling's power and water use show on the panel once the campus opens.
  const opening = st.done.has("turn") ? "" : ` · ${t.chipFromOpening}`;
  if (e.tags?.includes("power")) chips.push([`${t.chipPowerMore}${opening}`, "", "neutral"]);
  if (e.tags?.includes("water")) chips.push([`${t.chipWaterMore}${opening}`, "", "neutral"]);
  if (e.permit) chips.push([t.chipPermit, "", "bad"]);
  return chips.length ? `<span class="chips">${chips.map(([k, v, tone]) => `<span class="chip" data-tone="${tone}">${esc(v ? `${k} ${v}` : k)}</span>`).join("")}</span>` : "";
}
function jobsKey() {
  if (!started("grade")) return "none";
  if (st.done.has("turn")) return "ops";
  if (started("mep") && !st.done.has("fitout")) return "peak";
  if (st.done.has("fitout")) return "wind";
  return "build";
}
function renderSide() {
  const t = T();
  const L = hood();
  const ops = st.done.has("turn");
  const youSaid = { trucks: ["route", "hours"], noise: ["wall", "hours", "cool", "buffer"], dust: ["light"], water: ["cool"], power: ["cool"], gens: ["test"], setback: ["buffer"] };
  const row = (key, kind) => {
    const level = L[key] ?? 0;
    const planned = (key === "water" || key === "power") && started("util") && !ops;
    const word = key === "jobs" ? t.hood.jobsNow[jobsKey()] : planned ? t.hood.planned : kind === "amount" ? t.hood.amounts[level] : t.hood.levels[level];
    return `<li><button type="button" class="hood-row" data-key="${key}" data-kind="${kind}" aria-pressed="${ui.hot === key}"><span class="hood-name">${esc(t.hood[key].name)}</span><span class="meter" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<i${n <= level ? " data-on" : ""}></i>`).join("")}</span><span class="hood-word">${esc(word)}</span></button></li>`;
  };
  const notice = ["trucks", "noise", "dust", "storm", "gens", "setback"];
  const community = ["jobs", "tax", "power", "water"];
  $("[data-hood]").innerHTML = `<li class="hood-h">${esc(t.hoodNotice)}</li>${notice.map((k) => row(k, "notice")).join("")}<li class="hood-h">${esc(t.hoodCommunity)}</li>${community.map((k) => row(k, "amount")).join("")}`;
  const k = ui.hot;
  const picks = (youSaid[k] || []).filter((c) => st.choice[c]);
  $("[data-hood-detail]").innerHTML = k
    ? `<b>${esc(t.hood[k].name)}</b><span>${esc(t.hood[k].fact)}</span>${picks.length ? `<span class="you">${esc(t.hoodYou)}${picks.map((c) => esc(t.choices[c][st.choice[c]].label)).join(" · ")}</span>` : ""}`
    : `<span>${esc(t.hoodDetailHint)}</span>`;
  $("[data-hood-score]")?.remove();
  $("[data-hood-detail]").insertAdjacentHTML("afterend", `<div data-hood-score><p class="hood-break">${esc(hoodBreakdown())}</p><p class="hood-score">${esc(t.hoodScoreNote)}</p></div>`);
  markHoodTab(L);
  $("[data-choices]").innerHTML = CHOICES.map((c) => {
    const locked = choiceLocked(c);
    const v = st.choice[c];
    return `<div class="choice"${locked ? " data-locked" : ""}><div class="choice-head"><span class="choice-name">${esc(t.choices[c].name)}</span>${locked ? `<span class="lock">${ICON.lock}${esc(t.lockedAfter)}</span>` : ""}</div>
      <div class="seg" role="group" aria-label="${esc(t.choices[c].name)}">${["a", "b"].map((o) => `<button type="button" data-choice="${c}" data-v="${o}" aria-pressed="${v === o}"${locked && v !== o ? " disabled" : ""}>${esc(t.choices[c][o].label)}</button>`).join("")}</div>
      <p class="choice-note">${esc(v ? t.choices[c][v].note : t.choiceUnset)} ${v ? chipsFor("choice", c, v) : ""}</p></div>`;
  }).join("");
  $("[data-choices]").insertAdjacentHTML("afterbegin", `<p class="choices-note">${esc(t.choicesNote)}</p>`);
  for (const b of $$("[data-side-tab]")) b.setAttribute("aria-pressed", b.dataset.sideTab === ui.side);
  document.body.dataset.side = ui.side;
}
// How the neighbor score is made up right now, so the first reading at grading is explained (I4, C9).
function hoodBreakdown() {
  const t = T();
  const pts = effects().hood;
  if (!started("grade")) return pts ? fmt(t.hoodBreakWaitPts, { pts: signed(pts) }) : t.hoodBreakWait;
  const L = hood();
  const rows = 2 * (L.trucks + L.noiseScore + L.dust);
  const s = scores().hood;
  const text = fmt(t.hoodBreak, { score: s, pts: pts ? signed(pts) : "+0", rows });
  return 35 + pts - rows === s ? text : `${text} ${t.hoodBreakClamp}`;
}
// A dot on the Neighbors tab when that panel changed while another panel was showing (I4).
function markHoodTab(L) {
  const sig = JSON.stringify([L.trucks, L.noise, L.dust, L.storm, L.gens, L.setback, L.jobs, L.tax, L.power, L.water, started("grade") ? scores().hood : null]);
  const seen = TABBED.matches ? ui.tab === "hood" : ui.side === "hood" && !document.body.hasAttribute("data-present");
  if (seen || !st.started) ui.hoodNew = false;
  else if (ui.hoodSig != null && sig !== ui.hoodSig) ui.hoodNew = true;
  ui.hoodSig = sig;
  const t = T();
  for (const b of $$('[data-side-tab="hood"], .tabs [data-tab="hood"]')) {
    b.toggleAttribute("data-new", ui.hoodNew);
    if (ui.hoodNew) b.setAttribute("aria-label", `${b.textContent} · ${t.tabNew}`);
    else b.removeAttribute("aria-label");
  }
}
function focusHood(key, toggle) {
  if (!key) return;
  if (toggle) ui.hot = ui.hot === key ? null : key;
  else if (ui.hot === key) return;
  else ui.hot = key;
  const keep = document.activeElement?.closest?.("[data-key]")?.dataset.key;
  renderSide();
  paintScene(false);
  if (keep) $(`[data-hood] [data-key="${keep}"]`)?.focus({ preventScroll: true });
  const spot = HOT_SPOT[ui.hot];
  if (spot && st.ov) scene?.lookAt(spot[0], spot[1]);
}
$("[data-hood]").addEventListener("pointerover", (e) => {
  if (e.pointerType && e.pointerType !== "mouse") return;
  const b = e.target.closest("[data-key]");
  if (b) focusHood(b.dataset.key, false);
});
$("[data-hood]").addEventListener("focusin", (e) => {
  const b = e.target.closest("[data-key]");
  if (b) focusHood(b.dataset.key, false);
});
$("[data-hood]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]");
  if (b) focusHood(b.dataset.key, true);
});
$("[data-choices]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-choice]");
  if (b && !b.disabled) choose(b.dataset.choice, b.dataset.v);
});
for (const b of $$("[data-side-tab]")) b.addEventListener("click", () => { ui.side = b.dataset.sideTab; renderSide(); });
for (const b of $$(".tabs [data-tab]")) b.addEventListener("click", () => setTab(b.dataset.tab));
function setTab(tab) {
  ui.tab = tab;
  if (tab === "hood" || tab === "choices") ui.side = tab;
  document.body.dataset.view = tab;
  for (const b of $$(".tabs [data-tab]")) b.setAttribute("aria-pressed", b.dataset.tab === tab);
  renderSide();
}

function renderDash() {
  const t = T();
  const s = scores();
  // Every tile shows its rating word at every width, next to the dot (I3, WCAG 1.4.1).
  const tile = (key, value, word, level, short = value, wordShort = word) => {
    const node = $(`[data-dash="${key}"]`);
    $(".kpi-val", node).innerHTML = `<span class="long">${esc(value)}</span><span class="short">${esc(short)}</span>`;
    $(".kpi-word", node).innerHTML = `<span class="long">${esc(word)}</span><span class="short">${esc(wordShort)}</span>`;
    node.dataset.level = level;
  };
  const bl = budgetIdx(s.budget);
  const sl = schedIdx(s.months);
  const said = {};
  const add = (key, name, value, word) => { said[key] = fmt(t.scoreLive, { name, value, word }); };
  tile("schedule", fmt(t.dashMonths, { n: s.months }), t.level[sl], sl, fmt(t.dashMonthsShort, { n: s.months }));
  add("schedule", t.dashSchedule, fmt(t.dashMonths, { n: s.months }), t.level[sl]);
  tile("budget", fmt(t.dashBudgetVal, { n: s.budget }), t.level[bl], bl, `${Math.round(s.budget)}%`);
  add("budget", t.dashBudget, fmt(t.dashBudgetVal, { n: s.budget }), t.level[bl]);
  tile("safety", `${s.safety}/100`, levelWord(s.safety), scoreIdx(s.safety));
  add("safety", t.dashSafety, `${s.safety}/100`, levelWord(s.safety));
  if (!started("grade")) tile("hood", "—", t.notStarted, "none", "—", t.notStartedShort);
  else {
    tile("hood", `${s.hood}/100`, levelWord(s.hood), scoreIdx(s.hood));
    add("hood", t.dashNeighbors, `${s.hood}/100`, levelWord(s.hood));
  }
  announceScores(said);
}
// A polite summary of the tiles that changed, once things settle (I18).
let scoresSaid = null, scoreQueue = new Set(), scoreTimer = 0;
function announceScores(said) {
  if (!st.started) { scoresSaid = null; return; }
  if (scoresSaid) for (const k of Object.keys(said)) if (said[k] !== scoresSaid[k]) scoreQueue.add(k);
  scoresSaid = said;
  if (!scoreQueue.size) return;
  clearTimeout(scoreTimer);
  scoreTimer = setTimeout(() => {
    $("[data-score-live]").textContent = [...scoreQueue].map((k) => scoresSaid?.[k]).filter(Boolean).join(" ");
    scoreQueue = new Set();
  }, 900);
}
function renderAll(animate = true) {
  paintScene(animate);
  renderBuild();
  renderPlan();
  renderSide();
  renderDash();
  autosave();
}

// ---------- floating tag over a newly built part ----------
const tagEl = $("[data-tag]");
let tagFor = null, tagUntil = 0;
function showTag(id) {
  // Without the 3D view there is nothing to point at, so no tag (it used to stick in the corner).
  if (!scene) return;
  tagFor = id;
  tagUntil = performance.now() + 3200;
  tagEl.textContent = fmt(T().builtTag, { name: T().elements[id].name });
  tagEl.hidden = false;
}
(function followTag(now) {
  if (tagFor && scene) {
    const p = scene.screenOf(tagFor);
    if (!p || now > tagUntil) { tagEl.hidden = true; if (now > tagUntil) tagFor = null; }
    else { tagEl.hidden = false; tagEl.style.transform = `translate(${p[0].toFixed(0)}px, ${p[1].toFixed(0)}px) translate(-50%, -100%)`; }
  }
  requestAnimationFrame(followTag);
})(0);

// ---------- actions ----------
function focusNext() {
  ($(".el:not([data-done]):not([disabled])") || $("[data-finish]:not([disabled])"))?.focus({ preventScroll: true });
}
function decisionsDue(e) {
  const due = [];
  const phase = phaseOf[e];
  const p = PH.find((q) => q.id === phase);
  if (p && !p.els.some((x) => st.placed.has(x))) for (const c of PHASE_START[phase] || []) if (!st.choice[c]) due.push(c);
  for (const c of BEFORE_EL[e] || []) if (!st.choice[c] && !due.includes(c)) due.push(c);
  return due;
}
function l3NeedsTest() {
  return powerOn() && !st.choice.test && MEP.some((id) => st.cx[id] >= 2 && st.cx[id] < 3);
}
// Level 3 needs that item on site, permanent power, and the test choice. Level 4 is a later step, never the same one.
function advanceCx() {
  const t = T();
  const notes = [];
  if (powerOn() && st.choice.test) {
    let up = false;
    for (const id of MEP) if (st.cx[id] === 2) { st.cx[id] = 3; up = true; }
    if (up) notes.push(t.logL3);
  }
  if (!notes.length && powerOn() && MEP.every((id) => st.cx[id] >= 3) && MEP.some((id) => st.cx[id] === 3)) {
    for (const id of MEP) if (st.cx[id] === 3) st.cx[id] = 4;
    notes.push(t.logL4);
  }
  syncCx();
  return notes;
}
function pickPhase(id) {
  const t = T();
  const p = PH.find((q) => q.id === id);
  if (!ready(p)) {
    const list = p.after.filter((a) => !st.done.has(a)).map((a) => t.phases[a].name).join(", ");
    toast(fmt(t.logLocked, { name: t.phases[id].name, list, why: t.phases[id].why }), { log: true });
    renderBuild();
    return;
  }
  if (st.done.has(id)) return;
  const opening = st.focus !== id && !started(id);
  if (placing && phaseOf[placing.id] !== id) endPlace();
  st.focus = id;
  advanceCx().forEach(say);
  renderAll();
  if (opening) speak(`phase:${id}`);
  if (ui.tab !== "build") setTab("build");
  $(".el:not([data-done]):not([disabled])")?.focus({ preventScroll: true });
}
function placeIssueText(code) {
  const t = T();
  const map = { setback: t.placeBadSetback, site: t.placeBadSite, pad: t.placeBadPad, overlap: t.placeBadOverlap, utility: t.placeBadUtility, near: t.placeBadNear, road: t.placeBadRoad };
  return map[code] || "";
}
function snapGrid(n) { const g = M.LAYOUT_GRID || 10; return Math.round(n / g) * g; }
function layoutPlaced(except) {
  const out = {};
  for (const id of Object.keys(M.LAYOUT || {})) {
    if (id === except || !st.placed.has(id)) continue;
    out[id] = st.layout[id] || { x: 0, z: 0 };
  }
  return out;
}
function shiftMap() {
  const map = {};
  for (const [id, spec] of Object.entries(M.LAYOUT || {})) {
    if (!st.placed.has(id)) continue;
    map[spec.shift] = st.layout[id] || { x: 0, z: 0 };
  }
  return map;
}
function fillPlaceWhy() {
  const node = $("[data-place-why]");
  if (!node || !placing) return;
  const issue = M.layoutIssue(placing.id, placing.dx, placing.dz, layoutPlaced(placing.id));
  node.dataset.ok = issue ? "0" : "1";
  node.textContent = issue ? placeIssueText(issue) : T().placeOk;
}
function paintFootprints() {
  if (!scene) return;
  if (!placing) { scene.setFootprints([]); return; }
  const issue = M.layoutIssue(placing.id, placing.dx, placing.dz, layoutPlaced(placing.id));
  const items = [{ rects: M.layoutRects(placing.id, placing.dx, placing.dz), tone: issue ? "bad" : "ok", setback: true }];
  for (const id of Object.keys(M.LAYOUT)) {
    if (!st.placed.has(id) || id === placing.id) continue;
    const d = st.layout[id] || { x: 0, z: 0 };
    items.push({ rects: M.layoutRects(id, d.x, d.z), tone: "set" });
  }
  scene.setFootprints(items);
}
function endPlace() {
  placing = null;
  scene?.setPlaceMode(false);
  scene?.setFootprints([]);
  onCamMode(!!scene?.zoomed());
}
function setPreview(dx, dz) {
  if (!placing) return;
  const spec = M.LAYOUT[placing.id];
  if (spec?.axis === "z") dx = 0;
  placing.dx = snapGrid(dx);
  placing.dz = snapGrid(dz);
  fillPlaceWhy();
  paintFootprints();
}
function onPlacePointer(ev) {
  if (!placing || !M.LAYOUT[placing.id]) return;
  const r = M.LAYOUT[placing.id].rects[0];
  const cx = r.x + r.w / 2, cz = r.z + r.h / 2;
  if (ev.type === "down") {
    placing.grabX = ev.x - (cx + placing.dx);
    placing.grabZ = ev.z - (cz + placing.dz);
    return;
  }
  if (ev.type === "move") { setPreview(ev.x - (placing.grabX || 0) - cx, ev.z - (placing.grabZ || 0) - cz); return; }
  if (ev.type === "up") {
    if (ev.tap) setPreview(ev.x - cx, ev.z - cz);
    if (!M.layoutIssue(placing.id, placing.dx, placing.dz, layoutPlaced(placing.id))) confirmPlace();
  }
}
function beginPlace(e) {
  if (!M.LAYOUT[e] || !scene) { commitElement(e, { x: 0, z: 0 }); return; }
  const prev = st.layout[e] || { x: 0, z: 0 };
  placing = { id: e, dx: prev.x, dz: prev.z };
  scene.setPlaceMode(true, onPlacePointer);
  renderBuild();
  paintFootprints();
  onCamMode(!!scene.zoomed());
  $("[data-place-box]")?.scrollIntoView({ block: "nearest" });
  $("[data-place-set]")?.focus({ preventScroll: true });
}
function confirmPlace() {
  if (!placing) return;
  const { id, dx, dz } = placing;
  const issue = M.layoutIssue(id, dx, dz, layoutPlaced(id));
  if (issue) { toast(placeIssueText(issue)); fillPlaceWhy(); return; }
  endPlace();
  commitElement(id, { x: dx, z: dz });
}
function nudgePlace(dx, dz) {
  if (!placing) return;
  setPreview(placing.dx + dx, placing.dz + dz);
}
function place(e) {
  const t = T();
  if (st.placed.has(e) || dlg.open) return;
  if (cardPending) { waitForCard(); return; }
  const why = blockReason(e);
  if (why) {
    toast(why, { log: true });
    renderBuild();
    return;
  }
  const due = decisionsDue(e);
  if (due.length) { openDecide(due[0], () => place(e)); return; }
  if ((e === "substation" || e === "switchgear") && !st.cards.longlead) {
    openCard("longlead", () => { renderAll(); focusNext(); });
    return;
  }
  if (e === "substation" && !st.xfmr) {
    remember();
    st.xfmr = 1;
    say(t.logL1);
    renderAll();
    focusNext();
    return;
  }
  if (MEP.includes(e) && !st.cx[e]) {
    remember();
    st.cx[e] = 1;
    syncCx();
    say(t.logL1);
    renderAll();
    focusNext();
    return;
  }
  if (e === "L5" && !MEP.every((id) => st.cx[id] >= 4)) {
    const notes = advanceCx();
    notes.forEach(say);
    if (!notes.length) say(t.cxNeedL5);
    renderAll();
    focusNext();
    return;
  }
  if (M.LAYOUT[e]) {
    if (placing?.id === e) { confirmPlace(); return; }
    if (placing) endPlace();
    beginPlace(e);
    return;
  }
  commitElement(e);
}
function commitElement(e, offset) {
  const t = T();
  remember();
  if (offset) st.layout[e] = { x: offset.x, z: offset.z };
  st.placed.add(e);
  if (MEP.includes(e)) {
    st.cx[e] = Math.max(st.cx[e], 2);
    say(fmt(t.logL2, { n: gearAt(2) }));
  }
  advanceCx().forEach(say);
  say(t.elements[e].log);
  renderAll();
  scene?.focus(e);
  showTag(e);
  const said = speak(`el:${e}`);
  const card = Object.entries(CARD).find(([id, c]) => c.at && !(id in st.cards) && (c.at === e || c.at === phaseOf[e]));
  if (card) { st.cards[card[0]] = null; autosave(); scheduleCard(card[0], said, afterPlace); }
  else afterPlace();
}
function afterPlace() {
  if (l3NeedsTest()) openDecide("test", () => { advanceCx().forEach(say); renderAll(); focusNext(); });
  else focusNext();
}
// Lock this phase's months, then leave it. Called after a setback is answered, or right away when none is drawn.
function phaseSettled(id) {
  const t = T();
  st.frozenSched[id] = effects().sched[id] || 0;
  advanceCx().forEach(say);
  if (id === "cx") { say(t.logCx); speak("cx"); }
  st.focus = null;
  renderAll();
  if (id === "turn") openEnd();
  else $("[data-go]")?.focus({ preventScroll: true });
}
// An issue card that was due but not answered (after undo or a resumed game) is offered again.
// A setback drawn at the end of a phase still finishes that phase once it is answered.
function reofferCards() {
  const due = Object.entries(st.cards).find(([, pick]) => pick == null);
  if (!due) return;
  const rollPhase = CARD[due[0]]?.roll;
  const after = rollPhase && st.done.has(rollPhase) ? () => phaseSettled(rollPhase) : afterPlace;
  scheduleCard(due[0], Promise.resolve(), after);
}
// Undo takes back the last placement or finished phase (I7).
function undo() {
  if (!history.length || st.done.has("turn") || dlg.open) return;
  const back = loadState(JSON.parse(history.pop()));
  if (!back) return;
  playGen += 1;
  clearCardTimers();
  resume = null;
  cardAfter = null;
  cardPending = false;
  endPlace();
  hush();
  st = back;
  say(T().logUndo);
  renderAll(false);
  reofferCards();
  focusNext();
}
function finishPhase(id) {
  const t = T();
  if (!id || dlg.open) return;
  if (cardPending) { waitForCard(); return; }
  const missing = (PHASE_REQUIRED[id] || []).filter((c) => !st.choice[c]);
  if (missing.length) { openDecide(missing[0], () => finishPhase(id)); return; }
  if (!st.done.has(id)) {
    remember();
    st.done.add(id);
    say(fmt(t.logPhaseDone, { name: t.phases[id].name }));
  }
  // Freeze after the setback, if one opened, so that answer's months stay on the schedule.
  const proceed = () => phaseSettled(id);
  if (l3NeedsTest()) { openDecide("test", proceed); return; }
  if (maybeSetback(id, proceed)) return;
  proceed();
}
// One construction setback per phase, drawn when the phase is finished. The same issue-card dialog as the scripted cards.
function maybeSetback(id, proceed) {
  if (st.rolled[id] != null) return false;
  const found = Object.entries(CARD).find(([, c]) => c.roll === id);
  if (!found) { st.rolled[id] = ""; return false; }
  const [cid, card] = found;
  if (cid in st.cards) { st.rolled[id] = cid; return false; }
  const hit = rng() < (card.chance ?? 0);
  st.rolled[id] = hit ? cid : "";
  if (!hit) return false;
  st.cards[cid] = null;
  renderAll();
  openCard(cid, proceed);
  return true;
}
function choose(c, v, opts = {}) {
  const t = T();
  if (choiceLocked(c) || st.choice[c] === v || !EFFECT[c]?.[v]) return;
  st.choice[c] = v;
  say(fmt(t.logChoice, { name: t.choices[c].name, value: t.choices[c][v].label }));
  if (c === "test" && !opts.skipCx) advanceCx().forEach(say);
  renderAll();
  $(`[data-choice="${c}"][data-v="${v}"]`)?.focus({ preventScroll: true });
}
function next() {
  if (dlg.open) return;
  if (cardPending) { waitForCard(); return; }
  if (placing) { confirmPlace(); return; }
  const p = PH.find((q) => q.id === st.focus);
  if (p) {
    const open = p.els.filter((x) => !st.placed.has(x));
    const e = open.find((x) => !blockReason(x));
    if (e) return place(e);
    if (!open.length) return finishPhase(p.id);
    const other = PH.find((q) => q.id !== p.id && ready(q) && !st.done.has(q.id) && q.els.some((x) => !st.placed.has(x) && !blockReason(x)));
    if (other) return pickPhase(other.id);
    return place(open[0]);
  }
  const r = PH.find((q) => ready(q) && !st.done.has(q.id));
  if (r) pickPhase(r.id);
}

// ---------- narration ----------
const audio = new Audio();
audio.setAttribute("playsinline", "");
audio.playsInline = true;
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
let audioUnlocked = false;
const capEl = $("[data-caption]");
const voice = { on: true };
let capTimer = 0;
let speakSettle = null;
// iOS and Android allow later clips only after play() runs inside a tap or key press.
function unlockAudio() {
  if (audioUnlocked || audio.getAttribute("src")) return;
  audio.src = SILENT_WAV;
  const pending = audio.play();
  if (!pending) { audioUnlocked = true; return; }
  pending.then(() => {
    audioUnlocked = true;
    if ((audio.currentSrc || audio.src || "").includes("audio/wav")) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
  }).catch(() => {});
}
addEventListener("pointerdown", unlockAudio, { capture: true });
addEventListener("keydown", unlockAudio, { capture: true });
// Narration clips (I15). The first time narration plays, the web page loads every clip of the language at once, in
// a fixed order, so which clips the site serves never depends on how far a player got or which answers they
// picked (the privacy line). The service worker keeps a copy for offline reloads. Clips are fetched whole and
// played from memory, so no range requests reach the worker. The offline kiosk file has every clip inside it as a
// data: URL. A clip that cannot load leaves the caption on screen for a reading-length time instead.
const clipUrls = new Map();
const clipsLoaded = new Set();
function loadAllClips() {
  if (clipsLoaded.has(lang)) return;
  clipsLoaded.add(lang);
  const set = D.VOICE[lang] || {};
  // The intro and the first phase come first, the rest alphabetically: the same order for every player.
  const keys = Object.keys(set).sort((a, b) => (a === "intro" ? -1 : b === "intro" ? 1 : a === "phase:site" ? -1 : b === "phase:site" ? 1 : a < b ? -1 : 1));
  for (const k of keys) loadClip(set[k]).catch(() => {});
}
function loadClip(src) {
  if (/^(data|blob):/.test(src) || location.protocol === "file:") return Promise.resolve(src);
  if (!clipUrls.has(src)) {
    const p = fetch(src).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`clip ${r.status}`)))).then((b) => URL.createObjectURL(b));
    p.catch(() => clipUrls.delete(src));
    clipUrls.set(src, p);
  }
  return clipUrls.get(src);
}
let speakGen = 0;
function speak(key) {
  // A new line settles the previous one, so a queued issue card is not left waiting on audio that was cut off.
  if (speakSettle) { const prev = speakSettle; speakSettle = null; prev(); }
  const gen = ++speakGen;
  const text = (D.CAPTIONS[lang] || D.CAPTIONS.en)[key];
  if (!text) return Promise.resolve();
  const clip = (D.VOICE[lang] || {})[key] || (lang === "en" ? null : D.VOICE.en[key]);
  clearTimeout(capTimer);
  if (!voice.on) return Promise.resolve();
  loadAllClips();
  capEl.textContent = text;
  capEl.hidden = false;
  const readTime = Math.min(12000, Math.max(2500, text.length * 45));
  audio.pause();
  if (!clip) {
    capTimer = setTimeout(() => (capEl.hidden = true), readTime);
    return Promise.resolve();
  }
  return new Promise((res) => {
    let finished = false;
    let backstop = 0;
    const done = (hideAfter = 600) => {
      if (finished) return;
      finished = true;
      if (speakSettle === done) speakSettle = null;
      clearTimeout(backstop);
      audio.onended = audio.onerror = null;
      if (gen === speakGen) capTimer = setTimeout(() => (capEl.hidden = true), hideAfter);
      res();
    };
    speakSettle = done;
    // Waiting for a slow download counts against the issue-card cap in scheduleCard, not against the clip.
    backstop = setTimeout(done, 15000);
    loadClip(clip).then((src) => {
      if (finished || gen !== speakGen || !voice.on) return done();
      clearTimeout(backstop);
      backstop = setTimeout(done, Math.max(4000, text.length * 85));
      audio.src = src;
      audio.onended = () => done();
      audio.onerror = () => done(readTime);
      if (testHooks.voiceRate) audio.playbackRate = testHooks.voiceRate;
      audio.play().then(() => { audioUnlocked = true; }).catch(() => done(readTime));
    }, () => done(readTime));
  });
}
function hush() {
  if (speakSettle) { const prev = speakSettle; speakSettle = null; prev(); }
  audio.pause();
  capEl.hidden = true;
}
const voiceBtn = $("[data-voice]");
const libBox = $("[data-libmode]");
function renderVoiceBtn() {
  const t = T();
  voiceBtn.textContent = voice.on ? t.voiceOn : t.voiceOff;
  voiceBtn.setAttribute("aria-pressed", voice.on);
  // The checkbox is the device setting for the next player; the Voice button is this game only.
  libBox.checked = libraryOn();
  libBox.disabled = MODE === "library";
  $("[data-libmode-note]").textContent = MODE === "library" ? t.libraryModeUrl : t.libraryModeNote;
  voiceBtn.hidden = !Object.keys(D.VOICE.en || {}).length;
  $("[data-listen]").hidden = !voice.on || !(D.VOICE.en || {}).intro;
}
function setVoice(on, remember = false) {
  voice.on = on;
  if (!on) hush();
  if (remember && STAFFED) { prefs.voice = on; savePrefs(); }
  renderVoiceBtn();
}
voiceBtn.addEventListener("click", () => setVoice(!voice.on, true));
libBox.addEventListener("change", (e) => {
  prefs.library = e.target.checked;
  savePrefs();
  setVoice(!e.target.checked, true);
});
const keysBox = $("[data-keys-pref]");
keysBox.checked = prefs.keys;
// With the shortcuts off, the number hints on the answer buttons are hidden too.
const renderKeysPref = () => document.documentElement.toggleAttribute("data-nokeys", !prefs.keys);
renderKeysPref();
keysBox.addEventListener("change", (e) => { prefs.keys = e.target.checked; savePrefs(); renderKeysPref(); });
for (const box of presentBoxes()) box.addEventListener("change", (e) => setPresent(e.target.checked, true));
$("[data-listen]").addEventListener("click", () => speak("intro"));

// ---------- dialogs ----------
const dlg = $("[data-card]");
let resume = null;
let cardAfter = null;
let cardPending = false;
let playGen = 0;
let cardTimers = [];
function clearCardTimers() {
  for (const id of cardTimers) clearTimeout(id);
  cardTimers = [];
}
function later(fn, ms) {
  const id = setTimeout(fn, ms);
  cardTimers.push(id);
  return id;
}
// Escape and other close requests never lose the intro, the end screen or an unanswered issue card (I6).
// The markup sets closedby="none"; this also covers browsers without it. A guarded dialog comes back only while the
// game still wants it open. Browsers can deliver "close" events late, after the game has closed, reopened and closed
// the dialog again, so a one-shot "this close was ours" flag is not enough: it let an answered card reappear.
const wantOpen = new WeakSet();
function openDlg(d) {
  wantOpen.add(d);
  if (!d.open) d.showModal();
}
function closeDlg(d) {
  wantOpen.delete(d);
  if (d.open) d.close();
}
function guard(d, refocus) {
  d.addEventListener("cancel", (ev) => ev.preventDefault());
  d.addEventListener("close", () => {
    if (!wantOpen.has(d)) return;
    setTimeout(() => {
      if (d.open || !wantOpen.has(d)) return;
      try { d.showModal(); refocus(); } catch { /* the page is going away */ }
    }, 0);
  });
}
function scheduleCard(id, said, after) {
  const gen = playGen;
  let opened = false;
  cardPending = true;
  const open = () => {
    if (gen !== playGen || !st.started) { cardPending = false; return; }
    if (opened) return;
    if (dlg.open || endDlg.open || idleDlg.open || introDlg.open) { later(open, 300); return; }
    opened = true;
    cardPending = false;
    openCard(id, after);
  };
  const cap = later(open, 7000);
  Promise.resolve(said).then(() => { clearTimeout(cap); open(); });
}
function openDecide(id, next) {
  const t = T();
  const choice = t.choices[id];
  $(".kicker", dlg).textContent = t.decideKicker;
  $(".card-title", dlg).textContent = choice.name;
  $(".card-body", dlg).textContent = choice.ask;
  $(".card-opts", dlg).previousElementSibling.textContent = t.decideChoose;
  $(".card-opts", dlg).innerHTML = ["a", "b"]
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(choice[o].label)}</span><span class="opt-note">${esc(choice[o].note)}</span>${chipsFor("choice", id, o)}</button>`)
    .join("");
  dlg.dataset.kind = "choice";
  dlg.dataset.id = id;
  resume = next;
  openDlg(dlg);
  $(".opt", dlg).focus();
}
function openCard(id, after) {
  const t = T();
  const card = t.cards[id];
  $(".kicker", dlg).textContent = t.cardKicker;
  $(".card-title", dlg).textContent = card.title;
  $(".card-body", dlg).textContent = card.body;
  $(".card-opts", dlg).previousElementSibling.textContent = t.cardChoose;
  $(".card-opts", dlg).innerHTML = Object.keys(CARD[id].opts)
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(card[o].label)}</span>${chipsFor("card", id, o)}</button>`)
    .join("");
  dlg.dataset.kind = "card";
  dlg.dataset.id = id;
  cardAfter = after || null;
  openDlg(dlg);
  $(".opt", dlg).focus();
  speak(`card:${id}`);
}
$(".card-opts", dlg).addEventListener("click", (e) => {
  const b = e.target.closest("[data-o]");
  if (!b) return;
  const kind = dlg.dataset.kind;
  const id = dlg.dataset.id;
  if (kind === "choice") {
    const fn = resume;
    resume = null;
    closeDlg(dlg);
    choose(id, b.dataset.o, { skipCx: true });
    fn?.();
    return;
  }
  // An issue card is answered once; a stale copy of it never changes the first answer.
  if (st.cards[id]) { closeDlg(dlg); return; }
  st.cards[id] = b.dataset.o;
  say(T().cards[id][b.dataset.o].log);
  speak(`opt:${id}:${b.dataset.o}`);
  const fn = cardAfter;
  cardAfter = null;
  closeDlg(dlg);
  renderAll();
  fn?.();
});
guard(dlg, () => $(".opt", dlg)?.focus());
const endDlg = $("[data-end]");
// The debrief (C11): the results against the plan, with their rating words, the three answers that cost the most,
// every choice, and three questions to talk over. It prints on its own (Print button, print styles).
function answerEffects(kind, id, o) {
  const now = scores({ live: true });
  const off = withPick(kind, id, null, () => scores({ live: true }));
  return {
    months: Math.round((now.total - off.total) * 2) / 2,
    budget: Math.round((now.budgetRaw - off.budgetRaw) * 10) / 10,
    safety: now.safetyRaw - off.safetyRaw,
    hood: (kind === "card" ? CARD[id].opts[o] : EFFECT[id][o]).hood || 0,
  };
}
function costliest() {
  const t = T();
  const picks = [
    ...CHOICES.filter((c) => st.choice[c]).map((c) => ["choice", c, st.choice[c], t.choices[c].name, t.choices[c][st.choice[c]].label]),
    ...Object.entries(st.cards).filter(([, o]) => o).map(([id, o]) => ["card", id, o, t.cards[id].title, t.cards[id][o].label]),
  ];
  // One month weighs about the same as 1% of budget or 5 points of safety or neighbor relations; time costs most.
  return picks
    .map(([kind, id, o, name, label]) => {
      const d = answerEffects(kind, id, o);
      const cost = Math.max(0, d.months) + Math.max(0, d.budget) + Math.max(0, -d.safety) / 5 + Math.max(0, -d.hood) / 5;
      return { name, label, d, cost };
    })
    .filter((x) => x.cost > 0.01)
    .sort((x, y) => y.cost - x.cost)
    .slice(0, 3);
}
function effectText(d) {
  const t = T();
  const out = [];
  if (d.months) out.push(`${t.cardChips.sched} ${d.months > 0 ? "+" : "−"}${fmt(t.dashMonthsShort, { n: Math.abs(d.months) })}`);
  if (d.budget) out.push(`${t.cardChips.budget} ${d.budget > 0 ? "+" : "−"}${Math.abs(d.budget)}%`);
  if (d.safety) out.push(`${t.cardChips.safety} ${signed(d.safety)}`);
  if (d.hood) out.push(`${t.cardChips.hood} ${signed(d.hood)}`);
  return out.join(" · ");
}
function openEnd() {
  const t = T();
  const s = scores();
  const card = (name, value, idx, ref) => `<div data-level="${idx}"><dt>${esc(name)}</dt><dd><span class="end-val">${esc(value)}</span> <span class="end-word"><i class="end-dot" aria-hidden="true"></i>${esc(t.level[idx])}</span><span class="end-ref">${esc(ref)}</span></dd></div>`;
  $(".end-stats", endDlg).innerHTML = [
    card(t.dashSchedule, fmt(t.dashMonths, { n: s.months }), schedIdx(s.months), fmt(t.endPlanSched, { n: M.BASE_MONTHS })),
    card(t.dashBudget, fmt(t.dashBudgetVal, { n: s.budget }), budgetIdx(s.budget), fmt(t.endPlanBudget, { n: M.BUDGET_BANDS[0] - 100 })),
    card(t.dashSafety, `${s.safety}/100`, scoreIdx(s.safety), fmt(t.endStart, { n: M.SCORE_START.safety })),
    card(t.dashNeighbors, `${s.hood}/100`, scoreIdx(s.hood), fmt(t.endStartHood, { n: M.SCORE_START.hood })),
  ].join("");
  const top = costliest();
  $(".end-costly", endDlg).innerHTML = top.length
    ? top.map((x) => `<li><b>${esc(x.name)}:</b> ${esc(x.label)}<span class="end-fx">${esc(effectText(x.d))}</span></li>`).join("")
    : `<li>${esc(t.endCostlyNone)}</li>`;
  const made = [
    ...CHOICES.filter((c) => st.choice[c]).map((c) => `<li><b>${esc(t.choices[c].name)}:</b> ${esc(t.choices[c][st.choice[c]].label)}</li>`),
    ...Object.entries(st.cards).filter(([, o]) => o).map(([id, o]) => `<li><b>${esc(t.cards[id].title)}:</b> ${esc(t.cards[id][o].label)}</li>`),
  ];
  $(".end-chose", endDlg).innerHTML = made.length ? made.join("") : `<li>${esc(t.noDecisions)}</li>`;
  $(".end-talk", endDlg).innerHTML = t.endTalkQs.map((q) => `<li>${esc(q)}</li>`).join("");
  openDlg(endDlg);
  pinPad();
  endDlg.scrollTop = 0;
  // Enter on the end screen still means Play again, as before the Print button was added.
  $("[data-again]").focus({ preventScroll: true });
  speak("end");
}
$("[data-print]").addEventListener("click", () => {
  keepGoing();
  window.print();
});
$("[data-again]").addEventListener("click", () => { closeDlg(endDlg); reset(); });
guard(endDlg, () => $("[data-again]").focus());
const introDlg = $("[data-intro]");
const aboutDlg = $("[data-about-dlg]");
const confirmDlg = $("[data-confirm]");
// About opens at its title, not on the first link halfway down (on a small phone that scrolled the title away).
$("[data-about]").addEventListener("click", () => {
  aboutDlg.showModal();
  aboutDlg.scrollTop = 0;
  $("#about-title").focus({ preventScroll: true });
});
$("[data-about-close]").addEventListener("click", () => aboutDlg.close());
$("[data-start]").addEventListener("click", () => {
  clearSave();
  history = [];
  st.started = true;
  closeDlg(introDlg);
  scene?.setAttract(false);
  scene?.resetView();
  pickPhase("site");
});
// Class and home modes: carry on from the game this tab saved (C6).
$("[data-resume]").addEventListener("click", () => {
  let back = null;
  try { back = loadState(readSave()?.state); } catch { back = null; }
  if (!back) { clearSave(); $("[data-start]").click(); return; }
  st = back;
  history = [];
  ui.hoodSig = null;
  closeDlg(introDlg);
  scene?.setAttract(false);
  scene?.resetView();
  say(T().logResume);
  renderEffectsBtn();
  renderAll(false);
  if (st.done.has("turn")) { openEnd(); return; }
  reofferCards();
  if (st.focus) focusNext();
  else $("[data-go]")?.focus({ preventScroll: true });
});
guard(introDlg, () => $("[data-start]").focus({ preventScroll: true }));
function askStartOver() {
  if (confirmDlg.open) return;
  confirmDlg.showModal();
  $("[data-confirm-no]").focus();
}
$("[data-confirm-yes]").addEventListener("click", () => { confirmDlg.close(); reset(); });
$("[data-confirm-no]").addEventListener("click", () => confirmDlg.close());

// ---------- language, tools, keys ----------
function applyLang() {
  const t = T();
  document.documentElement.lang = t.lang || lang;
  for (const node of $$("[data-t]")) {
    const v = node.dataset.t.split(".").reduce((o, k) => o?.[k], t);
    if (typeof v === "string") node.textContent = v.replace(/\{(\w+)\}/g, (m, k) => (k in D.FILL ? D.FILL[k] : m));
  }
  for (const node of $$("[data-t-label]")) {
    const v = t[node.dataset.tLabel];
    if (typeof v === "string") { node.setAttribute("aria-label", v); node.title = v; }
  }
  canvas.setAttribute("aria-label", t.canvasLabel);
  onCamMode(!!scene?.zoomed());
  scene?.refreshSigns();
  renderEffectsBtn();
  renderVoiceBtn();
  renderAll(false);
}
const langBtn = $("[data-lang]");
if (Object.keys(STR.es || {}).length) {
  langBtn.hidden = false;
  langBtn.addEventListener("click", () => {
    lang = lang === "en" ? "es" : "en";
    langBtn.textContent = lang === "en" ? STR.en.langToggle : T().langNameEn;
    applyLang();
  });
}
const fxBtn = $("[data-fx]");
function renderEffectsBtn() {
  fxBtn.textContent = st.ov ? T().effectsOn : T().effectsOff;
  fxBtn.setAttribute("aria-pressed", st.ov);
}
function toggleFx() { st.ov = !st.ov; renderEffectsBtn(); paintScene(false); }
fxBtn.addEventListener("click", toggleFx);
// Single-key shortcuts (I2): only outside dialogs and text fields, never on key repeat, and they can be turned
// off in About. Number keys answer the open issue card; they are single-key shortcuts too and follow the setting.
const otherDialogOpen = () => [endDlg, aboutDlg, introDlg, idleDlg, confirmDlg].some((d) => d.open);
document.addEventListener("keydown", (ev) => {
  if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.repeat) return;
  if (dlg.open) {
    if (otherDialogOpen() || !prefs.keys || !/^[1-9]$/.test(ev.key)) return;
    const b = $(`.opt[data-key="${ev.key}"]`, dlg);
    if (b) { ev.preventDefault(); b.click(); }
    return;
  }
  if (otherDialogOpen() || !prefs.keys) return;
  if (ev.target instanceof Element && ev.target.closest("input, textarea, select, [contenteditable]")) return;
  const k = ev.key.toLowerCase();
  if (placing && k === "escape") { ev.preventDefault(); endPlace(); renderBuild(); focusNext(); return; }
  if (placing && !ev.shiftKey) {
    const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, 1], arrowdown: [0, -1] }[k];
    if (step) { ev.preventDefault(); nudgePlace(step[0] * (M.LAYOUT_GRID || 10), step[1] * (M.LAYOUT_GRID || 10)); return; }
  }
  if (k === "v") { ev.preventDefault(); setVoice(!voice.on, true); }
  else if (k === "n") { ev.preventDefault(); next(); }
  else if (k === "m") { ev.preventDefault(); toggleFx(); }
});
function reset({ clear = true } = {}) {
  if (clear) { clearSave(); history = []; }
  // A service-worker update that arrived mid-game is applied here, when the player starts over (C6).
  if (swUpdatePending) { location.reload(); return; }
  playGen += 1;
  clearCardTimers();
  resume = null;
  cardAfter = null;
  cardPending = false;
  endPlace();
  hush();
  closeDlg(dlg);
  closeDlg(endDlg);
  if (aboutDlg.open) aboutDlg.close();
  if (confirmDlg.open) confirmDlg.close();
  stopCountdowns();
  st = fresh();
  say(T().log0);
  // The next player starts on the default panels, scrolled to the top.
  Object.assign(ui, { hot: null, side: "hood", hoodSig: null, hoodNew: false });
  for (const p of $$(".panel")) p.scrollTop = 0;
  toastEl.hidden = true;
  // Each new player starts from this device's setting, whatever the last player pressed (I8).
  setVoice(deviceVoice());
  renderEffectsBtn();
  renderAll(false);
  setTab("build");
  scene?.setAttract(true);
  const t = T();
  const saved = readSave();
  $("[data-resume]").hidden = !saved;
  $("[data-resume-note]").hidden = !saved;
  const startBtn = $("[data-start]");
  startBtn.textContent = saved ? t.startNew : t.start;
  startBtn.classList.toggle("btn-ghost", !!saved);
  openDlg(introDlg);
  pinPad();
  // Focus without scrolling, so the age line under the title stays in view on small phones (C1).
  $(saved ? "[data-resume]" : "[data-start]").focus({ preventScroll: true });
  introDlg.scrollTop = 0;
}

// Kiosk: after two and a half minutes without input, ask; with no answer, start over for the next player.
// The end screen clears after a minute without input, with a visible countdown and a Keep button. Any input,
// mouse movement included, dismisses either prompt. ?mode=class and ?mode=home suspend both resets (C4).
const idleDlg = $("[data-idle]");
const idleBody = $(".idle-body", idleDlg);
const endClear = $("[data-end-clear]");
const endKeep = $("[data-end-keep]");
const alertEl = $("[data-alert]");
const endAlert = $("[data-alert-end]");
const idleAlert = $("[data-alert-idle]");
let lastInput = performance.now(), idleLeft = 0, idleTimer = 0, endLeft = 0, endTimer = 0, endShown = false;
let dismissing = false, dismissTimer = 0, lastPoint = null;
let swUpdatePending = false;
const countText = (key, n) => fmt(T()[n === 1 ? `${key}One` : key] || T()[key], { n });
// The countdown is announced when it starts and at 10 seconds, not every second (I18, WCAG 2.2.1). While a modal
// dialog is open, everything outside it is inert to screen readers, so the open dialog's own live region speaks.
function alertNow(text) {
  const el = idleDlg.open ? idleAlert : endDlg.open ? endAlert : alertEl;
  for (const x of [alertEl, endAlert, idleAlert]) x.textContent = "";
  setTimeout(() => (el.textContent = text), 60);
}
const prompting = () => idleDlg.open || endShown;
function stopCountdowns() {
  clearInterval(idleTimer);
  clearInterval(endTimer);
  clearTimeout(dismissTimer);
  idleTimer = 0;
  endTimer = 0;
  dismissing = false;
  for (const x of [alertEl, endAlert, idleAlert]) x.textContent = "";
  if (idleDlg.open) idleDlg.close();
  const keepHadFocus = document.activeElement === endKeep;
  endShown = false;
  endClear.hidden = true;
  endKeep.hidden = true;
  if (keepHadFocus && endDlg.open) $("[data-again]").focus();
}
function keepGoing() {
  stopCountdowns();
  lastInput = performance.now();
}
function startEndCountdown() {
  endLeft = 20;
  endShown = true;
  endClear.textContent = countText("endClear", endLeft);
  endClear.hidden = false;
  endKeep.hidden = false;
  // Focus moves to Keep, so Enter keeps the summary instead of starting over.
  endKeep.focus();
  alertNow(endClear.textContent);
  endTimer = setInterval(() => {
    endLeft -= 1;
    endClear.textContent = countText("endClear", endLeft);
    if (endLeft === 10) alertNow(endClear.textContent);
    if (endLeft <= 0) reset();
  }, 1000);
}
// A tap or press first only pauses the countdown. The prompt goes away after the click has landed, so nothing moves
// or closes under the finger: a tap on Keep keeps, and a tap never reaches the issue card underneath.
function deferDismiss() {
  clearInterval(idleTimer);
  clearInterval(endTimer);
  idleTimer = 0;
  endTimer = 0;
  if (dismissing) return;
  dismissing = true;
  const finish = () => {
    removeEventListener("click", onClick, true);
    if (dismissing) keepGoing();
  };
  const onClick = () => setTimeout(finish, 0);
  addEventListener("click", onClick, { capture: true, once: true });
  dismissTimer = setTimeout(finish, 1200);
}
function activity(ev) {
  if (ev.type === "pointermove") {
    // Mouse movement counts, but not a few pixels of jitter.
    const far = !lastPoint || Math.hypot(ev.clientX - lastPoint[0], ev.clientY - lastPoint[1]) > 8;
    if (!far) return;
    lastPoint = [ev.clientX, ev.clientY];
  }
  lastInput = performance.now();
  if (!prompting()) return;
  if (ev.type === "keydown") {
    // The key that dismisses a prompt does nothing else.
    ev.preventDefault();
    ev.stopImmediatePropagation();
    keepGoing();
    return;
  }
  if (dismissing) return;
  if (ev.type === "pointerdown" || ev.type === "touchstart") { deferDismiss(); return; }
  keepGoing();
}
for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
  addEventListener(type, activity, { capture: true, passive: type !== "keydown" });
}
setInterval(() => {
  if (STAFFED || !st.started || introDlg.open || prompting() || dismissing) return;
  const idle = performance.now() - lastInput;
  if (endDlg.open) { if (idle >= 60000) startEndCountdown(); return; }
  if (idle < (testHooks.idleMs || 150000)) return;
  if (aboutDlg.open) aboutDlg.close();
  if (confirmDlg.open) confirmDlg.close();
  idleLeft = 20;
  idleBody.textContent = countText("idleBody", idleLeft);
  try { idleDlg.showModal(); } catch { return; }
  $("[data-idle-keep]").focus();
  idleTimer = setInterval(() => {
    idleLeft -= 1;
    idleBody.textContent = countText("idleBody", idleLeft);
    if (idleLeft === 10) alertNow(idleBody.textContent);
    if (idleLeft <= 0) reset();
  }, 1000);
}, 5000);
$("[data-idle-keep]").addEventListener("click", keepGoing);
endKeep.addEventListener("click", keepGoing);
idleDlg.addEventListener("cancel", (ev) => { ev.preventDefault(); keepGoing(); });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // Keep this id identical to CACHE in sw.js. Bump both together when publishing.
  // The file name changes with the id, so a reload installs the new worker immediately.
  const SW_BUILD = "build-the-campus-v6";
  const hadController = !!navigator.serviceWorker.controller;
  if (hadController) {
    // A new build took over. On the intro nothing is in progress, so reload now. Mid-game, wait: reset() reloads
    // when the player starts over, so no game is lost (C6).
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (st.started) swUpdatePending = true;
      else location.reload();
    });
  }
  navigator.serviceWorker.register(`./sw-${SW_BUILD}.js`, { updateViaCache: "none" }).then((reg) => {
    const askSkip = () => { if (hadController && reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" }); };
    askSkip();
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => { if (worker.state === "installed") askSkip(); });
    });
    // No reg.update() here: with updateViaCache "none", registering and the browser's own check on each page load
    // already fetch the worker script once; a second call only downloaded it again.
  }).catch(() => {});
}

// @test-hooks-start
// Hooks for the checks in tests/. Only the test build (index.test.html) keeps them; build.mjs strips this block
// from the published pages.
if (window.__voiceRate) testHooks.voiceRate = window.__voiceRate;
if (window.__idleMs) testHooks.idleMs = window.__idleMs;
Object.defineProperties(window, {
  __voiceRate: { get: () => testHooks.voiceRate, set: (v) => { testHooks.voiceRate = v; }, configurable: true },
  __idleMs: { get: () => testHooks.idleMs, set: (v) => { testHooks.idleMs = v; }, configurable: true },
});
window.__dc = {
  all(opts = {}) {
    Object.assign(st.choice, opts);
    for (const p of PH) { for (const e of p.els) st.placed.add(e); st.done.add(p.id); }
    for (const id of MEP) st.cx[id] = 4;
    st.xfmr = 1;
    st.cards.longlead = st.cards.longlead || "a";
    syncCx();
    st.done.delete("turn");
    st.focus = "turn";
    st.started = true;
    closeDlg(introDlg);
    scene?.setAttract(false);
    renderAll(false);
  },
  upTo(id, opts = {}) {
    Object.assign(st.choice, opts);
    for (const p of PH) {
      if (p.id === id) { st.focus = id; p.els.slice(0, Math.ceil(p.els.length / 2)).forEach((e) => st.placed.add(e)); break; }
      for (const e of p.els) st.placed.add(e);
      st.done.add(p.id);
    }
    for (const gid of MEP) if (st.placed.has(gid)) st.cx[gid] = Math.max(st.cx[gid] || 0, 2);
    if (st.placed.has("substation")) st.xfmr = 1;
    syncCx();
    for (const [cid, c] of Object.entries(CARD)) {
      if (!c.at) continue;
      if (st.placed.has(c.at) || (PH.some((p) => p.id === c.at) && started(c.at))) st.cards[cid] = st.cards[cid] || "a";
    }
    st.started = true;
    closeDlg(introDlg);
    scene?.setAttract(false);
    renderAll(false);
  },
  hot(key) { ui.hot = key; renderSide(); paintScene(false); },
  tab: setTab,
  card: openCard,
  view(o) { if (o) scene?.setView(o); else scene?.resetView(); },
  cam: () => scene?.cam(),
  act: (name) => scene?.act(name),
  groundAt: (x, y) => scene?.groundAt(x, y),
  mode: MODE,
  history: () => history.length,
  state: () => st,
  audio: () => ({ unlocked: audioUnlocked, paused: audio.paused, time: audio.currentTime, src: audio.currentSrc ? audio.currentSrc.slice(0, 48) : "" }),
  scores,
  schedule,
  hood,
  info: () => scene?.info(),
  meshes: () => scene?.meshes(),
  lowGpu,
  render: () => renderAll(false),
};
// @test-hooks-end

renderVoiceBtn();
setPresent(URL_PRESENT || prefs.present);
reset({ clear: false });
measureSafe();
scene?.start();
