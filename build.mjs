// Builds index.html: Build the Campus, a 3D game about building a data center campus.
// node build.mjs  -> index.html, one self-contained page: three.js, fonts, strings and code inlined, no network.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const { STRINGS } = await import(pathToFileURL(join(HERE, "strings.mjs")).href);
const t = STRINGS.en;
const read = (f) => readFileSync(join(HERE, f), "utf8");

// Phases in build order, with typical duration ranges in months (typical, varies by project).
const PHASES = [
  { id: "site", months: [6, 18], after: [], els: ["zoning", "capacity", "stormPlan", "meetings"] },
  { id: "grade", months: [2, 6], after: ["site"], els: ["clear", "erosion", "ponds", "roads"] },
  { id: "util", months: [12, 36], after: ["site"], els: ["substation", "transmission", "water", "fiber"] },
  { id: "found", months: [2, 5], after: ["grade"], els: ["slab", "pads"] },
  { id: "shell", months: [4, 9], after: ["found"], els: ["panels", "steel", "roof"] },
  { id: "mep", months: [6, 12], after: ["shell"], els: ["switchgear", "ups", "gens", "cooling", "fire"] },
  { id: "fitout", months: [3, 6], after: ["mep"], els: ["racks", "containment", "trays"] },
  { id: "cx", months: [2, 4], after: ["fitout", "util"], els: ["L1", "L2", "L3", "L4", "L5"] },
  { id: "turn", months: [0.5, 1], after: ["cx"], els: ["punch", "handover"] },
];
const mid = Object.fromEntries(PHASES.map((p) => [p.id, (p.months[0] + p.months[1]) / 2]));
const fin = {};
for (const p of PHASES) fin[p.id] = Math.max(0, ...p.after.map((a) => fin[a])) + mid[p.id] + (p.id === "grade" || p.id === "found" ? 0.5 : 0);
const BASE_MONTHS = Math.round(fin.turn);

// three.js r170 as a plain object: drop the module's export clause and return its names.
const threeSrc = read("vendor/three.module.min.js");
const exp = threeSrc.match(/export\{([^}]*)\};?\s*$/);
if (!exp) throw new Error("three.js export clause not found");
const names = exp[1].split(",").map((s) => s.trim().split(/\s+as\s+/)).map(([a, b]) => `${b || a}:${a}`);
const THREE_JS = `const THREE=(()=>{${threeSrc.slice(0, exp.index)}\nreturn {${names.join(",")}};})();\n`;

const font = (file, family) => `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${readFileSync(join(HERE, "vendor/fonts", file)).toString("base64")}) format("woff2");font-weight:100 900;font-display:swap}`;
const FONTS = font("Geist-var.woff2", "Geist") + font("Inter-var.woff2", "Inter");

// Narration: every clip in voice/<lang>/ is inlined as a data URL; captions come from the same lines.
const { lines } = await import(pathToFileURL(join(HERE, "voice-lines.mjs")).href);
const VOICE = {}, CAPTIONS = {};
for (const lang of Object.keys(STRINGS)) {
  const tl = { ...STRINGS.en, ...STRINGS[lang] };
  CAPTIONS[lang] = lines(tl);
  const dir = join(HERE, "voice", lang);
  const man = existsSync(join(dir, "manifest.json")) ? JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) : {};
  VOICE[lang] = {};
  for (const [key, m] of Object.entries(man)) if (CAPTIONS[lang][key] && existsSync(join(dir, m.file))) VOICE[lang][key] = `data:audio/mpeg;base64,${readFileSync(join(dir, m.file)).toString("base64")}`;
}
const clipCount = Object.values(VOICE).reduce((n, v) => n + Object.keys(v).length, 0);

const tx = (key, text) => `<span data-t="${key}">${text}</span>`;
const kpi = (key, label) => `<div class="kpi" data-dash="${key}" data-level="4"><span class="kpi-label">${label}</span><span class="kpi-val">—</span><span class="kpi-word"></span></div>`;

