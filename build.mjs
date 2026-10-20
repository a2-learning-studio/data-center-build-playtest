// Builds Build the Campus, a 3D game about building a data center campus.
// node build.mjs writes two pages, at the repo root and in docs/:
//   index.html                      the web page: three.js, fonts, strings and code inlined; narration clips are
//                                   loaded from voice/<lang>/ the first time they play (the service worker keeps them)
//   build-the-campus-offline.html   the single-file kiosk copy: everything inlined, narration included, no network
// plus index.test.html at the root only: the web page with the hooks the checks in tests/ use (never published).
// Before writing, it checks the model, the strings and the scene tags against each other (I19) and stops on a gap.
// node build.mjs --test   also runs every script in tests/ against the fresh test build.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { speakable } from "./voice-lines.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { STRINGS } = await import(pathToFileURL(join(HERE, "strings.mjs")).href);
const MODEL = await import(pathToFileURL(join(HERE, "model.mjs")).href);
const { PHASES, BASE_MONTHS } = MODEL;
const t = STRINGS.en;
const read = (f) => readFileSync(join(HERE, f), "utf8");

{
  // C10: the plan must stay reachable. Smallest delays, as in model.mjs: CARD.weather.a adds 0.5 to grade;
  // EFFECT.hours.a adds 0.5 to grade and found.
  const finish = (extra) => {
    const fin = {};
    for (const p of PHASES) fin[p.id] = Math.max(0, ...p.after.map((a) => fin[a])) + (p.months[0] + p.months[1]) / 2 + (extra[p.id] || 0);
    return fin.turn;
  };
  const wa = MODEL.CARD.weather.opts.a.sched.grade;
  const ha = MODEL.EFFECT.hours.a.sched;
  const best = finish({ grade: wa });
  const daytime = finish({ grade: wa + ha.grade, found: ha.found });
  if (Math.round(best) > BASE_MONTHS || Math.round(daytime) > BASE_MONTHS) throw new Error(`BASE_MONTHS ${BASE_MONTHS}: the best run (${best}) or the daytime-hours run (${daytime}) can no longer rate Strong`);
  if (Math.round(best) < BASE_MONTHS - 2) throw new Error(`BASE_MONTHS ${BASE_MONTHS} is loose: the best run is ${best}, so Strong would be too easy`);
}

