# Voice handoff for Claude Code

This note is for the owner’s machine. It is not part of the game. Do not fetch it, inline it, copy it into `index.html` or `docs/`, or add it to a service-worker cache. `build.mjs` writes the game into `index.html` and a `docs/` copy. `sw.js` does not cache `.md` files. `_config.yml` excludes this file from the GitHub Pages build, so it is not on the live site.

Fifteen narration lines changed and no longer match `voice/en/manifest.json`. The old mp3 files are still on disk, but `build.mjs` leaves them out, so the game shows the new caption with no audio. Forty other lines still match and must keep their current clips. `STRINGS.es` is empty, so this list is English only.

The text to speak is `speakable()` from `voice-lines.mjs`, which is what `voice.mjs` sends. The on-screen caption is `lines()` and can differ where that function rewrites `&`, a middle dot, or `L5`.

## Lines that need a new recording

### phase:grade

- Where the words live: `strings.mjs` lines 154 and 156 (`phases.grade.name`, `phases.grade.log`). Built in `voice-lines.mjs` line 6.
- On-screen caption: Erosion control & grading. Silt fence, a construction exit and sediment basins go in before crews clear trees and grade the ground.
- Exact text to speak: Erosion control and grading. Silt fence, a construction exit and sediment basins go in before crews clear trees and grade the ground.
- Audio file: `voice/en/phase-grade.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 460 calls `speak("phase:grade")` when the player opens that phase. `build.mjs` inlines the file as `data:audio/mpeg;base64,...` on `D.VOICE.en["phase:grade"]`. `speak()` in `game.js` (line 557) shows `D.CAPTIONS.en["phase:grade"]` and plays that data URL. No separate audio request.

### phase:cx

- Where the words live: `strings.mjs` lines 190 and 192 (`phases.cx.name`, `phases.cx.log`). Built in `voice-lines.mjs` line 6.
- On-screen caption: Commissioning · L5. Only the integrated systems test is left. Levels 1 to 4 were done earlier, one piece of equipment at a time.
- Exact text to speak: Commissioning, Level five. Only the integrated systems test is left. Levels 1 to 4 were done earlier, one piece of equipment at a time.
- Audio file: `voice/en/phase-cx.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 460 calls `speak("phase:cx")` when the player opens commissioning. Embedded as `D.VOICE.en["phase:cx"]`.

### el:erosion

- Where the words live: `strings.mjs` line 208 (`elements.erosion.log`). Built in `voice-lines.mjs` line 7. The element name is not spoken.
- On-screen caption: Silt fence goes in before any clearing, so mud stays on the site.
- Exact text to speak: Silt fence goes in before any clearing, so mud stays on the site.
- Audio file: `voice/en/el-erosion.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 480 calls `speak("el:erosion")` when the player places silt fence. Embedded as `D.VOICE.en["el:erosion"]`.

### el:roads

- Where the words live: `strings.mjs` line 209 (`elements.roads.log`). Built in `voice-lines.mjs` line 7.
- On-screen caption: A construction exit and access road are built so trucks do not track mud into the street.
- Exact text to speak: A construction exit and access road are built so trucks do not track mud into the street.
- Audio file: `voice/en/el-roads.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 480 calls `speak("el:roads")` when the player places the construction exit. Embedded as `D.VOICE.en["el:roads"]`.

### el:ponds

- Where the words live: `strings.mjs` line 210 (`elements.ponds.log`). Built in `voice-lines.mjs` line 7.
- On-screen caption: Sediment basins are dug before clearing. They hold muddy water, and later they hold rain.
- Exact text to speak: Sediment basins are dug before clearing. They hold muddy water, and later they hold rain.
- Audio file: `voice/en/el-ponds.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 480 calls `speak("el:ponds")` when the player places sediment basins. Embedded as `D.VOICE.en["el:ponds"]`.

### el:clear

- Where the words live: `strings.mjs` line 211 (`elements.clear.log`). Built in `voice-lines.mjs` line 7.
- On-screen caption: Trees and topsoil come out only after the silt fence and sediment basins are in.
- Exact text to speak: Trees and topsoil come out only after the silt fence and sediment basins are in.
- Audio file: `voice/en/el-clear.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 480 calls `speak("el:clear")` when the player places clearing. Embedded as `D.VOICE.en["el:clear"]`.

### card:weather

