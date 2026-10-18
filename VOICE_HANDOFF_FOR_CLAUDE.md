# Voice handoff for Claude Code

This note is for the owner’s machine. It is not part of the game. Do not fetch it, inline it, copy it into `index.html` or `docs/`, or add it to a service-worker cache. `build.mjs` writes the game into `index.html` and a `docs/` copy. `sw.js` does not cache `.md` files. `_config.yml` excludes this file from the GitHub Pages build, so it is not on the live site.

No narration line needs a new recording. The fifteen lines that used to be listed here were recorded in PR #2 and match `voice/en/manifest.json`. This order-and-commissioning fix does not change any spoken caption. `STRINGS.es` is empty, so there is no Spanish list. Do not regenerate the existing clips.

The text a clip must match is `speakable()` from `voice-lines.mjs`, which is what `voice.mjs` sends. The on-screen caption is `lines()` and can differ where that function rewrites `&`, a middle dot, or `L5`.

## Lines that need a new recording

None.

Spoken keys are `intro`, `phase:<id>`, `el:<id>`, `card:<id>`, `opt:<id>:a|b|c`, `cx`, and `end`. Factory-test labels, the clearing wait, the commissioning track, and the level log lines are not in `lines()`, so they have no clip.

## Voice, provider, and settings

Taken from `voice.mjs` and commit `7684483` (“Add narration: 55 ElevenLabs clips (stock voice)”). Not guessed.

- Provider: ElevenLabs. `voice.mjs` posts to `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`.
- Voice id: `21m00Tcm4TlvDq8ikWAM`. The comment in `voice.mjs` calls this the stock voice “Rachel” (calm, warm, clear) and says it is not a cloned voice.
- Model: `eleven_multilingual_v2`.
- Output: query `output_format=mp3_22050_32`, response `audio/mpeg`.
- Voice settings in the request body: `stability` 0.55, `similarity_boost` 0.75, `style` 0.15, `use_speaker_boost` true.
- A clip is reused when `sha1(VOICE_ID + "|" + MODEL + "|" + speakable text)` truncated to 12 hex characters matches `voice/en/manifest.json`, and the mp3 exists.
- The API key is `ELEVEN_API_KEY` or `XI_KEY` in the environment. It is not stored in the repo.
- Unknown from the code: speaking rate, seed, language code sent to the API, and channel count. Do not invent those. Leave them unset so the request matches `voice.mjs`.

## How to embed clips and stay one offline file

1. Keep every file in `voice/en/` whose manifest text still equals today’s `speakable()` line. `voice.mjs` already skips those.
2. Run `node build.mjs`. It inlines a clip only when the manifest text equals `speakable(lines())` and the mp3 exists. Each clip becomes a `data:audio/mpeg;base64,...` URL inside `index.html`. The same HTML is copied to `docs/index.html`. The worker file name follows `CACHE` in `sw.js` (currently `sw-build-the-campus-v4.js`) and is copied beside both pages. GitHub Pages publishes the root `index.html` and that worker. `_config.yml` leaves this note out of the site.
3. Do not add audio URLs, do not fetch mp3s at runtime, and do not copy this markdown file into `index.html` or `docs/`.
4. After the build, the log line should report 55 voice clips.

## How to verify a clip

1. Rebuild, then open `index.html` over http (a `file://` page does not register the service worker; audio still works there).
2. Turn voice on. Reach a line by playing, or call the matching `speak(key)` from the click path.
3. The caption element `[data-caption]` shows `lines()` for that key.
4. Where the spoken text differs from the caption, the voice follows `speakable()` (`and` for `&`, “Level five” for `L5`, a pause for `·`).
5. Unchanged lines, including the intro and placing the substation (`el:substation`), must still play the existing clips.
6. The first tap or key press must unlock audio. Later cards must still be heard after that unlock.
7. Confirm this file is not inside `index.html` or `docs/`, and that a request for it is not stored by the service worker.

## Prompt to paste into Claude Code

```
You are working in the repo a2-learning-studio/data-center-build-playtest. Read VOICE_HANDOFF_FOR_CLAUDE.md at the repo root and follow it. Do not print, log, or commit an API key.

The “Lines that need a new recording” list is empty. Do not call the ElevenLabs API. Do not run voice.mjs. Do not replace or regenerate any file in voice/en/. The fifty-five clips already match the spoken lines.

If you change a string that lines() speaks, stop and add only that line to the list above (id, file and line, exact speakable text, voice/en path, and how the game embeds it) before anyone records it. Leave every other clip alone.

Run `node build.mjs` only if the game page needs a rebuild. That inlines matching mp3s as data URLs so the game stays one offline index.html, and it refreshes docs/index.html and the versioned service worker. Do not copy VOICE_HANDOFF_FOR_CLAUDE.md into index.html, docs/, or the service worker cache. Leave the _config.yml exclude in place. The build should report 55 voice clips.
```