// ---------- model, strings and scene checks (I19) ----------
const problems = [];
const warnings = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };
const at = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const isText = (v) => typeof v === "string" && v.trim().length > 0;
{
  const phaseIds = PHASES.map((p) => p.id);
  const elIds = [...PHASES.flatMap((p) => p.els), ...MODEL.CX_FLAGS];
  for (const p of PHASES) {
    for (const k of ["name", "short", "log", "why"]) need(isText(t.phases?.[p.id]?.[k]), `strings: phases.${p.id}.${k} is missing`);
    for (const a of p.after) need(phaseIds.includes(a), `model: phase ${p.id} comes after unknown phase ${a}`);
  }
  for (const e of elIds) for (const k of ["name", "log"]) need(isText(t.elements?.[e]?.[k]), `strings: elements.${e}.${k} is missing`);
  need(JSON.stringify(Object.keys(MODEL.EFFECT).sort()) === JSON.stringify([...MODEL.CHOICES].sort()), "model: EFFECT and CHOICES list different choices");
  for (const c of MODEL.CHOICES) {
    need(MODEL.EFFECT[c]?.a && MODEL.EFFECT[c]?.b, `model: choice ${c} needs options a and b`);
    for (const k of ["name", "ask", "a.label", "a.note", "b.label", "b.note"]) need(isText(at(t.choices?.[c], k)), `strings: choices.${c}.${k} is missing`);
  }
  for (const [id, card] of Object.entries(MODEL.CARD)) {
    for (const k of ["title", "body"]) need(isText(t.cards?.[id]?.[k]), `strings: cards.${id}.${k} is missing`);
    for (const o of Object.keys(card.opts)) for (const k of ["label", "log"]) need(isText(t.cards?.[id]?.[o]?.[k]), `strings: cards.${id}.${o}.${k} is missing`);
    need(!card.at || elIds.includes(card.at) || phaseIds.includes(card.at), `model: card ${id} comes at unknown ${card.at}`);
    need(!card.roll || phaseIds.includes(card.roll), `model: card ${id} rolls on unknown phase ${card.roll}`);
    need(!card.roll || (typeof card.chance === "number" && card.chance > 0 && card.chance < 1), `model: card ${id} needs a chance between 0 and 1`);
    for (const o of Object.values(card.opts)) for (const ph of Object.keys(o.sched || {})) need(phaseIds.includes(ph), `model: card ${id} delays unknown phase ${ph}`);
  }
  {
    const rolls = {};
    for (const [id, card] of Object.entries(MODEL.CARD)) {
      if (!card.roll) continue;
      need(!rolls[card.roll], `model: phase ${card.roll} rolls both ${rolls[card.roll]} and ${id}`);
      rolls[card.roll] = id;
    }
  }
  if (MODEL.LAYOUT) {
    const placed = Object.fromEntries(Object.keys(MODEL.LAYOUT).map((id) => [id, { x: 0, z: 0 }]));
    for (const [id, spec] of Object.entries(MODEL.LAYOUT)) {
      need(elIds.includes(id), `model: layout piece ${id} is not an element`);
      need(Array.isArray(spec.rects) && spec.rects.length > 0, `model: layout ${id} needs a footprint`);
      need(isText(t.placeHint?.[id]), `strings: placeHint.${id} is missing`);
      const issue = MODEL.layoutIssue(id, 0, 0, placed);
      need(!issue, `model: the suggested spot for ${id} does not fit (${issue})`);
    }
    need(String(t.placeBadNear).includes(String(MODEL.LAYOUT_NEAR)), `strings: placeBadNear must quote the ${MODEL.LAYOUT_NEAR} m limit`);
  }
  for (const [c, opts] of Object.entries(MODEL.EFFECT)) for (const o of Object.values(opts)) for (const ph of Object.keys(o.sched || {})) need(phaseIds.includes(ph), `model: choice ${c} delays unknown phase ${ph}`);
  for (const [name, table, keyKind] of [["PHASE_START", MODEL.PHASE_START, "phase"], ["PHASE_REQUIRED", MODEL.PHASE_REQUIRED, "phase"], ["BEFORE_EL", MODEL.BEFORE_EL, "element"]]) {
    for (const [k, cs] of Object.entries(table)) {
      need(keyKind === "phase" ? phaseIds.includes(k) : elIds.includes(k), `model: ${name} names unknown ${keyKind} ${k}`);
      for (const c of cs) need(MODEL.CHOICES.includes(c), `model: ${name} names unknown choice ${c}`);
    }
  }
  for (const [e, list] of Object.entries(MODEL.NEED_FIRST)) for (const x of [e, ...list]) need(elIds.includes(x), `model: NEED_FIRST names unknown element ${x}`);
  for (const id of MODEL.MEP) need(PHASES.find((p) => p.id === "mep").els.includes(id), `model: MEP item ${id} is not in the MEP phase`);
  // Every question is asked somewhere (the generator-test question is asked by the start-up rule in game.js).
  const asked = new Set([...Object.values(MODEL.PHASE_START).flat(), ...Object.values(MODEL.BEFORE_EL).flat(), "test"]);
  for (const c of MODEL.CHOICES) need(asked.has(c), `model: choice ${c} is never asked`);
  // Scene tags: every part on the map belongs to a known element or choice, and every element has a part.
  const scene = read("scene.js");
  const shown = new Set();
  for (const m of scene.matchAll(/\b(show|hide|need|opt|keep):\s*"([^"]*)"/g)) {
    const [, kind, v] = m;
    if (!v) continue;
    if (kind === "opt" || kind === "keep") {
      const [c, o] = v.split(":");
      need(MODEL.EFFECT[c]?.[o], `scene: tag ${kind}: "${v}" names an unknown choice or option`);
    } else {
      need(elIds.includes(v), `scene: tag ${kind}: "${v}" names an unknown element`);
      if (kind === "show") shown.add(v);
    }
  }
  for (const e of elIds) if (!MODEL.NO_SCENE_PART.includes(e)) need(shown.has(e), `scene: element ${e} has no part on the map (no show: "${e}" tag)`);
  if (MODEL.LAYOUT) {
    const shifts = new Set();
    for (const m of scene.matchAll(/shift:\s*"([^"]+)"/g)) if (m[1]) shifts.add(m[1]);
    for (const [id, spec] of Object.entries(MODEL.LAYOUT)) need(shifts.has(spec.shift), `scene: layout ${id} shift "${spec.shift}" has no group`);
  }
  for (const k of ["trucks", "noise", "dust", "storm", "water", "power", "gens", "jobs", "tax", "setback"]) for (const f of ["name", "fact"]) need(isText(t.hood?.[k]?.[f]), `strings: hood.${k}.${f} is missing`);
  // Every string the code asks for exists in English.
  const code = read("game.js") + read("build.mjs");
  const used = new Set();
  for (const m of code.matchAll(/(?:(?<![.\w])t|T\(\))\.(\w+)/g)) used.add(m[1]);
  for (const m of code.matchAll(/data-t(?:-label)?="(\w+)/g)) used.add(m[1]);
  for (const m of code.matchAll(/kpi\("\w+", "(\w+)"\)/g)) { used.add(m[1]); used.add(`${m[1]}Short`); }
  for (const m of code.matchAll(/camBtn\("\w+", "(\w+)"/g)) used.add(m[1]);
  for (const m of code.matchAll(/checkRow\("[^"]*", "(\w+)", "(\w+)"/g)) { used.add(m[1]); used.add(m[2]); }
  for (const m of code.matchAll(/countText\("(\w+)"/g)) { used.add(m[1]); used.add(`${m[1]}One`); }
  for (const k of used) need(k in t, `strings: en.${k} is used by the code but missing`);
  const unused = Object.keys(t).filter((k) => !used.has(k) && !["lang", "phases", "elements", "choices", "cards", "hood", "langNameEn", "langToggle"].includes(k));
  if (unused.length) warnings.push(`strings not used by the code: ${unused.join(", ")}`);
  // The score explanations quote the model's starting score.
  for (const k of ["hoodScoreNote", "hoodBreak", "hoodBreakWait"]) need(String(t[k]).includes(String(MODEL.SCORE_START.hood)), `strings: ${k} must quote the neighbor start of ${MODEL.SCORE_START.hood}`);
  // Other languages: an empty table is a warning (its language button stays hidden); a partial one lists its gaps.
  const keysOf = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${pre}${k}.`) : [`${pre}${k}`]));
  const enKeys = keysOf(t);
  for (const [lang, table] of Object.entries(STRINGS)) {
    if (lang === "en") continue;
    if (!table || !Object.keys(table).length) { warnings.push(`locale "${lang}" is empty, so its language button stays hidden`); continue; }
    const have = new Set(keysOf(table));
    const missing = enKeys.filter((k) => !have.has(k));
    if (missing.length) warnings.push(`locale "${lang}" is missing ${missing.length} strings (English shows instead): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? " …" : ""}`);
  }
}
if (problems.length) {
  console.error(`build check failed:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

// three.js r170 as a plain object: drop the module's export clause and return its names.
const threeSrc = read("vendor/three.module.min.js");
const exp = threeSrc.match(/export\{([^}]*)\};?\s*$/);
if (!exp) throw new Error("three.js export clause not found");
const names = exp[1].split(",").map((s) => s.trim().split(/\s+as\s+/)).map(([a, b]) => `${b || a}:${a}`);
const THREE_JS = `const THREE=(()=>{${threeSrc.slice(0, exp.index)}\nreturn {${names.join(",")}};})();\n`;

const font = (file, family) => `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${readFileSync(join(HERE, "vendor/fonts", file)).toString("base64")}) format("woff2");font-weight:100 900;font-display:swap}`;
const FONTS = font("Geist-var.woff2", "Geist") + font("Inter-var.woff2", "Inter");

// Narration: captions come from the same lines as the clips. The offline file inlines every clip as a data URL;
// the web page points at voice/<lang>/<file>?v=<content hash>, so a changed clip gets a new address (I15).
const { lines } = await import(pathToFileURL(join(HERE, "voice-lines.mjs")).href);
const VOICE = {}, VOICE_WEB = {}, CAPTIONS = {}, CLIPS = [];
for (const lang of Object.keys(STRINGS)) {
  const tl = { ...STRINGS.en, ...STRINGS[lang] };
  CAPTIONS[lang] = lines(tl);
  const dir = join(HERE, "voice", lang);
  const man = existsSync(join(dir, "manifest.json")) ? JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) : {};
  VOICE[lang] = {};
  VOICE_WEB[lang] = {};
  for (const [key, m] of Object.entries(man)) {
    // Drop a clip when the spoken line changed, so old audio never plays under new captions.
    if (!CAPTIONS[lang][key] || m.text !== speakable(CAPTIONS[lang][key]) || !existsSync(join(dir, m.file))) continue;
    if (!/^[\w.-]+\.mp3$/.test(m.file)) throw new Error(`unexpected clip file name: ${m.file}`);
    const bytes = readFileSync(join(dir, m.file));
    VOICE[lang][key] = `data:audio/mpeg;base64,${bytes.toString("base64")}`;
    VOICE_WEB[lang][key] = `voice/${lang}/${m.file}?v=${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}`;
    CLIPS.push({ lang, file: m.file });
  }
}
const clipCount = Object.values(VOICE).reduce((n, v) => n + Object.keys(v).length, 0);

// Numbers the score explanation quotes from the model, so the text stays true to the formula (C9, I11).
const FILL = {
  base: BASE_MONTHS,
  delay: MODEL.DELAY_PCT,
  cont: +(MODEL.BUDGET_BANDS[0] - 100).toFixed(1),
  b0: MODEL.BUDGET_BANDS[0],
  b1: MODEL.BUDGET_BANDS[1],
  b2: MODEL.BUDGET_BANDS[2],
  safety0: MODEL.SCORE_START.safety,
  hood0: MODEL.SCORE_START.hood,
};
const fill = (s) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in FILL ? FILL[k] : m));
const tx = (key, text) => `<span data-t="${key}">${text}</span>`;
const kpiLabel = (key) => `<span class="long" data-t="${key}">${t[key]}</span><span class="short" data-t="${key}Short">${t[`${key}Short`]}</span>`;
const kpi = (key, labelKey) => `<div class="kpi" data-dash="${key}" data-level="none"><span class="kpi-label">${kpiLabel(labelKey)}</span><span class="kpi-val">—</span><span class="kpi-word"></span></div>`;
// Small line icons for the map buttons (24 x 24 viewBox, stroked with the text colour).
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICONS = {
  in: svg("M12 5v14M5 12h14"),
  out: svg("M5 12h14"),
  left: svg("M5.5 12a6.5 6.5 0 1 0 2-4.7M5 3.5v4.5h4.5"),
  right: svg("M18.5 12a6.5 6.5 0 1 1-2-4.7M19 3.5v4.5h-4.5"),
  panL: svg("M15 5l-7 7 7 7"),
  panR: svg("M9 5l7 7-7 7"),
  panU: svg("M5 15l7-7 7 7"),
  panD: svg("M5 9l7 7 7-7"),
  present: svg("M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"),
};
const camBtn = (act, labelKey, extra = "") => `<button type="button" class="cb" data-cam-act="${act}" aria-label="${t[labelKey]}" title="${t[labelKey]}" data-t-label="${labelKey}"${extra}>${ICONS[act]}</button>`;
const checkRow = (attr, key, noteKey, checked = "") => `<label class="libmode"><input type="checkbox" ${attr}${checked}><span><b data-t="${key}">${t[key]}</b><br><span class="muted" data-t="${noteKey}">${t[noteKey]}</span></span></label>`;
const OFFLINE_FILE = "build-the-campus-offline.html";
const gloss = t.glossary.map(([term, def]) => `<div><dt>${term}</dt><dd>${def}</dd></div>`).join("");
const sources = t.sources.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.text}</a></li>`).join("");

// offline: the single-file kiosk copy, which says so in About instead of offering the download.
const bodyFor = (offline) => `
<div class="app">
<header class="bar">
  <div class="brand"><h1 class="brand-name" data-t="gameName">${t.gameName}</h1><span class="badge"><span class="badge-long" data-t="badge">${t.badge}</span><span class="badge-short" data-t="badgeShort">${t.badgeShort}</span></span></div>
  <div class="kpis" role="group" aria-label="${t.dashTitle}">${kpi("schedule", "dashSchedule")}${kpi("budget", "dashBudget")}${kpi("safety", "dashSafety")}${kpi("hood", "dashNeighbors")}</div>
  <div class="bar-btns"><button type="button" class="pill" data-about data-t="about">${t.about}</button><button type="button" class="pill" data-lang hidden>${t.langToggle}</button></div>