- Where the words live: `strings.mjs` lines 285 and 286 (`cards.weather.title`, `cards.weather.body`). Built in `voice-lines.mjs` line 9.
- On-screen caption: Weather: a week of heavy rain. The forecast calls for a week of heavy rain while the site is bare earth. Mud running off the site can reach the creek and the street. If controls fail, an inspector may issue a fine or a stop-work order.
- Exact text to speak: Weather: a week of heavy rain. The forecast calls for a week of heavy rain while the site is bare earth. Mud running off the site can reach the creek and the street. If controls fail, an inspector may issue a fine or a stop-work order.
- Audio file: `voice/en/card-weather.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 672 calls `speak("card:weather")` when the weather card opens. Embedded as `D.VOICE.en["card:weather"]`.

### opt:weather:a

- Where the words live: `strings.mjs` line 287 (`cards.weather.a.log`). Built in `voice-lines.mjs` line 10.
- On-screen caption: Grading pauses. Crews add silt fence, mulch and check dams.
- Exact text to speak: Grading pauses. Crews add silt fence, mulch and check dams.
- Audio file: `voice/en/opt-weather-a.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 693 calls `speak("opt:weather:a")` when the player picks that option. Embedded as `D.VOICE.en["opt:weather:a"]`.

### opt:weather:b

- Where the words live: `strings.mjs` line 288 (`cards.weather.b.log`). Built in `voice-lines.mjs` line 10.
- On-screen caption: Grading continues in the rain. Muddy water leaves the site, and an inspector may fine the job or stop the work.
- Exact text to speak: Grading continues in the rain. Muddy water leaves the site, and an inspector may fine the job or stop the work.
- Audio file: `voice/en/opt-weather-b.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 693 calls `speak("opt:weather:b")` when the player picks that option. Embedded as `D.VOICE.en["opt:weather:b"]`.

### card:longlead

- Where the words live: `strings.mjs` lines 291 and 292 (`cards.longlead.title`, `cards.longlead.body`). Built in `voice-lines.mjs` line 9.
- On-screen caption: Long-lead equipment: transformers & switchgear. Large transformers can take about 2 to 4 years to build and deliver. Switchgear is also built to order. The design is not final yet. In this game, waiting on transformers delays the substation by about 9 months, and waiting on switchgear delays the electrical work by about 4 months, so the wait still fits on the schedule.
- Exact text to speak: Long-lead equipment: transformers and switchgear. Large transformers can take about 2 to 4 years to build and deliver. Switchgear is also built to order. The design is not final yet. In this game, waiting on transformers delays the substation by about 9 months, and waiting on switchgear delays the electrical work by about 4 months, so the wait still fits on the schedule.
- Audio file: `voice/en/card-longlead.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 672 calls `speak("card:longlead")` when that card opens. Embedded as `D.VOICE.en["card:longlead"]`.

### opt:longlead:a

- Where the words live: `strings.mjs` line 293 (`cards.longlead.a.log`). Built in `voice-lines.mjs` line 10.
- On-screen caption: Equipment is ordered early. The factory tests it before it ships. Some design changes will cost extra.
- Exact text to speak: Equipment is ordered early. The factory tests it before it ships. Some design changes will cost extra.
- Audio file: `voice/en/opt-longlead-a.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 693 calls `speak("opt:longlead:a")` when the player picks that option. Embedded as `D.VOICE.en["opt:longlead:a"]`.

### opt:longlead:b

- Where the words live: `strings.mjs` line 294 (`cards.longlead.b.log`). Built in `voice-lines.mjs` line 10.
- On-screen caption: Ordering waits for the final design. The substation and the electrical work both slip.
- Exact text to speak: Ordering waits for the final design. The substation and the electrical work both slip.
- Audio file: `voice/en/opt-longlead-b.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 693 calls `speak("opt:longlead:b")` when the player picks that option. Embedded as `D.VOICE.en["opt:longlead:b"]`.

### opt:longlead:c

- Where the words live: `strings.mjs` line 295 (`cards.longlead.c.log`). Built in `voice-lines.mjs` line 10.
- On-screen caption: Transformers are ordered now and tested at the factory. Switchgear waits, which delays the electrical work.
- Exact text to speak: Transformers are ordered now and tested at the factory. Switchgear waits, which delays the electrical work.
- Audio file: `voice/en/opt-longlead-c.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 693 calls `speak("opt:longlead:c")` when the player picks that option. Embedded as `D.VOICE.en["opt:longlead:c"]`.

### opt:labor:a

- Where the words live: `strings.mjs` line 300 (`cards.labor.a.log`). Built in `voice-lines.mjs` line 10. The labor card body and options b and c are unchanged and already have clips.
- On-screen caption: A night shift starts. Lights and noise run later until the electrical work is done.
- Exact text to speak: A night shift starts. Lights and noise run later until the electrical work is done.
- Audio file: `voice/en/opt-labor-a.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 693 calls `speak("opt:labor:a")` when the player picks that option. Embedded as `D.VOICE.en["opt:labor:a"]`.

### cx

- Where the words live: `strings.mjs` line 327 (`logCx`). Built in `voice-lines.mjs` line 12.
- On-screen caption: Level 5 passed. Levels 1 to 4 were already done, one piece of equipment at a time.
- Exact text to speak: Level five passed. Levels 1 to 4 were already done, one piece of equipment at a time.
- Audio file: `voice/en/cx.mp3` — MP3 (`audio/mpeg`), 22050 Hz, 32 kbps (`output_format=mp3_22050_32`). Channel count is not set in the code.
- How the game uses it: `game.js` line 501 calls `speak("cx")` when the commissioning phase is finished. Embedded as `D.VOICE.en.cx`.

