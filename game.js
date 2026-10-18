// Runtime for Build the Campus: state, rules, panels and the 3D scene. One screen, no page scroll.
const D = __DATA__;
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
const PH = D.PHASES;
const phaseOf = Object.fromEntries(PH.flatMap((p) => p.els.map((e) => [e, p.id])));
const CHOICES = ["route", "hours", "buffer", "wall", "cool", "light", "test"];
const MEP = ["switchgear", "ups", "gens", "cooling", "fire"];
// Asked at the moment they matter. Nothing is filled in ahead of time.
const PHASE_START = { grade: ["route", "hours"], shell: ["light"] };
const BEFORE_EL = { roads: ["wall"], clear: ["buffer"], cooling: ["cool"] };
const NEED_FIRST = { clear: ["erosion", "ponds"] };
const PHASE_REQUIRED = { grade: ["route", "hours", "buffer", "wall"], shell: ["light"], mep: ["cool"], cx: ["test"] };

// ---------- state ----------
let st;
const fresh = () => ({
  placed: new Set(),
  done: new Set(),
  focus: null,
  choice: { route: null, hours: null, buffer: null, wall: null, cool: null, light: null, test: null },
  frozenSched: {},
  cards: {},
  log: [],
  ov: true,
  started: false,
});
const ui = { tab: "build", side: "hood", hot: null };
const started = (id) => PH.find((p) => p.id === id).els.some((e) => st.placed.has(e));
const ready = (p) => p.after.every((a) => st.done.has(a));
const mepCount = () => MEP.filter((e) => st.placed.has(e)).length;

// ---------- model ----------
const EFFECT = {
  route: { a: { budget: 0.5, hood: 10 }, b: { hood: -10 } },
  hours: { a: { hood: 8, sched: { grade: 0.5, found: 0.5 } }, b: { hood: -8, safety: -4 } },
  buffer: { a: { budget: 1, hood: 10 }, b: { hood: -4 } },
  wall: { a: { budget: 1, hood: 8 }, b: {} },
  // Tags are panel marks only. Cooling does not move the neighbor score.
  cool: { a: { tags: ["power"] }, b: { tags: ["water"] } },
  light: { a: { budget: 0.3, hood: 5 }, b: {} },
  test: { a: { hood: 5 }, b: {} },
};
const CARD = {
  weather: { at: "clear", opts: { a: { budget: 0.5, hood: 6, sched: { grade: 0.5 } }, b: { safety: -12, hood: -10, storm: 1, sched: { grade: 1 }, budget: 1, permit: 1 } } },
  // Real transformer lead time is about 2–4 years. The months here are the shortened in-game wait.
  longlead: { at: "util", opts: { a: { budget: 2 }, b: { sched: { util: 9, mep: 4 } }, c: { budget: 1, sched: { mep: 4 } } } },
  labor: { at: "mep", opts: { a: { budget: 2, safety: -8, hood: -8, night: 1 }, b: { sched: { mep: 3 } }, c: { budget: 1.5, safety: 5, sched: { mep: 1 } } } },
};
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
function schedule() {
  const e = effects();
  const extra = (id) => (Object.prototype.hasOwnProperty.call(st.frozenSched, id) ? st.frozenSched[id] : e.sched[id] || 0);
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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const levelWord = (score) => T().level[score < 30 ? 0 : score < 45 ? 1 : score < 60 ? 2 : score < 80 ? 3 : 4];
function choiceLocked(c) {
  if (st.done.has("turn")) return true;
  if (c === "buffer") return st.placed.has("clear");
  if (c === "wall") return st.placed.has("roads");
  if (c === "cool") return st.placed.has("cooling");
  if (c === "route" || c === "hours") return st.done.has("found");
  if (c === "light") return st.done.has("shell");
  if (c === "test") return st.placed.has("L3");
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
  L.gens = !st.placed.has("gens") ? 0 : clamp((st.placed.has("L3") && !ops ? 2 : 1) + (c.test === "b" ? 1 : 0), 1, 4);
  L.jobs = !s("grade") ? 0 : ops ? 1 : s("mep") && !d("fitout") ? 4 : d("fitout") ? 2 : 3;
  L.tax = !d("shell") ? 0 : ops ? 3 : 1;
  L.setback = !st.placed.has("panels") ? (s("grade") ? 1 : 0) : c.buffer === "a" ? 1 : c.buffer === "b" ? 3 : 2;
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
    hood: clamp(35 + e.hood - 2 * (L.trucks + L.noiseScore + L.dust), 0, 100),
    months: Math.round(schedule().total),
  };
}

