// Runtime for Build the Campus: state, rules, panels and the 3D scene. One screen, no page scroll.
const D = __DATA__;
const STR = __STRINGS__;
let lang = "en";
const T = () => ({ ...STR.en, ...(STR[lang] || {}) });
const STR_SIGN = [STR.en.signNotice, STR.en.signNotice2, STR.en.signCampus];
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
const PH = D.PHASES;
const phaseOf = Object.fromEntries(PH.flatMap((p) => p.els.map((e) => [e, p.id])));
const CHOICES = ["route", "hours", "buffer", "wall", "cool", "light", "test"];
const LOCK = { buffer: "clear", cool: "cooling", wall: "roads" };

// ---------- state ----------
let st;
const fresh = () => ({
  placed: new Set(),
  done: new Set(),
  focus: null,
  choice: { route: "a", hours: "a", buffer: "a", wall: "b", cool: "a", light: "a", test: "a" },
  cards: {},
  log: [],
  ov: true,
  started: false,
});
const ui = { tab: "build", side: "hood", hot: null };
const started = (id) => PH.find((p) => p.id === id).els.some((e) => st.placed.has(e));
const ready = (p) => p.after.every((a) => st.done.has(a));

// ---------- model ----------
const EFFECT = {
  route: { a: { budget: 0.5, hood: 10 }, b: { hood: -10 } },
  hours: { a: { hood: 8, sched: { grade: 0.5, found: 0.5 } }, b: { hood: -8, safety: -4 } },
  buffer: { a: { budget: 1, hood: 10 }, b: { hood: -4 } },
  wall: { a: { budget: 1, hood: 8 }, b: {} },
  cool: { a: {}, b: {} },
  light: { a: { budget: 0.3, hood: 5 }, b: {} },
  test: { a: { hood: 5 }, b: {} },
};
const CARD = {
  weather: { at: "clear", opts: { a: { budget: 0.5, hood: 6, sched: { grade: 0.5 } }, b: { safety: -12, hood: -10, storm: 1 } } },
  longlead: { at: "util", opts: { a: { budget: 2 }, b: { sched: { mep: 4 } }, c: { budget: 1, sched: { mep: 2 } } } },
  labor: { at: "mep", opts: { a: { budget: 2, safety: -8, hood: -8, night: 1 }, b: { sched: { mep: 3 } }, c: { budget: 1.5, safety: 5, sched: { mep: 1 } } } },
};
function effects() {
  const sum = { budget: 0, hood: 0, safety: 0, sched: {}, storm: 0, night: 0 };
  const add = (e) => {
    for (const key of ["budget", "hood", "safety", "storm", "night"]) sum[key] += e[key] || 0;
    for (const [p, m] of Object.entries(e.sched || {})) sum.sched[p] = (sum.sched[p] || 0) + m;
  };
  for (const c of CHOICES) add(EFFECT[c][st.choice[c]]);
  for (const [id, pick] of Object.entries(st.cards)) add(CARD[id].opts[pick]);
  if (st.placed.has("meetings")) sum.hood += 10;
  return sum;
}
function schedule() {
  const e = effects();
  const dur = Object.fromEntries(PH.map((p) => [p.id, (p.months[0] + p.months[1]) / 2 + (e.sched[p.id] || 0)]));
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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const levelWord = (score) => T().level[score < 30 ? 0 : score < 45 ? 1 : score < 60 ? 2 : score < 80 ? 3 : 4];
function hood() {
  const c = st.choice;
  const e = effects();
  const s = (id) => started(id);
  const d = (id) => st.done.has(id);
  const heavy = s("grade") && !d("shell");
  const building = s("grade") && !d("turn");
  const ops = d("turn");
  const L = {};
  L.trucks = !s("grade") ? 0 : ops ? 1 : clamp((heavy ? 3 : 2) + (c.route === "b" ? 1 : -1) + (c.hours === "b" ? 1 : 0), 1, 4);
  L.noise = !building ? (ops ? 1 : 0) : clamp((heavy ? 3 : 2) + (c.wall === "a" ? -1 : 0) + (c.hours === "b" || e.night ? 1 : 0), 1, 4);
  const dusty = s("grade") && !d("found") ? 3 + (e.storm ? 1 : 0) : 0;
  const glow = (building ? 1 : 0) + (ops ? 1 : 0) + (c.hours === "b" || e.night ? 1 : 0) + (c.light === "b" ? 1 : 0);
  L.dust = clamp(Math.max(dusty, glow), 0, 4);
  L.storm = !s("grade") ? 0 : st.placed.has("ponds") ? (e.storm ? 2 : 1) : 3 + (e.storm ? 1 : 0);
  L.water = !s("util") ? 0 : c.cool === "b" ? 3 : 1;
  L.power = !s("util") ? 0 : ops ? 4 : 3;
  L.gens = !st.placed.has("gens") ? 0 : clamp((st.placed.has("L3") && !ops ? 2 : 1) + (c.test === "b" ? 1 : 0), 1, 4);
  L.jobs = !s("grade") ? 0 : ops ? 1 : s("mep") ? 4 : 3;
  L.tax = !d("shell") ? 0 : ops ? 3 : 1;
  L.setback = !st.placed.has("panels") ? (s("grade") ? 1 : 0) : c.buffer === "a" ? 1 : 3;
  L._glow = glow;
  L._dusty = dusty;
  return L;
}
function scores() {
  const e = effects();
  const L = hood();
  return {
    budget: Math.round((100 + e.budget) * 10) / 10,
    safety: clamp(82 + e.safety, 0, 100),
    hood: clamp(35 + e.hood - 2 * (L.trucks + L.noise + L.dust), 0, 100),
    months: Math.round(schedule().total),
  };
}

// ---------- the 3D scene ----------
const canvas = $("[data-scene]");
let scene = null;
try {
  scene = createScene(canvas, { reduced: () => motionOff.matches });
} catch (err) {
  document.body.dataset.nogl = "";
  console.warn("3D view unavailable", err);
}
function paintScene(animate = true) {
  if (!scene) return;
  scene.apply((u) => {
    const optOk = !u.opt || st.choice[u.opt.split(":")[0]] === u.opt.split(":")[1];
    const keepIt = u.keep && st.choice[u.keep.split(":")[0]] === u.keep.split(":")[1];
    return (!u.show || st.placed.has(u.show)) && optOk && !(u.hide && st.placed.has(u.hide) && !keepIt);
  }, animate);
  const L = hood();
  const on = (v) => ({ on: !!v, level: 0 });
  const layers = {
    "route-a": { on: L.trucks > 0 && st.choice.route === "a", level: L.trucks },
    "route-b": { on: L.trucks > 0 && st.choice.route === "b", level: L.trucks },
    noise: { on: L.noise > 0 && !st.done.has("turn"), level: L.noise },
    gens: { on: L.gens > 1, level: L.gens },
    dust: { on: L._dusty > 0, level: L._dusty },
    glow: { on: L._glow > 1, level: L._glow },
    storm: on(st.placed.has("ponds")),
    plume: on(st.placed.has("cooling") && st.choice.cool === "b"),
    power: on(st.placed.has("transmission")),
    setback: on(st.placed.has("zoning")),
  };
  scene.overlays({ on: st.ov, layers, trucks: L.trucks, route: st.choice.route, focus: ui.hot ? OV_OF[ui.hot] || [] : null });
}
// Where each neighborhood effect shows on the map, for the camera.
const HOT_SPOT = { trucks: [200, 40], noise: [-60, 40], dust: [-40, -60], storm: [-60, 30], water: [55, -47], power: [170, -130], gens: [86, -100], setback: [-60, 92] };
const OV_OF = { trucks: ["route-a", "route-b"], noise: ["noise"], dust: ["dust", "glow"], storm: ["storm"], water: ["plume"], power: ["power"], gens: ["gens"], setback: ["setback"] };

// The open part of the stage, between the floating panels, so the camera centres the campus there.
function measureSafe() {
  if (!scene) return;
  const c = canvas.getBoundingClientRect();
  const phone = matchMedia("(max-width: 760px)").matches;
  if (phone) return scene.setSafe({ x: 0, y: 0, w: c.width, h: c.height });
  const b = $(".p-build").getBoundingClientRect();
  const s = $(".p-side").getBoundingClientRect();
  const p = $(".p-plan").getBoundingClientRect();
  const x = b.right - c.left, r = s.left - c.left;
  scene.setSafe({ x, y: 0, w: Math.max(200, r - x), h: Math.max(200, p.top - c.top) });
}
new ResizeObserver(measureSafe).observe(document.body);

// ---------- panels ----------
const status = $("[data-status]");
function say(text) {
  st.log.unshift(text);
  st.log = st.log.slice(0, 6);
  status.textContent = text;
}
const ICON = {
  done: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5" fill="currentColor"/><path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

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
    html = `<p class="kicker">${fmt(t.phaseOf, { n: PH.indexOf(p) + 1 })}</p><h2>${esc(t.phases[p.id].name)}</h2>
      <p class="muted">${esc(t.phases[p.id].log)} <span class="range">${p.months[0]}–${p.months[1]} ${esc(t.schedAxis)} · ${esc(t.typical)}</span></p>
      <ul class="els">${p.els
        .map((e) => {
          const done = st.placed.has(e);
          return `<li><button type="button" class="el" data-el="${e}"${done ? ` data-done title="${esc(t.showOnMap)}"` : ""}><span class="el-mark">${done ? ICON.done : ICON.plus}</span><span class="el-name">${esc(t.elements[e].name)}</span><span class="el-act">${esc(done ? t.placed : t.place)}</span></button></li>`;
        })
        .join("")}</ul>
      <button type="button" class="btn btn-wide" data-finish${all ? "" : " disabled"}>${esc(all ? fmt(t.finishPhase, { name: t.phases[p.id].short }) : t.finishNeed)}</button>`;
  }
  html += `<h3 class="log-h">${esc(t.logTitle)}</h3><ul class="log">${st.log.slice(0, 3).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  box.innerHTML = html;
}
$("[data-build]").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.el && b.hasAttribute("data-done")) { scene?.focus(b.dataset.el); showTag(b.dataset.el); }
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
    return `<li><button type="button" class="lane" data-phase="${p.id}" data-state="${state}" aria-pressed="${st.focus === p.id}" title="${esc(state === "locked" ? fmt(t.phaseLocked, { list: p.after.filter((a) => !st.done.has(a)).map((a) => t.phases[a].short).join(", ") }) : t.phases[p.id].name)}"><span class="lane-icon">${icon}</span><span class="lane-name">${esc(t.phases[p.id].short)}</span><span class="track">${bar}</span></button></li>`;
  }).join("");
  const ticks = [];
  for (let m = 0; m <= maxM; m += 6) ticks.push(`<span style="left:${pct(m)}">${m}</span>`);
  $("[data-plan]").innerHTML = `<div class="plan-head"><h2>${esc(t.schedTitle)} <small>(${esc(t.schedAxis)})</small></h2><p class="plan-total">${esc(started("site") ? fmt(t.schedTotal, { n: Math.round(sc.total) }) : t.schedEmpty)}</p></div>
    <ol class="lanes">${lanes}</ol><div class="axis"><span class="axis-pad"></span><span class="axis-track">${ticks.join("")}</span></div>
    <p class="plan-note">${esc(t.schedNote)}</p>`;
}
$("[data-plan]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-phase]");
  if (b) pickPhase(b.dataset.phase);
});

function chipsHtml(e) {
  const t = T();
  const chips = [];
  const months = Object.values(e.sched || {}).reduce((a, b) => a + b, 0);
  if (months) chips.push([t.cardChips.sched, `+${fmt(t.dashMonthsShort, { n: months })}`, "bad"]);
  if (e.budget) chips.push([t.cardChips.budget, `+${e.budget}%`, "bad"]);
  if (e.safety) chips.push([t.cardChips.safety, e.safety > 0 ? t.chipUp : t.chipDown, e.safety > 0 ? "good" : "bad"]);
  if (e.hood) chips.push([t.cardChips.hood, e.hood > 0 ? t.chipUp : t.chipDown, e.hood > 0 ? "good" : "bad"]);
  return chips.length ? `<span class="chips">${chips.map(([k, v, tone]) => `<span class="chip" data-tone="${tone}">${esc(k)} ${esc(v)}</span>`).join("")}</span>` : "";
}
function renderSide() {
  const t = T();
  const L = hood();
  const youSaid = { trucks: ["route", "hours"], noise: ["wall", "hours"], dust: ["light"], water: ["cool"], gens: ["test"], setback: ["buffer"] };
  const keys = Object.keys(t.hood).filter((k) => t.hood[k].name);
  $("[data-hood]").innerHTML = keys
    .map((key) => {
      const level = L[key] ?? 0;
      const word = key === "jobs" ? t.hood.jobsNow[!started("grade") ? "none" : st.done.has("turn") ? "ops" : started("mep") ? "peak" : "build"] : t.hood.levels[level];
      return `<li><button type="button" class="hood-row" data-key="${key}" aria-pressed="${ui.hot === key}"><span class="hood-name">${esc(t.hood[key].name)}</span><span class="meter" role="img" aria-label="${esc(word)}">${[1, 2, 3, 4].map((n) => `<i${n <= level ? " data-on" : ""}></i>`).join("")}</span><span class="hood-word">${esc(word)}</span></button></li>`;
    })
    .join("");
  const k = ui.hot;
  $("[data-hood-detail]").innerHTML = k
    ? `<b>${esc(t.hood[k].name)}</b><span>${esc(t.hood[k].fact)}</span>${youSaid[k] ? `<span class="you">${esc(t.hoodYou)}${youSaid[k].map((c) => esc(t.choices[c][st.choice[c]].label)).join(" · ")}</span>` : ""}`
    : `<span>${esc(t.hoodDetailHint)}</span>`;
  $("[data-choices]").innerHTML = CHOICES.map((c) => {
    const locked = LOCK[c] && st.placed.has(LOCK[c]);
    const v = st.choice[c];
    return `<div class="choice"${locked ? " data-locked" : ""}><div class="choice-head"><span class="choice-name">${esc(t.choices[c].name)}</span>${locked ? `<span class="lock">${ICON.lock}${esc(t.lockedAfter)}</span>` : ""}</div>
      <div class="seg" role="group" aria-label="${esc(t.choices[c].name)}">${["a", "b"].map((o) => `<button type="button" data-choice="${c}" data-v="${o}" aria-pressed="${v === o}"${locked && v !== o ? " disabled" : ""}>${esc(t.choices[c][o].label)}</button>`).join("")}</div>
      <p class="choice-note">${esc(t.choices[c][v].note)} ${chipsHtml(EFFECT[c][v])}</p></div>`;
  }).join("");
  for (const b of $$("[data-side-tab]")) b.setAttribute("aria-selected", b.dataset.sideTab === ui.side);
  document.body.dataset.side = ui.side;
}
$("[data-hood]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  ui.hot = ui.hot === b.dataset.key ? null : b.dataset.key;
  renderSide();
  paintScene(false);
  const spot = HOT_SPOT[ui.hot];
  if (spot && st.ov) scene?.lookAt(spot[0], spot[1]);
});
$("[data-choices]").addEventListener("click", (e) => {
  const b = e.target.closest("[data-choice]");
  if (b && !b.disabled) choose(b.dataset.choice, b.dataset.v);
});
for (const b of $$("[data-side-tab]")) b.addEventListener("click", () => { ui.side = b.dataset.sideTab; renderSide(); });
for (const b of $$("[data-tab]")) b.addEventListener("click", () => setTab(b.dataset.tab));
function setTab(tab) {
  ui.tab = tab;
  if (tab === "hood" || tab === "choices") ui.side = tab;
  document.body.dataset.tab = tab;
  for (const b of $$("[data-tab]")) b.setAttribute("aria-selected", b.dataset.tab === tab);
  renderSide();
}

function renderDash() {
  const t = T();
  const s = scores();
  const tile = (key, value, word, level, short = value) => {
    const node = $(`[data-dash="${key}"]`);
    $(".kpi-val", node).innerHTML = `<span class="long">${esc(value)}</span><span class="short">${esc(short)}</span>`;
    $(".kpi-word", node).textContent = word;
    node.dataset.level = level;
  };
  const bl = s.budget <= 100.5 ? 4 : s.budget <= 102 ? 3 : s.budget <= 104 ? 2 : 1;
  const sl = s.months <= D.BASE_MONTHS ? 4 : s.months <= D.BASE_MONTHS + 3 ? 2 : 1;
  tile("schedule", fmt(t.dashMonths, { n: s.months }), t.level[sl], sl, fmt(t.dashMonthsShort, { n: s.months }));
  tile("budget", fmt(t.dashBudgetVal, { n: s.budget }), t.level[bl], bl, `${Math.round(s.budget)}%`);
  tile("safety", `${s.safety}/100`, levelWord(s.safety), s.safety < 45 ? 1 : s.safety < 80 ? 2 : 4);
  tile("hood", `${s.hood}/100`, levelWord(s.hood), s.hood < 45 ? 1 : s.hood < 60 ? 2 : 4);
}
function renderAll(animate = true) {
  paintScene(animate);
  renderBuild();
  renderPlan();
  renderSide();
  renderDash();
}

// ---------- floating tag over a newly built part ----------
const tagEl = $("[data-tag]");
let tagFor = null, tagUntil = 0;
function showTag(id) {
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
function pickPhase(id) {
  const t = T();
  const p = PH.find((q) => q.id === id);
  if (!ready(p)) {
    say(fmt(t.logLocked, { name: t.phases[id].name, list: p.after.filter((a) => !st.done.has(a)).map((a) => t.phases[a].name).join(", ") }));
    renderBuild();
    return;
  }
  if (st.done.has(id)) return;
  st.focus = id;
  renderAll();
  if (ui.tab !== "build") setTab("build");
  $(".el:not([data-done])")?.focus({ preventScroll: true });
}
function place(e) {
  const t = T();
  if (st.placed.has(e)) return;
  st.placed.add(e);
  say(t.elements[e].log);
  renderAll();
  scene?.focus(e);
  showTag(e);
  const card = Object.entries(CARD).find(([id, c]) => !(id in st.cards) && (c.at === e || c.at === phaseOf[e]));
  if (card) setTimeout(() => openCard(card[0]), motionOff.matches ? 0 : 900);
  else ($(".el:not([data-done])") || $("[data-finish]:not([disabled])"))?.focus({ preventScroll: true });
}
function finishPhase(id) {
  const t = T();
  st.done.add(id);
  say(fmt(t.logPhaseDone, { name: t.phases[id].name }));
  if (id === "cx") say(t.logCx);
  st.focus = null;
  renderAll();
  if (id === "turn") openEnd();
  else $("[data-go]")?.focus({ preventScroll: true });
}
function choose(c, v) {
  const t = T();
  if (st.choice[c] === v) return;
  st.choice[c] = v;
  say(fmt(t.logChoice, { name: t.choices[c].name, value: t.choices[c][v].label }));
  renderAll();
  $(`[data-choice="${c}"][data-v="${v}"]`)?.focus({ preventScroll: true });
}
function next() {
  const p = PH.find((q) => q.id === st.focus);
  if (p) {
    const e = p.els.find((x) => !st.placed.has(x));
    if (e) return place(e);
    return finishPhase(p.id);
  }
  const r = PH.find((q) => ready(q) && !st.done.has(q.id));
  if (r) pickPhase(r.id);
}

// ---------- dialogs ----------
const dlg = $("[data-card]");
function openCard(id) {
  const t = T();
  const card = t.cards[id];
  $(".card-title", dlg).textContent = card.title;
  $(".card-body", dlg).textContent = card.body;
  $(".card-opts", dlg).innerHTML = Object.keys(CARD[id].opts)
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(card[o].label)}</span>${chipsHtml(CARD[id].opts[o])}</button>`)
    .join("");
  dlg.dataset.id = id;
  dlg.showModal();
  $(".opt", dlg).focus();
}
$(".card-opts", dlg).addEventListener("click", (e) => {
  const b = e.target.closest("[data-o]");
  if (!b) return;
  const id = dlg.dataset.id;
  st.cards[id] = b.dataset.o;
  say(T().cards[id][b.dataset.o].log);
  dlg.close();
  renderAll();
  ($(".el:not([data-done])") || $("[data-finish]:not([disabled])"))?.focus({ preventScroll: true });
});
dlg.addEventListener("cancel", (ev) => ev.preventDefault());
const endDlg = $("[data-end]");
function openEnd() {
  const t = T();
  const s = scores();
  $(".end-stats", endDlg).innerHTML = [
    [t.dashSchedule, fmt(t.dashMonths, { n: s.months })],
    [t.dashBudget, fmt(t.dashBudgetVal, { n: s.budget })],
    [t.dashSafety, `${s.safety}/100 · ${levelWord(s.safety)}`],
    [t.dashNeighbors, `${s.hood}/100 · ${levelWord(s.hood)}`],
  ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("");
  $(".end-chose", endDlg).innerHTML = [
    ...CHOICES.map((c) => `<li><b>${esc(t.choices[c].name)}:</b> ${esc(t.choices[c][st.choice[c]].label)}</li>`),
    ...Object.entries(st.cards).map(([id, o]) => `<li><b>${esc(t.cards[id].title)}:</b> ${esc(t.cards[id][o].label)}</li>`),
  ].join("");
  endDlg.showModal();
}
$("[data-again]").addEventListener("click", () => { endDlg.close(); reset(); });
const introDlg = $("[data-intro]");
const aboutDlg = $("[data-about-dlg]");
$("[data-about]").addEventListener("click", () => aboutDlg.showModal());
$("[data-about-close]").addEventListener("click", () => aboutDlg.close());
$("[data-start]").addEventListener("click", () => {
  st.started = true;
  introDlg.close();
  scene?.setAttract(false);
  scene?.resetView();
  pickPhase("site");
});
introDlg.addEventListener("cancel", (ev) => ev.preventDefault());

// ---------- language, tools, keys ----------
function applyLang() {
  const t = T();
  document.documentElement.lang = t.lang || lang;
  for (const node of $$("[data-t]")) {
    const v = node.dataset.t.split(".").reduce((o, k) => o?.[k], t);
    if (typeof v === "string") node.textContent = v;
  }
  renderEffectsBtn();
  renderAll(false);
}
const langBtn = $("[data-lang]");
if (Object.keys(STR.es || {}).length) {
  langBtn.hidden = false;
  langBtn.addEventListener("click", () => {
    lang = lang === "en" ? "es" : "en";
    langBtn.textContent = lang === "en" ? STR.en.langToggle : "English";
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
$("[data-reset]").addEventListener("click", () => scene?.resetView());
document.addEventListener("keydown", (ev) => {
  if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
  if (dlg.open) {
    const b = $(`.opt[data-key="${ev.key}"]`, dlg);
    if (b) { ev.preventDefault(); b.click(); }
    return;
  }
  if (endDlg.open || aboutDlg.open) return;
  if (introDlg.open) { if (ev.key === "n" || ev.key === "N") { ev.preventDefault(); $("[data-start]").click(); } return; }
  if (ev.key === "n" || ev.key === "N") { ev.preventDefault(); next(); }
  if (ev.key === "m" || ev.key === "M") { ev.preventDefault(); toggleFx(); }
});
function reset() {
  st = fresh();
  say(T().log0);
  ui.hot = null;
  renderEffectsBtn();
  renderAll(false);
  setTab("build");
  scene?.setAttract(true);
  introDlg.showModal();
  $("[data-start]").focus();
}

// Kiosk: after two and a half minutes without input, ask; with no answer, start over for the next player.
const idleDlg = $("[data-idle]");
let lastInput = performance.now(), idleLeft = 0, idleTimer = 0;
for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(ev, () => { lastInput = performance.now(); }, { capture: true, passive: true });
setInterval(() => {
  if (!st.started || introDlg.open || idleDlg.open || endDlg.open) return;
  if (performance.now() - lastInput < (window.__idleMs || 150000)) return;
  if (dlg.open) dlg.close();
  if (aboutDlg.open) aboutDlg.close();
  idleLeft = 20;
  $(".idle-body", idleDlg).textContent = fmt(T().idleBody, { n: idleLeft });
  idleDlg.showModal();
  $("[data-idle-keep]").focus();
  idleTimer = setInterval(() => {
    idleLeft--;
    $(".idle-body", idleDlg).textContent = fmt(T().idleBody, { n: idleLeft });
    if (idleLeft <= 0) { clearInterval(idleTimer); idleDlg.close(); reset(); }
  }, 1000);
}, 5000);
$("[data-idle-keep]").addEventListener("click", () => { clearInterval(idleTimer); idleDlg.close(); lastInput = performance.now(); });
idleDlg.addEventListener("cancel", (ev) => { ev.preventDefault(); $("[data-idle-keep]").click(); });

// A hook for screenshots and checks.
window.__dc = {
  all(opts = {}) {
    Object.assign(st.choice, opts);
    for (const p of PH) { for (const e of p.els) st.placed.add(e); st.done.add(p.id); }
    st.done.delete("turn");
    st.focus = "turn";
    st.started = true;
    introDlg.open && introDlg.close();
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
    for (const [cid, c] of Object.entries(CARD)) if (st.placed.has(c.at) || PH.find((p) => p.id === c.at && started(p.id))) st.cards[cid] = "a";
    st.started = true;
    introDlg.open && introDlg.close();
    scene?.setAttract(false);
    renderAll(false);
  },
  hot(key) { ui.hot = key; renderSide(); paintScene(false); },
  tab: setTab,
  card: openCard,
  view(o) { if (o) scene?.setView(o); else scene?.resetView(); },
  state: () => st,
  info: () => scene?.info(),
  meshes: () => scene?.meshes(),
};

reset();
measureSafe();
scene?.start();
