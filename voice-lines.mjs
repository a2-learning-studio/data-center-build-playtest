// The narration script, keyed by game event, built from the strings table (so Spanish follows the same keys).
// lines(t) gives the on-screen caption; speakable(text) is what the voice engine is sent.
export function lines(t) {
  const L = {};
  L.intro = `${t.introBody} ${t.introHow}`;
  for (const [id, p] of Object.entries(t.phases)) L[`phase:${id}`] = `${p.name}. ${p.log}`;
  for (const [id, e] of Object.entries(t.elements)) if (e && typeof e.log === "string") L[`el:${id}`] = e.log;
  for (const [id, c] of Object.entries(t.cards)) {
    L[`card:${id}`] = `${c.title}. ${c.body}`;
    for (const o of ["a", "b", "c"]) if (c[o]) L[`opt:${id}:${o}`] = c[o].log;
  }
  L.cx = t.logCx;
  L.end = `${t.endTitle}. ${t.endBody}`;
  return L;
}
const NUM = ["zero", "one", "two", "three", "four", "five"];
export const speakable = (s) =>
  s
    .replace(/Commissioning L1–L5/g, "Commissioning, levels one to five")
    .replace(/\bL([1-5])\b/g, (_, n) => `Level ${NUM[n]}`)
    .replace(/Level (\d)\b/g, (_, n) => `Level ${NUM[n]}`)
    .replace(/\bMEP\b/g, "M E P")
    .replace(/\bUPS\b/g, "U P S")
    .replace(/(\d+)–(\d+)/g, "$1 to $2")
    .replace(/[—–]/g, ", ")
    .replace(/\s*·\s*/g, ", ")
    .replace(/&/g, "and");