// ---------- the 3D scene ----------
const canvas = $("[data-scene]");
let scene = null;
try {
  scene = createScene(canvas, {
    reduced: () => motionOff.matches,
    signs: () => [T().signNotice, T().signNotice2, T().signCampus],
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
}
const HOT_SPOT = { trucks: [200, 40], noise: [-60, 40], dust: [-40, -60], storm: [-60, 30], water: [55, -47], power: [170, -130], gens: [86, -100], setback: [-60, 92] };
const OV_OF = { trucks: ["route-a", "route-b"], noise: ["noise"], dust: ["dust", "glow"], storm: ["storm"], water: ["plume"], power: ["power"], gens: ["gens"], setback: ["setback"] };

function measureSafe() {
  if (!scene) return;
  const c = canvas.getBoundingClientRect();
  const phone = matchMedia("(max-width: 760px)").matches;
  if (phone) return scene.setSafe({ x: 0, y: 0, w: c.width, h: c.height });
  const b = $(".p-build").getBoundingClientRect();
  const s = $(".p-side").getBoundingClientRect();
  const p = $(".p-plan").getBoundingClientRect();
  document.documentElement.style.setProperty("--plan-h", `${p.height}px`);
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

function cxTrackHtml() {
  const t = T();
  const show = st.placed.has("L1") || started("mep") || st.focus === "cx" || st.focus === "fitout";
  if (!show) return "";
  const n = mepCount();
  const rows = [
    ["L1", st.placed.has("L1") ? t.cxDone : t.cxWait],
    ["L2", n >= MEP.length ? t.cxDone : n ? fmt(t.cxOf, { n }) : t.cxWait],
    ["L3", st.placed.has("L3") ? t.cxDone : t.cxWait],
    ["L4", st.placed.has("L4") ? t.cxDone : t.cxWait],
    ["L5", st.placed.has("L5") ? t.cxDone : t.cxWait],
  ];
  return `<p class="log-h">${esc(t.cxTrackTitle)}</p><ul class="cx">${rows
    .map(([id, state]) => `<li><span><b>${esc(t.elements[id].name)}</b> — ${esc(t.cxWhen[id])}</span><span>${esc(state)}</span></li>`)
    .join("")}</ul><p class="muted">${esc(t.cxTrackNote)}</p>`;
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
    html = `<p class="kicker">${fmt(t.phaseOf, { n: PH.indexOf(p) + 1 })}</p><h2>${esc(t.phases[p.id].name)}</h2>
      <p class="muted">${esc(t.phases[p.id].log)} <span class="range">${p.months[0]}–${p.months[1]} ${esc(t.schedAxis)} · ${esc(t.typical)}</span></p>
      <ul class="els">${p.els
        .map((e) => {
          const done = st.placed.has(e);
          const waits = !done && (NEED_FIRST[e] || []).some((x) => !st.placed.has(x));
          const title = waits ? t.clearWait : done ? t.showOnMap : "";
          return `<li><button type="button" class="el" data-el="${e}"${done ? " data-done" : ""}${waits ? " disabled" : ""} title="${esc(title)}"><span class="el-mark">${done ? ICON.done : waits ? ICON.lock : ICON.plus}</span><span class="el-name">${esc(t.elements[e].name)}</span><span class="el-act">${esc(done ? t.placed : waits ? t.notYet : t.place)}</span></button></li>`;
        })
        .join("")}</ul>
      <button type="button" class="btn btn-wide" data-finish${all ? "" : " disabled"}>${esc(all ? fmt(t.finishPhase, { name: t.phases[p.id].short }) : t.finishNeed)}</button>`;
  }
  html += `${cxTrackHtml()}<p class="log-h">${esc(t.logTitle)}</p><ul class="log">${st.log.slice(0, 3).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  box.innerHTML = html;
}
$("[data-build]").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
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
    const lockedTitle = fmt(t.phaseLocked, { list: p.after.filter((a) => !st.done.has(a)).map((a) => t.phases[a].short).join(", ") });
    return `<li><button type="button" class="lane" data-phase="${p.id}" data-state="${state}" aria-pressed="${st.focus === p.id}" title="${esc(state === "locked" ? `${lockedTitle}. ${t.phases[p.id].why}` : t.phases[p.id].name)}"><span class="lane-icon">${icon}</span><span class="lane-name">${esc(t.phases[p.id].short)}</span><span class="track">${bar}</span></button></li>`;
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

function chipsHtml(e, siblings) {
  const t = T();
  const chips = [];
  const monthList = Object.values(e.sched || {});
  const months = monthList.length ? Math.max(...monthList) : 0;
  const sibDelay = (siblings || []).some((s) => Object.values(s.sched || {}).some((m) => m > 0));
  if (months) chips.push([t.cardChips.sched, `+${fmt(t.dashMonthsShort, { n: months })}`, "bad"]);
  else if (sibDelay) chips.push([t.cardChips.sched, t.chipNoDelay, "neutral"]);
  if (e.budget) chips.push([t.cardChips.budget, `+${e.budget}%`, "bad"]);
  if (e.safety) chips.push([t.cardChips.safety, e.safety > 0 ? t.chipUp : t.chipDown, e.safety > 0 ? "good" : "bad"]);
  if (e.hood) chips.push([t.cardChips.hood, e.hood > 0 ? t.chipUp : t.chipDown, e.hood > 0 ? "good" : "bad"]);
  if (e.tags?.includes("power")) chips.push([t.cardChips.power, "+", "neutral"]);
  if (e.tags?.includes("water")) chips.push([t.cardChips.water, "+", "neutral"]);
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
    return `<li><button type="button" class="hood-row" data-key="${key}" data-kind="${kind}" aria-pressed="${ui.hot === key}"><span class="hood-name">${esc(t.hood[key].name)}</span><span class="meter" role="img" aria-label="${esc(word)}">${[1, 2, 3, 4].map((n) => `<i${n <= level ? " data-on" : ""}></i>`).join("")}</span><span class="hood-word">${esc(word)}</span></button></li>`;
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
  $("[data-hood-detail]").insertAdjacentHTML("afterend", `<p class="hood-score" data-hood-score>${esc(t.hoodScoreNote)}</p>`);
  $("[data-choices]").innerHTML = CHOICES.map((c) => {
    const locked = choiceLocked(c);
    const v = st.choice[c];
    const sibs = ["a", "b"].map((o) => EFFECT[c][o]);
    return `<div class="choice"${locked ? " data-locked" : ""}><div class="choice-head"><span class="choice-name">${esc(t.choices[c].name)}</span>${locked ? `<span class="lock">${ICON.lock}${esc(t.lockedAfter)}</span>` : ""}</div>
      <div class="seg" role="group" aria-label="${esc(t.choices[c].name)}">${["a", "b"].map((o) => `<button type="button" data-choice="${c}" data-v="${o}" aria-pressed="${v === o}"${locked && v !== o ? " disabled" : ""}>${esc(t.choices[c][o].label)}</button>`).join("")}</div>
      <p class="choice-note">${esc(v ? t.choices[c][v].note : t.choiceUnset)} ${v ? chipsHtml(EFFECT[c][v], sibs) : ""}</p></div>`;
  }).join("");
  for (const b of $$("[data-side-tab]")) b.setAttribute("aria-pressed", b.dataset.sideTab === ui.side);
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
  if (!started("grade")) tile("hood", "—", t.notStarted, 3, "—");
  else tile("hood", `${s.hood}/100`, levelWord(s.hood), s.hood < 45 ? 1 : s.hood < 60 ? 2 : 4);
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
function l3Ready() { return st.done.has("util") && mepCount() > 0 && !st.placed.has("L3"); }
function l3NeedsTest() { return l3Ready() && !st.choice.test; }
function markAutoCx(just) {
  const t = T();
  const notes = [];
  const n = mepCount();
  if (n > 0) st.placed.add("L2");
  if (MEP.includes(just)) notes.push(fmt(t.logL2, { n }));
  if (l3Ready() && st.choice.test) {
    st.placed.add("L3");
    notes.push(t.logL3);
  }
  if (st.done.has("mep") && !st.placed.has("L4")) {
    st.placed.add("L4");
    notes.push(t.logL4);
  }
  return notes;
}
function pickPhase(id) {
  const t = T();
  const p = PH.find((q) => q.id === id);
  if (!ready(p)) {
    const list = p.after.filter((a) => !st.done.has(a)).map((a) => t.phases[a].name).join(", ");
    say(fmt(t.logLocked, { name: t.phases[id].name, list, why: t.phases[id].why }));
    renderBuild();
    return;
  }
  if (st.done.has(id)) return;
  const opening = st.focus !== id && !started(id);
  st.focus = id;
  renderAll();
  if (opening) speak(`phase:${id}`);
  if (ui.tab !== "build") setTab("build");
  $(".el:not([data-done]):not([disabled])")?.focus({ preventScroll: true });
}
function place(e) {
  const t = T();
  if (st.placed.has(e) || dlg.open || cardPending) return;
  if ((NEED_FIRST[e] || []).some((x) => !st.placed.has(x))) {
    say(t.clearWait);
    renderBuild();
    return;
  }
  const due = decisionsDue(e);
  if (due.length) { openDecide(due[0], () => place(e)); return; }
  st.placed.add(e);
  for (const note of markAutoCx(e)) say(note);
  say(t.elements[e].log);
  renderAll();
  scene?.focus(e);
  showTag(e);
  const said = speak(`el:${e}`);
  const card = Object.entries(CARD).find(([id, c]) => !(id in st.cards) && (c.at === e || c.at === phaseOf[e]));
  const follow = () => {
    if (l3NeedsTest()) openDecide("test", () => { markAutoCx("").forEach(say); renderAll(); focusNext(); });
    else focusNext();
  };
  if (card) { st.cards[card[0]] = null; scheduleCard(card[0], said, follow); }
  else follow();
}
function finishPhase(id) {
  const t = T();
  if (!id || dlg.open || cardPending) return;
  const missing = (PHASE_REQUIRED[id] || []).filter((c) => !st.choice[c]);
  if (missing.length) { openDecide(missing[0], () => finishPhase(id)); return; }
  if (!st.done.has(id)) {
    st.frozenSched[id] = effects().sched[id] || 0;
    st.done.add(id);
    say(fmt(t.logPhaseDone, { name: t.phases[id].name }));
  }
  const proceed = () => {
    markAutoCx("").forEach(say);
    if (id === "cx") { say(t.logCx); speak("cx"); }
    st.focus = null;
    renderAll();
    if (id === "turn") openEnd();
    else $("[data-go]")?.focus({ preventScroll: true });
  };
  if (l3NeedsTest()) openDecide("test", proceed);
  else proceed();
}
function choose(c, v) {
  const t = T();
  if (choiceLocked(c) || st.choice[c] === v || !EFFECT[c]?.[v]) return;
  st.choice[c] = v;
  say(fmt(t.logChoice, { name: t.choices[c].name, value: t.choices[c][v].label }));
  renderAll();
  $(`[data-choice="${c}"][data-v="${v}"]`)?.focus({ preventScroll: true });
}
function next() {
  if (dlg.open || cardPending) return;
  const p = PH.find((q) => q.id === st.focus);
  if (p) {
    const e = p.els.find((x) => !st.placed.has(x));
    if (e) return place(e);
    return finishPhase(p.id);
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
function speak(key) {
  // A new line settles the previous one, so a queued issue card is not left waiting on audio that was cut off.
  if (speakSettle) { const prev = speakSettle; speakSettle = null; prev(); }
  const text = (D.CAPTIONS[lang] || D.CAPTIONS.en)[key];
  if (!text) return Promise.resolve();
  const clip = (D.VOICE[lang] || {})[key] || (lang === "en" ? null : D.VOICE.en[key]);
  clearTimeout(capTimer);
  if (!voice.on) return Promise.resolve();
  capEl.textContent = text;
  capEl.hidden = false;
  if (!clip) {
    audio.pause();
    capTimer = setTimeout(() => (capEl.hidden = true), Math.min(12000, Math.max(2500, text.length * 45)));
    return Promise.resolve();
  }
  audio.pause();
  audio.src = clip;
  return new Promise((res) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      if (speakSettle === done) speakSettle = null;
      clearTimeout(backstop);
      audio.onended = audio.onerror = null;
      capTimer = setTimeout(() => (capEl.hidden = true), 600);
      res();
    };
    speakSettle = done;
    const backstop = setTimeout(done, Math.max(4000, text.length * 85));
    audio.onended = audio.onerror = done;
    if (window.__voiceRate) audio.playbackRate = window.__voiceRate;
    audio.play().then(() => { audioUnlocked = true; }).catch(done);
  });
}
function hush() {
  if (speakSettle) { const prev = speakSettle; speakSettle = null; prev(); }
  audio.pause();
  capEl.hidden = true;
}
const voiceBtn = $("[data-voice]");
function renderVoiceBtn() {
  voiceBtn.textContent = voice.on ? T().voiceOn : T().voiceOff;
  voiceBtn.setAttribute("aria-pressed", voice.on);
  $("[data-libmode]").checked = !voice.on;
  voiceBtn.hidden = !Object.keys(D.VOICE.en || {}).length;
  $("[data-listen]").hidden = !voice.on || !(D.VOICE.en || {}).intro;
}
function setVoice(on) { voice.on = on; if (!on) hush(); renderVoiceBtn(); }
voiceBtn.addEventListener("click", () => setVoice(!voice.on));
$("[data-libmode]").addEventListener("change", (e) => setVoice(!e.target.checked));
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
  const sibs = ["a", "b"].map((o) => EFFECT[id][o]);
  $(".kicker", dlg).textContent = t.decideKicker;
  $(".card-title", dlg).textContent = choice.name;
  $(".card-body", dlg).textContent = choice.ask;
  $(".card-opts", dlg).previousElementSibling.textContent = t.decideChoose;
  $(".card-opts", dlg).innerHTML = ["a", "b"]
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(choice[o].label)}</span><span class="opt-note">${esc(choice[o].note)}</span>${chipsHtml(EFFECT[id][o], sibs)}</button>`)
    .join("");
  dlg.dataset.kind = "choice";
  dlg.dataset.id = id;
  resume = next;
  dlg.showModal();
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
    .map((o, i) => `<button type="button" class="opt" data-key="${i + 1}" data-o="${o}"><span class="opt-label"><kbd>${i + 1}</kbd>${esc(card[o].label)}</span>${chipsHtml(CARD[id].opts[o], Object.values(CARD[id].opts))}</button>`)
    .join("");
  dlg.dataset.kind = "card";
  dlg.dataset.id = id;
  cardAfter = after || null;
  dlg.showModal();
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
    dlg.close();
    choose(id, b.dataset.o);
    fn?.();
    return;
  }
  st.cards[id] = b.dataset.o;
  if (id === "longlead" && !st.placed.has("L1")) {
    st.placed.add("L1");
    say(T().logL1);
  }
  say(T().cards[id][b.dataset.o].log);
  speak(`opt:${id}:${b.dataset.o}`);
  const fn = cardAfter;
  cardAfter = null;
  dlg.close();
  renderAll();
  fn?.();
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
  const made = [
    ...CHOICES.filter((c) => st.choice[c]).map((c) => `<li><b>${esc(t.choices[c].name)}:</b> ${esc(t.choices[c][st.choice[c]].label)}</li>`),
    ...Object.entries(st.cards).filter(([, o]) => o).map(([id, o]) => `<li><b>${esc(t.cards[id].title)}:</b> ${esc(t.cards[id][o].label)}</li>`),
  ];
  $(".end-chose", endDlg).innerHTML = made.length ? made.join("") : `<li>${esc(t.noDecisions)}</li>`;
  endDlg.showModal();
  speak("end");
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
  if (ev.key === "v" || ev.key === "V") { ev.preventDefault(); setVoice(!voice.on); }
});
function reset() {
  playGen += 1;
  clearCardTimers();
  resume = null;
  cardAfter = null;
  cardPending = false;
  hush();
  if (dlg.open) dlg.close();
  if (endDlg.open) endDlg.close();
  if (aboutDlg.open) aboutDlg.close();
  if (idleDlg.open) { clearInterval(idleTimer); idleDlg.close(); }
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
// An open issue or decision stays open. The end screen itself resets after about a minute.
const idleDlg = $("[data-idle]");
let lastInput = performance.now(), idleLeft = 0, idleTimer = 0;
for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(ev, () => { lastInput = performance.now(); }, { capture: true, passive: true });
setInterval(() => {
  if (!st.started || introDlg.open || idleDlg.open) return;
  const idle = performance.now() - lastInput;
  if (endDlg.open) { if (idle >= 60000) reset(); return; }
  if (idle < (window.__idleMs || 150000)) return;
  if (aboutDlg.open) aboutDlg.close();
  idleLeft = 20;
  $(".idle-body", idleDlg).textContent = fmt(T().idleBody, { n: idleLeft });
  try { idleDlg.showModal(); } catch { return; }
  $("[data-idle-keep]").focus();
  idleTimer = setInterval(() => {
    idleLeft -= 1;
    $(".idle-body", idleDlg).textContent = fmt(T().idleBody, { n: idleLeft });
    if (idleLeft <= 0) { clearInterval(idleTimer); idleDlg.close(); reset(); }
  }, 1000);
}, 5000);
$("[data-idle-keep]").addEventListener("click", () => { clearInterval(idleTimer); idleDlg.close(); lastInput = performance.now(); });
idleDlg.addEventListener("cancel", (ev) => { ev.preventDefault(); $("[data-idle-keep]").click(); });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // Keep this id identical to CACHE in sw.js. Bump both together when publishing.
  // The file name changes with the id, so a reload installs the new worker immediately.
  const SW_BUILD = "build-the-campus-v3";
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  if (hadController) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
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
    reg.update().catch(() => {});
  }).catch(() => {});
}

