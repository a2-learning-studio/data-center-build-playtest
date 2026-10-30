---
name: Build the Campus
description: A data center construction game in pine, paper and clay. This file documents the existing look; polish within it.
colors:
  # Custom properties on :root in style.css
  pine: "#163a30"
  paper: "#f7f4ee"
  card: "#fffdf8"
  sunken: "#efeae1"
  ink: "#163a30"
  ink-2: "#33443d"
  muted: "#5d6b64"
  line: "#dcd7cc"
  line-strong: "#b9b2a6"
  card-glass: "#fffdf8f2"
  card-veil: "#fffdf8e6"
  card-mist: "#fffdf8d9"
  clay: "#a9492a"
  clay-ink: "#94401f"
  clay-soft: "#f6e4da"
  pine-soft: "#e6f0eb"
  gold: "#e69f00"
  focus: "#13243b"
  focus-stage: "#f0b43c"
  good: "#1f8a5b"
  warn: "#d08a00"
  bad: "#c2452a"
  good-ink: "#1f6f4f"
  # Literals in style.css that carry a role (not custom properties)
  white: "#ffffff"
  pine-deep: "#0a1a15"
  pine-veil: "#163a30e6"
  bar-frost: "#ffffff12"
  bar-pill-line: "#f7f4eecc"
  kpi-label-ink: "#bfd1c8"
  kpi-word-ink: "#e3ece7"
  disabled-fill: "#cfc8bc"
  disabled-ghost-ink: "#6b756f"
  disabled-ghost-line: "#b9b2a6"
  locked-ink: "#5f6b65"
  chip-good-bg: "#dff1e8"
  chip-neutral-bg: "#e7eef2"
  bar-other: "#6f9a7a"
  track-grid: "#e5dfd4"
  stage-sky: "#cfe0ec"
  stage-ground: "#f4ecdf"
  rating-high-on-pine: "#5fd39a"
  rating-mid-on-pine: "#f0b43c"
  rating-low-on-pine: "#ff7a5a"
  rating-none: "#9fb3aa"
  effect-noise: "#d4532c"
  effect-trucks: "#e19a00"
  effect-storm: "#1d7fc9"
  effect-power: "#c04f9f"
  effect-setback: "#00a37a"
  effect-dust: "#b0743c"
typography:
  display:
    fontFamily: "Geist, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 1.2rem + 1.6vw, 2.4rem)"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Geist, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Geist, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.15
  brand:
    fontFamily: "Geist, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.15
  score:
    fontFamily: "Geist, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.45
  button:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
  button-big:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
  button-small:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 700
  label:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.09em"
  label-tile:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  chip:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.76rem"
    fontWeight: 700
  message:
    fontFamily: "Inter, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.35
rounded:
  meter: "3px"
  bar: "4px"
  lane: "8px"
  segment: "9px"
  control: "12px"
  tile: "14px"
  box: "16px"
  panel: "20px"
  dialog: "24px"
  pill: "999px"
spacing:
  hairline: "2px"
  tight: "4px"
  snug: "6px"
  gap: "8px"
  loose: "10px"
  roomy: "12px"
  panel-inset: "16px"
  panel-pad: "16px"
  dialog-pad: "26px 28px"
  dialog-pad-tabbed: "20px"
components:
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.clay-ink}"
    textColor: "{colors.white}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-fill}"
    textColor: "{colors.ink-2}"
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    height: "50px"
  button-ghost-hover:
    backgroundColor: "{colors.pine-soft}"
    textColor: "{colors.ink}"
  button-ghost-disabled:
    backgroundColor: "{colors.white}"
    textColor: "{colors.disabled-ghost-ink}"
  button-big:
    typography: "{typography.button-big}"
    padding: "14px 30px"
    height: "56px"
  button-small:
    typography: "{typography.button-small}"
    padding: "6px 14px"
    height: "40px"
  pill-bar:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "44px"
  pill-map:
    backgroundColor: "{colors.card-veil}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "44px"
  map-button:
    backgroundColor: "{colors.card-veil}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    size: "40px"
  map-button-pressed:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.white}"
  kpi-tile:
    backgroundColor: "{colors.bar-frost}"
    textColor: "{colors.paper}"
    rounded: "{rounded.tile}"
    padding: "5px 12px 6px 22px"
  badge:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.pine}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-neutral:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  chip-bad:
    backgroundColor: "{colors.clay-soft}"
    textColor: "{colors.clay-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  chip-good:
    backgroundColor: "{colors.chip-good-bg}"
    textColor: "{colors.good-ink}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  element-row:
    backgroundColor: "{colors.clay-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "7px 12px"
    height: "48px"
  element-row-done:
    backgroundColor: "{colors.pine-soft}"
  element-row-locked:
    backgroundColor: "{colors.sunken}"
  answer-option:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "12px 14px"
    height: "60px"
  segment-pressed:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.segment}"
    height: "40px"
  side-tab-pressed:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "40px"
  phone-tab-pressed:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.pine}"
    rounded: "{rounded.pill}"
    height: "40px"
  panel:
    backgroundColor: "{colors.card-glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-pad}"
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "{spacing.dialog-pad}"
  toast:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.white}"
    typography: "{typography.message}"
    rounded: "{rounded.tile}"
    padding: "10px 16px"
  caption:
    backgroundColor: "{colors.pine-veil}"
    textColor: "{colors.white}"
    rounded: "{rounded.tile}"
    padding: "8px 16px"
  built-tag:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  map-hint:
    backgroundColor: "{colors.card-mist}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  siting-box:
    backgroundColor: "{colors.pine-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.box}"
    padding: "10px 12px"
  setting-row:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "10px 14px"
