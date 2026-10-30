# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-10-29 for the UI/UX audit, from the repository at `5a1b1ec` (README, `strings.mjs`, `model.mjs`, `game.js`, `build.mjs`) and the audit brief, which relays the owner's decisions. No owner interview ran for this file. Tags: **(repo)** is read from the code or README; **(brief)** comes from the audit brief; **(inferred)** is the preparer's reading and needs the owner's confirmation. Not published: `_config.yml` keeps this file off the game site.

## Platform

web

## Users

Three groups use the game. Each comes in a different situation and has a different job.

1. **The player, 12 and up.** (brief, repo: `audience`, `audienceAbout`) A visitor at a public library panel, a student in a class, or a teenager or adult at home. Younger players play with an adult. Job: build the campus phase by phase, answer the issue cards, and understand what each trade-off cost. A run takes about 20 minutes. Players sign up for nothing and enter no personal data. Many are first-time visitors, have nobody to explain the game, and may walk away at any point. (inferred from the kiosk idle reset and the intro copy)
2. **The facilitator: librarian, teacher, program coordinator.** (brief, repo: modes, `educator.html`) Sets up a kiosk or a projector, runs a session, and leads the debrief. Job: get a group playing quickly, show the game on a large screen, keep each player's game apart, and end with a discussion or printed summaries. They use the address modes (`?mode=library|class|home`, `?view=presenter`, `?voice=off`, `?keys=off`), the offline kiosk file, the one-page educator sheet, presenter view, Print this summary, and the results files (JSON or CSV) in class mode.
3. **The family at home.** (brief, repo: `?mode=home`) A parent and child, or a teenager alone, playing at their own pace. Job: play without the kiosk's resets, pick the game up after a reload in the same tab, and talk the end screen over together.

Two needs cut across all three groups (repo: `srVoice`, Library mode, keyboard shortcuts): screen-reader and keyboard-only players, and rooms where sound is not wanted (library mode turns the voice off).

## Product Purpose

A free, offline, single-page game for a public library panel on data centers (repo: README). The player is the construction manager who builds a data center campus, one phase at a time, on Red Clay Ridge, a made-up Georgia site. The nine phases run from site work and permits to turnover. The game has a critical-path schedule, issue cards with trade-offs, a four-score dashboard (Schedule, Budget, Safety, Neighbor relations), a Neighbors panel, and an end-of-game debrief that prints.

The game succeeds when a player finishes a run in about 20 minutes and can say what the campus cost the schedule, the budget, crew safety and the neighbors, and why the answers differed. It also succeeds when a facilitator can use the debrief's "Talk it over" questions without extra preparation. (inferred from `endTalk`, `endCostly`, `educator.html`)

## Positioning

The game shows facts and trade-offs and does not take a side on data centers (repo: `introBody`, README). The site, the company and the neighbors are made up. The rules and the Neighbors facts are real as of October 2026, and About lists the sources. Costs, delays and points are simplified game values. The game sends nothing anywhere while it plays: no sign-up, no analytics, no cookies, and narration recorded in advance (repo: `privacy`, `voiceCredit`). It is a companion to *Community Builders of Pecan Grove*, a game by the same studio with the same look (repo: `creditsSet`, style.css header).

## Operating Context

- **Places** (brief): public library panels and kiosks; classrooms, often on a projector or a shared laptop with a facilitator nearby; homes.
- **Devices** (brief): a 1366 × 768 laptop is the smallest laptop supported. Also 1440 × 900 and larger, a 390 × 844 phone, short phones, and iPads in both orientations. Projectors run at 1024 × 768 and up, kiosks at 1920 × 1080 (repo: style.css).
- **Browsers** (repo: `systemReq`): Chrome or Edge 108+, Firefox 101+, Safari 15.4+. The game needs `<dialog>` and `100dvh`. The 3D map needs WebGL 2; without it, everything except the map still works.
- **Language** (brief, repo): English only for now. `STRINGS.es` is empty, so the language button stays hidden.
- **Modes** (repo: README "Modes"):
  - With no mode, the page is a library kiosk. It saves nothing. After 2.5 min without input it asks whether the player is still there and starts over 20 s later; the end screen starts a 20 s countdown after 60 s without input. What a player switches lasts one game. About prints addresses as plain text instead of links.
  - `?mode=library` is the kiosk with the voice off.
  - `?mode=class` and `?mode=home` never reset on their own. They keep the game for the tab in `sessionStorage`, remember Library mode, the voice, presenter view and the shortcut switch in `localStorage`, show links in About, and offer results files.
- **Rituals**: the facilitator sets up the kiosk each morning (the README checklist). Sessions end with a printed or on-screen debrief. An unattended kiosk passes from one visitor to the next.

## Capabilities and Constraints

### Screens and their one job

