// Runtime for Build the Campus: state, rules, panels and the 3D scene. One screen, no page scroll.
// A browser older than the stated minimum has no <dialog>: the game stops here, and the page keeps its note that this
// browser cannot run it, instead of a dashboard that does nothing (critic).
if (!window.HTMLDialogElement?.prototype.showModal) throw new Error("This browser has no <dialog>: the game cannot run.");
const D = __DATA__;
Object.assign(D.MODEL, (__LAYOUT_FNS__)(D.MODEL));
const STR = __STRINGS__;
let lang = "en";
// Another language falls back to English key by key, as merge() in voice-lines.mjs does for the build: tables merge,
// strings and lists come whole (PA-2).
const isTable = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const merge = (a, b) => (isTable(a) && isTable(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b ?? a);
const TABLES = {};
const T = () => (TABLES[lang] ??= merge(STR.en, STR[lang] || {}));
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
// Values are trimmed and lower-cased, and a second "?" counts as "&", so ?mode=Class and ?view=presenter?mode=class
// work as meant (FEU-2).
const QUERY = new URLSearchParams(location.search.replace(/\?/g, "&"));
const arg = (key) => (QUERY.get(key) || "").trim().toLowerCase();
const URL_MODE = arg("mode");
const MODE = ["class", "home", "library"].includes(URL_MODE) ? URL_MODE : "kiosk";
const STAFFED = MODE === "class" || MODE === "home";
// Class and home modes say so on the intro and in About, so a teacher can see that the address worked.
for (const node of $$("[data-mode-line]")) node.hidden = node.dataset.modeLine !== MODE;
// About's links leave the game (SA-1, PC-2). On a kiosk a new tab, a mail app or a download outlasts the idle reset,
// so a kiosk keeps their plain-text form, with the address printed; class and home modes keep the links.
for (const node of $$(STAFFED ? "[data-nolink]" : "[data-link]")) node.remove();
// Results files are for class and home modes (BTC-01). A kiosk keeps no record of play, so it has no such buttons.
if (!STAFFED) for (const node of $$("[data-staffed-only]")) node.remove();
const NS = "build-the-campus:v1:";
const SAVE_VERSION = 1;
// Saves carry the build that wrote them (the model and the version badge), and only that build resumes them (DE-5).
const SAVE_BUILD = (() => {
  let h = 0x811c9dc5;
  for (const c of JSON.stringify(D.MODEL) + STR.en.badge) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h.toString(36);
})();
// A results file (BTC-01): a finished class or home game saved as JSON on this device, which the intro opens again.
const RESULTS_FORMAT = "build-the-campus-results";
const RESULTS_VERSION = 1;
// The timed steps a class or home game keeps for its results file: at most this many, of these kinds.
const STEP_CAP = 400;
const STEP_KINDS = ["phase", "place", "factory", "choice", "card", "done", "undo", "resume", "end"];
const store = {
  get(area, key) { try { const v = window[area].getItem(NS + key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(area, key, value) { try { window[area].setItem(NS + key, JSON.stringify(value)); return true; } catch { return false; /* storage can be blocked or full */ } },
  del(area, key) { try { window[area].removeItem(NS + key); } catch { /* storage can be blocked */ } },
};
// Device settings: what every new game starts from. The address sets them: ?mode=library or ?voice=off (voice off),
// ?view=presenter (presenter view, I10) and ?keys=off. Class and home modes also remember on this device the Library
// mode, voice, presenter view and shortcut switch last chosen (I8, I2). A kiosk remembers nothing, so what one visitor
// switches, a V press included, never carries over to the next visitor (PA-1).
const URL_SET = {};
if (arg("voice") === "off") URL_SET.voice = false;
if (arg("view") === "presenter") URL_SET.present = true;
if (arg("keys") === "off") URL_SET.keys = false;
// ?motion=off keeps the map still, as the system's reduced-motion setting does (BTC-UX-38).
if (arg("motion") === "off") URL_SET.still = true;
const device = { library: false, voice: true, keys: true, present: false, still: false };
function deviceSettings() {
  // Read again for each new game, so a setting changed in another tab is not lost (DE-7).
  const p = STAFFED && store.get("localStorage", "prefs");
  if (p && typeof p === "object") Object.assign(device, { library: p.library === true, voice: p.voice !== false, keys: p.keys !== false, present: p.present === true, still: p.still === true });
  return { ...device, ...URL_SET };
}
// This game's settings: each new game starts from the device's (reset), and the switches change them.
const prefs = deviceSettings();
// Class and home modes store only the setting that changed, so two open tabs never undo each other's (DE-7).
function savePref(key, value) {
  if (!STAFFED) return;
  device[key] = value;
  const p = store.get("localStorage", "prefs");
  store.set("localStorage", "prefs", { ...(p && typeof p === "object" ? p : {}), [key]: value });
}
const libraryOn = () => MODE === "library" || prefs.library;
const deviceVoice = () => !libraryOn() && prefs.voice;
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
  // Class and home modes: when the game started and its timed steps, for its results file. A kiosk keeps none.
  t0: 0,
  steps: [],
});
// viewing: the finished campus is shown with its summary set aside (BTC-UX-01).
const ui = { tab: "build", side: "hood", hot: null, picked: null, hoodSig: null, hoodNew: false, planOpen: false, viewing: false };
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
    frozenSched: cleanSched(o.frozenSched),
    cx: Object.fromEntries(MEP.map((id) => [id, clamp(Number(o.cx?.[id]) || 0, 0, 4)])),
    xfmr: o.xfmr ? 1 : 0,
    log: Array.isArray(o.log) ? o.log.slice(0, 6).map(String) : [],
    ov: o.ov !== false,
    started: true,
    layout: cleanLayout(o.layout),
    seed: Number.isFinite(Number(o.seed)) ? (Number(o.seed) >>> 0) || 1 : 1,
    rolled: cleanRolled(o.rolled),
    t0: Number(o.t0) > 0 ? Number(o.t0) : 0,
    steps: cleanSteps(o.steps),
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
// Months frozen when a phase finished: numbers only, for known phases, so a damaged save cannot turn the schedule
// sums into text (DE-5, QL-7).
function cleanSched(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const p of PH) if (typeof raw[p.id] === "number" && Number.isFinite(raw[p.id]) && raw[p.id] >= 0) out[p.id] = raw[p.id];
  return out;
}
function cleanRolled(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const p of PH) if (typeof raw[p.id] === "string") out[p.id] = raw[p.id];
  return out;
}
// Steps from a save: known kinds with a time, and no more than the cap, so a damaged save cannot grow the list.
function cleanSteps(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const x of raw.slice(0, STEP_CAP)) {
    if (!x || !STEP_KINDS.includes(x.step) || !Number.isFinite(x.t) || x.t < 0) continue;
    const step = { t: x.t, step: x.step };
    if (typeof x.id === "string") step.id = x.id.slice(0, 40);
    if (typeof x.v === "string") step.v = x.v.slice(0, 8);
    out.push(step);
  }
  return out;
}
function rng() {
  st.seed = (Math.imul(st.seed, 1664525) + 1013904223) >>> 0;
  return st.seed / 4294967296;
}
let history = [];
// Each step Undo can take back keeps its own words, so Undo says what it took back (BTC-UX-52).
function remember(label = "") {
  history.push(JSON.stringify({ label, state: snapState() }));
  if (history.length > 30) history.shift();
}
// One timed step of a class or home game, for its results file (BTC-01): the seconds since the game started, what
// happened and to what. The list lives in the game, so the class/home save keeps it too; a kiosk records nothing.
function logStep(step, id, v) {
  if (!STAFFED) return;
  if (!st.t0) st.t0 = Date.now();
  if (st.steps.length >= STEP_CAP - 1 && step !== "end") return;
  const x = { t: Math.round((Date.now() - st.t0) / 1000), step };
  if (id) x.id = id;
  if (v) x.v = v;
  st.steps.push(x);
}
// A browser that will not save (site data blocked, storage full) says so once, as a reload would start over (QL-5).
let saveFailSaid = false;
function autosave() {
  if (!STAFFED || !st?.started) return;
  if (store.set("sessionStorage", "save", { v: SAVE_VERSION, build: SAVE_BUILD, at: Date.now(), state: snapState() }) || saveFailSaid) return;
  saveFailSaid = true;
  toast(T().saveFailed, { keep: true });
}
const clearSave = () => store.del("sessionStorage", "save");
// The game this tab kept, if this build can resume it. bad: a save is there that it cannot resume (DE-5).
function savedGame() {
  const s = STAFFED ? store.get("sessionStorage", "save") : null;
  if (!s) return { back: null, bad: false };
  let back = null;
  try { back = s.v === SAVE_VERSION && s.build === SAVE_BUILD ? loadState(s.state) : null; } catch { back = null; }
  return { back, bad: !back };
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
    // Reduced motion: the system setting, or Keep the map still in About and ?motion=off (BTC-UX-38).
    reduced: () => motionOff.matches || prefs.still,
    wheelPage: () => PAGE_SCROLLS.matches,
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

// The layouts where the page itself scrolls up and down (style.css): very short windows and short phones held upright.
const PAGE_SCROLLS = matchMedia("(max-width: 1100px) and (max-height: 300px), (max-width: 600px) and (orientation: portrait) and (max-height: 640px)");
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
    // Measured again whenever the probe changes size: the first layout can use the fallback font, and once the web
    // font arrives a long line can take one more line, which left it cut off at 320 x 568 (AS-5).
    sizeWatch.observe(capProbe);
  }
  const lines = Object.entries(D.CAPTIONS[lang] || D.CAPTIONS.en).filter(([k]) => !/^(intro|end|card:)/.test(k)).map(([, v]) => v);
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  if (capProbe.textContent !== longest) capProbe.textContent = longest;
  // With the voice off no caption can show, so no room is kept for one (BTC-UX-21).
  capProbe.hidden = !longest || !voiceBtnShown() || !voice.on;
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
  // Where the zoomed-in set of map buttons does not fit on one row, the move buttons take a row of their own above
  // the others, so Zoom in and the turn buttons never jump under the finger at the zoom step (BTC-UX-08). Where it
  // fits (1366 x 768, the iPhone landscape split) it stays one row. Measured with the move buttons showing.
  const move = $("[data-cam-move]");
  const moveHidden = move.hidden;
  const html = document.documentElement;
  move.hidden = false;
  html.removeAttribute("data-cam-split");
  const kids = [...cam.children].filter((n) => n.offsetParent);
  const split = kids.length > 1 && kids.some((n) => Math.abs(n.offsetTop - kids[0].offsetTop) > 4);
  html.toggleAttribute("data-cam-split", split);
  const camMax = cam.offsetHeight;
  move.hidden = moveHidden;
  // Beside the panels, the schedule's room is kept for the taller set from the start, so it does not shrink, and
  // move the map buttons, at the first zoom step.
  root.setProperty("--cam-h", `${split && !TABBED.matches ? camMax : cam.offsetHeight}px`);
  // The map's least height leaves room for the map buttons with the move buttons showing, zoomed in or not. On a
  // phone those buttons take a second row, and the map used to grow by that row as the first zoom step began, so
  // the ground slid from under the pointer during a wheel or pinch zoom (pan-check at 375 x 812).
  if (TABBED.matches) root.setProperty("--scene-min", `${Math.ceil(toolsB + capGap + camMax + 8)}px`);
  else root.removeProperty("--scene-min");
  const p = $(".p-plan").getBoundingClientRect();
  if (!TABBED.matches) root.setProperty("--plan-h", `${p.height}px`);
  // Measured after --plan-h moves the map buttons: the caption fits between the toolbar and those buttons.
  root.setProperty("--tools-b", `${tools.offsetTop + tools.offsetHeight}px`);
  root.setProperty("--cam-t", `${cam.offsetTop}px`);
  pinPad();
  fitDetail();
  if (!scene) return;
  const c = canvas.getBoundingClientRect();
  safeRect = { x: 0, y: 0, w: c.width, h: c.height };
  if (TABBED.matches) return scene.setSafe(safeRect);
  // The open map area between the panels. Presenter view hides the side panel and the schedule; its Neighbors panel,
  // opened on a screen under 1600 px wide, lies over the map without moving the campus (BTC-UX-07).
  const b = $(".p-build").getBoundingClientRect();
  const s = $(".p-side").getBoundingClientRect();
  const drawer = document.body.hasAttribute("data-present") && innerWidth < 1600;
  const x = b.width ? b.right - c.left : 0;
  const r = s.width && !drawer ? s.left - c.left : c.width;
  const bottom = p.height ? p.top - c.top : c.height;
  safeRect = { x, y: 0, w: Math.max(200, r - x), h: Math.max(200, bottom) };
  scene.setSafe(safeRect);
}
// The open map area last measured, in the map's own pixels: the floating tag stays inside it (BTC-UX-17).
let safeRect = null;
// Dialogs with a pinned button row keep focused controls clear of it (scroll-padding-bottom, WCAG 2.4.11).
function pinPad() {
  for (const [d, sel] of [[$("[data-intro]"), ".intro-btns"], [$("[data-end]"), ".dlg-foot"], [$("[data-about-dlg]"), ".dlg-foot"]]) {
    const row = d.open && $(sel, d);
    if (row) d.style.setProperty("--pin-h", `${row.offsetHeight + 12}px`);
  }
}
const sizeWatch = new ResizeObserver(measureSafe);
sizeWatch.observe(document.body);
sizeWatch.observe($(".tools"));
sizeWatch.observe($(".p-plan"));
sizeWatch.observe($(".cam"));
// The map itself too: it can change size while none of the boxes above does (the top bar takes another line when a
// score's text changes, and the map's share of the page shrinks). The 3D view then kept the old open area, so the
// campus sat off centre until the next measure. That came with the move buttons, at the first zoom step, and the
// ground slid from under the pointer as the view jumped (pan-check at 375 x 812 in CI).
sizeWatch.observe(canvas);
// Map buttons (WCAG 2.5.7): every drag, pinch and twist has a button. The move buttons appear when zoomed in.
let zoomTipShown = false;
// Touch-only screens (phones, iPads) get finger words in the hint: iPads were told to right-drag and scroll (BTC-UX-41).
const TOUCH_ONLY = matchMedia("(pointer: coarse) and (hover: none)");
function onCamMode(zoomed) {
  const t = T();
  const touch = TOUCH_ONLY.matches;
  // Small phones show the short form, so the hint stays on one line above the map buttons.
  const long = placing ? t.placeDrag : zoomed ? (touch ? t.dragHintZoomedTouch : t.dragHintZoomed) : touch ? t.dragHintShort : t.dragHint;
  const short = placing ? t.placeDragShort : zoomed ? t.dragHintZoomedShort : t.dragHintShort;
  $("[data-hint]").innerHTML = `<span class="long">${esc(long)}</span><span class="short">${esc(short)}</span>`;
  $("[data-cam-move]").hidden = !zoomed;
  if (zoomed && !zoomTipShown) {
    zoomTipShown = true;
    const hint = $("[data-hint]");
    hint.classList.add("hint-new");
    setTimeout(() => hint.classList.remove("hint-new"), 4500);
    $("[data-alert]").textContent = t.zoomTip;
    // Where the hint has no room (very short landscape windows), the tip shows once as a toast instead.
    if (getComputedStyle(hint).display === "none" && !$$("dialog").some((d) => d.open)) { toastEl.textContent = t.zoomTip; toastKeep = ""; showToast(); }
  }
}
$("[data-cam]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-cam-act]");
  if (!b) return;
  if (b.dataset.camAct === "present") setPresent(!document.body.hasAttribute("data-present"), true);
  else scene?.act(b.dataset.camAct);
});
// Presenter view (I10): the side panel and the schedule step aside so the map fills the stage, and the text is
// larger for a projector. The Build panel and the scores stay. Class and home modes remember it on the device, like
// Library mode; on a kiosk it lasts one game.
const presentBoxes = () => $$("[data-present-pref]");
function setPresent(on, remember = false) {
  document.body.toggleAttribute("data-present", on);
  document.documentElement.toggleAttribute("data-present", on);
  for (const b of $$("[data-cam-act=present]")) b.setAttribute("aria-pressed", on);
  if (!on) setSideOpen(false);
  for (const box of presentBoxes()) box.checked = on;
  prefs.present = on;
  if (remember) savePref("present", on);
  measureSafe();
}
// Presenter view keeps its big map, and a Neighbors toggle in the toolbar brings the side panel (Neighbors and
// Choices) back over it, so the civic part of the game stays in reach on a projector (BTC-UX-07). While presenter
// view is on, the toolbar also names it, with a button that turns it off (BTC-UX-X01).
const sideOpen = () => document.documentElement.hasAttribute("data-side-open");
function setSideOpen(on) {
  document.documentElement.toggleAttribute("data-side-open", on);
  $("[data-side-toggle]").setAttribute("aria-pressed", on);
  if (on) { ui.side = "hood"; renderSide(); }
  else markHoodTab(hood());
  measureSafe();
}
$("[data-side-toggle]").addEventListener("click", () => setSideOpen(!sideOpen()));
$("[data-present-off]").addEventListener("click", () => {
  setPresent(false, true);
  $("[data-cam-act=present]").focus({ preventScroll: true });
});

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
// A lasting note (keep: the browser is not saving, QL-5) is about no click, so a dialog that opens over it only puts
// it off (openDlg): it shows again, for its full time, once no dialog covers it.
let toastKeep = "";
function toast(text, { log = false, keep = false } = {}) {
  if (log) say(text);
  else status.textContent = text;
  toastEl.textContent = text;
  toastKeep = keep ? text : "";
  if (keep && $$("dialog").some((d) => d.open)) { toastEl.hidden = true; toastAfterDialogs(); }
  else showToast();
}
function showToast() {
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; toastKeep = ""; }, Math.min(9000, Math.max(3500, toastEl.textContent.length * 55)));
}
function toastAfterDialogs() {
  clearTimeout(toastTimer);
  const wait = () => {
    if (!toastKeep || toastEl.textContent !== toastKeep) return;
    if ($$("dialog").some((d) => d.open)) { toastTimer = setTimeout(wait, 300); return; }
    showToast();
  };
  toastTimer = setTimeout(wait, 300);
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
  // The substation's factory test sits under level 1, beside the line it belongs to (BTC-UX-X02).
  const rows = [
    row("L1", t.cxWhen.L1, cxState(1)),
    row("substation", t.cxWhen.L1, st.xfmr ? t.cxDone : t.cxWait),
    row("L2", t.cxWhen.L2, cxState(2)),
    row("L3", t.cxWhen.L3, cxState(3)),
    row("L4", t.cxWhen.L4, cxState(4)),
    ...gear,
    row("L5", t.cxWhen.L5, st.placed.has("L5") ? t.cxDone : t.cxWait),
  ];
  return `<p class="log-h" role="heading" aria-level="3">${esc(t.cxTrackTitle)}</p><ul class="cx">${rows.join("")}</ul><p class="muted">${esc(t.cxTrackNote)}</p>`;
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
// Touch screens get the touch line and other devices the mouse and arrow-key line (style.css, UD-8). Set it here
// is described by the fit message, so focusing it says whether the spot fits (AS-1).
function placeBoxHtml() {
  const t = T();
  if (!placing) return "";
  const hint = t.placeHint[placing.id] || "";
  return `<div class="place-box" data-place-box><p class="kicker">${esc(t.placeKicker)}</p><p>${esc(hint)} <span class="place-keys">${esc(t.placeKeys)}</span><span class="place-touch">${esc(t.placeTouch)}</span></p><p class="place-why" id="place-why" data-place-why></p><div class="place-actions"><button type="button" class="btn btn-small" data-place-set aria-describedby="place-why">${esc(t.placeSet)}</button><button type="button" class="btn btn-ghost btn-small" data-place-cancel>${esc(t.placeCancel)}</button></div></div>`;
}
function renderBuild() {
  const t = T();
  const box = $("[data-build]");
  const p = PH.find((q) => q.id === st.focus);
  const next = PH.find((q) => ready(q) && !st.done.has(q.id) && !started(q.id)) || PH.find((q) => ready(q) && !st.done.has(q.id));
  let html = "";
  if (!p) {
    if (st.done.has("turn")) {
      // Looking at the finished campus after the summary (BTC-UX-01): the way back to it is the one next step.
      html = `<p class="kicker">${esc(fmt(t.phaseOf, { n: PH.length }))}</p><h2>${esc(t.phases.turn.name)}</h2><p class="muted">${esc(t.lookNote)}</p><button type="button" class="btn btn-wide" data-back-end>${esc(t.endBack)}</button>`;
    } else if (next) {
      html = `<p class="kicker">${esc(fmt(t.phaseOf, { n: PH.indexOf(next) + 1 }))}</p><h2>${esc(t.phases[next.id].name)}</h2><p class="muted">${esc(t.phases[next.id].log)}</p><button type="button" class="btn btn-wide" data-go="${next.id}">${esc(fmt(t.nextHint, { name: t.phases[next.id].name }))}</button>`;
    } else html = `<p class="muted">${esc(t.pickPhase)}</p>`;
  } else {
    const all = p.els.every((e) => st.placed.has(e));
    // Locked steps and the waiting Finish stay in the Tab order and say why when pressed (aria-disabled, BTC-UX-30).
    // Once Finish can be pressed it is pinned to the bottom of the panel on a card band, as the dialogs pin theirs,
    // so a long phase never hides its next step below the fold (BTC-UX-05).
    html = `${placeBoxHtml()}<p class="kicker">${esc(fmt(t.phaseOf, { n: PH.indexOf(p) + 1 }))}</p><h2>${esc(t.phases[p.id].name)}</h2>
      <p class="muted">${esc(t.phases[p.id].log)} <span class="range">${p.months[0]}–${p.months[1]} ${esc(t.schedAxis)} · ${esc(t.typical)}</span></p>
      <ul class="els">${p.els
        .map((e) => {
          const done = st.placed.has(e);
          const why = !done ? blockReason(e) : "";
          const title = why || (done ? t.showOnMap : "");
          const short = why ? blockShort(e) : "";
          return `<li><button type="button" class="el" data-el="${e}"${done ? " data-done" : ""}${why ? ' aria-disabled="true"' : ""} title="${esc(title)}"><span class="el-mark">${done ? ICON.done : why ? ICON.lock : ICON.plus}</span><span class="el-name">${esc(t.elements[e].name)}${short ? `<span class="el-why">${esc(short)}</span>` : ""}</span><span class="el-act">${esc(actLabel(e, done))}</span></button></li>`;
        })
        .join("")}</ul>
      <div class="finish-bar"${all ? " data-pin" : ""}><button type="button" class="btn btn-wide" data-finish${all ? "" : ' aria-disabled="true"'}>${esc(all ? fmt(t.finishPhase, { name: t.phases[p.id].short }) : t.finishNeed)}</button></div>`;
  }
  // The Site log and Undo come right after the next step, and the commissioning track after them, as reference: the
  // track pushed both below the fold from Utilities on (BTC-UX-X02).
  html += `<p class="log-h" role="heading" aria-level="3">${esc(t.logTitle)}</p><ul class="log">${st.log.slice(0, 3).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  const canUndo = history.length > 0 && !st.done.has("turn");
  html += `<div class="game-btns"><button type="button" class="btn btn-ghost btn-small" data-undo${canUndo ? "" : " disabled"}>${esc(t.undo)}</button><button type="button" class="btn btn-ghost btn-small" data-restart>${esc(t.startOver)}</button></div>`;
  html += cxTrackHtml();
  const keep = document.activeElement?.matches?.("[data-undo], [data-restart]") ? (document.activeElement.hasAttribute("data-undo") ? "[data-undo]" : "[data-restart]") : "";
  box.innerHTML = html;
  fillPlaceWhy();
  if (keep) $(keep, box)?.focus({ preventScroll: true });
}
const locked = (b) => b.getAttribute("aria-disabled") === "true";
$("[data-build]").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (cardPending && !b.matches("[data-restart], [data-undo], [data-done]")) { waitForCard(); return; }
  if (b.hasAttribute("data-undo")) undo();
  else if (b.hasAttribute("data-restart")) askStartOver();
  else if (b.hasAttribute("data-back-end")) showEnd();
  else if (b.hasAttribute("data-place-set")) confirmPlace();
  else if (b.hasAttribute("data-place-cancel")) { endPlace(); renderBuild(); focusNext(); }
  else if (b.dataset.el && b.hasAttribute("data-done")) { scene?.focus(b.dataset.el, true); showTag(b.dataset.el); }
  // A locked step says why (place() toasts its reason), and the waiting Finish says what it waits for.
  else if (b.dataset.el) place(b.dataset.el);
  else if (b.hasAttribute("data-finish")) { if (locked(b)) toast(T().finishNeed); else finishPhase(st.focus); }
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
    return `<li><button type="button" class="lane" data-phase="${p.id}" data-state="${state}"${sc.crit.has(p.id) && shown ? " data-crit" : ""} aria-pressed="${st.focus === p.id}" title="${esc(state === "locked" ? `${lockedTitle}. ${t.phases[p.id].why}` : t.phases[p.id].name)}"><span class="lane-icon">${icon}</span><span class="lane-name">${esc(t.phases[p.id].short)}</span><span class="sr"> (${esc(sr)})</span><span class="track">${bar}</span></button></li>`;
  }).join("");
  const ticks = [];
  for (let m = 0; m <= maxM; m += 6) ticks.push(`<span style="left:${pct(m)}">${m}</span>`);
  // The legend stays visible on short screens, where the longer note is hidden; the bar patterns carry the
  // meaning without colour (I3, WCAG 1.4.1).
  // The thin range line is named too, since the note that explains it is hidden on screens 800 px tall and less
  // (BTC-UX-14).
  const legend = `<p class="legend"><span><i class="sw sw-crit"></i>${esc(t.legendCrit)}</span><span><i class="sw sw-other"></i>${esc(t.legendOther)}</span><span><i class="sw sw-now"></i>${esc(t.legendNow)}</span><span><i class="sw sw-range"></i>${esc(t.legendRange)}</span></p>`;
  // The toggle shows only where the schedule starts as a row of phases (style.css, UD-1).
  $("[data-plan]").innerHTML = `<div class="plan-head"><h2>${esc(t.schedTitle)} <small>(${esc(t.schedAxis)})</small></h2><button type="button" class="plan-toggle" data-plan-toggle aria-expanded="${ui.planOpen}">${esc(ui.planOpen ? t.planLess : t.planMore)}</button><p class="plan-total">${esc(st.started ? fmt(t.schedTotal, { n: Math.round(sc.total), base: M.BASE_MONTHS }) : t.schedEmpty)}</p></div>
    <ol class="lanes" style="--cols:${maxM / 6}">${lanes}</ol><div class="axis"><span class="axis-pad"></span><span class="axis-track">${ticks.join("")}</span></div>
    ${legend}<p class="plan-note">${esc(t.schedNote)}</p>`;
}
// Show or hide the schedule's bars where it starts as a row of phases. Not saved: each player starts with the map big.
function setPlanOpen(open) {
  ui.planOpen = open;
  document.body.toggleAttribute("data-plan-open", open);
  renderPlan();
}
$("[data-plan]").addEventListener("click", (e) => {
  if (e.target.closest("[data-plan-toggle]")) {
    setPlanOpen(!ui.planOpen);
    $("[data-plan-toggle]").focus({ preventScroll: true });
    return;
  }
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
  const row = (key, kind) => {
    const level = L[key] ?? 0;
    const planned = (key === "water" || key === "power") && started("util") && !ops;
    const word = key === "jobs" ? t.hood.jobsNow[jobsKey()] : planned ? t.hood.planned : kind === "amount" ? t.hood.amounts[level] : t.hood.levels[level];
    return `<li><button type="button" class="hood-row" data-key="${key}" data-kind="${kind}" aria-pressed="${ui.hot === key}"><span class="hood-name">${esc(t.hood[key].name)}</span><span class="meter" aria-hidden="true">${[1, 2, 3, 4].map((n) => `<i${n <= level ? " data-on" : ""}></i>`).join("")}</span><span class="hood-word">${esc(word)}</span></button></li>`;
  };
  const notice = ["trucks", "noise", "dust", "storm", "gens", "setback"];
  const community = ["jobs", "tax", "power", "water"];
  // Two lists, each under a heading screen readers can jump to (BTC-UX-34).
  $("[data-hood]").innerHTML = `<p class="hood-h" role="heading" aria-level="3">${esc(t.hoodNotice)}</p><ul class="hood">${notice.map((k) => row(k, "notice")).join("")}</ul><p class="hood-h" role="heading" aria-level="3">${esc(t.hoodCommunity)}</p><ul class="hood">${community.map((k) => row(k, "amount")).join("")}</ul>`;
  renderHoodDetail();
  $("[data-hood-break]").textContent = hoodBreakdown();
  markHoodTab(L);
  $("[data-choices]").innerHTML = CHOICES.map((c) => {
    const locked = choiceLocked(c);
    const v = st.choice[c];
    return `<div class="choice"${locked ? " data-locked" : ""}><div class="choice-head"><span class="choice-name">${esc(t.choices[c].name)}</span>${locked ? `<span class="lock" id="lock-${c}">${ICON.lock}${esc(t.lockedAfter)}</span>` : ""}</div>
      <div class="seg" role="group" aria-label="${esc(t.choices[c].name)}" aria-describedby="${locked ? `lock-${c} ` : ""}note-${c}">${["a", "b"].map((o) => `<button type="button" data-choice="${c}" data-v="${o}" aria-pressed="${v === o}"${locked && v !== o ? " disabled" : ""}>${esc(t.choices[c][o].label)}</button>`).join("")}</div>
      <p class="choice-note" id="note-${c}">${esc(v ? t.choices[c][v].note : t.choiceUnset)} ${v ? chipsFor("choice", c, v) : ""}</p></div>`;
  }).join("");
  $("[data-choices]").insertAdjacentHTML("afterbegin", `<p class="choices-note">${esc(t.choicesNote)}</p>`);
  for (const b of $$("[data-side-tab]")) b.setAttribute("aria-pressed", b.dataset.sideTab === ui.side);
  document.body.dataset.side = ui.side;
  // The side region is named for what it shows (BTC-UX-34).
  $(".p-side").setAttribute("aria-label", ui.side === "choices" ? t.choicesTitle : t.tabHood);
  fitDetail();
}
// The fact for the row in focus. The box is a polite live region, so it is written only when its words change:
// writing the same fact again on every render made screen readers repeat it after each action (AS-2).
let hoodDetailHtml = null;
function renderHoodDetail() {
  const t = T();
  const youSaid = { trucks: ["route", "hours"], noise: ["wall", "hours", "cool", "buffer"], dust: ["light"], water: ["cool"], power: ["cool"], gens: ["test"], setback: ["buffer"] };
  const k = ui.hot;
  const picks = (youSaid[k] || []).filter((c) => st.choice[c]);
  const html = k
    ? `<b>${esc(t.hood[k].name)}</b><span>${esc(t.hood[k].fact)}</span>${picks.length ? `<span class="you">${esc(t.hoodYou)}${picks.map((c) => esc(t.choices[c][st.choice[c]].label)).join(" · ")}</span>` : ""}`
    : `<span>${esc(t.hoodDetailHint)}</span>`;
  if (html === hoodDetailHtml) return;
  hoodDetailHtml = html;
  const box = $("[data-hood-detail]");
  box.innerHTML = html;
  box.scrollTop = 0;
  fitDetail();
}
// Beside the panels the fact box sits under the rows with a height cap, always in sight (BTC-UX-06, BTC-UX-60). A
// fact longer than the cap scrolls inside the box, and the box then takes keyboard focus so it can be scrolled
// without a mouse (WCAG 2.1.1).
function fitDetail() {
  const box = $("[data-hood-detail]");
  if (box.scrollHeight > box.clientHeight + 1) box.tabIndex = 0;
  else box.removeAttribute("tabindex");
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
  // In presenter view the side panel is seen only while its Neighbors toggle has it open (BTC-UX-07).
  const seen = TABBED.matches ? ui.tab === "hood" : ui.side === "hood" && (!document.body.hasAttribute("data-present") || sideOpen());
  if (seen || !st.started) ui.hoodNew = false;
  else if (ui.hoodSig != null && sig !== ui.hoodSig) ui.hoodNew = true;
  ui.hoodSig = sig;
  const t = T();
  for (const b of $$('[data-side-tab="hood"], .tabs [data-tab="hood"], [data-side-toggle]')) {
    b.toggleAttribute("data-new", ui.hoodNew);
    if (ui.hoodNew) b.setAttribute("aria-label", `${b.textContent} · ${t.tabNew}`);
    else b.removeAttribute("aria-label");
  }
}
// press: a click, Enter or tap. Only a press moves the map to the effect, at once and past the pause after manual
// moves; pointing at or tabbing through the rows only highlights it, so a zoomed view no longer swings row by row,
// or jump-cuts under reduced motion (BTC-UX-17).
function focusHood(key, toggle, press = false) {
  if (!key) return;
  showHood(toggle ? (ui.hot === key ? null : key) : key, press);
}
function showHood(key, press = false) {
  if (key === ui.hot && !press) return;
  ui.hot = key;
  // The rows change in place: rebuilding the list moved focus to a new copy of the row, so a screen reader
  // announced each Tab twice (AS-2).
  for (const b of $$("[data-hood] [data-key]")) b.setAttribute("aria-pressed", b.dataset.key === ui.hot);
  renderHoodDetail();
  paintScene(false);
  const spot = HOT_SPOT[ui.hot];
  if (press && spot && st.ov) scene?.lookAt(spot[0], spot[1], true);
}
// The fact box is a polite live region for focus and presses. A mouse sweeping over the rows does not queue a fact per
// row for screen readers (BTC-UX-33), and a wheel or scroll over the list does not switch rows as they pass under a
// resting pointer (BTC-UX-06).
const detailLive = (on) => $("[data-hood-detail]").setAttribute("aria-live", on ? "polite" : "off");
let hoodScrolledAt = -Infinity;
$(".p-side").addEventListener("scroll", () => { hoodScrolledAt = performance.now(); }, { capture: true, passive: true });
$(".p-side").addEventListener("wheel", () => { hoodScrolledAt = performance.now(); }, { passive: true });
$("[data-hood]").addEventListener("pointerover", (e) => {
  if (e.pointerType && e.pointerType !== "mouse") return;
  if (performance.now() - hoodScrolledAt < 250) return;
  const b = e.target.closest("[data-key]");
  if (!b) return;
  detailLive(false);
  focusHood(b.dataset.key, false);
});
// A row the pointer only passed over is not left shown (and every other effect faded) once the pointer leaves the
// list; a row that was pressed stays (BTC-UX-65).
$("[data-hood]").addEventListener("pointerleave", (e) => {
  if (e.pointerType !== "mouse") return;
  // A row that has keyboard focus counts as shown too.
  const focused = $("[data-hood]").contains(document.activeElement) ? document.activeElement.closest("[data-key]")?.dataset.key : null;
  const keep = ui.picked || focused || null;
  if (keep === ui.hot) return;
  detailLive(false);
  showHood(keep);
});
$("[data-hood]").addEventListener("focusin", (e) => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  detailLive(true);
  focusHood(b.dataset.key, false);
});
// Hover and focus already show a row by the time a click, Enter or tap lands, so the press keeps it shown, and a
// second press on the row it picked clears it (AS-2: rebuilding the list used to undo the toggle by accident).
$("[data-hood]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  detailLive(true);
  focusHood(b.dataset.key, ui.picked === b.dataset.key, true);
  ui.picked = ui.hot;
});
$("[data-choices]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-choice]");
  if (b && !b.disabled) choose(b.dataset.choice, b.dataset.v, { step: true });
});
for (const b of $$("[data-side-tab]")) b.addEventListener("click", () => { ui.side = b.dataset.sideTab; renderSide(); });
for (const b of $$(".tabs [data-tab]")) b.addEventListener("click", () => setTab(b.dataset.tab));
// The skip link (AS-10) goes straight to the Build panel, which on phones is a tab.
$("[data-skip]").addEventListener("click", (e) => {
  e.preventDefault();
  if (ui.tab !== "build") setTab("build");
  $(".p-build").focus();
});
function setTab(tab) {
  ui.tab = tab;
  if (tab === "hood" || tab === "choices") ui.side = tab;
  document.body.dataset.view = tab;
  for (const b of $$(".tabs [data-tab]")) b.setAttribute("aria-pressed", b.dataset.tab === tab);
  renderSide();
}

// The tiles' last values, unrounded, so a change shows on the tile that changed (BTC-UX-12), half a month included.
let dashWas = null, dashTimer = 0;
const dashDelta = {
  schedule: (d) => `${d > 0 ? "+" : "−"}${fmt(T().dashMonthsShort, { n: Math.abs(Math.round(d * 2) / 2) })}`,
  budget: (d) => `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d * 10) / 10)}%`,
  safety: (d) => signed(d),
  hood: (d) => signed(d),
};
function renderDash() {
  const t = T();
  const s = scores();
  const now = { schedule: s.total, budget: s.budgetRaw, safety: s.safety, hood: started("grade") ? s.hood : null };
  const changed = {};
  if (dashWas && st.started) {
    for (const k of Object.keys(now)) {
      const d = now[k] != null && dashWas[k] != null ? now[k] - dashWas[k] : 0;
      if (k === "schedule" ? Math.abs(d) >= 0.25 : k === "budget" ? Math.abs(d) >= 0.05 : d !== 0) changed[k] = d;
    }
  }
  dashWas = st.started ? now : null;
  // Every tile shows its rating word at every width, next to the dot (I3, WCAG 1.4.1). A tile that just changed gets a
  // light ring for a few seconds, not a coloured dot that could read as a rating, and from 1366 px wide the size of
  // the change after its word ("· +1 mo"); screen readers get the summary below instead.
  const tile = (key, value, word, level, short = value, wordShort = word) => {
    const node = $(`[data-dash="${key}"]`);
    $(".kpi-val", node).innerHTML = `<span class="long">${esc(value)}</span><span class="short">${esc(short)}</span>`;
    const delta = key in changed ? `<span class="kpi-delta" aria-hidden="true"> · ${esc(dashDelta[key](changed[key]))}</span>` : node.querySelector(".kpi-delta")?.outerHTML || "";
    $(".kpi-word", node).innerHTML = `<span class="long">${esc(word)}</span><span class="short">${esc(wordShort)}</span>${delta}`;
    node.dataset.level = level;
    if (key in changed) node.setAttribute("data-changed", "");
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
  if (Object.keys(changed).length) {
    clearTimeout(dashTimer);
    dashTimer = setTimeout(clearDashMarks, 4000);
  }
  announceScores(said);
}
function clearDashMarks() {
  clearTimeout(dashTimer);
  for (const n of $$("[data-dash]")) { n.removeAttribute("data-changed"); n.querySelector(".kpi-delta")?.remove(); }
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
// Approvals, plans, studies and the final test are done, not built (BTC-UX-53).
const DONE_TAG = new Set(["zoning", "capacity", "stormPlan", "meetings", "L5"]);
let tagFor = null, tagUntil = 0, tagH = 0, tagW = 0, tagRaf = 0;
function showTag(id) {
  // Without the 3D view, or with its context lost, there is nothing to point at, so no tag (it used to stick in the
  // corner, FE-2).
  if (!scene || document.body.hasAttribute("data-nogl")) return;
  tagFor = id;
  tagUntil = performance.now() + 3200;
  tagEl.textContent = fmt(DONE_TAG.has(id) ? T().doneTag : T().builtTag, { name: T().elements[id].name });
  tagEl.hidden = false;
  tagH = tagEl.offsetHeight;
  tagW = tagEl.offsetWidth;
  // Placed at once, not on the next frame: on a slow device a frame can take longer than the click, and the tag
  // used to show at the last tag's spot, or under the toolbar, until then. The tag follows its part only while it
  // shows, so no frame loop runs between tags (FE-3).
  if (tagRaf) cancelAnimationFrame(tagRaf);
  followTag(performance.now());
}
function followTag(now) {
  tagRaf = 0;
  if (!tagFor || now > tagUntil || document.body.hasAttribute("data-nogl")) { tagEl.hidden = true; tagFor = null; return; }
  const p = scene.screenOf(tagFor);
  // Under the toolbar the tag could not be read, so it stays out of sight while its part is that high (UD-11); the
  // same under a narration caption, which shows at the same moment on a phone (BTC-UX-62), and outside the open map
  // between the panels, where it was drawn over panel text or off the screen (BTC-UX-17).
  let top = parseFloat(document.documentElement.style.getPropertyValue("--tools-b")) || 0;
  if (!capEl.hidden) top = Math.max(top, capEl.offsetTop + capEl.offsetHeight + 4);
  const r = safeRect;
  const out = p && r && (p[0] - tagW / 2 < r.x || p[0] + tagW / 2 > r.x + r.w || p[1] > r.y + r.h);
  if (!p || p[1] - tagH < top || out) tagEl.hidden = true;
  else { tagEl.hidden = false; tagEl.style.transform = `translate(${p[0].toFixed(0)}px, ${p[1].toFixed(0)}px) translate(-50%, -100%)`; }
  tagRaf = requestAnimationFrame(followTag);
}

// ---------- actions ----------
// Focus moves without scrolling (the page and the map never move), then only the panel itself scrolls so the
// focused control is in sight, clear of the pinned Finish band: in Grading and MEP, Finish sat below the fold at
// 200% zoom, on phones and in short windows, and the next Enter pressed a button nobody could see (BTC-UX-05,
// WCAG 2.4.7, 2.4.11). In the layouts where the page itself scrolls (very short windows), the page follows too.
function reveal(node) {
  const panel = node?.closest?.(".panel");
  if (!panel) return;
  const p = panel.getBoundingClientRect(), r = node.getBoundingClientRect();
  const band = node.closest(".finish-bar") ? null : $(".finish-bar[data-pin]", panel);
  const bottom = p.bottom - (band ? band.offsetHeight : 0) - 8;
  if (r.bottom > bottom) panel.scrollTop += Math.min(r.bottom - bottom, r.top - p.top - 8);
  else if (r.top < p.top + 8) panel.scrollTop -= p.top + 8 - r.top;
  const page = document.scrollingElement;
  if (page && page.scrollHeight > innerHeight + 1) {
    const s = node.getBoundingClientRect();
    if (s.bottom > innerHeight) page.scrollTop += s.bottom - innerHeight + 8;
    else if (s.top < 0) page.scrollTop -= 8 - s.top;
  }
}
const OPEN_EL = '.el:not([data-done]):not([aria-disabled="true"])';
function focusOn(node) {
  if (!node) return;
  node.focus({ preventScroll: true });
  reveal(node);
}
function focusNext() {
  focusOn($(OPEN_EL) || $('[data-finish]:not([aria-disabled="true"])'));
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
let phaseSayTimer = 0;
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
  const moved = st.focus !== id;
  if (placing && phaseOf[placing.id] !== id) endPlace();
  st.focus = id;
  if (opening) logStep("phase", id);
  advanceCx().forEach(say);
  renderAll();
  if (opening) speak(`phase:${id}`);
  if (ui.tab !== "build") setTab("build");
  // Another phase starts at the top of the panel, with its name in sight.
  if (moved) $(".p-build").scrollTop = 0;
  focusOn($(OPEN_EL));
  // Screen readers hear which phase opened once the focus move has been read; the visible log is left alone
  // (BTC-UX-31). The status line is the polite one the Site log uses.
  if (moved) {
    clearTimeout(phaseSayTimer);
    phaseSayTimer = setTimeout(() => { if (st.focus === id && !$$("dialog").some((d) => d.open)) status.textContent = fmt(t.phaseSay, { n: PH.indexOf(p) + 1, name: t.phases[id].name }); }, 600);
  }
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
// announce: the footprint moved. Screen readers hear the message on the status line once the footprint stops
// moving, and only when it says something new (AS-1, WCAG 4.1.3).
let placeSayTimer = 0;
function fillPlaceWhy(announce = false) {
  const node = $("[data-place-why]");
  if (!node || !placing) return;
  const issue = M.layoutIssue(placing.id, placing.dx, placing.dz, layoutPlaced(placing.id));
  const text = issue ? placeIssueText(issue) : T().placeOk;
  node.dataset.ok = issue ? "0" : "1";
  node.textContent = text;
  if (!announce) return;
  clearTimeout(placeSayTimer);
  placeSayTimer = setTimeout(() => { if (placing && status.textContent !== text) status.textContent = text; }, 700);
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
  clearTimeout(placeSayTimer);
  scene?.setPlaceMode(false);
  scene?.setFootprints([]);
  onCamMode(!!scene?.zoomed());
}
function setPreview(dx, dz) {
  if (!placing) return;
  const spec = M.LAYOUT[placing.id];
  if (spec?.axis === "z") dx = 0;
  const x = snapGrid(dx), z = snapGrid(dz);
  // The footprints are drawn again only when the snapped spot changes: every pointer move rebuilt about 80 WebGL
  // buffers inside the same 10 m cell (BTC-UX-45).
  if (x === placing.dx && z === placing.dz) return;
  placing.dx = x;
  placing.dz = z;
  fillPlaceWhy(true);
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
  // With no 3D map, or with its context lost mid-game, there is no map to drag on: the piece goes where it was last
  // set, or at the suggested spot (BTC-UX-56).
  if (!M.LAYOUT[e] || !scene || document.body.hasAttribute("data-nogl")) {
    const prev = st.layout[e];
    commitElement(e, prev && !M.layoutIssue(e, prev.x, prev.z, layoutPlaced(e)) ? prev : { x: 0, z: 0 });
    return;
  }
  const prev = st.layout[e] || { x: 0, z: 0 };
  placing = { id: e, dx: prev.x, dz: prev.z };
  scene.setPlaceMode(true, onPlacePointer);
  renderBuild();
  paintFootprints();
  onCamMode(!!scene.zoomed());
  $(".p-build").scrollTop = 0;
  focusOn($("[data-place-set]"));
}
function confirmPlace() {
  if (!placing) return;
  const { id, dx, dz } = placing;
  const issue = M.layoutIssue(id, dx, dz, layoutPlaced(id));
  // The reason is already written in the siting box, beside Set it here; a toast over the map buttons repeated it
  // word for word and covered Cancel on phones. It shows only when the box has scrolled out of sight (BTC-UX-15).
  if (issue) {
    fillPlaceWhy();
    const why = $("[data-place-why]"), panel = why?.closest(".panel");
    const r = why?.getBoundingClientRect(), pr = panel?.getBoundingClientRect();
    const seen = r && pr && r.height > 0 && r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1 && r.bottom <= innerHeight;
    if (seen) status.textContent = placeIssueText(issue);
    else toast(placeIssueText(issue));
    return;
  }
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
    remember(`${t.factoryAct} · ${t.elements[e].name}`);
    st.xfmr = 1;
    logStep("factory", e);
    say(fmt(t.logL1, { name: t.elements[e].name }));
    renderAll();
    focusNext();
    return;
  }
  if (MEP.includes(e) && !st.cx[e]) {
    remember(`${t.factoryAct} · ${t.elements[e].name}`);
    st.cx[e] = 1;
    logStep("factory", e);
    syncCx();
    say(fmt(t.logL1, { name: t.elements[e].name }));
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
  remember(t.elements[e].name);
  if (offset) st.layout[e] = { x: offset.x, z: offset.z };
  st.placed.add(e);
  logStep("place", e);
  if (MEP.includes(e)) {
    st.cx[e] = Math.max(st.cx[e], 2);
    say(fmt(t.logL2, { n: gearAt(2) }));
  }
  advanceCx().forEach(say);
  say(t.elements[e].log);
  renderAll();
  scene?.focus(e);
  showTag(e);
  speak(`el:${e}`);
  const card = Object.entries(CARD).find(([id, c]) => c.at && !(id in st.cards) && (c.at === e || c.at === phaseOf[e]));
  if (card) { st.cards[card[0]] = null; autosave(); scheduleCard(card[0], afterPlace); }
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
  if (id === "turn") logStep("end");
  renderAll();
  if (id === "turn") openEnd();
  else focusOn($("[data-go]"));
}
// An issue card that was due but not answered (after undo or a resumed game) is offered again.
// A setback drawn at the end of a phase still finishes that phase once it is answered.
function reofferCards() {
  const due = Object.entries(st.cards).find(([, pick]) => pick == null);
  if (!due) return;
  const rollPhase = CARD[due[0]]?.roll;
  const after = rollPhase && st.done.has(rollPhase) ? () => phaseSettled(rollPhase) : afterPlace;
  scheduleCard(due[0], after);
}
// Undo takes back the last placement, finished phase or change in the Choices panel (I7, DE-4).
function undo() {
  if (!history.length || st.done.has("turn") || dlg.open) return;
  const step = JSON.parse(history.pop());
  const back = loadState(step.state);
  if (!back) return;
  playGen += 1;
  clearCardTimers();
  resume = null;
  cardAfter = null;
  cardPending = false;
  endPlace();
  hush();
  // The steps keep what was undone, and the undo itself (BTC-01). The map-effects switch is a view, not a move, so it
  // stays as the player left it: undo used to bring back an older setting while its button still showed this one.
  back.t0 = st.t0;
  back.steps = st.steps;
  back.ov = st.ov;
  st = back;
  logStep("undo");
  say(step.label ? fmt(T().logUndoWhat, { what: step.label }) : T().logUndo);
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
    remember(fmt(t.undoFinish, { name: t.phases[id].name }));
    st.done.add(id);
    logStep("done", id);
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
  // A change in the Choices panel is a step of its own, so Undo takes back that change first (DE-4).
  if (opts.step) remember(`${t.choices[c].name} → ${t.choices[c][v].label}`);
  st.choice[c] = v;
  logStep("choice", c, v);
  say(fmt(t.logChoice, { name: t.choices[c].name, value: t.choices[c][v].label }));
  if (c === "test" && !opts.skipCx) advanceCx().forEach(say);
  renderAll();
  $(`[data-choice="${c}"][data-v="${v}"]`)?.focus({ preventScroll: true });
}
function next() {
  if (dlg.open) return;
  if (st.done.has("turn") && !endDlg.open) { showEnd(); return; }
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
// The clip line in progress, which settles when it ends, is cut off or is replaced.
let speaking = Promise.resolve();
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
// data: URL. A clip that cannot load leaves the caption on screen for a reading-length time instead. It is asked for
// again only with the next narration, together with any other clip still missing and in the same order, never on
// its own when its line comes up: that lone request told the host which answer was picked (critic).
const clipUrls = new Map();
// A language's clips, the intro and the first phase first, the rest alphabetically: the same order for every player.
function clipOrder(l = lang) {
  const set = D.VOICE[l] || {};
  const keys = Object.keys(set).sort((a, b) => (a === "intro" ? -1 : b === "intro" ? 1 : a === "phase:site" ? -1 : b === "phase:site" ? 1 : a < b ? -1 : 1));
  return keys.map((k) => set[k]);
}
function loadAllClips() {
  for (const src of clipOrder()) loadClip(src).catch(() => {});
}
// Clips loaded before this build's worker controlled the page went past it, so it kept none of them, and a reload
// with no network had no narration (review). When it takes control, the clips already loaded are asked for once more,
// through it, after the first batch has settled and in the same fixed order, so the requests still never depend on
// play. The copy the page gets back is not used: the one in memory plays.
function keepClips() {
  const asked = [...clipUrls.values()];
  if (!asked.length) return;
  Promise.allSettled(asked).then(() => {
    for (const l of Object.keys(D.VOICE)) for (const src of clipOrder(l)) if (clipUrls.has(src)) fetch(src).then((r) => r.blob()).catch(() => {});
  });
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
  // A line with no clip in this language shows its caption only, never another language's voice (PA-2).
  const clip = (D.VOICE[lang] || {})[key] || null;
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
  return (speaking = new Promise((res) => {
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
    // Waiting for a slow download counts against the issue-card cap in speakAfter, not against the clip.
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
  }));
}
// An issue card opens at once, and its line follows the clip in progress instead of cutting it off, so two clips
// never play together and the narration never holds the game up (UD-5, QL-6, AS-3). The line is dropped when
// another line starts first or when still() says its card is gone; after 7 s it plays anyway (the old cap).
function speakAfter(key, still) {
  if (!speakSettle) { speak(key); return; }
  const gen = speakGen;
  let sent = false;
  const go = () => {
    if (sent) return;
    sent = true;
    if (gen === speakGen && still()) speak(key);
  };
  later(go, 7000);
  speaking.then(go);
}
function hush() {
  if (speakSettle) { const prev = speakSettle; speakSettle = null; prev(); }
  audio.pause();
  capEl.hidden = true;
}
const voiceBtn = $("[data-voice]");
// The same switch on the intro, for screen-reader users before the narration starts (AS-11).
const voiceIntro = $("[data-voice-intro]");
const libBox = $("[data-libmode]");
function renderVoiceBtn() {
  const t = T();
  for (const b of [voiceBtn, voiceIntro]) {
    b.textContent = voice.on ? t.voiceOn : t.voiceOff;
    b.setAttribute("aria-pressed", voice.on);
  }
  // In class and home modes the checkbox is the device setting for the next player; on a kiosk it is this game only,
  // like the Voice button.
  libBox.checked = libraryOn() && !voice.on;
  libBox.disabled = MODE === "library";
  $("[data-libmode-note]").textContent = MODE === "library" ? t.libraryModeUrl : STAFFED ? t.libraryModeNote : t.libraryModeKiosk;
  voiceBtn.hidden = !Object.keys(D.VOICE.en || {}).length;
  $("[data-voice-line]").hidden = voiceBtn.hidden;
  $("[data-listen]").hidden = !voice.on || !(D.VOICE.en || {}).intro;
}
function setVoice(on, remember = false) {
  voice.on = on;
  if (!on) hush();
  if (remember) savePref("voice", on);
  renderVoiceBtn();
  // The caption room comes and goes with the voice (BTC-UX-21).
  measureSafe();
}
// Turning the voice on lifts Library mode, for this game on a kiosk and on the device in class and home modes, so the
// two switches never disagree ("Library mode · no voice" ticked beside "Voice: on", BTC-UX-27).
function pressVoice() {
  const on = !voice.on;
  if (on && prefs.library) { prefs.library = false; savePref("library", false); }
  setVoice(on, true);
}
voiceBtn.addEventListener("click", pressVoice);
voiceIntro.addEventListener("click", pressVoice);
libBox.addEventListener("change", (e) => {
  prefs.library = e.target.checked;
  savePref("library", e.target.checked);
  setVoice(!e.target.checked, true);
});
const keysBox = $("[data-keys-pref]");
keysBox.checked = prefs.keys;
// With the shortcuts off, the number hints on the answer buttons are hidden too.
const renderKeysPref = () => document.documentElement.toggleAttribute("data-nokeys", !prefs.keys);
renderKeysPref();
keysBox.addEventListener("change", (e) => { prefs.keys = e.target.checked; savePref("keys", e.target.checked); renderKeysPref(); });
// Keep the map still (BTC-UX-38): the intro turn, the fans, trucks and rings stop, and the camera cuts instead of
// easing, as with the system's reduced-motion setting, for visitors who cannot reach that setting on a kiosk.
const stillBox = $("[data-still-pref]");
function renderStill() {
  stillBox.checked = prefs.still;
  document.documentElement.toggleAttribute("data-still", prefs.still);
  scene?.start();
}
stillBox.addEventListener("change", (e) => { prefs.still = e.target.checked; savePref("still", e.target.checked); renderStill(); });
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
  // A message about a click that did nothing is over once a dialog takes the screen (UD-5); a lasting note waits.
  if (toastKeep && !toastEl.hidden) toastAfterDialogs();
  toastEl.hidden = true;
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
// A card that is due opens at once, while the line before it is still being read: its own line waits for that clip
// (openCard, speakAfter). It used to wait 3 to 7 s for the narration, refusing every other action meanwhile and
// leaving focus on the page body (UD-5, QL-6, AS-3). Only another open dialog, such as the idle prompt, holds it.
function scheduleCard(id, after) {
  const gen = playGen;
  cardPending = true;
  const open = () => {
    if (gen !== playGen || !st.started) { cardPending = false; return; }
    if (dlg.open || endDlg.open || idleDlg.open || introDlg.open) { later(open, 300); return; }
    cardPending = false;
    openCard(id, after);
  };
  open();
}
// When the card dialog last showed a new question. A click that lands within 400 ms of that, or the second click of
// a double-click, was aimed at the question before: a double-click answered one question and then the next one
// unseen (QL-1). The number keys and other clicks with no click count (detail 0) still answer at once; Enter and
// Space on a new question's buttons wait the same 400 ms (the keydown guard by the shortcuts).
let dlgShownAt = 0;
const tooSoon = (e) => e.detail > 1 || (e.detail > 0 && performance.now() - dlgShownAt < 400);
function openDecide(id, next) {
  const t = T();
  const choice = t.choices[id];
  $(".kicker", dlg).textContent = t.decideKicker;
  $(".card-title", dlg).textContent = choice.name;
  $(".card-body", dlg).textContent = choice.ask;
  // The number keys are named only while the single-key shortcuts are on.
  // The number keys are named only while the shortcuts are on, and not on touch-only screens, which have none
  // (BTC-UX-54).
  $(".card-opts", dlg).previousElementSibling.textContent = prefs.keys && !TOUCH_ONLY.matches ? t.decideChoose : t.cardChoose;
  $(".card-opts", dlg).innerHTML = ["a", "b"]
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(choice[o].label)}</span><span class="opt-note">${esc(choice[o].note)}</span>${chipsFor("choice", id, o)}</button>`)
    .join("");
  dlg.dataset.kind = "choice";
  dlg.dataset.id = id;
  resume = next;
  openDlg(dlg);
  dlgShownAt = performance.now();
  $(".opt", dlg).focus();
}
function openCard(id, after) {
  const t = T();
  const card = t.cards[id];
  $(".kicker", dlg).textContent = t.cardKicker;
  $(".card-title", dlg).textContent = card.title;
  $(".card-body", dlg).textContent = card.body;
  $(".card-opts", dlg).previousElementSibling.textContent = prefs.keys && !TOUCH_ONLY.matches ? t.cardChooseKeys : t.cardChoose;
  // Where the finish moves less than the months the card names, a line under the chips says why (UD-7).
  const why = (o) => {
    const n = Math.max(0, ...Object.values(CARD[id].opts[o].sched || {}));
    const moved = withPick("card", id, o, () => schedule().total) - withPick("card", id, null, () => schedule().total);
    return t.cardWhy[id]?.[o] && moved < n - 0.25 ? `<span class="opt-note">${esc(fmt(t.cardWhy[id][o], { n }))}</span>` : "";
  };
  $(".card-opts", dlg).innerHTML = Object.keys(CARD[id].opts)
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(card[o].label)}</span>${chipsFor("card", id, o)}${why(o)}</button>`)
    .join("");
  dlg.dataset.kind = "card";
  dlg.dataset.id = id;
  cardAfter = after || null;
  openDlg(dlg);
  dlgShownAt = performance.now();
  $(".opt", dlg).focus();
  speakAfter(`card:${id}`, () => dlg.open && dlg.dataset.kind === "card" && dlg.dataset.id === id && st.cards[id] == null);
}
$(".card-opts", dlg).addEventListener("click", (e) => {
  const b = e.target.closest("[data-o]");
  if (!b || tooSoon(e)) return;
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
  logStep("card", id, b.dataset.o);
  speak(`opt:${id}:${b.dataset.o}`);
  const fn = cardAfter;
  cardAfter = null;
  closeDlg(dlg);
  // Written once the dialog has closed: the status line is outside it, and inert while the modal is open (BTC-UX-32).
  say(T().cards[id][b.dataset.o].log);
  renderAll();
  fn?.();
});
guard(dlg, () => $(".opt", dlg)?.focus());
const endDlg = $("[data-end]");
// The debrief (C11): the results against the plan, with their rating words, the three answers that cost the most,
// every choice, and three questions to talk over. It prints on its own (Print button, print styles).
// Every question has to be answered, so an answer is measured against the best other answer to the same question,
// never against leaving it out (IA-3, DE-6). Months and budget are the whole game's, with each answer in turn;
// safety and neighbor points are the answers' own, as on their chips. One month weighs about the same as 1% of
// budget or 5 points of safety or neighbor relations, so cost is the net of the four, and the best other answer is
// the one the answer given costs the most against.
function answerEffects(kind, id, o) {
  const opts = kind === "card" ? CARD[id].opts : EFFECT[id];
  const at = (k) => withPick(kind, id, k, () => scores({ live: true }));
  const mine = at(o);
  let vsBest = null;
  for (const k of Object.keys(opts)) {
    if (k === o) continue;
    const other = at(k);
    const d = {
      vs: k,
      months: Math.round((mine.total - other.total) * 2) / 2,
      budget: Math.round((mine.budgetRaw - other.budgetRaw) * 10) / 10,
      safety: (opts[o].safety || 0) - (opts[k].safety || 0),
      hood: (opts[o].hood || 0) - (opts[k].hood || 0),
    };
    d.cost = d.months + d.budget - d.safety / 5 - d.hood / 5;
    if (!vsBest || d.cost > vsBest.cost) vsBest = d;
  }
  return vsBest;
}
// The three answers that cost the most on balance. An answer that was the best for its question is left out.
function costliest() {
  const t = T();
  const picks = [
    ...CHOICES.filter((c) => st.choice[c]).map((c) => ["choice", c, st.choice[c], t.choices[c].name, t.choices[c]]),
    ...Object.entries(st.cards).filter(([, o]) => o).map(([id, o]) => ["card", id, o, t.cards[id].title, t.cards[id]]),
  ];
  return picks
    .map(([kind, id, o, name, words]) => {
      const d = answerEffects(kind, id, o);
      return { id, answer: o, name, label: words[o].label, vs: d && words[d.vs].label, d };
    })
    .filter((x) => x.d && x.d.cost > 0.01)
    .sort((x, y) => y.d.cost - x.d.cost)
    .slice(0, 3);
}
// In words, so a printed "+8" is never read as one more cost (TW-6): "Finish 1 month later · Budget 0.3% more".
function effectText(d) {
  const t = T();
  const count = (n, one, many) => (n === 1 ? one : fmt(many, { n }));
  const months = count(Math.abs(d.months), t.endMonth, t.endMonths);
  const out = [];
  if (d.months) out.push(`${t.cardChips.sched} ${fmt(d.months > 0 ? t.endLater : t.endSooner, { n: months })}`);
  if (d.budget) out.push(`${t.cardChips.budget} ${fmt(d.budget > 0 ? t.endMore : t.endLess, { n: Math.abs(d.budget) })}`);
  if (d.safety) out.push(`${t.cardChips.safety} ${fmt(d.safety > 0 ? t.endBetter : t.endWorse, { n: count(Math.abs(d.safety), t.endPoint, t.endPoints) })}`);
  if (d.hood) out.push(`${t.cardChips.hood} ${fmt(d.hood > 0 ? t.endBetter : t.endWorse, { n: count(Math.abs(d.hood), t.endPoint, t.endPoints) })}`);
  return out.join(" · ");
}
// The day the debrief is printed, on the paper only (DC-5): set when it opens and again just before printing. A
// debrief that is not open gets no date, so an old summary never looks new.
function stampPrint() {
  const t = T();
  const date = new Date().toLocaleDateString(t.lang, { year: "numeric", month: "long", day: "numeric" });
  $("[data-print-date]").textContent = endDlg.open ? fmt(t.printDate, { date }) : "";
}
// A player looking at the finished campus who prints (the browser's own Print) gets the summary, not the short note.
addEventListener("beforeprint", () => { if (ui.viewing && !endDlg.open) showEnd(); stampPrint(); });
// On a kiosk, Enter on the end screen still means Play again. In class and home modes the summary is the class's
// record, so focus starts on its title and Play again asks first (FEU-1). When the game puts focus on Play again
// (here, and after Keep this summary), Enter or Space within a second of that was meant for the button before: a
// held or doubled Enter on Finish or on Keep cleared the summary unseen (review; the keydown guard by the shortcuts).
let againAt = 0;
const endFocus = () => {
  if (!STAFFED) againAt = performance.now();
  $(STAFFED ? "#end-title" : "[data-again]").focus({ preventScroll: true });
};
// This game's debrief as plain data, in the words and numbers the player saw (BTC-01). The end screen shows it and a
// results file saves it, so a file opened later shows the same summary, whichever version of the game opens it.
function resultsRecord() {
  const t = T();
  const s = scores();
  const result = (id, name, number, value, level, plan) => ({ id, name, number, value, level, rating: t.level[level], plan });
  // Setback cards are drawn by chance, so ratings are partly luck (FEU-4).
  const setbacks = Object.keys(CARD).filter((id) => CARD[id].roll);
  const drawn = setbacks.filter((id) => st.cards[id]);
  return {
    format: RESULTS_FORMAT,
    version: RESULTS_VERSION,
    build: SAVE_BUILD,
    badge: t.badge,
    mode: MODE,
    lang: t.lang,
    saved: new Date().toISOString(),
    started: st.t0 ? new Date(st.t0).toISOString() : null,
    results: [
      result("schedule", t.dashSchedule, s.months, fmt(t.dashMonths, { n: s.months }), schedIdx(s.months), fmt(t.endPlanSched, { n: M.BASE_MONTHS })),
      result("budget", t.dashBudget, s.budget, fmt(t.dashBudgetVal, { n: s.budget }), budgetIdx(s.budget), fmt(t.endPlanBudget, { n: M.BUDGET_BANDS[0] - 100 })),
      result("safety", t.dashSafety, s.safety, `${s.safety}/100`, scoreIdx(s.safety), fmt(t.endStart, { n: M.SCORE_START.safety })),
      result("neighbors", t.dashNeighbors, s.hood, `${s.hood}/100`, scoreIdx(s.hood), fmt(t.endStartHood, { n: M.SCORE_START.hood })),
    ],
    setbacks: { drawn, of: setbacks.length, note: fmt(t.endLuck, { n: drawn.length, of: setbacks.length }) },
    choices: CHOICES.filter((c) => st.choice[c]).map((c) => ({ id: c, answer: st.choice[c], name: t.choices[c].name, label: t.choices[c][st.choice[c]].label })),
    cards: Object.entries(st.cards).filter(([, o]) => o).map(([id, o]) => ({ id, answer: o, setback: !!CARD[id].roll, name: t.cards[id].title, label: t.cards[id][o].label })),
    costliest: costliest().map((x) => ({ id: x.id, answer: x.answer, name: x.name, label: x.label, vs: x.d.vs, vsLabel: x.vs, effect: effectText(x.d), months: x.d.months, budget: x.d.budget, safety: x.d.safety, neighbors: x.d.hood })),
    steps: st.steps.map((x) => ({ ...x })),
  };
}
// Writes a debrief into the end screen. Every word is escaped: a results file's words show as text, never as markup.
function fillEnd(rec) {
  const t = T();
  $(".end-stats", endDlg).innerHTML = rec.results.map((r) => `<div data-level="${esc(r.level)}"><dt>${esc(r.name)}</dt><dd><span class="end-val">${esc(r.value)}</span> <span class="end-word"><i class="end-dot" aria-hidden="true"></i>${esc(r.rating)}</span><span class="end-ref">${esc(r.plan)}</span></dd></div>`).join("");
  $("[data-end-luck]", endDlg).textContent = rec.setbacks.note;
  // Titles that end in a colon are joined to the answer with a dash, never a second colon (TW-6).
  $(".end-costly", endDlg).innerHTML = rec.costliest.length
    ? rec.costliest.map((x) => `<li><b>${esc(x.name)}</b> — ${esc(x.label)}<span class="end-fx">${esc(fmt(t.endVs, { label: x.vsLabel }))} ${esc(x.effect)}</span></li>`).join("")
    : `<li data-none>${esc(t.endCostlyNone)}</li>`;
  const made = [...rec.choices, ...rec.cards].map((x) => `<li><b>${esc(x.name)}</b> — ${esc(x.label)}</li>`);
  $(".end-chose", endDlg).innerHTML = made.length ? made.join("") : `<li>${esc(t.noDecisions)}</li>`;
  // Each question gets lines to answer on, on paper only (FEU-3).
  $(".end-talk", endDlg).innerHTML = t.endTalkQs.map((q) => `<li>${esc(q)}<span class="print-only print-lines"></span></li>`).join("");
}
// The end screen shows this game's debrief or, in class and home modes, a results file's, read only: that one has
// Close instead of Play again and the save buttons.
function endButtons(fromFile) {
  for (const b of $$("[data-again], [data-save-file], [data-save-csv], [data-end-look]", endDlg)) b.hidden = fromFile;
  const close = $("[data-end-close]", endDlg);
  if (close) close.hidden = !fromFile;
}
// Emptied whenever it closes, so no player's summary is left for the next one to see or print.
function clearEnd() {
  for (const sel of [".end-stats", ".end-costly", ".end-chose", ".end-talk"]) $(sel, endDlg).innerHTML = "";
  $("[data-end-luck]", endDlg).textContent = "";
  $("[data-print-date]").textContent = "";
  const from = $("[data-end-from]", endDlg);
  from.textContent = "";
  from.hidden = true;
  const saved = $("[data-end-saved]", endDlg);
  saved.textContent = "";
  saved.hidden = true;
  ui.viewing = false;
  endButtons(false);
}
function showEnd() {
  ui.viewing = false;
  openDlg(endDlg);
  stampPrint();
  pinPad();
  endDlg.scrollTop = 0;
  endFocus();
}
function openEnd() {
  clearEnd();
  fillEnd(resultsRecord());
  showEnd();
  speak("end");
}
$("[data-print]").addEventListener("click", () => {
  keepGoing();
  window.print();
});
// The finished campus (BTC-UX-01): the summary steps aside, kept as it is, so the player can see the campus and the
// operating Neighbors rows the answers promised. The Build panel leads back to it; on a kiosk it comes back by
// itself after a minute without input, with its countdown, and Print brings it back too.
$("[data-end-look]").addEventListener("click", () => {
  keepGoing();
  closeDlg(endDlg);
  ui.viewing = true;
  if (TABBED.matches) setTab("build");
  else { ui.side = "hood"; renderSide(); }
  renderBuild();
  focusOn($("[data-back-end]"));
});
// A kiosk with no printer can drop the Print button with ?print=off, so a visitor never leaves the print dialog
// open over the game (BTC-UX-X06). The print styles stay.
if (arg("print") === "off") $("[data-print]").remove();
$("[data-again]").addEventListener("click", () => {
  if (STAFFED) { askStartOver("end"); return; }
  closeDlg(endDlg);
  reset();
});
guard(endDlg, endFocus);
// Results files (BTC-01), class and home modes only. The browser saves them to this device as a download; nothing is
// sent. The name says what the file is and when it was saved: build-the-campus-results-2026-10-27-1442.json.
const two = (n) => String(n).padStart(2, "0");
const dayOf = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
function saveResults(ext, type, text, when) {
  const name = `build-the-campus-results-${dayOf(when)}-${two(when.getHours())}${two(when.getMinutes())}.${ext}`;
  const url = URL.createObjectURL(new Blob([text], { type }));
  // The link goes inside the open dialog: everything outside a modal dialog is inert.
  const a = el("a", { href: url, download: name, hidden: true });
  endDlg.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  alertNow(fmt(T().endSaved, { file: name }));
  // Seen as well as heard: managed browsers often hide their download bar (BTC-UX-48).
  const line = $("[data-end-saved]", endDlg);
  line.textContent = fmt(T().endSaved, { file: name });
  line.hidden = false;
  pinPad();
}
// One header row and one row of values, for a spreadsheet. Every value comes from the game, never from typing; one a
// spreadsheet could read as a formula would start with an apostrophe. The byte-order mark makes Excel read UTF-8.
function resultsCsv(rec) {
  const t = T();
  const h = t.csvHead;
  const when = new Date(rec.saved);
  const cols = [
    [h.saved, `${dayOf(when)} ${two(when.getHours())}:${two(when.getMinutes())}`],
    [h.mode, rec.mode],
    [h.version, rec.badge],
    ...rec.results.flatMap((r) => [[h[r.id], r.number], [fmt(h.rating, { name: r.name }), r.rating]]),
    [h.setbacks, rec.setbacks.drawn.length],
    ...CHOICES.map((c) => [t.choices[c].name, rec.choices.find((x) => x.id === c)?.label ?? ""]),
    ...Object.keys(CARD).map((id) => [t.cards[id].title, rec.cards.find((x) => x.id === id)?.label ?? ""]),
    [h.steps, rec.steps.length],
  ];
  const cell = (v) => `"${String(v).replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
  return `﻿${cols.map(([k]) => cell(k)).join(",")}\r\n${cols.map(([, v]) => cell(v)).join(",")}\r\n`;
}
$("[data-save-file]")?.addEventListener("click", () => {
  const rec = resultsRecord();
  saveResults("json", "application/json", `${JSON.stringify(rec, null, 2)}\n`, new Date(rec.saved));
});
$("[data-save-csv]")?.addEventListener("click", () => {
  const rec = resultsRecord();
  saveResults("csv", "text/csv", resultsCsv(rec), new Date(rec.saved));
});
// Opening one: the browser reads the file picked, here, and uploads nothing. The file is checked before anything is
// shown, and a wrong or damaged one gets a one-line message on the intro instead.
function readResults(text) {
  const t = T();
  let o = null;
  try { o = JSON.parse(text); } catch { return t.fileBad; }
  if (!o || typeof o !== "object" || o.format !== RESULTS_FORMAT) return t.fileBad;
  if (o.version !== RESULTS_VERSION) return t.fileVersion;
  const str = (v) => typeof v === "string" && v.length <= 400;
  const list = (a, max, ok) => Array.isArray(a) && a.length <= max && a.every((x) => x && typeof x === "object" && ok(x));
  const said = (x) => str(x.name) && str(x.label);
  const ok = str(o.badge) && str(o.saved) && Number.isFinite(Date.parse(o.saved))
    && list(o.results, 4, (r) => str(r.name) && str(r.value) && str(r.rating) && str(r.plan) && Number.isInteger(r.level) && r.level >= 0 && r.level <= 4) && o.results.length === 4
    && str(o.setbacks?.note) && list(o.choices, 50, said) && list(o.cards, 50, said)
    && list(o.costliest, 3, (x) => said(x) && str(x.vsLabel) && str(x.effect)) && Array.isArray(o.steps);
  return ok ? o : t.fileBad;
}
function showFile(rec) {
  const t = T();
  clearEnd();
  fillEnd(rec);
  const from = $("[data-end-from]", endDlg);
  from.textContent = fmt(t.fileFrom, { date: new Date(rec.saved).toLocaleString(t.lang, { dateStyle: "long", timeStyle: "short" }), badge: rec.badge });
  from.hidden = false;
  endButtons(true);
  showEnd();
}
const fileInput = $("[data-file-input]");
const fileBad = $("[data-file-bad]");
$("[data-open-file]")?.addEventListener("click", () => fileInput.click());
fileInput?.addEventListener("change", () => {
  const file = fileInput.files[0];
  // Cleared, so picking the same file again opens it again.
  fileInput.value = "";
  if (!file) return;
  fileBad.textContent = "";
  fileBad.hidden = true;
  // The line sits under the button, so it scrolls clear of the intro's pinned buttons.
  const fail = (text) => { fileBad.textContent = text; fileBad.hidden = false; fileBad.scrollIntoView({ block: "center" }); };
  if (file.size > 1e6) { fail(T().fileBad); return; }
  const reader = new FileReader();
  reader.onload = () => { const rec = readResults(String(reader.result)); if (typeof rec === "string") fail(rec); else showFile(rec); };
  reader.onerror = () => fail(T().fileBad);
  reader.readAsText(file);
});
$("[data-end-close]")?.addEventListener("click", () => {
  closeDlg(endDlg);
  clearEnd();
  $("[data-open-file]").focus({ preventScroll: true });
});
const introDlg = $("[data-intro]");
const aboutDlg = $("[data-about-dlg]");
const confirmDlg = $("[data-confirm]");
// The map stops redrawing while any dialog but the intro covers it (BTC-UX-20). The intro keeps the slow turn behind
// it; every other dialog is opened and closed in more than one place, so this follows their open attribute.
const syncHold = () => scene?.hold($$("dialog").some((d) => d.open && d !== introDlg));
new MutationObserver(syncHold).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["open"] });
// About opens at its title, not on the first link halfway down (on a small phone that scrolled the title away).
$("[data-about]").addEventListener("click", () => {
  aboutDlg.showModal();
  pinPad();
  aboutDlg.scrollTop = 0;
  $("#about-title").focus({ preventScroll: true });
});
$("[data-about-close]").addEventListener("click", () => aboutDlg.close());
function beginGame() {
  clearSave();
  history = [];
  st.started = true;
  closeDlg(introDlg);
  scene?.setAttract(false);
  scene?.resetView();
  pickPhase("site");
}
// Over a game this tab kept, Start a new game asks first (DE-3).
$("[data-start]").addEventListener("click", () => (savedGame().back ? askStartOver("save") : beginGame()));
// The intro offers Resume for a game this tab kept, and says so when this build cannot resume one (DE-5).
let keptDone = false;
function offerResume() {
  const t = T();
  const { back, bad } = savedGame();
  if (bad) clearSave();
  // A finished game this tab kept is a summary, not a game in progress (BTC-UX-47).
  keptDone = !!back?.done.has("turn");
  $("[data-resume]").hidden = !back;
  $("[data-resume]").textContent = keptDone ? t.resumeShow : t.resume;
  $("[data-resume-note]").hidden = !back;
  $("[data-resume-note]").textContent = keptDone ? t.resumeDone : t.resumeNote;
  $("[data-resume-fail]").hidden = !bad;
  const startBtn = $("[data-start]");
  startBtn.textContent = back ? t.startNew : t.start;
  startBtn.classList.toggle("btn-ghost", !!back);
  return !!back;
}
// Class and home modes: carry on from the game this tab saved (C6).
$("[data-resume]").addEventListener("click", () => {
  const { back } = savedGame();
  if (!back) { offerResume(); $("[data-start]").focus({ preventScroll: true }); return; }
  st = back;
  history = [];
  ui.hoodSig = null;
  closeDlg(introDlg);
  scene?.setAttract(false);
  scene?.resetView();
  logStep("resume");
  say(T().logResume);
  renderEffectsBtn();
  renderAll(false);
  if (st.done.has("turn")) { openEnd(); return; }
  reofferCards();
  if (st.focus) focusNext();
  else focusOn($("[data-go]"));
});
guard(introDlg, () => $("[data-start]").focus({ preventScroll: true }));
// The slow turn behind the intro stops at a visitor's first key press or touch there, so nothing moves beside the
// text they are reading; it starts again for the next visitor (BTC-UX-38, WCAG 2.2.2).
for (const type of ["keydown", "pointerdown"]) introDlg.addEventListener(type, () => scene?.setAttract(false));
// One question for every way to clear a game: Start over, Play again in class and home modes, and Start a new game
// over a kept game (FEU-1, DE-3). Each says what it clears.
function askStartOver(about = "game") {
  if (confirmDlg.open) return;
  const t = T();
  confirmDlg.dataset.about = about;
  $("#confirm-body").textContent = about === "end" ? t.confirmEnd : about === "save" ? (keptDone ? t.confirmSaveDone : t.confirmSave) : t.confirmBody;
  $("[data-confirm-no]").textContent = about === "end" ? t.endKeep : about === "save" ? t.confirmBack : t.confirmNo;
  // The yes button names what happens next for each question (BTC-UX-54).
  $("[data-confirm-yes]").textContent = about === "end" ? t.endAgain : about === "save" ? t.startNew : t.confirmYes;
  confirmDlg.showModal();
  $("[data-confirm-no]").focus();
}
$("[data-confirm-yes]").addEventListener("click", () => {
  confirmDlg.close();
  if (confirmDlg.dataset.about === "save") beginGame();
  else reset();
});
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
    if (typeof v === "string") { node.setAttribute("aria-label", v); if (node.hasAttribute("title")) node.title = v; }
  }
  canvas.setAttribute("aria-label", t.canvasLabel);
  canvas.setAttribute("aria-roledescription", t.canvasRole);
  document.title = t.pageTitle;
  // The intro's Start and Listen buttons are named by code, and before the game starts the Site log holds only its
  // opening line, so a switch made on the intro reaches them too.
  $("[data-start]").textContent = $("[data-resume]").hidden ? t.start : t.startNew;
  $("[data-listen]").textContent = t.listen;
  if (!st.started && st.log.length === 1) { st.log = []; say(t.log0); }
  onCamMode(!!scene?.zoomed());
  scene?.refreshSigns();
  renderEffectsBtn();
  renderVoiceBtn();
  renderLangBtns();
  renderAll(false);
}
// The language switch is in the top bar and on the intro, so a visitor can choose before starting (PA-2). Each
// button is named in the language it switches to.
const langBtns = $$("[data-lang]");
function renderLangBtns() {
  for (const b of langBtns) {
    b.textContent = lang === "en" ? STR.en.langToggle : T().langNameEn;
    b.lang = lang === "en" ? "es" : "en";
  }
}
if (Object.keys(STR.es || {}).length) {
  renderLangBtns();
  for (const b of langBtns) {
    b.hidden = false;
    b.addEventListener("click", () => {
      lang = lang === "en" ? "es" : "en";
      applyLang();
    });
  }
}
const fxBtn = $("[data-fx]");
function renderEffectsBtn() {
  fxBtn.textContent = st.ov ? T().effectsOn : T().effectsOff;
  fxBtn.setAttribute("aria-pressed", st.ov);
}
function toggleFx() { st.ov = !st.ov; renderEffectsBtn(); paintScene(false); }
fxBtn.addEventListener("click", toggleFx);
// Enter and Space press the focused button, and a held key repeats. Each answer or step moves focus on to the next
// button or question, so about 1.5 s of held Enter played the game by itself, with the shortcuts off too (review).
// A repeat never presses anything; nor does a press within 400 ms of a new question, on its answer buttons, or within
// a second of the game putting focus on Play again: it was meant for what was there before. Later presses work.
addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter" && ev.key !== " ") return;
  const on = (sel) => ev.target instanceof Element && ev.target.matches(sel);
  const now = performance.now();
  if (ev.repeat || (on(".opt") && now - dlgShownAt < 400) || (on("[data-again]") && now - againAt < 1000)) ev.preventDefault();
}, { capture: true });
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
  if (otherDialogOpen()) return;
  if (ev.target instanceof Element && ev.target.closest("input, textarea, select, [contenteditable]")) return;
  const k = ev.key.toLowerCase();
  // Siting by keyboard: the arrow keys and Escape are not single-key shortcuts, so they work with the switch off
  // too (EA-1, AS-4, WCAG 2.1.1).
  if (placing && k === "escape") { ev.preventDefault(); endPlace(); renderBuild(); focusNext(); return; }
  if (placing && !ev.shiftKey) {
    const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, 1], arrowdown: [0, -1] }[k];
    if (step) { ev.preventDefault(); nudgePlace(step[0] * (M.LAYOUT_GRID || 10), step[1] * (M.LAYOUT_GRID || 10)); return; }
  }
  if (!prefs.keys) return;
  if (k === "v") { ev.preventDefault(); pressVoice(); }
  else if (k === "n") { ev.preventDefault(); next(); }
  else if (k === "m") { ev.preventDefault(); toggleFx(); }
});
function reset({ clear = true } = {}) {
  if (clear) { clearSave(); history = []; }
  // A service-worker update that arrived mid-game is applied here, when the player starts over (C6).
  if (swUpdatePending) { location.reload(); return; }
  // On a kiosk the language, like every other switch, lasts one visitor (PA-1, PA-2).
  if (!STAFFED && lang !== "en") { lang = "en"; applyLang(); }
  playGen += 1;
  clearCardTimers();
  resume = null;
  cardAfter = null;
  cardPending = false;
  endPlace();
  hush();
  closeDlg(dlg);
  closeDlg(endDlg);
  clearEnd();
  if (fileBad) { fileBad.textContent = ""; fileBad.hidden = true; }
  if (aboutDlg.open) aboutDlg.close();
  if (confirmDlg.open) confirmDlg.close();
  stopCountdowns();
  st = fresh();
  dashWas = null;
  clearDashMarks();
  say(T().log0);
  // The next player starts on the default panels, scrolled to the top.
  Object.assign(ui, { hot: null, picked: null, side: "hood", hoodSig: null, hoodNew: false, planOpen: false, viewing: false });
  document.documentElement.removeAttribute("data-side-open");
  $("[data-side-toggle]").setAttribute("aria-pressed", "false");
  document.body.removeAttribute("data-plan-open");
  for (const p of $$(".panel")) p.scrollTop = 0;
  toastEl.hidden = true;
  // Each new player starts from this device's settings, whatever the last player pressed (I8). On a kiosk that is
  // the address, for presenter view, Library mode and the shortcut switch too (PA-1).
  Object.assign(prefs, deviceSettings());
  keysBox.checked = prefs.keys;
  renderKeysPref();
  renderStill();
  setPresent(prefs.present);
  setVoice(deviceVoice());
  renderEffectsBtn();
  renderAll(false);
  setTab("build");
  scene?.setAttract(true);
  // Every new player gets the one-time zoom tip, not only the first after the page loaded.
  zoomTipShown = false;
  const saved = offerResume();
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
  $("[data-again]").classList.remove("btn-ghost");
  if (keepHadFocus && endDlg.open) {
    againAt = performance.now();
    $("[data-again]").focus({ preventScroll: true });
  }
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
  // While Keep shows, it is the one primary: Play again turns ghost and Keep sits at the end of the row, so nothing
  // slides under the pointer when it goes (BTC-UX-49). Focus moves to Keep without scrolling the summary away
  // (BTC-UX-61), so Enter keeps the summary instead of starting over.
  $("[data-again]").classList.add("btn-ghost");
  pinPad();
  endKeep.focus({ preventScroll: true });
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
  // A player looking at the finished campus gets the summary back, with its countdown, as if it had stayed open.
  if (endDlg.open || ui.viewing) { if (idle >= 60000) { if (!endDlg.open) showEnd(); startEndCountdown(); } return; }
  if (idle < (testHooks.idleMs || 150000)) return;
  // The prompt opens over About or the Start-over question, so Keep playing goes back to them where they were;
  // only the reset closes them.
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
// The next visitor can start fresh from the prompt itself instead of keeping the last player's game (BTC-UX-X04).
$("[data-idle-new]").addEventListener("click", () => reset());
endKeep.addEventListener("click", keepGoing);
idleDlg.addEventListener("cancel", (ev) => { ev.preventDefault(); keepGoing(); });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // Keep this id identical to CACHE in sw.js. Bump both together when publishing.
  // The file name changes with the id, so a reload installs the new worker immediately.
  const SW_BUILD = "build-the-campus-v7";
  const hadController = !!navigator.serviceWorker.controller;
  // A new build took over. On the intro nothing is in progress, so reload now. Mid-game, wait: reset() reloads when
  // the player starts over, so no game is lost (C6). This page's own worker taking control is no update: on a first
  // visit, or when this page arrived under an older build's worker. The listener used to exist only for pages that
  // loaded under a worker, so a tab opened on a first visit never took a later update (PA-7).
  const own = new URL(`./sw-${SW_BUILD}.js`, location.href).href;
  let ctl = navigator.serviceWorker.controller?.scriptURL || "";
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const was = ctl;
    ctl = navigator.serviceWorker.controller?.scriptURL || "";
    if (ctl === own && was !== own) { keepClips(); return; }
    if (st.started) swUpdatePending = true;
    else location.reload();
  });
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
  // When the card dialog last showed a question, and when the end screen last put focus on Play again.
  shownAt: () => dlgShownAt,
  againAt: () => againAt,
  state: () => st,
  audio: () => ({ unlocked: audioUnlocked, paused: audio.paused, ended: audio.ended, time: audio.currentTime, src: audio.currentSrc ? audio.currentSrc.slice(0, 48) : "" }),
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
reset({ clear: false });
measureSafe();
scene?.start();
// The game is running, so the note for browsers that cannot run it goes (build.mjs).
$("[data-nojs]")?.remove();
