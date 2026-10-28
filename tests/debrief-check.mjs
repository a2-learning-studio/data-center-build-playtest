// Debrief, About content, About's links by mode and release hygiene (C11, I11, I13, I14, SA-1, report 3.3), what
// the debrief lists and prints (IA-3, DE-6, TW-6, FEU-3, FEU-4, DC-5, ES-2), printing with no debrief open, and the
// class and home results files, saved and opened again on the device (BTC-01, BTC-64), with the end screen narrated
// only for a game played here.
// node tests/debrief-check.mjs   (see drive.mjs for the browser and paths)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, watch, openGame, startGame, finishPhases, axe } from "./drive.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};
function jpegSize(buf) {
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd9 || marker === 0xda) break;
    i += 2 + len;
  }
  return { width: 0, height: 0 };
}

// ---------- the published pages (no browser needed) ----------
for (const file of ["index.html", "build-the-campus-offline.html", "docs/index.html"]) {
  const html = readFileSync(join(ROOT, file), "utf8");
  const script = html.match(/<script type="module">([\s\S]*)<\/script><\/body>/)?.[1] ?? "";
  // The browser hashes the script after the HTML parser turns CRLF into LF.
  const hash = createHash("sha256").update(script.replace(/\r\n?/g, "\n"), "utf8").digest("base64");
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] ?? "";
  check(`${file}: CSP script hash matches the inline script`, csp.includes(`'sha256-${hash}'`) && csp.includes("default-src 'none'"), csp.slice(0, 80));
  check(`${file}: no test hooks`, !/__dc|__idleMs|__voiceRate|@test-hooks/.test(html));
  check(`${file}: referrer, description, Open Graph and favicon carry the age line`,
    html.includes('<meta name="referrer" content="no-referrer">') && /<meta name="description" content="For ages 12 and up/.test(html) && /<meta property="og:description" content="For ages 12 and up/.test(html) && /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/.test(html));
  const pageUrl = file.endsWith("build-the-campus-offline.html")
    ? "https://a2-learning-studio.github.io/data-center-build-playtest/build-the-campus-offline.html"
    : "https://a2-learning-studio.github.io/data-center-build-playtest/";
  const imageUrl = "https://a2-learning-studio.github.io/data-center-build-playtest/social-preview.jpg";
  check(`${file}: link-preview image, size and large Twitter card`,
    html.includes(`<meta property="og:url" content="${pageUrl}">`)
    && html.includes('<meta property="og:type" content="website">')
    && html.includes(`<meta property="og:image" content="${imageUrl}">`)
    && html.includes('<meta property="og:image:width" content="1200">')
    && html.includes('<meta property="og:image:height" content="630">')
    && html.includes('<meta property="og:image:alt" content="The Red Clay Ridge data center campus')
    && html.includes('<meta name="twitter:card" content="summary_large_image">')
    && html.includes(`<meta name="twitter:image" content="${imageUrl}">`)
    && html.includes(`<meta property="og:title" content="Build the Campus`));
  check(`${file}: no Kennesaw State University credit`, !/Kennesaw State University|construction research/i.test(html.replace(/akeyvanf@kennesaw\.edu/g, "")));
  check(`${file}: credits name A2 Learning Studio`, html.includes("A project by A2 Learning Studio") && html.includes("© 2026 A2 Learning Studio") && !html.includes("Ali Keyvanfar"));
}
const edu = readFileSync(join(ROOT, "educator.html"), "utf8");
check("educator sheet is published in docs/ too", edu === readFileSync(join(ROOT, "docs/educator.html"), "utf8"));
check("educator sheet link preview",
  edu.includes('<meta property="og:image" content="https://a2-learning-studio.github.io/data-center-build-playtest/social-preview.jpg">')
  && edu.includes('<meta property="og:image:width" content="1200">')
  && edu.includes('<meta property="og:image:height" content="630">')
  && edu.includes('<meta property="og:url" content="https://a2-learning-studio.github.io/data-center-build-playtest/educator.html">')
  && edu.includes('<meta name="twitter:card" content="summary_large_image">'));
for (const file of ["social-preview.jpg", "docs/social-preview.jpg"]) {
  const buf = readFileSync(join(ROOT, file));
  const size = jpegSize(buf);
  check(`${file}: 1200x630 JPEG under 1 MB`, buf.length < 1024 * 1024 && size.width === 1200 && size.height === 630, `${size.width}x${size.height}, ${buf.length} bytes`);
}
check("educator sheet credit, contact, licence and version", edu.includes("A project by A2 Learning Studio") && !edu.includes("Ali Keyvanfar") && edu.includes("mailto:akeyvanf@kennesaw.edu") && edu.includes("BY-NC 4.0") && edu.includes("Play-test v1.5") && !/Spanish|Español|Kennesaw State/.test(edu));
// The sheet's privacy line says what About's says the game stores (review: it had a kiosk keep settings): nothing on a
// kiosk; in class and home modes the four settings, the game and its timed steps, and results files only if downloaded.
const eduPrivacy = edu.match(/<p><b>Privacy:<\/b>([^<]*)<\/p>/)?.[1] || "";
check("educator sheet privacy line matches what the game stores",
  ["A kiosk stores nothing.", "Class and home modes keep the voice, Library mode, presenter and shortcut settings", "timed steps until the tab closes", "results files only if downloaded"].every((w) => eduPrivacy.includes(w)),
  eduPrivacy);
