# Build the Campus: audit, 17 Oct 2026 (v1.1)

Method: a scripted keyboard-only playthrough, render statistics, a scan of every visible text's contrast and size, and screenshots at 1366×768, 1440×900 and 390×844. Content was reviewed for accuracy, neutrality and the standing rules. Headless Chrome uses software WebGL, so frame rates are a floor, not a measurement of a real laptop.

## Findings and what was done

| # | Area | Finding | Status |
|---|---|---|---|
| 1 | Play | Keyboard-only playthrough (N and 1) reaches turnover in 49 presses; all 3 issue cards fire; no console errors | Pass |
| 2 | Layout | Page height equals window height at all three sizes; no page scroll | Pass |
| 3 | Performance | 827 draw calls per frame, heavy for library laptops | **Fixed:** static parts are merged per material, now 293 (−65%) |
| 4 | Contrast | Locked phase names 2.86:1 (WCAG AA needs 4.5:1) | **Fixed:** now ≥ 4.5:1 everywhere |
| 5 | Readable at a distance | Labels as small as 10.9 px | **Fixed:** smallest text now about 12 px; the whole UI scales up on screens ≥1600 px and ≥1900 px wide |
| 6 | Kiosk | No reset between players | **Fixed:** after 2.5 minutes idle, a "Still building?" prompt; if no answer in 20 s, the game returns to the intro |
| 7 | Clarity | A built part's label showed for 3 s and could not be found again | **Fixed:** clicking a placed element flies the camera to it and shows its label |
| 8 | Neighborhood on map | Selecting an effect dimmed the others but did not show where it was | **Fixed:** the camera now moves to that effect |
| 9 | Accuracy | Intro said "90-acre"; the drawn site is about 45 acres | **Fixed** |
| 10 | Learning | End screen showed scores only | **Fixed:** it also lists every choice and card answer the player made |
| 11 | Strings table | "Kennesaw State University" and "mo" were hard-coded | **Fixed:** moved to `strings.mjs` |
| 12 | Robustness | No handling if the graphics card drops the 3D context | **Fixed:** a text message replaces the view |
| 13 | Credits/licences | three.js and font licences not shown | **Fixed:** listed in About |
| 14 | Neutrality | Text states facts and trade-offs; cooling type changes water and power, not the neighbor score | Pass |
| 15 | Rule 4 | Narration is third person; never speaks as Dr. Keyvanfar | Pass |
| 16 | Rule 2 | Site, street and company are made up | Pass |

## Open items (not changed; for his decision)

| Item | Why it matters | Suggested next step |
|---|---|---|
| Real-laptop speed | Software GL gives about 30 fps here, but the library hardware is unknown | Test on one library laptop; if slow, add an automatic low-quality mode (no soft shadows, lower resolution) |
| Spanish | `STRINGS.es` is empty; some screen-reader labels are set once in English | Translate, then switch `aria-label`s to the strings table |
| Pointing at 3D objects | Hovering a building does not name it | Add hover/tap labels in the 3D view |
| Only 3 issue cards | v1 scope | Add failed inspection, change order, safety incident, utility delay |
| Score meaning | Dashboard words (Fair, Good, Strong) have no explanation | Add a one-line "how this is scored" in About |