const body = `
<div class="app">
<header class="bar">
  <div class="brand"><span class="brand-name" data-t="gameName">${t.gameName}</span><span class="badge" data-t="badge">${t.badge}</span></div>
  <div class="kpis" aria-label="${t.dashTitle}">${kpi("schedule", tx("dashSchedule", t.dashSchedule))}${kpi("budget", tx("dashBudget", t.dashBudget))}${kpi("safety", tx("dashSafety", t.dashSafety))}${kpi("hood", tx("dashNeighbors", t.dashNeighbors))}</div>
  <div class="bar-btns"><button type="button" class="pill" data-about data-t="about">${t.about}</button><button type="button" class="pill" data-lang hidden>${t.langToggle}</button></div>
</header>
<main class="stage">
  <canvas class="scene" data-scene tabindex="0" aria-label="${t.canvasLabel}"></canvas>
  <p class="nogl">${t.canvasLabel}</p>
  <div class="tag" data-tag hidden aria-hidden="true"></div>
  <p class="caption" data-caption hidden></p>
  <span class="sr" role="status" aria-live="polite" data-status></span>
  <nav class="tabs" role="tablist" aria-label="${t.gameName}">
    <button type="button" role="tab" data-tab="build" aria-selected="true" data-t="tabBuild">${t.tabBuild}</button>
    <button type="button" role="tab" data-tab="plan" aria-selected="false" data-t="tabPlan">${t.tabPlan}</button>
    <button type="button" role="tab" data-tab="hood" aria-selected="false" data-t="tabHood">${t.tabHood}</button>
    <button type="button" role="tab" data-tab="choices" aria-selected="false" data-t="tabChoices">${t.tabChoices}</button>
  </nav>
  <section class="panel p-build" aria-label="${t.tabBuild}"><div data-build></div></section>
  <section class="panel p-side" aria-label="${t.tabHood}">
    <div class="side-tabs" role="tablist"><button type="button" role="tab" data-side-tab="hood" aria-selected="true" data-t="hoodTitle">${t.hoodTitle}</button><button type="button" role="tab" data-side-tab="choices" aria-selected="false" data-t="choicesTitle">${t.choicesTitle}</button></div>
    <div class="side-hood"><ul class="hood" data-hood></ul><p class="hood-detail" data-hood-detail aria-live="polite"></p></div>
    <div class="side-choices"><div class="choices" data-choices></div></div>
    <p class="credit-line"><span data-t="credits">${t.credits}</span> · <span data-t="creditOrg">${t.creditOrg}</span></p>
  </section>
  <section class="panel p-plan" data-plan aria-label="${t.schedTitle}"></section>
  <div class="tools"><button type="button" class="pill pill-dark" data-fx aria-pressed="true">${t.effectsOn}</button><button type="button" class="pill pill-dark" data-voice aria-pressed="true">${t.voiceOn}</button><button type="button" class="pill pill-dark" data-reset data-t="resetView">${t.resetView}</button><span class="hint" data-t="dragHint">${t.dragHint}</span></div>
</main>
</div>
<dialog class="dlg dlg-intro" data-intro aria-labelledby="intro-title">
  <p class="kicker" data-t="introKicker">${t.introKicker}</p>
  <h1 id="intro-title" data-t="introTitle">${t.introTitle}</h1>
  <p class="byline" data-t="credits">${t.credits}</p>
  <p data-t="introBody">${t.introBody}</p>
  <p data-t="introHow">${t.introHow}</p>
  <p class="muted" data-t="keysHint">${t.keysHint}</p>
  <label class="libmode"><input type="checkbox" data-libmode><span><b data-t="libraryMode">${t.libraryMode}</b><br><span class="muted" data-t="libraryModeNote">${t.libraryModeNote}</span></span></label>
  <div class="intro-btns"><button type="button" class="btn btn-big" data-start data-t="start">${t.start}</button><button type="button" class="btn btn-ghost" data-listen>${t.listen}</button></div>
</dialog>
<dialog class="dlg" data-card aria-labelledby="card-title"><p class="kicker" data-t="cardKicker">${t.cardKicker}</p><h2 class="card-title" id="card-title"></h2><p class="card-body"></p><p class="muted" data-t="cardChoose">${t.cardChoose}</p><div class="card-opts"></div></dialog>
<dialog class="dlg" data-end aria-labelledby="end-title"><h2 id="end-title" data-t="endTitle">${t.endTitle}</h2><p data-t="endBody">${t.endBody}</p><h3 data-t="endStats">${t.endStats}</h3><dl class="end-stats"></dl><h3 data-t="endChose">${t.endChose}</h3><ul class="end-chose"></ul><button type="button" class="btn btn-big" data-again data-t="endAgain">${t.endAgain}</button></dialog>
<dialog class="dlg" data-idle aria-labelledby="idle-title"><h2 id="idle-title" data-t="idleTitle">${t.idleTitle}</h2><p class="idle-body"></p><button type="button" class="btn btn-big" data-idle-keep data-t="idleKeep">${t.idleKeep}</button></dialog>
<dialog class="dlg" data-about-dlg aria-labelledby="about-title"><h2 id="about-title" data-t="gameName">${t.gameName}</h2><p class="byline" data-t="credits">${t.credits}</p><p data-t="creditsBody">${t.creditsBody}</p><p data-t="creditsSet">${t.creditsSet}</p><p class="muted"><span data-t="voiceCredit">${t.voiceCredit}</span> three.js r170 (MIT) · Geist and Inter fonts (SIL Open Font License)</p><button type="button" class="btn" data-about-close data-t="close">${t.close}</button></dialog>`;

const LIVE = read("game.js").replace("__DATA__", JSON.stringify({ PHASES, BASE_MONTHS, VOICE, CAPTIONS })).replace("__STRINGS__", JSON.stringify(STRINGS));
const script = (THREE_JS + read("scene.js") + "\n" + LIVE).replace(/<\/(script)/gi, "<\\/$1");
const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${t.pageTitle}</title><style>${FONTS}${read("style.css")}</style></head><body data-tab="build" data-side="hood">${body}<script type="module">${script}</script></body></html>`;
writeFileSync(join(HERE, "index.html"), page);
console.log("wrote index.html", `${(page.length / 1024).toFixed(0)} KB`, `base ${BASE_MONTHS} months`, `${clipCount} voice clips`);