// A printed or forwarded sheet still leads to the game, in class mode too; the offline copy gives the sheet's address.
const SITE = "https://a2-learning-studio.github.io/data-center-build-playtest/";
check("educator sheet prints the game and class-mode addresses",
  edu.includes(`href="${SITE}">a2-learning-studio.github.io/data-center-build-playtest/</a>`)
  && edu.includes(`href="${SITE}?mode=class">a2-learning-studio.github.io/data-center-build-playtest/?mode=class</a>`)
  && edu.includes("English only for now"));
const offlinePage = readFileSync(join(ROOT, "build-the-campus-offline.html"), "utf8");
check("offline About gives the educator sheet's full address", offlinePage.includes(`data-t="educatorNoteOffline">`) && new RegExp(`data-t="educatorNoteOffline">[^<]*${SITE.replace(/[./]/g, "\\$&")}educator\\.html`).test(offlinePage));
const cfg = readFileSync(join(ROOT, "_config.yml"), "utf8");
check("tests/ and the test build are kept out of GitHub Pages", /^\s+- tests$/m.test(cfg) && /^\s+- index\.test\.html$/m.test(cfg));
// LICENSE and LICENSE-CONTENT point to the third-party licence texts, so the site publishes those two files.
check("the vendor licence texts are published, the vendor code and fonts are not",
  !/^\s+- vendor\/?$/m.test(cfg) && !/^\s+- vendor\/(three-LICENSE\.txt|fonts\/?$|fonts\/LICENSE\.txt)/m.test(cfg)
  && ["vendor/three.module.min.js", "vendor/fonts/Geist-var.woff2", "vendor/fonts/Inter-var.woff2"].every((f) => new RegExp(`^\\s+- ${f.replace(/\./g, "\\.")}$`, "m").test(cfg)));
const fontLicence = readFileSync(join(ROOT, "vendor/fonts/LICENSE.txt"), "utf8");
check("font licence carries both fonts' own notices", fontLicence.includes("Copyright 2024 The Geist Project Authors") && fontLicence.includes("Copyright 2016 The Inter Project Authors") && fontLicence.includes("SIL OPEN FONT LICENSE Version 1.1"));