| Screen or surface | Its one job |
|---|---|
| **Intro** dialog (over the slowly turning map) | Start, or resume, a game in one press. Before that, say who the game is for and let a screen-reader user turn the voice off. |
| **Top bar** (name, version badge, dashboard, About) | Show the four scores and how each is rated, all the time. |
| **Map** (3D canvas, toolbar, map buttons) | Show what has been built and where its effects reach the neighbors. While siting, place the piece. |
| **Build panel** | Give the next action: the phase in focus, its elements, Finish phase, then Next. |
| **Schedule** (critical path) | Show when the campus will be handed over and which phases set that date. It also works as the phase picker. |
| **Neighbors** panel | Show what neighbors notice and what the community gets and uses, with the facts behind each row. |
| **Choices** panel | Review the seven decisions and their effects, and change one while it is still open. |
| **Issue card / Your choice** dialog | Make one trade-off with its consequences shown on the answer buttons. |
| **End screen** (debrief) | Compare the results with the plan, name the costliest answers, and start the discussion. It also prints or saves. |
| **About** dialog | Who made the game, privacy, contact, controls and modes, scoring, setup, system requirements, glossary, sources and licences. |
| **Start over?** dialog | Stop a game, a kept game or a summary from being cleared by accident. |
| **Still building?** dialog (kiosk) | Hand the kiosk to the next visitor without surprising the one still playing. |
| **Educator sheet** (`educator.html`) | Let a facilitator run a session or a kiosk from one printed page. |

### Content inventory

- **Phases (9)**: Site & permits · Erosion control & grading · Utilities · Foundations & pads · Building shell · Mechanical, electrical & plumbing (MEP) · Data hall fit-out · Commissioning · Level 5 · Turnover. The phases have 4, 4, 4, 2, 3, 5, 3, 1 and 2 elements: 28 placeable elements, plus commissioning levels L1–L4, which are flags.
- **Elements sited on the map (5)**: Construction exit & access road, Sediment basins, Substation, Building slab, Equipment pads. The player drags or taps the footprint, or nudges it with the arrow keys. A spot that does not fit gives one of 7 reasons.
- **Decisions, "Your choice" (7)**: Truck route · Truck & work hours · Buffer & berm · Noise wall by the homes · Cooling type · Night lighting · Generator testing. Each has 2 options. A decision is asked when it becomes due (at a phase start, before an element, or before a phase can finish) and locks once that work is done.
- **Issue cards (9)**, all in the same dialog:
  - 3 scripted cards: Weather, a week of heavy rain (at clearing, 2 options); Long-lead equipment (at the utility capacity study, or before the substation or switchgear is ordered, 3 options); Labor shortage (when the MEP phase starts, 3 options).
  - 6 setback cards, drawn by chance (p = 0.8) when a phase finishes: heat wave (grading), heavy-haul truck (utilities), concrete samples (foundations), near miss (shell), server racks (fit-out), run one test again (commissioning). Each has 2 options.
- **Answer chips**: Finish ± months, Budget + %, Safety ±, Neighbor relations ± ("counts from grading"), "unchanged", "no points", more power or water use ("once it opens"), permit violation risk.
- **Dashboard**: 4 tiles. Each shows a value and a rating word (Concern, Watch, Fair, Good or Strong) and has long and short forms. Neighbor relations shows "—" and "Starts at grading" until grading starts.
- **Neighbors**: "What neighbors notice" has 6 rows: Truck traffic: routes & hours · Noise · Dust & night lighting · Stormwater · Generator testing · Buffer, berms & landscaping. "What the community gets and uses" has 4 rows: Jobs: construction vs operations · Tax revenue · Power demand & grid upgrades · Cooling water use. Each row has a 4-step meter and a word. Below the rows are a fact box ("Your choice: …") and a score breakdown line.
- **Commissioning track**: levels L1–L5 for 5 pieces of equipment (Switchgear, Backup batteries (UPS), Backup generators, Cooling equipment, Fire protection), plus the substation.
- **Site log**: the 3 latest lines in the panel. The full log is announced on the status line.
- **End screen**: 4 result tiles against the plan; the setbacks-drawn line; "What cost the most" (each answer compared with the best other answer); "Your choices"; "Talk it over" (3 questions).
- **About**: credits; privacy; contact; map, keys and modes help; two preference switches; scoring explanation; kiosk setup; system requirements; quality note; 25 glossary terms; 10 sources; narration credit; licences.
- **Narration**: 73 recorded lines, shown as captions under the toolbar.

### State inventory

