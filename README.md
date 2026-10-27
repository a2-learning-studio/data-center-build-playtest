# Build the Campus · play-test

**Play it:** https://a2-learning-studio.github.io/data-center-build-playtest/

A free, offline, single-page game for a public library panel on data centers. The player is the construction manager building a data center campus on a made-up Georgia site, one phase at a time: site and permits, erosion control and grading, utilities, foundations, shell, MEP, data hall fit-out, commissioning (levels 1–4 during construction, level 5 at the end), and turnover. It has a critical-path schedule, issue cards with trade-offs, a Neighbors panel, a dashboard and an end-of-game debrief that prints. A one-page educator sheet, `educator.html`, goes with it. The game shows facts and trade-offs and does not take a side on data centers.

**Kiosk setup.** For a computer with no network, download `build-the-campus-offline.html` (About links to it, or on a kiosk prints its address) and open it in a full-screen browser. It is the whole game in one file, narration included. For an unattended kiosk, also use the browser's own kiosk or lockdown settings (for example Microsoft Edge kiosk mode): the game starts itself over, but it cannot close other tabs or the print dialog. The web page, `index.html`, is smaller: the first time narration plays, it loads all the narration clips from `voice/en/` at once, the same set in the same order for every player. On the web address, the versioned `sw-build-the-campus-*.js` file (copied from `sw.js`) saves the page from the copy the browser already has (no second download) and keeps the clips once they have loaded, so a reload can still open after the connection drops. While the kiosk is online, a reload checks for a new build, takes that build, and drops older saved copies. In About, the game explains the same setup. GitHub Pages builds with Jekyll; `_config.yml` keeps the sources, `tests/` and the test build out of the published site, and publishes the two licence texts in `vendor/`.

**Kiosk checklist.**
- Open the offline file in the browser's kiosk mode, for example `msedge.exe --kiosk "file:///C:/Kiosk/build-the-campus-offline.html?mode=library" --edge-kiosk-type=fullscreen --no-first-run`, or in full screen (F11). `?mode=library` works on the file too and keeps the voice off for every player. Edge kiosk mode runs InPrivate and forgets a ticked Library mode box when it restarts; the address does not.
- Turn off sleep and the screen saver, so the screen stays on between visitors.
- *Print this summary* on the end screen opens the browser's print dialog: connect a default printer, or tell visitors the summary is for the screen only.
- Each morning, check the version badge in the top bar and close any other tabs or windows. The offline file never updates itself: download it again when the web copy shows a newer version.
- With no mode, an idle game starts over after about three minutes, and the end screen clears after about a minute and a half.

A project by A2 Learning Studio. A companion to [Community Builders of Pecan Grove](https://a2-learning-studio.github.io/pecan-grove-playtest/). The site, company and neighbors are made up. The rules and the facts in the Neighbors panel are real as of October 2026 (sources are listed in the game's About panel); costs, delays and points are simplified game values, not estimates for a real project. Durations are typical ranges and vary by project. For ages 12 and up; younger players with an adult.

Narration recorded in advance with ElevenLabs (Impact Program); the game contacts no service while you play.

**Questions, privacy concerns or corrections:** [akeyvanf@kennesaw.edu](mailto:akeyvanf@kennesaw.edu)

**Accessibility.** The game aims to meet WCAG 2.2 level AA. Known limits: the 3D map is visual only, though everything that counts is also in the panels, the schedule and the Site log as text; and the game is in English only. To report a barrier, email [akeyvanf@kennesaw.edu](mailto:akeyvanf@kennesaw.edu).

**Licence.** Code under the MIT License (`LICENSE`); text, graphics and game design under Creative Commons BY-NC 4.0 (`LICENSE-CONTENT`), © 2026 A2 Learning Studio. three.js r170 (MIT, `vendor/three-LICENSE.txt`) and the Geist and Inter fonts (SIL Open Font License, `vendor/fonts/LICENSE.txt`) keep their own licences; the narration clips follow the ElevenLabs Impact Program terms.

**Modes.** With no mode the page is set up for a library kiosk: it starts over after a few minutes without input and saves nothing. What a visitor switches (the voice, Library mode, presenter view, the single-key shortcuts) lasts one game, and About prints its source, contact, educator-sheet and download addresses as plain text, so no tap opens another tab, an email app or a download. `?mode=library` is the same kiosk with the voice off for every game. Add `?mode=class` (a staffed class) or `?mode=home` to the address to stop it clearing itself and to keep the game in progress if the page reloads, until the tab is closed; the intro then names the mode, and About's addresses are links. In those two modes the device remembers Library mode, the voice, presenter view and the shortcut switch under `build-the-campus:v1:` keys; nothing is sent anywhere. In any mode the address can also set what every game starts with: `?voice=off`, `?view=presenter` and `?keys=off`, joined with `&` (for example `?mode=class&voice=off`).

**Browsers and computers.** Chrome or Edge 108 or later, Firefox 101 or later, or Safari 15.4 or later (Mac, iPad and iPhone); the game needs `<dialog>`, `100dvh` and, for the 3D map, WebGL 2. Most computers, Chromebooks and tablets in use today have WebGL 2 graphics. A screen 1280 × 720 or larger works best; phones show a smaller map. On a computer window up to 900 px tall, the schedule under the map starts as a row of phases, so the map stays large; Show timeline opens its bars (phones and tablets keep the full schedule on its own tab). Without WebGL the panels, the schedule and every decision still work. The game picks less 3D detail on software rendering, older Intel HD and UHD graphics, entry-level ARM graphics (Mali, Adreno 500 and earlier, PowerVR) and small machines; add `?quality=low` or `?quality=high` to the address to override it.

**Presenter view.** For a projector or a large screen: the four-corner button on the map (or the switch in About, or `?view=presenter` in the address) hides the side panel and the schedule so the map fills the screen, and makes every label at least 16 px. On a tablet held upright it makes the map taller and every label at least 16 px; on a phone it makes the map taller. The Build panel and the scores stay. In class and home modes the device remembers the setting; on a kiosk the button lasts one game, and `?view=presenter` starts every game in it.

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
| `educator.html` | One-page educator and facilitator sheet with the game's addresses and a kiosk checklist (prints on one US Letter page; `tests/debrief-check.mjs` prints it to PDF to check) |
| `LICENSE`, `LICENSE-CONTENT` | MIT licence for the code; CC BY-NC 4.0 notice for text, graphics and game design |
| `voice-lines.mjs` | The narration script, built from the strings table |
| `voice.mjs` | Makes the narration clips in advance with ElevenLabs (stock voice; key from the environment only). Double-click `make-voice.cmd` to run it with a hidden key prompt. The game itself never calls it |
| `sw.js` | Saves the web copy for offline reloads |
| `tests/` | Headless checks (Playwright) against `index.test.html`: `order-check`, `playthrough`, `wait-path`, `pan-check`, `session-check`, `layout-check`, `feedback-check`, `debrief-check`, `a11y-check`. See `tests/drive.mjs` for the browser and paths |
