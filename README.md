# Build the Campus · play-test

**Play it:** https://a2-learning-studio.github.io/data-center-build-playtest/

A free, offline, single-page game for a public library panel on data centers. The player is the construction manager building a data center campus on a made-up Georgia site, one phase at a time: site and permits, clearing and grading, utilities, foundations, shell, MEP, data hall fit-out, commissioning levels 1–5, and turnover. It has a critical-path schedule, issue cards with trade-offs, a neighborhood panel and a dashboard. The game shows facts and trade-offs and does not take a side on data centers.

Created by Ali Keyvanfar, Ph.D. A personal public-education project, drawing on construction research at Kennesaw State University. A companion to [Community Builders of Pecan Grove](https://a2-learning-studio.github.io/pecan-grove-playtest/). Made-up site and companies; durations are typical ranges and vary by project.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game in one offline file (three.js, fonts, text and code inlined) |
| `strings.mjs` | Every word the player sees; add `es` with the same keys for Spanish |
| `game.js` | Rules, scoring, schedule, issue cards, panels |
| `scene.js` | The 3D campus (three.js) |
| `style.css` | Layout and look |
| `build.mjs` | `node build.mjs` rebuilds `index.html` |
| `voice-lines.mjs` | The narration script, built from the strings table |
| `voice.mjs` | Makes the narration clips with ElevenLabs (stock voice; key from the environment only) |
| `AUDIT.md` | Audit of v1.1 and open items |
| `PROMPT-for-Grok.md` | A ready prompt for an outside AI review |
| `screenshots/` | Laptop and phone views |

Third-party: three.js r170 (MIT, `vendor/three-LICENSE.txt`); Geist and Inter fonts (SIL Open Font License, `vendor/fonts/LICENSE.txt`).
