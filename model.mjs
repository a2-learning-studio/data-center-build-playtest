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
  // Construction setbacks. `roll` is the phase that may draw the card once, when that phase is finished.
  // `chance` is the odds of the draw (the game stores the roll, so a resumed game does not draw again).
  // Option a holds the date and spends money. Option b spends time. A near miss means nobody was hurt.
  heat: { roll: "grade", chance: 0.8, opts: { a: { budget: 0.6, safety: 4 }, b: { budget: 0.1, safety: 2, sched: { grade: 1 } } } },
  haul: { roll: "util", chance: 0.8, opts: { a: { budget: 0.8 }, b: { budget: 0.1, sched: { util: 1.5 } } } },
  inspect: { roll: "found", chance: 0.8, opts: { a: { budget: 0.5 }, b: { sched: { found: 1 } } } },
  nearmiss: { roll: "shell", chance: 0.8, opts: { a: { budget: 0.2, safety: 6, sched: { shell: 0.5 } }, b: { safety: -4 } } },
  supply: { roll: "fitout", chance: 0.8, opts: { a: { budget: 0.7 }, b: { sched: { fitout: 1.5 } } } },
  retest: { roll: "cx", chance: 0.8, opts: { a: { budget: 0.6 }, b: { sched: { cx: 0.5 } } } },
};

// Where the player may site a piece, in metres. World x runs toward the county road, z toward the homes.
// `shift` is the scene tag that moves with the piece. `rects` are the footprints at the suggested spot.
// `box` is the limit: pad (graded earth), site (property, behind the setback line at z = 92), pond (may use the
// buffer), road (the exit slides along the county road). `near` must stay within LAYOUT_NEAR of that piece.
// `ease` must keep touching the transmission corridor. `axis` locks the other axis.
export const LAYOUT_NEAR = 70;
export const LAYOUT_GRID = 10;
export const LAYOUT = {
  roads: { shift: "roads", axis: "z", box: "road", rects: [{ x: -100, z: 0, w: 328, h: 12 }] },
  ponds: { shift: "ponds", box: "pond", rects: [{ x: -230, z: 22, w: 62, h: 58 }, { x: 108, z: 30, w: 70, h: 56 }] },
  substation: { shift: "substation", box: "site", ease: true, rects: [{ x: 135, z: -165, w: 70, h: 60 }] },
  slab: { shift: "hall", box: "pad", near: "pads", rects: [{ x: -152, z: -142, w: 184, h: 105 }] },
  pads: {
    shift: "yard",
    box: "site",
    near: "slab",
    rects: [{ x: 37, z: -136, w: 32, h: 49 }, { x: 79, z: -139, w: 14, h: 75 }, { x: 37, z: -55, w: 32, h: 16 }],
  },
};
export const LAYOUT_BOX = {
  pad: { x0: -170, x1: 130, z0: -158, z1: 18 },
  site: { x0: -236, x1: 220, z0: -170, z1: 92 },
  pond: { x0: -242, x1: 214, z0: -170, z1: 118 },
  road: { x0: -240, x1: 250, z0: -90, z1: 78 },
};
export const LAYOUT_EASE = { x0: 150, x1: 260, z0: -180, z1: -80 };

// One function so the build can paste it into the page. The model is stored as JSON, which drops functions.
export function createLayout(tables) {
  const { LAYOUT, LAYOUT_BOX, LAYOUT_EASE, LAYOUT_NEAR } = tables;
  function layoutRects(id, dx, dz) {
    const spec = LAYOUT[id];
    if (!spec) return [];
    return spec.rects.map((r) => ({ x: r.x + dx, z: r.z + dz, w: r.w, h: r.h }));
  }
  function layoutInside(r, b) {
    return r.x >= b.x0 - 0.01 && r.z >= b.z0 - 0.01 && r.x + r.w <= b.x1 + 0.01 && r.z + r.h <= b.z1 + 0.01;
  }
  function layoutOverlap(a, b) {
    return a.x < b.x + b.w - 0.05 && a.x + a.w > b.x + 0.05 && a.z < b.z + b.h - 0.05 && a.z + a.h > b.z + 0.05;
  }
  function layoutGap(a, b) {
    const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
    const dz = Math.max(0, Math.max(a.z - (b.z + b.h), b.z - (a.z + a.h)));
    return Math.hypot(dx, dz);
  }
  function layoutHits(r, b) {
    return r.x < b.x1 && r.x + r.w > b.x0 && r.z < b.z1 && r.z + r.h > b.z0;
  }
  // `placed` maps other piece ids to the offset already chosen. A missing neighbor is the suggested spot, for the
  // near check only. Returns "" or a short reason code the strings table names.
  function layoutIssue(id, dx, dz, placed = {}) {
    const spec = LAYOUT[id];
    if (!spec) return "";
    if (spec.axis === "z" && Math.abs(dx) > 0.01) return "road";
    const mine = layoutRects(id, dx, dz);
    const box = LAYOUT_BOX[spec.box] || LAYOUT_BOX.site;
    for (const r of mine) {
      if (!layoutInside(r, box)) {
        if ((spec.box === "pond" || spec.box === "site") && r.z + r.h > box.z1) return "setback";
        if (spec.box === "road" && r.x + r.w < 220) return "road";
        return spec.box === "pad" ? "pad" : "site";
      }
    }
    if (spec.ease && !mine.some((r) => layoutHits(r, LAYOUT_EASE))) return "utility";
    if (spec.near) {
      const pos = placed[spec.near] || { x: 0, z: 0 };
      const theirs = layoutRects(spec.near, pos.x, pos.z);
      let best = Infinity;
      for (const a of mine) for (const b of theirs) best = Math.min(best, layoutGap(a, b));
      if (best > LAYOUT_NEAR) return "near";
    }
    for (const [oid, pos] of Object.entries(placed)) {
      if (oid === id || !pos || !LAYOUT[oid]) continue;
      for (const a of mine) for (const b of layoutRects(oid, pos.x, pos.z)) if (layoutOverlap(a, b)) return "overlap";
    }
    return "";
  }
  return { layoutRects, layoutIssue };
}
const layoutApi = createLayout({ LAYOUT, LAYOUT_BOX, LAYOUT_EASE, LAYOUT_NEAR });
export const layoutRects = layoutApi.layoutRects;
export const layoutIssue = layoutApi.layoutIssue;

// When each question is asked: nothing is filled in ahead of time.
export const PHASE_START = { grade: ["route", "hours"], shell: ["light"] }; // asked when that phase's first element is placed
// Asked before that element is placed. Cooling is a design decision (I11): it sizes the water line, the power
// order and the pads, and the county asks about water use at rezoning, so it comes before zoning or the power study.
export const BEFORE_EL = { zoning: ["cool"], capacity: ["cool"], roads: ["wall"], clear: ["buffer"] };
export const NEED_FIRST = { clear: ["erosion", "roads", "ponds"] };
export const PHASE_REQUIRED = { site: ["cool"], grade: ["route", "hours", "buffer", "wall"], shell: ["light"], cx: ["test"] };
