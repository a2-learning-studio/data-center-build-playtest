# Build the Campus · play-test

**Play it:** https://a2-learning-studio.github.io/data-center-build-playtest/

A free, offline, single-page game for a public library panel on data centers. The player is the construction manager building a data center campus on a made-up Georgia site, one phase at a time: site and permits, erosion control and grading, utilities, foundations, shell, MEP, data hall fit-out, commissioning (levels 1–4 during construction, level 5 at the end), and turnover. It has a critical-path schedule, issue cards with trade-offs, a neighborhood panel and a dashboard. The game shows facts and trade-offs and does not take a side on data centers.

**Kiosk setup.** The whole game is `index.html`. Download that file and open it in a full-screen browser. It does not need a network. On the web address, the versioned `sw-build-the-campus-*.js` file (copied from `sw.js`) saves the page so a reload can still open after the connection drops. While the kiosk is online, a reload checks for a new build, takes that build, and drops older saved copies. In About, the game explains the same setup. The published site is the `docs/` copy of the game.

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
| `voice.mjs` | Makes the narration clips with an AI text-to-speech service (stock voice; key from the environment only) |
| `sw.js` | Saves the web copy for offline reloads |
| `AUDIT.md` | Audit of v1.1 and open items |
| `PROMPT-for-Grok.md` | A ready prompt for an outside AI review |
| `screenshots/` | Laptop and phone views |

Third-party: three.js r170 (MIT, `vendor/three-LICENSE.txt`); Geist and Inter fonts (SIL Open Font License, `vendor/fonts/LICENSE.txt`).