</header>
<main class="stage">
  <canvas class="scene" data-scene tabindex="0" role="application" aria-roledescription="3D map" aria-label="${t.canvasLabel}"></canvas>
  <p class="nogl" data-t="noglLabel">${t.noglLabel}</p>
  <div class="tag" data-tag hidden aria-hidden="true"></div>
  <p class="caption" data-caption hidden></p>
  <span class="sr" role="status" aria-live="polite" data-status></span>
  <span class="sr" aria-live="polite" data-score-live></span>
  <span class="sr" aria-live="polite" data-alert></span>
  <p class="toast" data-toast hidden aria-hidden="true"></p>
  <nav class="tabs" aria-label="${t.gameName}">
    <button type="button" data-tab="build" aria-pressed="true" data-t="tabBuild">${t.tabBuild}</button>
    <button type="button" data-tab="plan" aria-pressed="false" data-t="tabPlan">${t.tabPlan}</button>
    <button type="button" data-tab="hood" aria-pressed="false" data-t="tabHood">${t.tabHood}</button>
    <button type="button" data-tab="choices" aria-pressed="false" data-t="tabChoices">${t.tabChoices}</button>
  </nav>
  <section class="panel p-build" aria-label="${t.tabBuild}"><div data-build></div></section>
  <section class="panel p-side" aria-label="${t.tabHood}">
    <div class="side-tabs"><button type="button" data-side-tab="hood" aria-pressed="true" data-t="hoodTitle">${t.hoodTitle}</button><button type="button" data-side-tab="choices" aria-pressed="false" data-t="choicesTitle">${t.choicesTitle}</button></div>
    <div class="side-hood"><ul class="hood" data-hood></ul><p class="hood-detail" data-hood-detail aria-live="polite"></p></div>
    <div class="side-choices"><div class="choices" data-choices></div></div>
  </section>
  <section class="panel p-plan" data-plan aria-label="${t.schedTitle}"></section>
  <div class="tools"><button type="button" class="pill pill-dark" data-fx aria-pressed="true">${t.effectsOn}</button><button type="button" class="pill pill-dark" data-voice aria-pressed="true">${t.voiceOn}</button><span class="hint" data-hint><span class="long">${t.dragHint}</span><span class="short">${t.dragHintShort}</span></span></div>
  <div class="cam" role="group" aria-label="${t.camGroup}" data-cam>
    <div class="cam-move" role="group" aria-label="${t.camMove}" data-cam-move hidden>${camBtn("panL", "camPanL")}${camBtn("panU", "camPanU")}${camBtn("panD", "camPanD")}${camBtn("panR", "camPanR")}</div>
    ${camBtn("in", "camIn")}${camBtn("out", "camOut")}${camBtn("left", "camLeft")}${camBtn("right", "camRight")}${camBtn("present", "camPresent", ' aria-pressed="false"')}<button type="button" class="pill pill-dark" data-cam-act="reset" data-reset data-t="resetView">${t.resetView}</button>
  </div>