## Voice, provider, and settings

Taken from `voice.mjs`, `make-voice.ps1`, and commit `7684483` (“Add narration: 55 ElevenLabs clips (stock voice)”). Not guessed.

- Provider: ElevenLabs. `voice.mjs` posts to `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`.
- Voice id: `21m00Tcm4TlvDq8ikWAM`. The comment in `voice.mjs` calls this the stock voice “Rachel” (calm, warm, clear) and says it is not a cloned voice.
- Model: `eleven_multilingual_v2`.
- Output: query `output_format=mp3_22050_32`, response `audio/mpeg`.
- Voice settings in the request body: `stability` 0.55, `similarity_boost` 0.75, `style` 0.15, `use_speaker_boost` true.
- A clip is reused when `sha1(VOICE_ID + "|" + MODEL + "|" + speakable text)` truncated to 12 hex characters matches `voice/en/manifest.json`, and the mp3 exists.
- The API key is `ELEVEN_API_KEY` or `XI_KEY` in the environment. `make-voice.ps1` asks for it, runs `node --dns-result-order=ipv4first voice.mjs en`, then `node build.mjs`, and clears the key. The key is not stored in the repo.
- Unknown from the code, the README, and the commit messages: speaking rate, seed, language code sent to the API, and channel count. Do not invent those. Leave them unset so the request matches `voice.mjs`.

## How to embed clips and stay one offline file

1. Keep every existing file in `voice/en/` whose manifest text still equals today’s `speakable()` line. `voice.mjs` already skips those.
2. Run `voice.mjs` so it overwrites only the fifteen files above and updates their manifest entries (`file`, `hash`, `text` = the exact text to speak, `bytes`).
3. Run `node build.mjs`. It inlines a clip only when the manifest text equals `speakable(lines())` and the mp3 exists (`build.mjs` around the `VOICE` loop). Each clip becomes a `data:audio/mpeg;base64,...` URL inside `index.html`. The same HTML is copied to `docs/index.html`, and `sw.js` is copied to `docs/sw.js`.
4. Do not add audio URLs, do not fetch mp3s at runtime, and do not copy this markdown file into `index.html` or `docs/`.
5. After the build, the log line should report 55 voice clips (40 today, plus these 15).

## How to verify a clip

1. Rebuild, then open `index.html` over http (a `file://` page does not register the service worker; audio still works there).
2. Turn voice on. Reach the line by playing, or call the matching `speak(key)` from the click path.
3. The caption element `[data-caption]` is visible and its text equals the on-screen caption in this file, character for character.
4. The clip is audible. Where the spoken text differs from the caption, the voice follows the “exact text to speak” line (`and` for `&`, “Level five” for `L5`, a pause for `·`).
5. Play `intro` and one unchanged element, such as placing the substation (`el:substation`). Those old clips must still play.
6. Check every changed line on desktop, in Android Chrome, and in iOS Safari. The first tap or key press must unlock audio (`game.js` calls `play()` on that gesture). Later cards must still be heard after that unlock.
7. Confirm this file is not inside `index.html` or `docs/`, and that a request for it is not stored by the service worker.

## Prompt to paste into Claude Code

```
You are working in the repo a2-learning-studio/data-center-build-playtest. Read VOICE_HANDOFF_FOR_CLAUDE.md at the repo root and follow it. Do not print, log, or commit an API key.

Generate the fifteen narration clips listed in that file with the owner's existing TTS setup. Use make-voice.ps1, or the same commands it runs: set ELEVEN_API_KEY in the environment only (the script also accepts XI_KEY), then run `node --dns-result-order=ipv4first voice.mjs en`. voice.mjs already targets ElevenLabs voice 21m00Tcm4TlvDq8ikWAM, model eleven_multilingual_v2, output_format mp3_22050_32, and the voice_settings in that file. Do not change the voice, model, or settings. Do not clone a voice. Send each line's "exact text to speak" (voice.mjs does this via speakable()). Generate only lines whose text changed. Leave the existing mp3 files and manifest entries in place for every unchanged line.

Then run `node build.mjs`. That inlines matching mp3s as data URLs so the game stays one offline index.html, and it copies that file plus sw.js into docs/ for GitHub Pages. Do not copy VOICE_HANDOFF_FOR_CLAUDE.md into index.html, docs/, or the service worker cache. The build should report 55 voice clips.

Run the game. Check that every changed line plays and that its on-screen caption matches the caption in the handoff. Also check that unchanged lines, including the intro, still play the old clips. Do this on desktop, in Android Chrome, and in iOS Safari, including the first-tap audio unlock. Open a pull request with the new clips, the updated manifest, and the rebuilt index.html and docs/index.html. Do not put the API key in the branch.
```