---

# Design System: Build the Campus

> **This file documents the existing look; polish within it.** The owner chose to keep the game's colors, fonts and character. The values here are read from `style.css`, `build.mjs`, `game.js` and `scene.js` at `5a1b1ec`. Where the source is inconsistent, this file says so under **Recorded inconsistencies** and does not choose a rule. No owner interview ran, so the qualitative names are the source's own words or are marked provisional. Not published: `_config.yml` keeps this file off the game site. No `.impeccable/design.json` sidecar was written: this is a documentation pass for an audit, and the frontmatter and the prose hold everything below.

## Overview

**Creative North Star: "Pine, paper and clay"** (provisional: the words of the header comment in `style.css`, "pine stage #163a30, paper #f7f4ee, clay #a9492a pill buttons, Geist headings, Inter body". The owner has not named one.)

The game is one fixed screen: a dark pine top bar with four score tiles, and under it a sunny 3D model of a red-clay construction site that fills the stage. Warm cream panels float over the map, slightly translucent with a soft blur, with generous 20 px corners. Every action is a fully rounded pill: clay orange for the next step, white with a dark green outline for the alternatives. Color is functional and sparing. Pine marks the brand and anything selected, clay marks what to do next and what costs something, gold marks the version badge and the "new" moments, and green, gold and red appear only as rating dots beside their words. Type pairs Geist (headings, the game's name, score values) with Inter (everything else), mostly at weights 600 and 700, so even small labels read firmly on a projector.

Density is high but calm. The side panels hold many rows at 0.78 to 0.92 rem, but each row is a large, clearly bounded button, and the map always keeps the open middle of the screen. The look is shared with the studio's other game, *Community Builders of Pecan Grove*. Accessibility is part of the look: rating words beside every dot, hatched as well as red critical-path bars, a 3 px focus ring, a forced-colors mapping, and a 16 px floor for labels on kiosks and in presenter view.

**Key Characteristics:**
- Pine bar, cream panels floating over a full-bleed 3D site, and a paper footer.
- Pill buttons everywhere. Clay is the action color; white with a 2 px ink outline is the alternative.
- Geist 700 for headings and numbers, Inter 600 and 700 for UI text, Inter 400 for running text.
- Translucent surfaces with backdrop blur (panels 10 px, map controls 6 px) and a two-layer pine-tinted shadow.
- Color never carries meaning alone: words, hatching, outlines and dashes back it up.
- Light theme only. No dark mode exists. Windows contrast themes get a full forced-colors mapping.

## Colors

A forest-green and warm-cream palette with one terracotta action color and one amber highlight. The 3D map supplies the sky blues, grass greens and the red-clay dirt.

### Primary
- **Clay** (`clay`): the action color. Primary buttons (Start building, Place, Finish phase, Next, Build it here), the element-row marks, the critical-path bars and their hatched swatch, the dot that marks a changed tab, and the in-progress or ready lane icons. White text on clay is 5.72:1.
- **Clay ink** (`clay-ink`): the primary button's hover, the uppercase kickers, the element action words ("PLACE"), links in dialogs, the "does not fit" siting line, and the file error. 6.86:1 on card.
- **Clay soft** (`clay-soft`): the fill of element rows and of the "bad" chips.

### Secondary
- **Pine** (`pine`, the same value as `ink`): the top bar and the phone tab bar, every pressed or selected state (side tabs, map buttons, the inset ring on segments, the hood-row border), done marks, the meter fill, toasts, the floating tag, the caption backing (at 90%), the favicon tile and the 3D campus sign.
- **Pine soft** (`pine-soft`): the done element rows, a pressed lane or hood row, the siting box, and the ghost-button hover.

### Tertiary
- **Gold** (`gold`): the version badge, the drag hint for 4.5 s at the first zoom (`hint-new`), and the accent on the 3D campus sign.
- **Stage gold** (`focus-stage`): the focus ring on the pine bar, on the phone tabs and on the skip link. The same hex is the "Fair" dot on the score tiles.

### Neutral
- **Paper** (`paper`): the page and footer background, the text and outline on the bar, and the pressed phone tab.
- **Card** (`card`): dialogs, the sticky dialog footers, the nojs and nogl notes. At 95% (`card-glass`) it fills the floating panels; at 90% (`card-veil`) the map pills and map buttons; at 85% (`card-mist`) the drag hint.
- **White** (`white`, a literal): answer options, ghost buttons, segment fills and meter cells. Pure white sits on the cream card.
- **Sunken** (`sunken`): wells and tracks: side-tab and segment tracks, the hood detail box, setting rows, end-stat tiles, range pills, neutral chips, kbd hints, locked element rows.
- **Line** (`line`): the panel border (at 80%), the answer-option border and the meter cell ring. It is 1.41:1 on card.
- **Ink** (`ink`), **Ink 2** (`ink-2`), **Muted** (`muted`): text at 12.28:1, 10.15:1 and 5.50:1 on card. Muted is 4.67:1 on sunken.
- **Pine deep** (`pine-deep`, used only with alpha): the dialog backdrop (40%), the intro backdrop gradient, the nojs veil, and the dialog shadow.

### Status and rating colors
- **On the pine bar**, the score-tile dots: high `rating-high-on-pine` (Strong, Good), mid `rating-mid-on-pine` (Fair), low `rating-low-on-pine` (Watch, Concern), none `rating-none`. Each has a 3 px halo at 20% alpha. On pine they measure 6.70, 6.72, 4.87 and 5.65:1.
- **On the end screen**, the dots on sunken use the status tokens `good`, `warn` and `bad`, and `rating-none` (the rating word sits beside each one; the earlier `#2f9e6a`, `#d89a1c` and `#d9573b` palette is retired) (2.82, 2.05 and 3.26:1; the rating word sits beside each one).
- **Chips**: good `chip-good-bg` with `good-ink` text (5.19:1); bad `clay-soft` with `clay-ink` (5.65:1); neutral `chip-neutral-bg` or `sunken` with `ink`.
- **Siting fit**: `good-ink` on pine-soft for "This spot fits." (5.23:1) and `clay-ink` for the reasons it does not (5.98:1).
- **Tokens `good`, `warn` and `bad`**: defined on `:root` and used nowhere in `style.css`. The `good` and `bad` values reappear as literals in `scene.js` for the siting footprints.

### Map-effect swatches
The small square before each Neighbors row names that effect's color on the map: noise and generators `effect-noise`, trucks `effect-trucks`, stormwater `effect-storm`, power `effect-power`, setback `effect-setback`, dust and night lighting `effect-dust`. Water, tax and jobs have none. On card they measure 4.07, 2.34, 4.19, 4.25, 3.17 and 3.82:1. They are `aria-hidden` and sit next to the row's name.

### Named Rules
**The Word-With-Every-Dot Rule.** A rating is never a dot alone. Every score tile shows its word at every width (short forms below 1180 px), and the end screen does the same (style.css I3, WCAG 1.4.1).

**The One-Ink Meter Rule.** Neighbors meters fill in pine only. They show an amount, not a rating, so red, gold and green keep their dashboard meaning (UD-6).

**The Dark-Ink Text Rule.** Text on a pale tint uses the darker inks (`good-ink`, `clay-ink`), never the mid-tone status colors (AS-1, WCAG 1.4.3).

### Recorded inconsistencies (colors)
- Literals duplicate tokens, outside `:root` and comments: `#f7f4ee` (paper) four times plain and once at 80% in the bar, pill and tab rules; `#fffdf8` (card) once plain and four times with alpha suffixes; `#dcd7cc` (line) twice with alpha; `#163a30` (pine) six times with alpha in shadows and the caption; `#1f6f4f` as `good-ink` and again as a literal in `.chip[data-tone=good]`; and `#f0b43c` is `focus-stage` and also the Fair dot.
- There are two near-whites: pure `#fff` (22 uses) and `card` `#fffdf8`.
- Grays sit close together: `muted` `#5d6b64`, `locked-ink` `#5f6b65` and `disabled-ghost-ink` `#6b756f`.
- There are three rating palettes: the dots on the bar, the dots on the end screen, and the unused `good`, `warn` and `bad` tokens. The end-screen "Good" is `#2f9e6a`, the tile "Good" is `#5fd39a`, and the siting "fits" is `#1f8a5b`.
- The swatches do not all match the map. Four of six Neighbors swatches differ in hex from the overlay they name in `scene.js`: trucks `#e19a00` against `#ffb000`, storm `#1d7fc9` against `#1d8fe0`, power `#c04f9f` against `#d65db1`, dust `#b0743c` against `#b88a5a`. Noise, generators and setback match.
- The favicon's roof stroke is `#e0763c`, an orange that appears nowhere else.
- The educator sheet has its own palette: ink `#1d1d1b`, muted `#55534e`, rule `#d8d4cc`, accent `#9a3b1b`, panel `#f6f3ee`. It shares no token with the game.

## Typography

**Display font:** Geist, variable 100–900, inlined as a data URL (fallbacks: Segoe UI, ui-sans-serif, system-ui).
**Body font:** Inter, variable 100–900, inlined (same fallbacks).
**Mono:** none in the game (`kbd` inherits Inter). The educator sheet uses `ui-monospace, Consolas`.

**Character:** a geometric grotesk for names and numbers over a neutral, highly legible UI sans. Most UI text is set at 600 or 700, which reads firmly on projectors and in small sizes. Uppercase tracked labels give each section a quiet heading.

### Hierarchy

Type tokens on `:root`: `--fs-xs` .75rem, `--fs-sm` .8rem, `--fs-row` .85rem and `--fs-ui` .9rem; sizes within .01rem of them use them. The .78, .82, .88 and .92rem sizes remain where they are.
- **Display**: the intro title and `h1`. Geist 700, `clamp(1.7rem, 1.2rem + 1.6vw, 2.4rem)`, line height 1.15.
- **Headline**: the dialog titles and the phase name in the Build panel (`h2`). Geist 700, 1.25rem, line height 1.15; 1.375rem in dialogs other than the intro (BTC-UX-V09).
- **Title**: `h3` sections in dialogs, and the schedule heading. Geist 700, 1rem; 1.125rem in dialogs.
- **Brand**: the game's name in the bar. Geist 700, 1.2rem (1.05rem tabbed, 1rem on a 1024 px projector), no wrap.
- **Score**: the tile values. Geist 700, 1.05rem, tabular figures (0.95rem at 1040 px and below, 0.8rem tabbed).
- **Body**: Inter 400, 1.0625rem at line height 1.45 (16 px in the tabbed layout). Paragraph spacing 0 0 10px. There is no set line length; dialogs cap at 620 to 700 px.
- **Small text**: `.muted` 0.9rem; the side panels use 0.8 to 0.92rem at weight 600.
- **Label**: kickers in Inter 700, 0.75rem, letter spacing 0.09em, uppercase, clay-ink. The tile labels, Site log heading and end-stat terms use 0.08em; the element actions 0.06em; the Neighbors group heads 0.04em.
- **Message**: toasts in Inter 600, 0.95rem, line height 1.35. Captions are 1rem at 1.35 (0.85rem tabbed, 0.8rem on landscape phones).
- **Root size**: 16 px; 18 px at 1600 × 860 and up; 20 px at 1900 × 1000 and up, and in presenter view. All sizes are rem, so they scale with it.
- **Print**: the debrief at 10 pt, line height 1.25; title 16 pt; sections 11.5 pt; muted text 9 pt.

### Named Rules
**The 16 px Label Floor.** On kiosk screens (1900 × 1000 and up) and in presenter view, every small label class (kicker, tile label and word, element action and reason, lock, chip, Neighbors head, lane icon, axis, legend, end-stat term) goes to 0.8rem at a 20 px root: 16 px (I10, AS-9).

**The Short-Form Rule.** On laptops the tiles switch to short forms instead of truncating. Each tile label, value, word and the badge has a long and a short form, switched at 1240, 1180 and 1040 px. In the tabbed layout the labels wrap and only the value and the word may ellipsize (I3, WCAG 1.4.12).

### Recorded inconsistencies (type)
- There are 19 distinct rem sizes from 0.74 to 1.25, plus the display clamp: .74, .75, .76, .78, .8, .82, .84, .85, .86, .88, .9, .92, .95, 1, 1.05, 1.0625 (the body, set in the `font` shorthand), 1.1, 1.2 and 1.25. Several pairs are within 0.02rem of each other.
- Uppercase tracking takes five values: .03, .04, .06, .08 and .09em.
- Line heights include 1.15, 1.2, 1.25, 1.3, 1.35, 1.4 and 1.45, with no scale.
- The smallest screen text is 0.74rem (11.8 px, the drag hint in the tabbed layout); 0.75rem is 12 px.
- The educator sheet sets `system-ui` at 0.9375rem, not Inter or Geist.

## Layout

**One fixed screen, no page scroll.** `.app` is a three-row grid filling `100dvh`: the bar, the stage and the footer. Only windows 1100 px wide or less and 300 px tall or less (such as 400% zoom) scroll vertically.

**Side-panel layout** (1101 px wide and up, or 1024 px and up in landscape and at least 601 px tall):
- The map fills the stage. The Build panel floats at the left (`--pl` 20.6rem), the side panel (Neighbors | Choices) at the right (`--pr` 22rem), and the schedule at the bottom between them. All are inset 16 px from the edges.
- The toolbar (Effects, Voice, drag hint) and the map buttons sit in the open middle between the panels. The narration caption hangs just under the toolbar.
- Panel widths step down to 18.75/19.9rem at 1240 px and 17.5/18.5rem at 1100 px.
- At 900 px tall and below (1366 × 768, 1440 × 900), the schedule starts as a wrapping row of phase chips with a "Show timeline" toggle. At 800 px and below, the schedule note hides.

**Tabbed layout** (1023 px and below, or 1100 px and below in portrait, or 1100 px and below at 600 px tall or less):
- The map takes the top 38% of the stage (45% on portrait tablets, 62% in presenter view), never less than `--scene-min`. Under it sit a pine tab bar (Build · Schedule · Neighbors · Choices) and one panel, edge to edge with no radius.
- Landscape phones (500 px tall or less): the map on the left, the tabs and panel on the right (`--pw` max(45%, 17.5rem)).
- 360 px and below: the short badge, tighter tiles, and the tile dot moved to the bottom corner.

**Measured, not guessed.** `game.js` `measureSafe()` writes `--top-room`, `--cam-h`, `--plan-h`, `--scene-min`, `--tools-b` and `--cam-t` on every resize. The schedule then never grows into the toolbar, the caption or the map buttons, and the 3D camera centers the campus in the open area between the panels (`scene.setSafe`).

**Spacing.** No spacing tokens exist; the frontmatter `spacing` names the common observed steps. The observed values (see Shapes) are used for:
- gaps of 4 to 10 px inside components;
- a 16 px panel inset and panel padding;
- dialog padding of 26 × 28 px (20 px tabbed);
- 8 px gutters in the tabbed layout.

**Layers (z-index).** Panels 2 · built tag and caption 3 · toolbar, map buttons and nogl note 4 · toast 20 · skip link 30 · nojs note 50 · dialogs in the top layer.

**Presenter view.** In the side-panel layout, the side panel and the schedule hide, the Build panel narrows to 16.5rem, the map buttons, toolbar and caption reach the right edge, and the root is 20 px.

### Named Rules
**The Open-Middle Rule.** The toolbar, the caption, the map buttons and the schedule never overlap. Only their buttons take clicks (`pointer-events:none` on the strips), so nothing over the map blocks a panel (I9).

## Elevation & Depth

Depth is a hybrid of translucency and soft, pine-tinted shadow. Surfaces over the map are slightly see-through with a backdrop blur, so the site stays present behind them. Surfaces on paper are flat.

### Shadow Vocabulary
- **Float** (`--shadow`: `0 2px 4px #163a3024, 0 14px 32px -10px #163a3070`): panels, the skip link, the nojs and nogl notes, the built tag, the toast and the caption.
- **Button lift** (`0 1px 2px #163a302e, 0 3px 8px -2px #163a3042`): primary `.btn` only. Ghost and disabled buttons have none.
- **Dialog** (`0 30px 70px -18px #0a1a1599`): every `<dialog>`, over a backdrop of `#0a1a1566` with a 2 px blur. The intro's backdrop is a gradient from clear to `#0a1a1580`, so the turning campus shows through.
- **Pinned footer** (`0 -10px 12px -10px #163a3033`): the sticky button rows at the bottom of the intro, end and About dialogs.
- **Segment pressed** (`0 1px 3px #163a3033` plus an inset 2 px pine ring).
- **Halo rings**: the tile dots (3 px at 20% of their color) and the changed-tab dot (2 px white).

### Named Rules
**The Glass-Over-Map Rule.** Anything floating over the 3D map is translucent card with a backdrop blur (panels 95% with 10 px, map pills and buttons 90% with 6 px). In the tabbed layout the panels sit below the map and turn opaque, flat and borderless.

## Shapes

Soft and friendly. Every action is a full pill (999 px); containers use large radii that step down as they nest.

- The typical-range pill on a phase (`.range`) is rounded at 0.8em, so it follows its text size (BTC-UX-V08).
- Radii in use: dialog 24 px · panel 20 px (`--radius`) · siting box and answer option 16 px · tiles, element rows, toast, caption, setting rows and end-stat tiles 14 px · map buttons, hood rows and segment tracks 12 px (map buttons 10 px tabbed) · segment buttons 9 px · lanes and kbd 8 px · schedule bars 4 px · meter cells and legend swatches 3 px · circles 50% (element marks, lane icons, dots).
- Borders: 2 px solid ink on ghost buttons, map pills, map buttons and the timeline toggle; 2 px paper at 80% on the bar pills; 2 px line on answer options; 1 px line at 80% on panels; 2 px transparent on element and hood rows, which turns clay or pine on hover or press. A map pill that is off (`aria-pressed="false"`) has a **dashed** border.
- The built tag has a 10 px rotated-square pointer. The schedule track has a 12.5% grid of 1 px `track-grid` lines.

### Recorded inconsistencies (shapes)
- Twelve px radius values (2, 3, 4, 8, 9, 10, 12, 14, 16, 20, 24 and 999 px), plus 50% and 0. The `--radius` token is used twice (panels and the nojs note); every other radius is a literal.
- Spacing has no scale. Padding, margin and gap use 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28 and 30 px. The most common are 8 px (48 uses), 6 px (37), 4 px (36) and 10 px (33).

## Components

### Buttons
- **Shape:** full pill (999 px), weight 700.
- **Primary** (`.btn`): clay with white text, 12 × 22 px padding, minimum height 50 px, the button-lift shadow. Hover: clay-ink. Disabled: `disabled-fill` with ink-2 text, no shadow, `not-allowed` cursor.
- **Ghost** (`.btn-ghost`): white, 2 px ink border, ink text, no shadow. Hover: pine-soft. Disabled: white, `disabled-ghost-ink` text, `disabled-ghost-line` border.
- **Sizes:**
  - Big (`.btn-big`): 1.1rem, 14 × 30 px, 56 px, for Start, Resume, Play again and Keep playing.
  - Small (`.btn-small`): 0.88rem, 6 × 14 px, 40 px, for Undo, Start over, Build it here, Cancel, Open results file and the intro Voice button.
  - Wide (`.btn-wide`): full width, for Finish phase and Next.
  - On phones the end-screen buttons sit two to a row, 48 px.
- **Focus:** a 3 px solid `focus` outline at a 2 px offset (15.4:1 on card). On the pine bar, the phone tabs and the skip link it is `focus-stage`. The canvas outline is inset 4 px.
- **Choice of primary:** on the intro, Start a new game turns ghost when Resume your game is offered. Listen is always ghost.

### Header pills and map pills
- **Bar pills** (About, language): transparent, paper text, 2 px paper border at 80%, 44 px (40 px tabbed). Hover: white at 10%.
- **Map pills** (`.pill-dark`: Effects on map, Voice, Reset view): `card-veil` with a 6 px blur, ink text and border, 44 px (40 px in the map-button row, 36 px tabbed, 34 px at 360 px, 32 px on landscape phones). Hover: white. Off: dashed border. The label text says the state ("Voice: on" or "Voice: off").

### Map buttons
- **Style** (`.cb`): a 40 px square at 12 px radius, `card-veil` with a 6 px blur, 2 px ink border, and a 20 px stroked icon. 36 px tabbed, 34 px at 360 px, 32 px on landscape phones.
- **Set:** Zoom in · Zoom out · Turn left · Turn right · Presenter view (a pressed toggle: pine fill, white icon) · Reset view (a map pill). Move left, forward, back and right appear only while zoomed in.
- **Group:** `role="group"` "Map view", with a nested group "Move the view". Every button has an `aria-label` and a `title`. The row wraps, right-aligned, above the schedule.

### Tabs and segmented controls
- **Side tabs** (Neighbors | Choices): a sunken pill track with 4 px padding. Pressed: pine fill, white text. 40 px.
- **Phone tabs** (`.tabs`): on the pine bar. Paper text. Pressed: a paper pill with pine text. Focus in `focus-stage`. 40 px. The Neighbors tab (here and in the side tabs) gets a 9 px clay dot at the top right when that panel changed out of sight.
- **Choice segments** (`.seg`): a two-up sunken track at 12 px radius. Buttons 40 px, 0.84rem, weight 600. Pressed: white with a 2 px inset pine ring and a soft shadow. Disabled: 45% opacity. A locked choice shows a lock icon and "Locked: that work is done".
- **All pressed states** use `aria-pressed`.

### Build panel rows
- **Element row** (`.el`): a full-width button, clay-soft, 14 px radius, 48 px (44 px tabbed). It has a 26 px circular mark (plus, check or lock), the name in 600, an optional reason line (0.78rem, ink-2), and an uppercase action word in clay-ink. Hover: clay border and a 1 px lift (the only CSS transition, 0.15 s). Done: pine-soft with a pine mark and a muted word. Locked: disabled, sunken, 85% opacity.
- **Siting box** (`.place-box`): pine-soft with a 2 px pine border at 16 px radius. It holds a kicker, the hint, the keys or touch line, the fit message (bold, good-ink or clay-ink) and the Build it here and Cancel buttons.
- **Range pill** (`.range`): the typical duration, 0.8rem, on sunken.
- **Commissioning track** (`.cx`): name and state rows at 0.86rem.
- **Site log**: an uppercase muted heading, then the 3 latest lines at 0.86rem. The newest is ink and 600.
- **Footer row**: Undo last step and Start over as small ghost buttons.

### Answer options (issue cards and decisions)
- **Style** (`.opt`): white, 2 px line border, 16 px radius, 12 × 14 px padding, at least 60 px. Hover: pine border.
- **Content:** the label in 700, with a 26 px kbd number hint (hidden when shortcuts are off). A decision adds a note in 0.85rem muted. Then the effect chips, and an optional "why" note.
- **Dialog head:** a kicker ("Issue card" or "Your choice"), an `h2` title, the body, and "Choose one".

### Chips and badges
- **Chips** (`.chip`): 0.76rem 700 pills with 1 × 7 px padding, in a good, bad or neutral tone. Text such as "Finish +1 mo", "Budget +2%", "Safety −5", "Neighbor relations +4 · counts from grading".
- **Version badge**: gold with pine text, 0.8rem 700, a 2 × 10 px pill. It shows "Play-test v1.5" and "v1.5" below 1040 px.

### Dashboard tiles
- **Style** (`.kpi`): white at 7% on pine, 14 px radius. An 8 px status dot with a halo, then the label (uppercase 0.75rem 700, 0.08em, `kpi-label-ink`), the value (Geist 700 1.05rem, tabular) and the rating word (0.78rem 600, `kpi-word-ink`).
- **Layout:** four tiles centered in the bar. In the tabbed layout they form a four-column grid under the brand, with labels in sentence case.
- **Before grading:** the Neighbors tile shows "—" and "Starts at grading", with the gray dot.

### Neighbors rows
- **Row** (`.hood-row`): a three-column button: name with its swatch, a 4-cell meter, and a word. 38 px, 12 px radius. Hover: sunken. Pressed (shown on the map): pine-soft with a pine border.
- **Meter:** 13 × 10 px cells at 3 px radius. Off cells are white with a 1.5 px line ring; on cells are pine.
- **Around the rows:** group heads in uppercase 0.78rem muted. The detail box is sunken at 14 px radius and at least 84 px tall (70 px at 800 px tall or less). Below it, the breakdown line and the score note.

### Schedule
- **Lanes** (`.lane`): buttons with a 22 px icon column (20 px circle), a 6.5rem name and a track, 28 px tall (32 px on touch and tabbed). Pressed: pine-soft.
- **Lane icons:** done pine with a check; now or ready clay with the number; locked sunken with a lock.
- **Bars:** the plan bar is `bar-other` at 4 px radius. A critical-path bar is clay plus 135° white hatching. The bar in progress has a 2 px ink outline. The typical range is a thin 2 px ink-2 line at 50% with end ticks.
- **Axis and legend:** the axis ticks every 6 months; the legend repeats the three swatches.
- **Collapsed chip row:** in the side-panel layout at 900 px tall or less, lanes become pills on sunken. A critical-path lane gets a 4 px hatched clay underline. The "Show timeline" toggle is a 28 px ghost pill.

### Dialogs
- **Style:** card, 24 px radius, 26 × 28 px padding (20 px tabbed), the dialog shadow. Maximum width 620 px (intro 660, end 700). Maximum height `100dvh − 24px`, scrolling inside.
- **Intro, end and About:** the button row is pinned to the bottom with the pinned-footer shadow, and `scroll-padding-bottom` keeps a focused control clear of it (WCAG 2.4.11). At 300 px tall or less the rows scroll with the content.
- **Which can close:** the intro, issue cards and the end screen cannot be closed with Escape (`closedby="none"` plus a guard that reopens them). On the idle prompt, Escape counts as Keep playing. About closes on any request. "Start over?" is a small dialog with Start over and a ghost Keep playing, and Escape closes it.
- **Setting rows** (`.libmode`): a 22 px checkbox in `accent-color: pine` with a bold label and a muted note, on a sunken tile at 14 px radius.
- **End-screen tiles:** a 2-column grid of sunken tiles (4 columns in print). Each has an uppercase term, a value, a dot with the rating word, and a "Plan: …" line.

### Messages over the map
- **Toast:** pine, white 600 0.95rem text, 14 px radius, over the map just above the map buttons, centered between the panels, at most 35rem wide. It never takes clicks. It shows for 3.5 to 9 s (55 ms per character).
- **Caption:** `pine-veil`, white 1rem text at line height 1.35, 14 px radius, centered under the toolbar, at most 640 px wide. Clicks pass through it.
- **Built tag:** a pine pill, white 0.85rem 700, with a pointer. It follows the new part for 3.2 s and hides while the part is under the toolbar.
- **Drag hint:** a `card-mist` pill in 0.8rem ink-2. At the first zoom it turns gold with pine bold text for 4.5 s.
- **nogl note:** card, 14 px radius, the float shadow, 600 text, placed where the map buttons would be.

### Icons
Inline SVG only; no icon font, no images.
- **Map buttons:** a 24 × 24 viewBox, stroked in `currentColor` at 2.4, round caps and joins. Plus, minus, two curved turn arrows, four chevrons, and a presenter screen on a stand (it was four corners, which read as full screen) presenter corners.
- **Element and lane marks:** a 16 × 16 viewBox. Check and plus are stroked at 2.2. The lock is a filled body with a 1.6 stroked shackle.
- **Favicon:** a 64 px pine tile with 14 px radius, an orange roof line and a paper building.
- *Recorded inconsistency:* stroke weights are 2.4, 2.2 and 1.6.

### 3D map (signature component)
- **Scene:** a 520 × 360 m site tile with banded soil sides on a sky dome (top `#8fbbe6`, middle `#e7eef2`, low `#f4ecdf`), with fog `#e9eef0` from 1400 to 2600 m. Lighting is a hemisphere light (`#e4f0ff` over `#a0906c`) and a warm sun (`#fff3e0`) with soft shadows, through ACES filmic tone mapping at exposure 1.05. Before the first frame, the stage shows a CSS gradient from `stage-sky` to `stage-ground`.
- **Ground and materials:** speckled canvas textures for grass (`#7c9a58`), red-clay dirt (`#b98c5f`), asphalt (`#55595e`), gravel (`#b4ada2`) and slab (`#c7c3ba`). Off-white buildings (`#ecebe5`), galvanized and dark metals, machine yellow (`#f0b323`), glass, water (`#3d6f73`), a pulsing green beacon (`#1fdf86`), and warm lamps.
- **Signs:** the campus sign is pine with paper letters and a gold accent. A public-notice board carries "PUBLIC NOTICE · Rezoning hearing" from the strings table.
- **Effect overlays** (only while "Effects on map: on"): truck routes as amber tubes with scrolling stripes (`#ffb000`), stormwater flow (`#1d8fe0`), the setback line (`#00a37a`), power lines in magenta (`#d65db1`, the transmission wires take the same color), noise and generator rings that expand (`#d4532c`), dust particles (`#b88a5a`), night-light glow (`#ffc94a`, additive), and a white cooling plume. While a Neighbors row is in focus, its layer shows at 1.6× opacity and the others fade to 0.15×.
- **Siting footprints:**
  - fits: `#1f8a5b` at 45%;
  - does not fit: `#c2452a` with diagonal hatching at 85%;
  - already placed: pine at 22%;
  - the piece being sited: a 2 m outline in `#10261d`;
  - the setback line in `#00a37a`.
  
  Neither fit nor ground relies on color alone (AS-1).
- **Camera:** a 30° perspective. Home is az 0.78, el 0.6, framed to the open area between the panels. Elevation is held between 0.28 and 1.25 rad. How far the view can be moved shrinks with the zoom, so zooming out brings it back home. "Zoomed" means closer than 0.8 × the framing distance. The game reframes a placed part or a hovered row only after 10 s with no manual input. Cursor: grab, grabbing, move (zoomed in) and crosshair (siting).
- **Gestures and their buttons:**

  | Gesture | Button or key |
  |---|---|
  | Drag (turn when out, move when zoomed in) | Turn buttons; move buttons when zoomed in |
  | Right-drag or Shift-drag (turn) | Turn buttons |
  | Wheel or pinch (zoom toward the pointer) | Zoom buttons |
  | Two fingers (move, zoom, twist to turn) | Move, zoom and turn buttons |
  | — | Arrow keys turn; Shift + arrows move; + and − zoom |
  | — | Reset view |
- **Low quality:** no antialiasing, pixel ratio 1, basic 1024 px shadows, and standard rather than physical glass and water.

### Motion
- **CSS:** one transition: element rows, 0.15 s on transform and border color. No keyframes.
- **Timed UI:** toast 3.5–9 s; built tag 3.2 s; gold zoom hint 4.5 s; a caption with no clip stays 2.5–12 s (45 ms per character); score announcements wait 900 ms; an answer within 400 ms of a new card is ignored.
- **3D:**
  - A new part rises over 0.75 s on an overshoot curve, or drops 30 m into place.
  - The camera eases at 1 − e^(−5·dt).
  - Behind the intro, the campus turns at 0.05 rad/s.
  - Fans spin, rack LEDs step every 0.35 s, the water ripples, the beacon pulses, route stripes scroll, rings expand, plume and dust drift, and trucks drive their route.
  - Idle drawing is capped at 30 fps, and a hidden tab stops it.
- **Reduced motion** (`prefers-reduced-motion: reduce`):
  - CSS sets `*{transition:none!important;animation:none!important}`.
  - The 3D map stops its turn, snaps camera moves instead of easing them, shows new parts at once, and freezes fans, LEDs, water, stripes, trucks and particles. The rings hold fixed positions and the beacon holds steady.
  - The map then no longer frames a newly built part, but it still jumps to frame a hovered Neighbors row.
  - The render loop stops once the frame is still.

### Print sheet (debrief)
- **Page:** US Letter with 0.45 in margins, white, black text, no dialog chrome.
- **Head and foot:** a bold head line and "Name or team: ____" (a 2.6 in rule). At the foot: credits, contact, the address and "Printed <date>".
- **Body:** the 4 result tiles in one row with 1 px gray borders, the choices in 3 columns, and two ruled lines under each "Talk it over" question. The dots keep their color (`print-color-adjust: exact`).

### Forced colors
In Windows contrast themes:
- Buttons, dialogs, segments and tabs get system-color borders. Pressed buttons fill with Highlight and HighlightText.
- Meters use Canvas and CanvasText cells. Schedule bars become CanvasText. The critical path is hatched in Highlight, and the bar in progress gets an outline.
- The Neighbors swatches keep their map colors (`forced-color-adjust: none`).

### Educator sheet (separate page)
A static Letter page in `system-ui`:
- Its own palette (see Colors) and a 3 px accent rule under the header.
- Uppercase accent `h2`s, two columns, boxed notes with a left accent bar, and ruled tables.
- It prints on one Letter page in Arial, Arimo or Liberation Sans at 8.5 pt.

## Changes in the October 2026 UI/UX round

Within the same look:
- **Build panel:** once Finish can be pressed it is pinned to the panel's bottom on a card band with the pinned-footer shadow. A locked step is a sunken well with a `#cfc8bc` mark and a muted word, at full opacity, and stays in the Tab order (`aria-disabled`). The waiting Finish is a sunken pill. The Site log and Undo come before the commissioning track. After turnover the panel offers "Back to the summary".
- **Neighbors beside the panels:** the rows, the score note and the breakdown scroll in their own area. Under them the fact box has one fixed height, `clamp(6.5rem, 20dvh, 12rem)`, whatever it holds, so pointing at a row never moves anything; a longer fact scrolls inside it. While rows wait below the fold the box carries the pinned-footer shadow. On short laptop screens (up to 800 px tall) the rows are 34 px. On the phone tab the fact comes right under the rows.
- **Presenter view:** the toolbar adds a "Neighbors" pill and a "Presenter view: on" pill. From 1280 px the opened panel takes its usual place on the right and the map tools move clear of it; under 1280 px it lies over the open map below the toolbar, the map buttons wait under it, and a caption still shows over it. The Build panel width is `clamp(16.5rem, 28vw, 22rem)`.
- **Score tiles:** a tile that changed gets a 2 px `#f7f4eecc` inset ring for 4 s and, from 1366 px, the change after its word. The label spans `auto 1fr`.
- **End screen:** "Look at the campus" under the opening paragraph (left out when there is no 3D map); Print and the save buttons are `.btn-small`. During the kiosk countdown Keep is the one clay button, on the countdown's own line above the other buttons (full width on phones), so nothing moves when it goes.
- **Map tag:** a part built out of the open map gets its "Built:" or "Done:" tag at the nearest edge of the open map, its pointer turned towards the part.
- **Short phones held upright:** the map's share is 38% of the window (`svh`), and scrolled past the map the Build panel fills the window under the tabs.
- **Map buttons:** where the zoomed-in set would wrap, the move buttons take their own row (`html[data-cam-split]`). On touch screens the buttons sit 8 px apart.
- **Answer options** have a 2 px `muted` edge; empty meter cells use `line-strong`. Panel and dialog scrollbars are `muted` on transparent.

## Do's and Don'ts

### Do:
- **Do** keep pine, paper, clay and gold, and Geist with Inter, exactly as the frontmatter gives them. The owner chose polish within this look.
- **Do** put every new action in a pill. A clay `.btn` is for the one next step; a white ghost outlined in ink is for the alternatives.
- **Do** pair every status color with a word, a pattern or an outline (the Word-With-Every-Dot Rule, hatching, outlines, dashes).
- **Do** keep text on pale tints in the darker inks (`ink`, `ink-2`, `muted`, `good-ink`, `clay-ink`). On the tints measured here they are 4.67:1 or more.
- **Do** keep anything over the map translucent card with a backdrop blur, inside the open middle, with `pointer-events` only on its buttons.
- **Do** keep the 3 px focus ring (`focus` on light surfaces, `focus-stage` on pine) and `aria-pressed` on toggles.
- **Do** give every new small label class the 16 px floor on kiosks and in presenter view, and a short form where the side-panel layout narrows.
- **Do** give every map gesture a button and a key, and add any new map control to the "Map view" group.
- **Do** check new layouts at the brief's sizes: 1366 × 768, 1440 × 900, 390 × 844, short phones, and iPad in both orientations.

### Don't:
- **Don't** change the palette, the fonts, the pill shape or the floating-panel character. The owner ruled out any change to the visual identity.
- **Don't** fill a meter or an amount in red, gold or green. Those colors mean dashboard ratings (the One-Ink Meter Rule).
- **Don't** add a new hex where a token exists, or a new near-white or near-gray. The source already has the duplicates recorded above.
- **Don't** cover the map buttons, the toolbar or the caption with a new panel or overlay, or let the schedule grow into them.
- **Don't** add motion that ignores `prefers-reduced-motion`, or that runs while nothing changes. The render loop is meant to stop.
- **Don't** edit the built pages (`index.html`, the offline file, `docs/`). Change `style.css`, `build.mjs`, `game.js` or `scene.js` and rebuild.
- **Don't** change a narrated string to fit a layout. It drops the recorded clip (see PRODUCT.md).