</main>
<footer class="foot"><span data-t="credits">${t.credits}</span></footer>
</div>
<dialog class="dlg dlg-intro" data-intro closedby="none" aria-labelledby="intro-title" aria-describedby="intro-aud intro-body">
  <p class="kicker" data-t="introKicker">${t.introKicker}</p>
  <h2 class="dlg-title" id="intro-title" data-t="introTitle">${t.introTitle}</h2>
  <p class="audience" id="intro-aud" data-t="audience">${t.audience}</p>
  <p class="byline" data-t="credits">${t.credits}</p>
  <p id="intro-body" data-t="introBody">${t.introBody}</p>
  <p data-t="introHow">${t.introHow}</p>
  <p class="muted keys-hint" data-t="keysHint">${t.keysHint}</p>
  <label class="libmode"><input type="checkbox" data-libmode><span><b data-t="libraryMode">${t.libraryMode}</b><br><span class="muted" data-libmode-note>${t.libraryModeNote}</span></span></label>
  <p class="resume-note" data-resume-note hidden data-t="resumeNote">${t.resumeNote}</p>
  <div class="intro-btns"><button type="button" class="btn btn-big" data-resume hidden data-t="resume">${t.resume}</button><button type="button" class="btn btn-big" data-start>${t.start}</button><button type="button" class="btn btn-ghost" data-listen>${t.listen}</button></div>