// ---------- the debrief in the browser ----------
const browser = await launch();
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
await ctx.addInitScript(() => addEventListener("securitypolicyviolation", (e) => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
const p = await ctx.newPage();
watch(p, errors);
await openGame(p);
const about = await p.evaluate(() => {
  const d = document.querySelector("[data-about-dlg]");
  return {
    gloss: d.querySelectorAll(".gloss dt").length,
    terms: [...d.querySelectorAll(".gloss dt")].map((n) => n.textContent).join("|"),
    licence: d.querySelector("[data-t=licences]")?.textContent || "",
    credit: d.querySelector(".byline")?.textContent || "",
    voice: d.querySelector("[data-t=voiceCredit]")?.textContent || "",
    sources: d.querySelectorAll(".sources li").length,
    sourcesTitle: d.querySelector("[data-t=sourcesTitle]")?.textContent || "",
    help: d.querySelector("[data-t=scoreHelp]")?.textContent || "",
    privacy: d.querySelector("[data-t=privacy]")?.textContent || "",
    lang: !document.querySelector("[data-lang]").hidden,
    footer: getComputedStyle(document.querySelector(".foot")).display !== "none" && document.querySelector(".foot").textContent,
  };
});
// About's ways out of the game (SA-1, PC-2): class and home modes link them; a kiosk, the offline kiosk file included,
// prints the addresses as plain text and has no link at all.
const exits = (pg) => pg.evaluate(() => {
  const d = document.querySelector("[data-about-dlg]");
  const links = [...d.querySelectorAll("a")].map((a) => ({ href: a.getAttribute("href"), target: a.getAttribute("target"), rel: a.getAttribute("rel") || "", download: a.hasAttribute("download"), text: a.textContent }));
  return { links, text: d.textContent };
});
const { STRINGS } = await import(pathToFileURL(join(ROOT, "strings.mjs")).href);
const urls = STRINGS.en.sources.map((s) => s.url);
const kiosk = await exits(p);
check("kiosk About: no links; contact, educator sheet, offline file and sources printed", kiosk.links.length === 0 && ["akeyvanf@kennesaw.edu", `${SITE}educator.html`, `${SITE}build-the-campus-offline.html`, ...urls].every((u) => kiosk.text.includes(u)), JSON.stringify(kiosk.links));
const cp = await ctx.newPage();
watch(cp, errors);
await openGame(cp, "?mode=class");
const staffed = await exits(cp);
await cp.close();
const linked = (f) => staffed.links.some(f);
check("class About: sources open apart from the game, the offline file downloads", urls.every((u) => linked((l) => l.href === u && l.target === "_blank" && /noopener/.test(l.rel))) && linked((l) => l.href === "build-the-campus-offline.html" && l.download), JSON.stringify(staffed.links.map((l) => l.href)));
const op = await ctx.newPage();
watch(op, errors);
await op.goto(pathToFileURL(join(ROOT, "build-the-campus-offline.html")).href, { waitUntil: "domcontentloaded", timeout: 120000 });
await op.waitForTimeout(300);
const offline = await exits(op);
const offlineFiles = await op.evaluate(() => document.querySelectorAll("[data-staffed-only], [data-open-file], [data-file-input], [data-save-file], [data-save-csv]").length);
await op.close();
check("offline kiosk: no results-file buttons", offlineFiles === 0, String(offlineFiles));
check("offline kiosk About: no links; contact and sources printed", offline.links.length === 0 && ["akeyvanf@kennesaw.edu", ...urls].every((u) => offline.text.includes(u)), JSON.stringify(offline.links));
check("About: Words to know, starting with what a data center is", about.gloss >= 15 && /^Data center\|CM/.test(about.terms) && /CM \(construction manager\)/.test(about.terms) && /MEP/.test(about.terms) && /UPS/.test(about.terms), `${about.gloss} terms`);
check("About: educator sheet link", linked((l) => l.href === "educator.html" && l.target === "_blank" && /educator sheet/.test(l.text)));
check("About: one licence line", /MIT License/.test(about.licence) && /BY-NC 4\.0/.test(about.licence) && /ElevenLabs Impact Program/.test(about.licence));
check("About and footer credit", about.credit === "A project by A2 Learning Studio" && about.footer === "A project by A2 Learning Studio" && /© 2026 A2 Learning Studio/.test(about.licence) && !/Ali Keyvanfar/.test(about.licence));
check("About: narration credit", about.voice === "Narration recorded in advance with ElevenLabs (Impact Program); the game contacts no service while you play.");
// BTC-64: the subject names the build, and the link carries nothing else.
check("About: mailto contact naming the build, and dated sources", linked((l) => l.href === "mailto:akeyvanf@kennesaw.edu?subject=Build%20the%20Campus%20Play-test%20v1.5") && about.sources >= 7 && about.sourcesTitle === "Sources (as of October 2026)");
check("About: score help quotes the model's numbers", /0\.3% for every month/.test(about.help) && /103% of plan/.test(about.help) && /45-month plan/.test(about.help) && !/\{\w+\}/.test(about.help), about.help.slice(0, 60));
check("no language button while Spanish is empty", !about.lang);
// Everything the browser keeps (game.js prefs and the class/home save) is named in the privacy line.
// BTC-01: and the class/home results files: what they hold, that they stay on the device, and that a kiosk has none.
check("About: privacy names every remembered setting and the results files", ["Library mode", "presenter view", "shortcut", "voice setting", "game in progress", "list of its steps", "choices, scores and steps", "no name", "Open results file", "without sending it anywhere", "kiosk offers neither"].every((w) => about.privacy.includes(w)), about.privacy);

// A run with costly answers: wait for the final design, keep grading in the rain, overtime for electricians.
await p.evaluate(() => {
  document.querySelector("[data-start]").click();
  const s = window.__dc.state();
  s.cards.weather = "b";
  s.cards.longlead = "b";
  s.cards.labor = "a";
  window.__dc.all({ route: "b", hours: "a", buffer: "a", wall: "b", cool: "a", light: "a", test: "a" });
  window.print = () => { window.__printed = (window.__printed || 0) + 1; };
});
await p.evaluate(() => document.querySelector("[data-build] [data-finish]").click());
await p.waitForTimeout(400);
const end = await p.evaluate(() => {
  const d = document.querySelector("[data-end]");
  return {
    open: d.open,
    stats: [...d.querySelectorAll(".end-stats > div")].map((n) => n.innerText.replace(/\s+/g, " ").trim()),
    costly: [...d.querySelectorAll(".end-costly li")].map((n) => n.innerText.replace(/\s+/g, " ").trim()),
    chose: [...d.querySelectorAll(".end-chose li")].map((n) => n.innerText.replace(/\s+/g, " ").trim()),
    luck: d.querySelector("[data-end-luck]")?.textContent ?? "",
    typed: d.querySelectorAll("input, textarea, select, [contenteditable]").length,
    talk: d.querySelectorAll(".end-talk li").length,
    print: !!d.querySelector("[data-print]"),
    scores: window.__dc.scores(),
  };
});
check("end screen opens", end.open);
check("results against the plan, with rating words", end.stats.length === 4 && /Plan: 45 months/.test(end.stats[0]) && /(Strong|Good|Fair|Watch|Concern)/.test(end.stats[0]) && /held for surprises/.test(end.stats[1]) && /Started at 82/.test(end.stats[2]) && /Started at 35/.test(end.stats[3]), JSON.stringify(end.stats));
// Weather b: +1 mo, +1.3%, −12 safety, −10 neighbors; long-lead b: +4 mo here and +1.2%; labor a: +1.5%, −8, −8.
// IA-3, DE-6: every question has to be answered, so each answer is compared with the best other answer to it. TW-6:
// the effects are in words, and a title is joined to its answer with a dash, never a second colon.
check("three costliest answers, in order, each against the best other answer", end.costly.length === 3
  && /^Weather: a week of heavy rain — Keep grading through the rain Compared with “Pause earthwork and stabilize slopes”: Finish 0\.5 months later · Budget [\d.]+% more · Safety 12 points worse · Neighbor relations 16 points worse$/.test(end.costly[0])
  && /^Long-lead equipment: transformers & switchgear — Wait for the final design Compared with “Order now, before the design is final”: Finish 4 months later · Budget [\d.]+% more$/.test(end.costly[1])
  && /^Truck route — Shortest route Compared with “Highway route”: Budget 0\.2% less · Neighbor relations 20 points worse$/.test(end.costly[2]), JSON.stringify(end.costly));
check("effects in words, no plus or minus signs, no double colons", end.costly.every((x) => !/[+−]\d/.test(x)) && [...end.costly, ...end.chose].every((x) => / — /.test(x) && (x.split(" — ")[0].match(/:/g) || []).length <= 1), JSON.stringify(end.chose));
check("good-neighbor choices that cost a little are not listed as costly", !end.costly.some((x) => /^(Buffer|Truck & work hours|Night lighting)/.test(x)));
// FEU-4: setback cards are drawn by chance, and the debrief says how many were.
check("the debrief says how many setbacks were drawn, and that they are chance", end.luck === "Setbacks drawn: 0 of 6. Setback cards are drawn by chance, so compare choices, not only ratings.", end.luck);
check("nothing on the debrief is typed or stored", end.typed === 0);
check("three questions to talk over", end.talk === 3);
await p.evaluate(() => document.querySelector("[data-print]").click());
check("Print button calls print", (await p.evaluate(() => window.__printed)) === 1);
await p.emulateMedia({ media: "print" });
const pr = await p.evaluate(() => ({
  app: getComputedStyle(document.querySelector(".app")).display,
  end: getComputedStyle(document.querySelector("[data-end]")).display,
  foot: getComputedStyle(document.querySelector("[data-end] .dlg-foot")).display,
  head: getComputedStyle(document.querySelector(".print-head")).display,
  name: [getComputedStyle(document.querySelector(".print-name")).display, document.querySelector(".print-name").textContent],
  lines: [...document.querySelectorAll("[data-end] .end-talk .print-lines")].filter((n) => n.getBoundingClientRect().height > 20).length,
  date: document.querySelector("[data-print-date]").textContent,
  paper: document.querySelector(".print-foot").innerText.replace(/\s+/g, " "),
}));
check("print shows only the debrief", pr.app === "none" && pr.end !== "none" && pr.foot === "none" && pr.head !== "none", JSON.stringify(pr));
// DC-5, ES-2, FEU-3: the paper gives the date, the web address and what the numbers are, a name line and lines to
// answer on, all written by hand; none of them is on the screen.
check("the printed debrief has the date, the address, the made-up-site line, a name line and answer lines",
  /^Printed [A-Z][a-z]+ \d{1,2}, \d{4}\.$/.test(pr.date) && pr.paper.includes("a2-learning-studio.github.io/data-center-build-playtest/")
  && pr.paper.includes("Made-up site; costs, delays and scores are simplified game values; facts as of October 2026.") && pr.paper.includes("A project by A2 Learning Studio · akeyvanf@kennesaw.edu")
  && pr.name[0] !== "none" && pr.name[1] === "Name or team:" && pr.lines === 3, JSON.stringify(pr));
await p.emulateMedia({ media: "screen" });
check("the print-only lines stay off the screen", await p.evaluate(() => [".print-head", ".print-foot", ".print-lines"].every((sel) => getComputedStyle(document.querySelector(sel)).display === "none")));
// Budget: time costs money now (I11), and good-neighbor choices cost tenths of a percent.
const money = await p.evaluate(() => {
  const s = window.__dc.state();
  const at = (c, v) => { const old = s.choice[c]; s.choice[c] = v; const b = window.__dc.scores().budget; s.choice[c] = old; return b; };
  return { lightA: at("light", "a") - at("light", "b"), routeA: at("route", "a") - at("route", "b") };
});
check("shielded lighting costs the same as standard; the highway route costs a few tenths", Math.abs(money.lightA) < 1e-9 && money.routeA > 0 && money.routeA < 0.5, JSON.stringify(money));
// BTC-01: a kiosk has no results-file buttons and keeps no steps, in memory or in storage.
const kioskEnd = await p.evaluate(() => ({
  controls: document.querySelectorAll("[data-staffed-only], [data-open-file], [data-file-input], [data-save-file], [data-save-csv], [data-end-close]").length,
  steps: window.__dc.state().steps.length,
  t0: window.__dc.state().t0,
  stored: localStorage.length + sessionStorage.length,
}));
check("kiosk: no results-file buttons, no steps kept, nothing stored", kioskEnd.controls === 0 && kioskEnd.steps === 0 && kioskEnd.t0 === 0 && kioskEnd.stored === 0, JSON.stringify(kioskEnd));
// Printing with no end screen open prints a short note: never the last player's summary, never an empty one. The
// print rules show only an open end screen, and starting over empties it.
const printed = (pg) => pg.evaluate(() => ({
  app: getComputedStyle(document.querySelector(".app")).display,
  end: getComputedStyle(document.querySelector("[data-end]")).display,
  note: getComputedStyle(document.querySelector(".print-empty")).display,
  noteText: document.querySelector(".print-empty").innerText.replace(/\s+/g, " ").trim(),
  left: [...["stats", "costly", "chose", "talk"].map((k) => document.querySelector(`[data-end] .end-${k}`).children.length), document.querySelector("[data-end-luck]").textContent.length, document.querySelector("[data-print-date]").textContent.length].join(","),
}));
const NOTE = "Build the Campus · Play-test v1.5 The summary prints from the end screen, once a game is finished. a2-learning-studio.github.io/data-center-build-playtest/";
const blankPaper = (x) => x.app === "none" && x.end === "none" && x.note !== "none" && x.noteText === NOTE && x.left === "0,0,0,0,0,0";
await p.emulateMedia({ media: "print" });
const withEnd = await printed(p);
await p.emulateMedia({ media: "screen" });
check("with the end screen open, the note stays off the paper", withEnd.end !== "none" && withEnd.note === "none", JSON.stringify(withEnd));
await p.evaluate(() => document.querySelector("[data-again]").click());
await p.waitForTimeout(200);
await p.emulateMedia({ media: "print" });
const afterAgain = await printed(p);
await p.emulateMedia({ media: "screen" });
await p.evaluate(() => { document.querySelector("[data-start]").click(); window.__dc.upTo("grade", { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a" }); });
await p.waitForTimeout(200);
await p.emulateMedia({ media: "print" });
const midGame = await printed(p);
const notePages = +((await p.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1").match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/)?.[1] ?? 0);
await p.emulateMedia({ media: "screen" });
// Done with this page. Left open mid-game it kept drawing its map for the rest of the run: a headless page is never
// hidden, so the game's loop never paused as it does in a background tab, and every later page shared the one
// software GPU with it. On a slow runner that held the resumed game's first frames, and the click on Resume, past 30 s.
await p.close();
check("after Play again and mid-game, print gives the note on one page, and the last summary is emptied", blankPaper(afterAgain) && blankPaper(midGame) && notePages === 1, JSON.stringify({ afterAgain, midGame, notePages }));
// IA-3, DE-6: the textbook answers (order long-lead equipment early, a wide buffer, daytime hours) are never listed as
// costly. With the best answer to every question, two setbacks drawn, nothing is.
const debrief = async (cards, choices) => {
  const q = await ctx.newPage();
  watch(q, errors);
  await openGame(q);
  await q.evaluate(([cards, choices]) => {
    document.querySelector("[data-start]").click();
    Object.assign(window.__dc.state().cards, cards);
    window.__dc.all(choices);
  }, [cards, choices]);
  await q.evaluate(() => document.querySelector("[data-build] [data-finish]").click());
  await q.waitForTimeout(400);
  return q;
};
{
  const q = await debrief({ weather: "a", longlead: "a", labor: "c", heat: "a", haul: "b" }, { route: "a", hours: "a", buffer: "a", wall: "a", cool: "a", light: "a", test: "a" });
  const best = await q.evaluate(() => ({ costly: [...document.querySelectorAll("[data-end] .end-costly li")].map((n) => n.innerText), luck: document.querySelector("[data-end-luck]").textContent }));
  check("the best answer to every question is never listed as costly", best.costly.length === 1 && best.costly[0] === "Each of your answers was the best on balance for its question." && /^Setbacks drawn: 2 of 6\./.test(best.luck), JSON.stringify(best));
  await q.close();
}
// The longest debrief (every setback drawn, three answers whose effects take two lines) still prints on one US Letter
// page, with 2% to spare, as it did before the print-only lines were added (FEU-3).
{
  const q = await debrief({ weather: "b", longlead: "a", labor: "a", heat: "b", haul: "b", inspect: "b", nearmiss: "b", supply: "b", retest: "b" }, { route: "a", hours: "b", buffer: "b", wall: "b", cool: "b", light: "b", test: "b" });
  const pages = async (scale) => +((await q.pdf({ preferCSSPageSize: true, printBackground: true, scale })).toString("latin1").match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/)?.[1] ?? 0);
  const one = await pages(1), spare = await pages(1.02);
  check("the longest debrief prints on one US Letter page, with room to spare", one === 1 && spare === 1, JSON.stringify({ one, spare }));
  // Opened from a results file (BTC-01), the same debrief has one more line saying so; it still fits.
  await q.evaluate(() => { const from = document.querySelector("[data-end-from]"); from.textContent = "From a results file saved September 30, 2026 at 12:45 PM (Play-test v1.5). Read only."; from.hidden = false; });
  const fileOne = await pages(1), fileSpare = await pages(1.02);
  check("and with the results-file line, still on one page", fileOne === 1 && fileSpare === 1, JSON.stringify({ fileOne, fileSpare }));
  await q.close();
}
// BTC-01: in class mode, Save results file downloads the run as JSON to this device and Save as CSV one spreadsheet
// row; Open results file on the intro reads one back here and shows the same debrief, read only; a wrong or damaged
// file gets one line instead. Nothing is uploaded, and the file holds no name.
const SAVE_KEY = "build-the-campus:v1:save";
const endView = (pg) => pg.evaluate(() => {
  const d = document.querySelector("[data-end]");
  const text = (sel) => [...d.querySelectorAll(sel)].map((n) => n.innerText.replace(/\s+/g, " ").trim());
  return {
    open: d.open,
    intro: document.querySelector("[data-intro]").open,
    stats: text(".end-stats > div"),
    costly: text(".end-costly li"),
    chose: text(".end-chose li"),
    luck: d.querySelector("[data-end-luck]").textContent,
    from: d.querySelector("[data-end-from]").hidden ? "" : d.querySelector("[data-end-from]").textContent,
    buttons: [...d.querySelectorAll(".end-btns button")].filter((b) => !b.hidden).map((b) => b.dataset.t).join(","),
    focus: document.activeElement?.id || document.activeElement?.dataset?.t || "",
  };
});
const openFile = async (pg, files) => {
  const [chooser] = await Promise.all([pg.waitForEvent("filechooser"), pg.locator("[data-open-file]").click()]);
  await chooser.setFiles(files);
  await pg.waitForTimeout(400);
};
const fileMsg = (pg) => pg.evaluate(() => {
  const m = document.querySelector("[data-file-bad]");
  const r = m.getBoundingClientRect();
  // Seen: not under the intro's pinned buttons.
  const seen = !m.hidden && m.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  return { end: document.querySelector("[data-end]").open, shown: seen, text: m.textContent, role: m.getAttribute("role") };
});
const csvRows = (csv) => csv.replace(/^﻿/, "").trim().split("\r\n").map((r) => r.slice(1, -1).split('","'));
const cpage = await ctx.newPage();
watch(cpage, errors);
await openGame(cpage, "?mode=class");
await cpage.emulateMedia({ media: "print" });
const before = await printed(cpage);
await cpage.emulateMedia({ media: "screen" });
check("before any game, print gives the note, not an empty summary", blankPaper(before), JSON.stringify(before));
// Every narration caption shown, so the end screen's line can be counted: once for a game played here, never for a
// results file opened on the intro (its debrief is read only).
await cpage.evaluate(() => { window.__caps = []; const c = document.querySelector("[data-caption]"); new MutationObserver(() => window.__caps.push(c.textContent)).observe(c, { childList: true, characterData: true, subtree: true }); });
const endSaid = (pg) => pg.evaluate(() => {
  const line = `${document.getElementById("end-title").textContent}. ${document.getElementById("end-body").textContent}`;
  return { end: window.__caps.filter((x) => x === line).length, all: window.__caps.length, voice: document.querySelector("[data-voice]").getAttribute("aria-pressed") };
});
// A few real steps (the first phase and its questions), then the rest of the game at once.
await startGame(cpage);
await finishPhases(cpage, ["site"]);
await cpage.evaluate(() => {
  Object.assign(window.__dc.state().cards, { weather: "b", longlead: "b", labor: "a" });
  window.__dc.all({ route: "b", hours: "a", buffer: "a", wall: "b", cool: "a", light: "a", test: "a" });
});
await cpage.evaluate(() => document.querySelector("[data-build] [data-finish]").click());
await cpage.waitForTimeout(400);
const shown = await endView(cpage);
const liveSaid = await endSaid(cpage);
check("a game played here: the end screen's line is narrated once", liveSaid.voice === "true" && liveSaid.end === 1, JSON.stringify(liveSaid));
const game = await cpage.evaluate(() => ({ scores: window.__dc.scores(), steps: window.__dc.state().steps.length }));
const kept = await cpage.evaluate((k) => JSON.parse(sessionStorage.getItem(k)), SAVE_KEY);
const [dl] = await Promise.all([cpage.waitForEvent("download"), cpage.locator("[data-save-file]").click()]);
const jsonPath = await dl.path();
const jsonText = readFileSync(jsonPath, "utf8");
const rec = JSON.parse(jsonText);
await cpage.waitForTimeout(150);
const said = await cpage.evaluate(() => document.querySelector("[data-alert-end]").textContent);
check("class end screen: Save results file and Save as CSV beside Print and Play again", shown.open && shown.buttons === "endPrint,endSaveFile,endSaveCsv,endAgain", shown.buttons);
check("the results file is named for the game and the time it was saved", /^build-the-campus-results-\d{4}-\d{2}-\d{2}-\d{4}\.json$/.test(dl.suggestedFilename()) && said === `Saved ${dl.suggestedFilename()} to this device.`, `${dl.suggestedFilename()} | ${said}`);
check("the results file holds exactly the record's fields, and no name", JSON.stringify(Object.keys(rec)) === JSON.stringify(["format", "version", "build", "badge", "mode", "lang", "saved", "started", "results", "setbacks", "choices", "cards", "costliest", "steps"]) && !/Name or team/.test(jsonText), Object.keys(rec).join(","));
check("format, version, build, mode and times", rec.format === "build-the-campus-results" && rec.version === 1 && rec.build === kept?.build && rec.badge === "Play-test v1.5" && rec.mode === "class" && rec.lang === "en"
  && Date.parse(rec.started) <= Date.parse(rec.saved) && Math.abs(Date.now() - Date.parse(rec.saved)) < 120000, JSON.stringify({ build: rec.build, kept: kept?.build, saved: rec.saved, started: rec.started }));
const s = game.scores;
check("the final numbers and ratings, as the end screen shows them", rec.results.map((r) => r.id).join(",") === "schedule,budget,safety,neighbors"
  && rec.results[0].number === s.months && rec.results[1].number === s.budget && rec.results[2].number === s.safety && rec.results[3].number === s.hood
  && rec.results.every((r, i) => shown.stats[i].includes(r.value) && shown.stats[i].includes(r.rating) && shown.stats[i].includes(r.plan)), JSON.stringify(rec.results));
check("every choice and card answer, and the setbacks drawn", rec.choices.length === 7 && rec.choices.find((c) => c.id === "route")?.answer === "b" && rec.choices.find((c) => c.id === "route")?.label === "Shortest route"
  && rec.cards.find((c) => c.id === "weather")?.answer === "b" && rec.cards.find((c) => c.id === "longlead")?.answer === "b" && rec.cards.find((c) => c.id === "labor")?.answer === "a"
  && rec.setbacks.of === 6 && rec.setbacks.drawn.every((id) => rec.cards.some((c) => c.id === id && c.setback)) && rec.setbacks.note === shown.luck
  && JSON.stringify([...rec.choices, ...rec.cards].map((x) => `${x.name} — ${x.label}`)) === JSON.stringify(shown.chose), JSON.stringify({ choices: rec.choices.length, cards: rec.cards, setbacks: rec.setbacks }));
check("what cost the most, with its effects in words", rec.costliest.length === shown.costly.length && rec.costliest.every((x, i) => shown.costly[i] === `${x.name} — ${x.label} Compared with “${x.vsLabel}”: ${x.effect}`), JSON.stringify(rec.costliest.map((x) => x.name)));
const kinds = rec.steps.map((x) => x.step);
check("timed steps from the first phase to the finish, also kept in the class save", rec.steps.length === game.steps && rec.steps.length > 5 && JSON.stringify(rec.steps[0]) === '{"t":0,"step":"phase","id":"site"}'
  && ["place", "choice", "done"].every((k) => kinds.includes(k)) && kinds.at(-1) === "end" && rec.steps.at(-2).step === "done" && rec.steps.at(-2).id === "turn"
  && rec.steps.every((x, i) => Number.isInteger(x.t) && x.t >= (rec.steps[i - 1]?.t ?? 0)) && kept?.state?.steps?.length === rec.steps.length, JSON.stringify(rec.steps.slice(0, 4)));
const stores = await cpage.evaluate(() => ({ session: Object.keys(sessionStorage), local: Object.keys(localStorage) }));
check("class mode adds no storage: only the game this tab keeps", JSON.stringify(stores.session) === JSON.stringify([SAVE_KEY]) && stores.local.every((k) => k === "build-the-campus:v1:prefs"), JSON.stringify(stores));
const [dc] = await Promise.all([cpage.waitForEvent("download"), cpage.locator("[data-save-csv]").click()]);
const csv = readFileSync(await dc.path(), "utf8");
const rows = csvRows(csv);
const col = (name) => rows[1]?.[rows[0].indexOf(name)];
check("Save as CSV: a header row and one row of values, for a spreadsheet", /^build-the-campus-results-\d{4}-\d{2}-\d{2}-\d{4}\.csv$/.test(dc.suggestedFilename()) && csv.startsWith("﻿") && rows.length === 2 && rows[0].length === rows[1].length
  && col("Mode") === "class" && col("Version") === "Play-test v1.5" && col("Schedule (months)") === String(s.months) && col("Budget (% of plan)") === String(s.budget) && col("Neighbor relations: rating") === rec.results[3].rating
  && col("Truck route") === "Shortest route" && col("Weather: a week of heavy rain") === rec.cards.find((c) => c.id === "weather").label && col("Steps") === String(rec.steps.length), JSON.stringify(rows));
// Play again (it asks first), then open the file on the intro.
await cpage.evaluate(() => document.querySelector("[data-again]").click());
await cpage.evaluate(() => document.querySelector("[data-confirm-yes]").click());
await cpage.waitForTimeout(300);
await cpage.evaluate(() => { window.__caps = []; });
await openFile(cpage, jsonPath);
const fromFile = await endView(cpage);
const fileSaid = await endSaid(cpage);
check("a results file: nothing is narrated, the end screen's line included", fileSaid.voice === "true" && fileSaid.all === 0, JSON.stringify(fileSaid));
check("Open results file shows the same debrief, read only, with the file's date and version", fromFile.open && fromFile.intro
  && JSON.stringify([fromFile.stats, fromFile.costly, fromFile.chose, fromFile.luck]) === JSON.stringify([shown.stats, shown.costly, shown.chose, shown.luck])
  && /^From a results file saved .+ \(Play-test v1\.5\)\. Read only\.$/.test(fromFile.from) && fromFile.buttons === "endPrint,close" && fromFile.focus === "end-title", JSON.stringify(fromFile));
check("axe: a results file's debrief", (await axe(cpage, "results file debrief")).length === 0);
await cpage.emulateMedia({ media: "print" });
const filePaper = await cpage.evaluate(() => ({ end: getComputedStyle(document.querySelector("[data-end]")).display, from: getComputedStyle(document.querySelector("[data-end-from]")).display, note: getComputedStyle(document.querySelector(".print-empty")).display }));
await cpage.emulateMedia({ media: "screen" });
check("a results file's debrief prints, labelled as from the file", filePaper.end !== "none" && filePaper.from !== "none" && filePaper.note === "none", JSON.stringify(filePaper));
await cpage.locator("[data-end-close]").click();
await cpage.waitForTimeout(200);
const closed = await cpage.evaluate(() => ({ end: document.querySelector("[data-end]").open, intro: document.querySelector("[data-intro]").open, left: document.querySelector("[data-end] .end-chose").children.length, focus: document.activeElement.matches("[data-open-file]") }));
check("Close goes back to the intro and empties the debrief", !closed.end && closed.intro && closed.left === 0 && closed.focus, JSON.stringify(closed));
// Wrong or damaged files: one line on the intro, nothing opened. A file's words are text, never markup.
await openFile(cpage, { name: "cut.json", mimeType: "application/json", buffer: Buffer.from(jsonText.slice(0, jsonText.length >> 1)) });
const cut = await fileMsg(cpage);
await openFile(cpage, { name: "other.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
const other = await fileMsg(cpage);
await openFile(cpage, { name: "edited.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...rec, results: rec.results.slice(1) })) });
const edited = await fileMsg(cpage);
await openFile(cpage, { name: "later.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ ...rec, version: 2 })) });
const later = await fileMsg(cpage);
const BAD = "That file is not a Build the Campus results file, or it is damaged.";
check("a damaged, foreign or edited file gives one line and opens nothing", [cut, other, edited].every((m) => !m.end && m.shown && m.text === BAD && m.role === "alert"), JSON.stringify({ cut, other, edited }));
check("a file from another version says so", !later.end && later.shown && later.text === "That results file comes from another version of the game, so it cannot be opened here.", JSON.stringify(later));
check("axe: the intro with the file message", (await axe(cpage, "class intro, file message")).length === 0);
const tricky = structuredClone(rec);
tricky.choices[0].label = '<img src="x" onerror="window.__xss=1">';
await openFile(cpage, { name: "tricky.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(tricky)) });
const shownTricky = await cpage.evaluate(() => ({ end: document.querySelector("[data-end]").open, img: document.querySelectorAll("[data-end] img").length, text: document.querySelector("[data-end] .end-chose li").textContent, xss: window.__xss, msg: document.querySelector("[data-file-bad]").hidden }));
check("a file's words show as text, never as markup, and a good file clears the message", shownTricky.end && shownTricky.img === 0 && shownTricky.text.endsWith('<img src="x" onerror="window.__xss=1">') && shownTricky.xss === undefined && shownTricky.msg, JSON.stringify(shownTricky));
await cpage.close();
// The published pages, with no test hooks and under their own Content-Security-Policy: the class game kept in the tab
// resumes at its end screen, saves its results file (a blob: download) and opens it again (FileReader).
for (const file of ["build-the-campus-offline.html", "index.html"]) {
  const pg = await ctx.newPage();
  watch(pg, errors);
  await pg.addInitScript(([k, v]) => sessionStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(kept)]);
  await pg.goto(`${pathToFileURL(join(ROOT, file)).href}?mode=class`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(300);
  await pg.locator("[data-resume]").click();
  await pg.waitForTimeout(400);
  const end = await endView(pg);
  const [d] = await Promise.all([pg.waitForEvent("download"), pg.locator("[data-save-file]").click()]);
  const path = await d.path();
  const r = JSON.parse(readFileSync(path, "utf8"));
  check(`${file}: a resumed class game saves its results file`, end.open && r.format === rec.format && r.version === rec.version && r.build === rec.build
    && JSON.stringify([r.results, r.choices, r.cards, r.costliest]) === JSON.stringify([rec.results, rec.choices, rec.cards, rec.costliest]) && r.steps.length === rec.steps.length + 1 && r.steps.at(-1).step === "resume", JSON.stringify({ open: end.open, steps: r.steps.length }));
  await pg.evaluate(() => document.querySelector("[data-again]").click());
  await pg.evaluate(() => document.querySelector("[data-confirm-yes]").click());
  await pg.waitForTimeout(300);
  await openFile(pg, path);
  const back = await endView(pg);
  check(`${file}: and opens it again, the same debrief`, back.open && back.from !== "" && JSON.stringify([back.stats, back.costly, back.chose]) === JSON.stringify([shown.stats, shown.costly, shown.chose]), JSON.stringify(back.stats));
  await pg.close();
}
// The educator sheet prints on one US Letter page (C11), with 2% to spare for other systems' font rendering.
{
  const sheet = await ctx.newPage();
  watch(sheet, errors);
  await sheet.goto(pathToFileURL(join(ROOT, "educator.html")).href);
  const printed = async (scale) => {
    const pdf = (await sheet.pdf({ preferCSSPageSize: true, printBackground: true, scale })).toString("latin1");
    const boxes = pdf.match(/\/MediaBox\s*\[[^\]]*\]/g) || [];
    return { pages: +(pdf.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/)?.[1] ?? 0), letter: boxes.length > 0 && boxes.every((b) => /\[\s*0 0 612 792\s*\]/.test(b)) };
  };
  const one = await printed(1), spare = await printed(1.02);
  check("educator sheet prints on one US Letter page, with room to spare", one.pages === 1 && one.letter && spare.pages === 1, JSON.stringify({ one, spare }));
  await sheet.close();
}
await ctx.close();
await browser.close();
for (const e of errors) console.log("  console: " + e);
if (failed || errors.length) { console.log(`debrief-check: ${failed} failed, ${errors.length} console error(s)`); process.exit(1); }
console.log("debrief-check ok");