// A hook for screenshots and checks.
window.__dc = {
  all(opts = {}) {
    Object.assign(st.choice, opts);
    for (const p of PH) { for (const e of p.els) st.placed.add(e); st.done.add(p.id); }
    for (const id of ["L1", "L2", "L3", "L4"]) st.placed.add(id);
    st.done.delete("turn");
    st.focus = "turn";
    st.started = true;
    introDlg.open && introDlg.close();
    scene?.setAttract(false);
    renderAll(false);
  },
  upTo(id, opts = {}) {
    Object.assign(st.choice, opts);
    let passedMep = false;
    for (const p of PH) {
      if (p.id === id) { st.focus = id; p.els.slice(0, Math.ceil(p.els.length / 2)).forEach((e) => st.placed.add(e)); break; }
      for (const e of p.els) st.placed.add(e);
      st.done.add(p.id);
      if (p.id === "mep") passedMep = true;
    }
    if (passedMep || st.placed.has("switchgear")) for (const cid of ["L1", "L2", "L3", "L4"]) st.placed.add(cid);
    for (const [cid, c] of Object.entries(CARD)) if (st.placed.has(c.at) || PH.find((p) => p.id === c.at && started(p.id))) st.cards[cid] = st.cards[cid] || "a";
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
  audio: () => ({ unlocked: audioUnlocked, paused: audio.paused, time: audio.currentTime, src: audio.currentSrc ? audio.currentSrc.slice(0, 48) : "" }),
  scores,
  hood,
  info: () => scene?.info(),
  meshes: () => scene?.meshes(),
};

renderVoiceBtn();
reset();
measureSafe();
scene?.start();