</dialog>
<dialog class="dlg" data-card closedby="none" aria-labelledby="card-title" aria-describedby="card-body"><p class="kicker" data-t="cardKicker">${t.cardKicker}</p><h2 class="card-title" id="card-title"></h2><p class="card-body" id="card-body"></p><p class="muted" data-t="cardChoose">${t.cardChoose}</p><div class="card-opts"></div></dialog>
<dialog class="dlg dlg-end" data-end closedby="none" aria-labelledby="end-title" aria-describedby="end-body"><p class="print-only print-head"><span data-t="printHead">${t.printHead}</span> · <span data-t="badge">${t.badge}</span></p><h2 id="end-title" data-t="endTitle">${t.endTitle}</h2><p id="end-body" data-t="endBody">${t.endBody}</p><h3 data-t="endStats">${t.endStats}</h3><dl class="end-stats"></dl><h3 data-t="endCostly">${t.endCostly}</h3><ol class="end-costly"></ol><p class="muted" data-t="endCostlyNote">${t.endCostlyNote}</p><h3 data-t="endChose">${t.endChose}</h3><ul class="end-chose"></ul><h3 data-t="endTalk">${t.endTalk}</h3><ol class="end-talk"></ol><p class="print-only print-foot"><span data-t="credits">${t.credits}</span> · ${t.contactEmail}</p><div class="dlg-foot"><p class="end-clear" id="end-clear" data-end-clear hidden></p><span class="sr" aria-live="polite" data-alert-end></span><div class="end-btns"><button type="button" class="btn" data-end-keep hidden aria-describedby="end-clear" data-t="endKeep">${t.endKeep}</button><button type="button" class="btn btn-ghost" data-print data-t="endPrint">${t.endPrint}</button><button type="button" class="btn btn-big" data-again data-t="endAgain">${t.endAgain}</button></div></div></dialog>
<dialog class="dlg" data-confirm aria-labelledby="confirm-title" aria-describedby="confirm-body"><h2 id="confirm-title" data-t="confirmTitle">${t.confirmTitle}</h2><p id="confirm-body" data-t="confirmBody">${t.confirmBody}</p><div class="intro-btns"><button type="button" class="btn" data-confirm-yes data-t="confirmYes">${t.confirmYes}</button><button type="button" class="btn btn-ghost" data-confirm-no data-t="confirmNo">${t.confirmNo}</button></div></dialog>
<dialog class="dlg" data-idle closedby="none" aria-labelledby="idle-title" aria-describedby="idle-body"><h2 id="idle-title" data-t="idleTitle">${t.idleTitle}</h2><p class="idle-body" id="idle-body"></p><span class="sr" aria-live="polite" data-alert-idle></span><button type="button" class="btn btn-big" data-idle-keep data-t="idleKeep">${t.idleKeep}</button></dialog>
<dialog class="dlg" data-about-dlg aria-labelledby="about-title" aria-describedby="about-body"><h2 id="about-title" tabindex="-1" data-t="gameName">${t.gameName}</h2><p class="byline" data-t="credits">${t.credits}</p><p id="about-body" data-t="creditsBody">${t.creditsBody}</p><p data-t="creditsSet">${t.creditsSet}</p><p class="audience" data-t="audienceAbout">${t.audienceAbout}</p><p data-t="privacy">${t.privacy}</p><p class="contact"><span data-t="contact">${t.contact}</span> <a href="mailto:${t.contactEmail}">${t.contactEmail}</a></p><h3 data-t="controlsTitle">${t.controlsTitle}</h3><p data-t="mapHelp">${t.mapHelp}</p><label class="libmode"><input type="checkbox" data-keys-pref checked><span><b data-t="keysPref">${t.keysPref}</b><br><span class="muted" data-t="keysPrefNote">${t.keysPrefNote}</span></span></label>${checkRow("data-present-pref", "presentPref", "presentNote")}<p data-t="modesNote">${t.modesNote}</p><p data-t="scoreHelp">${fill(t.scoreHelp)}</p>${offline ? `<p data-t="kioskNoteOffline">${t.kioskNoteOffline}</p>` : `<p><span data-t="kioskNote">${t.kioskNote}</span> <a href="${OFFLINE_FILE}" download data-t="kioskLink">${t.kioskLink}</a></p>`}<h3 data-t="systemTitle">${t.systemTitle}</h3><p data-t="systemReq">${t.systemReq}</p><p data-t="qualityNote">${t.qualityNote}</p><h3 data-t="glossTitle">${t.glossTitle}</h3><dl class="gloss">${gloss}</dl>${offline ? `<p data-t="educatorNoteOffline">${t.educatorNoteOffline}</p>` : `<p><span data-t="educatorNote">${t.educatorNote}</span> <a href="educator.html" target="_blank" rel="noopener" data-t="educatorLink">${t.educatorLink}</a></p>`}<h3 data-t="sourcesTitle">${t.sourcesTitle}</h3><ul class="sources">${sources}</ul><p class="muted" data-t="sourcesNote">${t.sourcesNote}</p><p class="muted" data-t="voiceCredit">${t.voiceCredit}</p><p class="muted licence" data-t="licences">${t.licences}</p><button type="button" class="btn" data-about-close data-t="close">${t.close}</button></dialog>`;

// A small campus icon: a dark green tile with a building and a roof line.
const FAVICON = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#163a30'/><path d='M10 28 32 14l22 14' fill='none' stroke='#e0763c' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/><rect x='14' y='28' width='36' height='24' rx='3' fill='#f7f4ee'/><path d='M20 35h24M20 41h24M20 47h24' stroke='#163a30' stroke-width='3'/></svg>")}`;
const DESCRIPTION = `${t.audience} Build a made-up data center campus in Georgia, one phase at a time, and see how each choice moves the schedule, the budget, crew safety and the neighbors.`;
// The test hooks (window.__dc and the idle and voice-speed settings) live between these markers in game.js.
const HOOKS = /\/\/ @test-hooks-start[\s\S]*?\/\/ @test-hooks-end\n?/;
if (!HOOKS.test(read("game.js"))) throw new Error("test-hook markers not found in game.js");

