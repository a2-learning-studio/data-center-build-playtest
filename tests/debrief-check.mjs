// Debrief, About content and release hygiene (C11, I11, I13, I14, report 3.3).
// node tests/debrief-check.mjs   (see drive.mjs for the browser and paths)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, watch, openGame } from "./drive.mjs";

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
check("educator sheet credit, contact, licence and version", edu.includes("A personal project by Ali Keyvanfar, Ph.D.") && edu.includes("mailto:akeyvanf@kennesaw.edu") && edu.includes("BY-NC 4.0") && edu.includes("Play-test v1.5") && !/Spanish|Español|Kennesaw State/.test(edu));
const cfg = readFileSync(join(ROOT, "_config.yml"), "utf8");
check("tests/ and the test build are kept out of GitHub Pages", /^\s+- tests$/m.test(cfg) && /^\s+- index\.test\.html$/m.test(cfg));

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
    educator: d.querySelector('a[href="educator.html"]')?.textContent || "",
    licence: d.querySelector("[data-t=licences]")?.textContent || "",
    credit: d.querySelector(".byline")?.textContent || "",
    voice: d.querySelector("[data-t=voiceCredit]")?.textContent || "",
    mail: d.querySelector('a[href="mailto:akeyvanf@kennesaw.edu"]') !== null,
    sources: d.querySelectorAll(".sources li").length,
    sourcesTitle: d.querySelector("[data-t=sourcesTitle]")?.textContent || "",
    help: d.querySelector("[data-t=scoreHelp]")?.textContent || "",
    lang: !document.querySelector("[data-lang]").hidden,
    footer: getComputedStyle(document.querySelector(".foot")).display !== "none" && document.querySelector(".foot").textContent,
  };
});
check("About: Words to know", about.gloss >= 15 && /CM \(construction manager\)/.test(about.terms) && /MEP/.test(about.terms) && /UPS/.test(about.terms), `${about.gloss} terms`);
check("About: educator sheet link", /educator sheet/.test(about.educator));
check("About: one licence line", /MIT License/.test(about.licence) && /BY-NC 4\.0/.test(about.licence) && /ElevenLabs Impact Program/.test(about.licence));
check("About and footer credit", about.credit === "A personal project by Ali Keyvanfar, Ph.D." && about.footer === "A personal project by Ali Keyvanfar, Ph.D.");
check("About: narration credit", about.voice === "Narration recorded in advance with ElevenLabs (Impact Program); the game contacts no service while you play.");
check("About: mailto contact and dated sources", about.mail && about.sources >= 7 && about.sourcesTitle === "Sources (as of October 2026)");
check("About: score help quotes the model's numbers", /0\.3% for every month/.test(about.help) && /103% of plan/.test(about.help) && /45-month plan/.test(about.help) && !/\{\w+\}/.test(about.help), about.help.slice(0, 60));
check("no language button while Spanish is empty", !about.lang);

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
    talk: d.querySelectorAll(".end-talk li").length,
    print: !!d.querySelector("[data-print]"),
    scores: window.__dc.scores(),
  };
});
check("end screen opens", end.open);
check("results against the plan, with rating words", end.stats.length === 4 && /Plan: 45 months/.test(end.stats[0]) && /(Strong|Good|Fair|Watch|Concern)/.test(end.stats[0]) && /held for surprises/.test(end.stats[1]) && /Started at 82/.test(end.stats[2]) && /Started at 35/.test(end.stats[3]), JSON.stringify(end.stats));
// Weather b: +1 mo, +1.3%, −12 safety, −10 neighbors; long-lead b: +4 mo here and +1.2%; labor a: +1.5%, −8, −8.
check("three costliest answers, in order", end.costly.length === 3 && /^Weather/.test(end.costly[0]) && /^Long-lead.*Finish \+4 mo/.test(end.costly[1]) && /^Labor/.test(end.costly[2]), JSON.stringify(end.costly));
check("three questions to talk over", end.talk === 3);
await p.evaluate(() => document.querySelector("[data-print]").click());
check("Print button calls print", (await p.evaluate(() => window.__printed)) === 1);
await p.emulateMedia({ media: "print" });
const pr = await p.evaluate(() => ({
  app: getComputedStyle(document.querySelector(".app")).display,
  end: getComputedStyle(document.querySelector("[data-end]")).display,
  foot: getComputedStyle(document.querySelector("[data-end] .dlg-foot")).display,
  head: getComputedStyle(document.querySelector(".print-head")).display,
}));
check("print shows only the debrief", pr.app === "none" && pr.end !== "none" && pr.foot === "none" && pr.head !== "none", JSON.stringify(pr));
await p.emulateMedia({ media: "screen" });
// Budget: time costs money now (I11), and good-neighbor choices cost tenths of a percent.
const money = await p.evaluate(() => {
  const s = window.__dc.state();
  const at = (c, v) => { const old = s.choice[c]; s.choice[c] = v; const b = window.__dc.scores().budget; s.choice[c] = old; return b; };
  return { lightA: at("light", "a") - at("light", "b"), routeA: at("route", "a") - at("route", "b") };
});
check("shielded lighting costs the same as standard; the highway route costs a few tenths", Math.abs(money.lightA) < 1e-9 && money.routeA > 0 && money.routeA < 0.5, JSON.stringify(money));
await ctx.close();
await browser.close();
for (const e of errors) console.log("  console: " + e);
if (failed || errors.length) { console.log(`debrief-check: ${failed} failed, ${errors.length} console error(s)`); process.exit(1); }
console.log("debrief-check ok");
