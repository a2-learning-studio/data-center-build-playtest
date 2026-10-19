# Build the Campus · play-test

**Play it:** https://a2-learning-studio.github.io/data-center-build-playtest/

A free, offline, single-page game for a public library panel on data centers. The player is the construction manager building a data center campus on a made-up Georgia site, one phase at a time: site and permits, erosion control and grading, utilities, foundations, shell, MEP, data hall fit-out, commissioning (levels 1–4 during construction, level 5 at the end), and turnover. It has a critical-path schedule, issue cards with trade-offs, a Neighbors panel, a dashboard and an end-of-game debrief that prints. A one-page educator sheet, `educator.html`, goes with it. The game shows facts and trade-offs and does not take a side on data centers.

**Kiosk setup.** For a computer with no network, download `build-the-campus-offline.html` (About has a link) and open it in a full-screen browser. It is the whole game in one file, narration included. The web page, `index.html`, is smaller: the first time narration plays, it loads all the narration clips from `voice/en/` at once, the same set in the same order for every player. On the web address, the versioned `sw-build-the-campus-*.js` file (copied from `sw.js`) saves the page from the copy the browser already has (no second download) and keeps the clips once they have loaded, so a reload can still open after the connection drops. While the kiosk is online, a reload checks for a new build, takes that build, and drops older saved copies. In About, the game explains the same setup. GitHub Pages builds with Jekyll; `_config.yml` keeps the sources, `tests/` and the test build out of the published site.

A personal project by Ali Keyvanfar, Ph.D. A companion to [Community Builders of Pecan Grove](https://a2-learning-studio.github.io/pecan-grove-playtest/). The site, company and neighbors are made up; the rules and figures are real as of October 2026 (sources are listed in the game's About panel). Durations are typical ranges and vary by project. For ages 12 and up; younger players with an adult.

Narration recorded in advance with ElevenLabs (Impact Program); the game contacts no service while you play.

**Questions, privacy concerns or corrections:** [akeyvanf@kennesaw.edu](mailto:akeyvanf@kennesaw.edu)

**Licence.** Code under the MIT License (`LICENSE`); text, graphics and game design under Creative Commons BY-NC 4.0 (`LICENSE-CONTENT`), © 2026 Ali Keyvanfar. three.js r170 (MIT, `vendor/three-LICENSE.txt`) and the Geist and Inter fonts (SIL Open Font License, `vendor/fonts/LICENSE.txt`) keep their own licences; the narration clips follow the ElevenLabs Impact Program terms.

**Modes.** With no mode the page is set up for a library kiosk: it starts over after a few minutes without input and saves nothing. Add `?mode=class` (a staffed class) or `?mode=home` to the address to stop it clearing itself and to keep the game in progress if the page reloads, until the tab is closed. `?mode=library` starts each game with the voice off. Library mode, the voice choice in class and home modes, the presenter view and the single-key shortcut switch are remembered on the device under `build-the-campus:v1:` keys; nothing is sent anywhere.

**Browsers and computers.** Chrome or Edge 108 or later, Firefox 101 or later, or Safari 15.4 or later (Mac, iPad and iPhone); the game needs `<dialog>`, `100dvh` and, for the 3D map, WebGL 2. Most computers, Chromebooks and tablets in use today have WebGL 2 graphics. A screen 1280 × 720 or larger works best; phones show a smaller map. Without WebGL the panels, the schedule and every decision still work. The game picks less 3D detail on software rendering, older Intel HD and UHD graphics, entry-level ARM graphics (Mali, Adreno 500 and earlier, PowerVR) and small machines; add `?quality=low` or `?quality=high` to the address to override it.

**Presenter view.** For a projector or a large screen: the four-corner button on the map (or the switch in About, or `?view=presenter` in the address) hides the side panel and the schedule so the map fills the screen, and makes every label at least 16 px. The Build panel and the scores stay. The device remembers the setting.

**Map controls.** Drag to turn; scroll, pinch or + and − to zoom toward the pointer. Zoomed in, a drag (or Shift + arrow keys) moves the view, and right-drag, Shift-drag or two fingers turn it. The buttons on the map do the same, and Reset view brings the whole site back.

## Files

| File | What it is |
|---|---|
| `index.html` | The web page (three.js, fonts, text and code inlined; narration clips loaded from `voice/` the first time narration plays) |
| `build-the-campus-offline.html` | The offline kiosk copy: the whole game in one file, narration included |
| `model.mjs` | The game model in one place: phases, choices, issue cards, when each question is asked, and the scoring constants |
| `strings.mjs` | Every word the player sees, under the same ids as the model |
| `game.js` | Rules, scoring, schedule, issue cards, panels |
| `scene.js` | The 3D campus (three.js) |
| `style.css` | Layout and look |
| `build.mjs` | `node build.mjs` checks the model, strings and scene tags against each other, then rebuilds both pages at the root and in `docs/` (with `docs/voice/` and the educator sheet), plus the unpublished test build `index.test.html`. It recomputes the page's Content-Security-Policy script hash every time and strips the test hooks from the published pages. `node build.mjs --test` also runs every script in `tests/` |
| `educator.html` | One-page educator and facilitator sheet (prints on one US Letter page) |
| `LICENSE`, `LICENSE-CONTENT` | MIT licence for the code; CC BY-NC 4.0 notice for text, graphics and game design |
| `voice-lines.mjs` | The narration script, built from the strings table |
| `voice.mjs` | Makes the narration clips in advance with ElevenLabs (stock voice; key from the environment only). The game itself never calls it |
| `sw.js` | Saves the web copy for offline reloads |
| `tests/` | Headless checks (Playwright) against `index.test.html`: `order-check`, `playthrough`, `wait-path`, `pan-check`, `session-check`, `layout-check`, `feedback-check`, `debrief-check`. See `tests/drive.mjs` for the browser and paths |