// kind: "web" (index.html), "offline" (the kiosk file) or "test" (index.test.html, hooks kept).
const pageFor = (kind) => {
  const offline = kind === "offline";
  const game = kind === "test" ? read("game.js") : read("game.js").replace(HOOKS, "");
  const data = { MODEL: { ...MODEL }, FILL, VOICE: offline ? VOICE : VOICE_WEB, CAPTIONS };
  const LIVE = game
    .replace("__DATA__", JSON.stringify(data))
    .replace("__STRINGS__", JSON.stringify(STRINGS))
    .replace("__LAYOUT_FNS__", MODEL.createLayout.toString());
  // Line endings are normalised to LF first: the HTML parser does the same before the browser checks the hash, and
  // a checkout with core.autocrlf=true has CRLF sources.
  const script = (THREE_JS + read("scene.js") + "\n" + LIVE).replace(/\r\n?/g, "\n").replace(/<\/(script)/gi, "<\\/$1");
  // I13: a meta Content-Security-Policy whose script hash is worked out again on every build. Styles need
  // 'unsafe-inline' (the schedule bars set inline widths); narration plays from blob: and data: URLs; the web page
  // fetches clips from its own origin and registers its own service worker.
  const hash = createHash("sha256").update(script, "utf8").digest("base64");
  const csp = [
    "default-src 'none'",
    `script-src 'sha256-${hash}'`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src data:",
    "media-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
  const body = bodyFor(offline);
  const head = [
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    '<meta name="referrer" content="no-referrer">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    `<title>${t.pageTitle}</title>`,
    `<meta name="description" content="${DESCRIPTION}">`,
    '<meta name="theme-color" content="#163a30">',
    `<link rel="icon" type="image/svg+xml" href="${FAVICON}">`,
    `<meta property="og:title" content="${t.pageTitle}">`,
    `<meta property="og:description" content="${DESCRIPTION}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:site_name" content="${t.gameName}">`,
    '<meta name="twitter:card" content="summary">',
  ].join("");
  return `<!doctype html><html lang="en"><head>${head}<style>${FONTS}${read("style.css")}</style></head><body data-view="build" data-side="hood">${body}<script type="module">${script}</script></body></html>`;
};
const page = pageFor("web");
const offlinePage = pageFor("offline");
const testPage = pageFor("test");
for (const p of [page, offlinePage]) {
  if (p.includes("VOICE_HANDOFF")) throw new Error("voice handoff leaked into the page");
  if (/__dc|__idleMs|__voiceRate|@test-hooks/.test(p)) throw new Error("test hooks leaked into a published page");
}
if (!testPage.includes("window.__dc")) throw new Error("the test build lost its hooks");
if (page.includes("data:audio/mpeg")) throw new Error("the web page must not inline narration clips");
// The same files go to the repo root and to docs/, so either can be published. tests/, the test build and the
// source files stay out of the site (_config.yml for the root; docs/ never gets them).
const docs = join(HERE, "docs");
mkdirSync(docs, { recursive: true });
for (const dir of [HERE, docs]) {
  writeFileSync(join(dir, "index.html"), page);
  writeFileSync(join(dir, OFFLINE_FILE), offlinePage);
}
writeFileSync(join(HERE, "index.test.html"), testPage);
// The one-page educator sheet (C11) is a hand-written static page; docs/ gets a copy.
copyFileSync(join(HERE, "educator.html"), join(docs, "educator.html"));
// docs/voice/ holds exactly the clips the web page uses; the root page uses voice/ itself.
for (const lang of Object.keys(VOICE_WEB)) {
  const out = join(docs, "voice", lang);
  mkdirSync(out, { recursive: true });
  const keep = new Set(CLIPS.filter((c) => c.lang === lang).map((c) => c.file));
  for (const name of readdirSync(out)) if (!keep.has(name)) unlinkSync(join(out, name));
  for (const file of keep) copyFileSync(join(HERE, "voice", lang, file), join(out, file));
}
const sw = read("sw.js");
const cacheName = sw.match(/const CACHE = "([^"]+)"/)?.[1];
const swBuild = read("game.js").match(/const SW_BUILD = "([^"]+)"/)?.[1];
if (!cacheName || cacheName !== swBuild) throw new Error("SW_BUILD in game.js must match CACHE in sw.js");
const swFile = `sw-${cacheName}.js`;
for (const dir of [HERE, docs]) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith("sw-build-the-campus-") && name !== swFile) unlinkSync(join(dir, name));
  }
}
const plainSw = join(docs, "sw.js");
if (existsSync(plainSw)) unlinkSync(plainSw);
writeFileSync(join(HERE, swFile), sw);
writeFileSync(join(docs, swFile), sw);
writeFileSync(join(docs, ".nojekyll"), "");
// Narration lines with no recorded clip show their caption for reading time instead.
const silent = Object.keys(CAPTIONS.en).filter((k) => !VOICE.en[k]);
if (silent.length) warnings.push(`narration lines with no matching clip (caption only): ${silent.join(", ")}`);
for (const w of warnings) console.warn(`warning: ${w}`);
console.log("wrote index.html", `${(page.length / 1024).toFixed(0)} KB`, `and ${OFFLINE_FILE} ${(offlinePage.length / 1024).toFixed(0)} KB`, `base ${BASE_MONTHS} months`, `${clipCount} voice clips`, "(checks passed)");

// node build.mjs --test: run every check in tests/ against index.test.html, one after another (I19).
if (process.argv.includes("--test")) {
  const dir = join(HERE, "tests");
  const scripts = readdirSync(dir).filter((f) => f.endsWith(".mjs") && f !== "drive.mjs").sort();
  const failed = [];
  for (const f of scripts) {
    const t0 = Date.now();
    const r = spawnSync(process.execPath, [join(dir, f)], { cwd: HERE, stdio: "inherit", env: process.env });
    const ok = r.status === 0;
    console.log(`${ok ? "pass" : "FAIL"} tests/${f} (${Math.round((Date.now() - t0) / 1000)} s)`);
    if (!ok) failed.push(f);
  }
  if (failed.length) { console.error(`tests failed: ${failed.join(", ")}`); process.exit(1); }
  console.log(`all ${scripts.length} test scripts passed`);
}