- **Loading and unsupported browser**: the `nojs` note ("Loading the game. If it does not start…") covers the page until `game.js` runs. Where scripts are off or the browser is too old, the note stays.
- **No WebGL, or WebGL context lost**: `body[data-nogl]`. A note sits over the map. The map buttons, the drag hint, the Effects button and the floating tag hide; the panels and every decision still work. A restored context rebuilds the map in place.
- **Low 3D quality**: picked for software rendering, older Intel HD/UHD graphics, entry-level ARM graphics and small machines. `?quality=low|high` overrides the choice.
- **Attract**: behind the intro, the map turns slowly. It stands still with reduced motion.
- **Intro variants**:
  - kiosk;
  - `library` (the Library mode box is ticked, locked, and shows "Set by the address");
  - class or home: a mode line, plus Open results file and its error line;
  - a game this tab kept: Resume your game, a ghost Start a new game button, and "This tab kept your game in progress.";
  - a save this version cannot resume ("…a new game starts here.");
  - voice off: the Listen button hides;
  - touch-only devices: the keys line hides.
- **Play, between phases**: the Build panel shows "Phase n of 9", the phase description and **Next: <phase>**, or "Pick a ready phase to work on."
- **Play, phase in focus**: each element row is in one of these states: Place, Place on map, Set it here, Order first, Factory test, Functional test, Placed (done), or locked with its reason on the button. Finish phase stays disabled ("Place every element to finish this phase") until every element is placed. Undo is disabled when there is nothing to undo and after turnover.
- **Siting**: the siting box appears in the Build panel (Set it here, Cancel, and a fits or does-not-fit line). The map shows a crosshair cursor. The footprint is green when it fits and red with hatching when it does not, outlined in dark; placed pieces show as darker ground; the setback line shows. The hint changes to "Drag or tap to site". The arrow keys nudge the piece and Escape cancels.
- **Zoomed in**: `canvas[data-zoomed]`. The four move buttons appear. The hint reads "Drag to move…". The first time per game, the hint turns gold for 4.5 s and screen readers hear the zoom tip. Reset view brings the whole site back.
- **Issue card due**: the card opens at once, and its narration waits for the line before it to finish. A click on the Build panel meanwhile gives the toast "One moment: an issue card is about to open." An answer within 400 ms of a new card, or the second click of a double-click, is ignored.
- **Empty states**:
  - schedule: "Bars appear as you start phases.";
  - Neighbors: "Not counted yet: the score starts at 35 when grading begins.";
  - a decision not yet made: "Not chosen yet.";
  - Neighbors fact box: "Point at, tap or tab to a row…";
  - end screen: "Each of your answers was the best on balance…" and "No choices were recorded.";
  - Site log: its opening line.
- **Changed out of sight**: a clay dot on the Neighbors tab, with "· updated" added to its accessible name.
- **Toasts**: a locked phase or element, a card about to open, a spot that does not fit, and the lasting "This browser is not saving the game…" (class and home modes, when storage fails). Toasts never take clicks, and a dialog that opens hides them.
- **Live regions**: the status line (log lines and siting messages); a summary of the scores that changed, 900 ms after they settle; alerts for the zoom tip and the countdowns at their start and at 10 s.
- **Paused**: the game has no pause control and no running clock. A hidden tab stops the render loop. The kiosk countdowns are the only timers, and a tap or key press stops either of them.
- **Idle (kiosk)**: after 150 s, "Still building?" counts down from 20 s; Keep playing, or any input, dismisses it. After 60 s on the end screen, "This summary clears in n seconds…" appears with Keep this summary.
- **Resumed (class and home)**: the game comes back with "Your game is back where you left it." An unanswered card opens again. A finished game reopens its end screen.
- **End screen variants**:
  - kiosk: focus starts on Play again, which starts over at once;
  - class and home: focus starts on the title, Play again asks first, and Save results file and Save as CSV appear;
  - a results file opened from the intro: "From a results file saved … Read only.", with Close instead of Play again and the save buttons;
  - a results file that is bad or from another version: an error line on the intro.
- **Print view**: only an open end screen prints. `tests/debrief-check.mjs` checks that the longest debrief fits on one US Letter page. The page has a header (name and team line, version), the 4 results in a row, the choices in three columns, ruled lines to answer the "Talk it over" questions, and a footer (credits, contact, address, "Printed <date>"). Printing anywhere else prints a short note.
- **Presenter view**: in the side-panel layout, the side panel and the schedule hide, the map fills the stage, and no label is under 16 px. On a portrait tablet the map is taller and the labels are at least 16 px. On a phone only the map is taller.
- **Offline copy**: `build-the-campus-offline.html` is the whole game in one file, narration included. About then says it is the offline kiosk copy, and the educator sheet appears as a printed address. On the web page, the versioned service worker saves the page and the clips, so a reload with no connection still opens. A clip that fails to load leaves its caption on screen for reading time.
- **User settings that change the UI**:
  - Voice on or off, and Library mode;
  - Effects on map on or off;
  - single-key shortcuts on or off (the number hints on answers hide when off);
  - presenter view;
  - reduced motion: the camera snaps, nothing rises, the map does not frame new parts, and the rings, fans, trucks and stripes stand still;
  - forced colors (Windows contrast themes): borders and system colors replace the backgrounds.

