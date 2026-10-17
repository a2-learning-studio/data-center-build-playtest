// Generates the narration clips with ElevenLabs, using a stock narrator voice (never a cloned one: standing rule 4).
// The API key is read only from this terminal's environment and is never printed or saved. In PowerShell:
//   $env:ELEVEN_API_KEY = "sk_..."
//   node --dns-result-order=ipv4first voice.mjs        (English; or: voice.mjs es)
//   node build.mjs                                     (inlines the clips into index.html)
// Only lines whose text changed are synthesized again.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const { STRINGS } = await import(pathToFileURL(join(HERE, "strings.mjs")).href);
const { lines, speakable } = await import(pathToFileURL(join(HERE, "voice-lines.mjs")).href);
const KEY = process.env.ELEVEN_API_KEY || process.env.XI_KEY;
const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs stock "Rachel": calm, warm, clear
const MODEL = "eleven_multilingual_v2";
const lang = process.argv[2] || "en";

async function main() {
  if (!KEY) { console.log("Set ELEVEN_API_KEY to your sk_ key in this terminal first, then run again."); return 2; }
  const t = { ...STRINGS.en, ...(STRINGS[lang] || {}) };
  const dir = join(HERE, "voice", lang);
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const all = lines(t);
  let made = 0, chars = 0, failed = 0;
  for (const [key, text] of Object.entries(all)) {
    const say = speakable(text);
    const hash = createHash("sha1").update(`${VOICE_ID}|${MODEL}|${say}`).digest("hex").slice(0, 12);
    const file = `${key.replace(/:/g, "-")}.mp3`;
    if (manifest[key]?.hash === hash && existsSync(join(dir, file))) continue;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_22050_32`, {
      method: "POST",
      headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: say, model_id: MODEL, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true } }),
    });
    if (!r.ok) { console.log("FAIL", key, r.status, (await r.text()).slice(0, 200)); failed++; if (r.status === 401) break; continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    writeFileSync(join(dir, file), buf);
    manifest[key] = { file, hash, text: say, bytes: buf.length };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
    made++;
    chars += say.length;
    console.log("ok", key, `${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log(`made ${made} clips (${chars} characters), ${failed} failed, ${Object.keys(all).length} lines in all`);
  return failed ? 1 : 0;
}
process.exitCode = await main();
