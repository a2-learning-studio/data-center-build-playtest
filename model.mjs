// The game model in one place (I19): phases, choices, issue cards, when each question is asked, and how the
// scores are worked out. build.mjs checks it against strings.mjs and scene.js and hands it to game.js, so a phase,
// choice or card is defined here once. Every word the player sees stays in strings.mjs, under the same ids.

// Phases in build order, with typical duration ranges in months (typical, varies by project).
export const PHASES = [
  { id: "site", months: [6, 18], after: [], els: ["zoning", "capacity", "stormPlan", "meetings"] },
  // Erosion controls and sediment storage before clearing (Georgia GAR100001 Part IV.D.2).
  { id: "grade", months: [2, 6], after: ["site"], els: ["erosion", "roads", "ponds", "clear"] },
  { id: "util", months: [12, 36], after: ["site"], els: ["substation", "transmission", "water", "fiber"] },
  { id: "found", months: [2, 5], after: ["grade"], els: ["slab", "pads"] },
  { id: "shell", months: [4, 9], after: ["found"], els: ["panels", "steel", "roof"] },
  { id: "mep", months: [6, 12], after: ["shell"], els: ["switchgear", "ups", "gens", "cooling", "fire"] },
  { id: "fitout", months: [3, 6], after: ["mep"], els: ["racks", "containment", "trays"] },
  // Levels 1–4 are milestones during procurement and MEP. Only Level 5 is placed in this phase.
  { id: "cx", months: [2, 4], after: ["fitout", "util"], els: ["L5"] },
  { id: "turn", months: [0.5, 1], after: ["cx"], els: ["punch", "handover"] },
];
// Commissioning milestones that are awarded, not placed, and the MEP items that move through them.
export const CX_FLAGS = ["L1", "L2", "L3", "L4"];
export const MEP = ["switchgear", "ups", "gens", "cooling", "fire"];
// Elements with nothing to build on the map (a meeting), so the scene has no part for them.
export const NO_SCENE_PART = ["meetings"];

// The plan the schedule is judged against (C10). The midpoint critical path runs 43.25 months. The weather card
// always fires and adds at least half a month of grading, so the best run is 43.75 (shown as 44). Daytime hours add
// another month (grading and foundations), and that neighbor-friendly run must still rate Strong.
export const BASE_MONTHS = 45;

// Budget (I11). Time costs money: each month the finish moves past the midpoint critical path adds DELAY_PCT
// percent (crews, equipment rental, site offices and financing keep running). The plan holds a 3% contingency
// for surprises, so a run that stays inside it rates Strong.
export const DELAY_PCT = 0.3;
export const BUDGET_BANDS = [103, 104.5, 106]; // Strong, Good, Fair at or under; Watch above
export const SCORE_START = { safety: 82, hood: 35 };

// The seven choices. Effects: budget in % of plan, sched in added months per phase, hood and safety in points.
// Good-neighbor options are priced as the Industry Advisor recommends (I11): shielded lights cost about the same
// as standard ones, and the route, buffer and wall add a few tenths of a percent, not whole percents.
export const CHOICES = ["route", "hours", "buffer", "wall", "cool", "light", "test"];
export const EFFECT = {
  route: { a: { budget: 0.2, hood: 10 }, b: { hood: -10 } },
  hours: { a: { hood: 8, sched: { grade: 0.5, found: 0.5 } }, b: { hood: -8, safety: -4 } },
  buffer: { a: { budget: 0.4, hood: 10 }, b: { hood: -4 } },
  wall: { a: { budget: 0.3, hood: 8 }, b: {} },
  // Tags are panel marks only. Cooling does not move the neighbor score.
  cool: { a: { tags: ["power"] }, b: { tags: ["water"] } },
  light: { a: { hood: 5 }, b: {} },
  test: { a: { hood: 5 }, b: {} },
};
// Issue cards. `at` is the element or phase that brings the card, once that element is placed or that phase starts.
export const CARD = {
  weather: { at: "clear", opts: { a: { budget: 0.3, hood: 6, sched: { grade: 0.5 } }, b: { safety: -12, hood: -10, storm: 1, sched: { grade: 1 }, budget: 1, permit: 1 } } },
  // Long-lead equipment is ordered during design and permitting (I11), right after the utility capacity study.
  // Real transformer lead time is about 2–4 years; the months here are the shortened in-game wait.
  longlead: { at: "capacity", opts: { a: { budget: 1 }, b: { sched: { util: 9, mep: 4 } }, c: { budget: 0.5, sched: { mep: 4 } } } },
  labor: { at: "mep", opts: { a: { budget: 1.5, safety: -8, hood: -8, night: 1 }, b: { sched: { mep: 3 } }, c: { budget: 1.2, safety: 5, sched: { mep: 1 } } } },
};

// When each question is asked: nothing is filled in ahead of time.
export const PHASE_START = { grade: ["route", "hours"], shell: ["light"] }; // asked when that phase's first element is placed
// Asked before that element is placed. Cooling is a design decision (I11): it sizes the water line, the power
// order and the pads, and the county asks about water use at rezoning, so it comes before zoning or the power study.
export const BEFORE_EL = { zoning: ["cool"], capacity: ["cool"], roads: ["wall"], clear: ["buffer"] };
export const NEED_FIRST = { clear: ["erosion", "roads", "ponds"] };
export const PHASE_REQUIRED = { site: ["cool"], grade: ["route", "hours", "buffer", "wall"], shell: ["light"], cx: ["test"] };