### Technical constraints

- **Built pages are generated** (repo: `build.mjs`): never hand-edit `index.html`, `build-the-campus-offline.html`, `docs/`, `index.test.html` or `sw-build-the-campus-v*.js`. Change the sources (`style.css`, `game.js`, `scene.js`, `strings.mjs`, `model.mjs`, the markup in `build.mjs`), run `node build.mjs --strict`, and commit the rebuilt pages with the source change. CI fails when they differ.
- **Every UI string** lives in `strings.mjs` under the ids that `model.mjs` uses. The build fails when the code asks for a missing key.
- The CSP allows only the page's own script hash, inline styles, `data:`/`blob:` images and fonts, and same-origin clips. No external fonts, scripts or images.
- One fixed screen with no page scroll. The exception is very short windows (400% zoom), where the page scrolls vertically.

## Brand Commitments

- **The look stays** (brief: the owner chose polish within the current look). Keep the pine, paper and clay palette, the Geist headings and Inter body text, and the game's character: rounded pill buttons, translucent floating panels over a sunny 3D map, and the made-up Red Clay Ridge site. Recommend nothing that changes the visual identity. The look is shared with *Community Builders of Pecan Grove* (repo: style.css header). See DESIGN.md.
- **Narration is frozen** (brief). Never change a narrated line and never touch `voice/` or `docs/voice/`. These strings are narrated (`voice-lines.mjs` `lines()`), and each must stay word for word:
  - `introBody`, `introHow`;
  - every `phases.<id>.name` (or `.spoken`, where one is set: `mep`) and `phases.<id>.log`;
  - every `elements.<id>.log`;
  - every `cards.<id>.title`, `cards.<id>.body` and `cards.<id>.{a,b,c}.log`;
  - `logCx`, `endTitle`, `endBody`.
  
  Editing any of them drops its recorded clip, and `node build.mjs --strict` then fails.
- **Voice of the copy** (repo): plain, short, neutral sentences at about grade 7. Name what happened and why. Never take a side.
- **Name and credit** (repo): "Build the Campus"; "A project by A2 Learning Studio"; version badge "Play-test v1.5".

## Evidence on Hand

- **Real**: the 10 sources in About (as of October 2026); the educator sheet; the narration recorded with ElevenLabs (Impact Program); `social-preview.jpg`, a 1200 × 630 capture of the finished campus; the README kiosk checklist; the earlier audit (v2, 18 Oct 2026), whose fixes v1.4 and the owner's v1.5 brought into `main`.
- **Absent, and must not be made up**: testimonials, usage numbers, pilot results, endorsements, and any institutional endorsement beyond the stated credit. The 20-minute run time is the stated estimate; no timing study is in the repository. (inferred: the v2 report asked for it to be timed during the pilot)

## Product Principles

1. **Even-handed.** Show the trade-offs and the facts and let the player and the group decide. (repo)
2. **Nothing leaves the device.** No sign-up, no network calls during play, no analytics. Class and home modes store only on the device. (repo)
3. **Every gesture has a button, and every color has a word.** The map works by buttons and keys, and the ratings, the critical path and the siting fit never rely on color alone. (repo: CSS comments I3, AS-1, WCAG 2.5.7, 1.4.1)
4. **A shared machine forgets the last player.** A kiosk starts every visitor from the device's settings and clears the last summary. (repo: PA-1, I8)
5. **The facilitator is never surprised.** Nothing clears without warning, and the debrief can be printed or saved before it does. (repo: FEU-1, UD-4) (inferred wording)

## Accessibility & Inclusion

- **Standard** (brief, repo README): WCAG 2.2 AA, including:
  - keyboard play throughout, with a skip link to the Build panel and a focus that moves to the next action after each step;
  - screen readers: live regions, labelled groups and dialogs, and a voice-off switch for screen-reader users on the intro;
  - reduced motion;
  - 2.5.7, every map gesture has a button: zoom, turn, the four move buttons when zoomed in, Reset view;
  - 2.1.4, the single-key shortcuts can be turned off;
  - 2.5.8, target sizes;
  - 1.4.10 reflow and 1.4.12 text spacing;
  - forced colors.
- **Known limits, stated in the README**: the 3D map is visual only. Everything that counts is also in the panels, the schedule and the Site log as text. English only.
- **Age** (brief, repo): 12 and up, with younger players alongside an adult. Plain language. The jargon (switchgear, MEP, commissioning, critical path) is explained in the 25-term glossary.
- **Sound**: the voice is on by default on a kiosk and off with `?mode=library` or Library mode. Captions always show what the voice says.
