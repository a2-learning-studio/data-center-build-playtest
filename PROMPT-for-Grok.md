Please audit this educational game. I have attached its source files and screenshots.

About the game: "Build the Campus" is a free, offline, single-page web game for a public library panel on data centers (Fulton County Library, 27 Oct 2026; audience: teens, adults and families). The player is the construction manager building a data center campus on a made-up Georgia site, phase by phase: site and permits → clearing and grading → utilities → foundations → shell → MEP → data hall fit-out → commissioning levels 1–5 → turnover. It has a schedule with a critical path, 3 issue cards with trade-offs, a neighborhood panel (traffic, noise, dust and lighting, stormwater, cooling water, power, generator testing, jobs, tax revenue, setbacks) and a dashboard (schedule, budget, safety, neighbor relations). The 3D view uses three.js.

Rules the game must follow:
1. Strictly neutral: facts and trade-offs only, never for or against data centers.
2. No real company names or real sites.
3. All text in one strings table (`strings.mjs`) so Spanish can be added.
4. Narration never speaks as the author.
5. Offline, keyboard and touch, readable from a distance, no page scrolling.

Live game: https://a2-learning-studio.github.io/data-center-build-playtest/
Source: https://github.com/a2-learning-studio/data-center-build-playtest

Files:
- `strings.mjs`: every word the player sees
- `game.js`: rules, scoring, schedule, cards, panels
- `scene.js`: the 3D campus (three.js)
- `style.css`: layout and look
- `build.mjs`: assembles the single offline page
- `screenshots/`: laptop (1366×768) and phone (390×844) views

Please check and rank by severity:
1. Accuracy: are the construction phases, the commissioning levels L1–L5, the typical duration ranges and the neighborhood facts correct? Flag anything a construction professional would dispute.
2. Neutrality: does any wording, scoring or default choice lean for or against data centers?
3. Learning: will a teen understand what a construction manager does and why the order of phases matters?
4. Usability and accessibility: keyboard, touch, contrast, text size and clarity for first-time players at a library kiosk.
5. Code: bugs, performance risks on low-end laptops, and anything that breaks offline.

For each finding, give the file and line or the screenshot, why it matters, and a concrete fix.
