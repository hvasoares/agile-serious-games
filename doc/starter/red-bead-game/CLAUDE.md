# CLAUDE.md — Deming Red Bead Experiment

Context for AI assistants working on this project. Read this before editing.

## What this is

A single-file, interactive 3D simulation of **W. Edwards Deming's Red Bead Experiment**, used to teach statistical process control. A "Willing Worker" dips a 50-hole paddle into a bin of beads (20% red) and is judged on how few red beads they pull — but the result is pure random sampling, so the worker has no control. The app lets the user run pulls, plot them on a live **control chart**, and try a dozen "process improvement" interventions to see which actually change the system and which are theater.

The whole point is pedagogical: distinguish **common-cause variation** (the system) from **special causes**, and show that only changing the system (not exhorting/ranking workers) reduces defects.

## File layout

- **`red-bead-experiment.html`** — the entire app. One self-contained file: inline CSS, inline JS, no build step, no bundler, no framework.

There is no package.json, no test suite, no server. To run: open the file in any modern browser. It needs internet access to load Three.js and fonts from CDN (see Dependencies).

## Tech stack & hard constraints

- **Three.js r128**, loaded as a global `THREE` from `cdnjs.cloudflare.com`. Constraints that come with r128 — **do not break these**:
  - No `THREE.OrbitControls` (we hand-roll orbit controls with azimuth/polar/radius).
  - No `THREE.CapsuleGeometry` (use Sphere/Cylinder/Box only).
  - Instanced bead colors set via `InstancedMesh.setColorAt()` + `instanceColor.needsUpdate`.
- **Vanilla JS**, ES5-flavored: `"use strict"`, `var`, function declarations, all wrapped in one IIFE. Keep it this way for consistency.
- **No `localStorage`/`sessionStorage`** and no browser storage of any kind — all state lives in plain JS variables for the session.
- Fonts: Google Fonts (`Space Grotesk` for display, `IBM Plex Mono` for instrument/numeric UI).
- The control chart is **hand-rolled SVG** (no charting library). Built by clearing and re-appending nodes in `renderChart()`.
- If `THREE` fails to load, the stage shows a fallback message instead of crashing.

## Visual / design language

Industrial "quality-control instrument panel": dark slate background, one saturated **red** (`--red:#e0473d`, the red bead) as the only loud accent, warm paper for white beads, brass for the paddle and annotations, monospaced numerics. CSS variables are defined in `:root`. Keep new UI consistent with this — restrained palette, mono for data, Space Grotesk for labels.

## Layout (DOM)

- `header` — title + intro.
- `.stage` — the 3D viewport:
  - `canvas#scene`, `.who#whoTurn` (worker name), `.readout` (`#lastRead` big number + `#modeTag`), `.banner#banner`/`#bannerText` (exhortation), `.flash#flash` (tamper red flash), `.hint`.
- `.panel` — two-column on wide screens:
  - `.chartwrap` → `svg#chart`, `#quotaNote`, `#signalNote`, `.legend`.
  - `.side` cards: **Tally** (stats + pull controls), **Change the system**, **Inspect & sort**, **Management theater**, **Chart options**, **Event log** (`#logList`), **What it proves**.
- `footer` — note on the theoretical limits.

## JS architecture (sections inside the IIFE, in order)

1. **Model state** — params and arrays.
2. **The pull** — `scoopOnce`, `applyRework`, `doPull`, `recordResult`.
3. **Stats / readouts** — DOM refs + `updateBinReadout`, `updateMeters`, `updateStats`, `updateModeTag`.
4. **Control chart** — `segLimits`, `detectSignals`, `renderChart` (+ helpers `val`, `fmtV`, `ticks`, `svg`).
5. **Leaderboard** — `renderBoard`.
6. **Event log** — `logEvent`, `renderLog`.
7. **3D hit effects** — `triggerShake`, `flashRed`, `tamperHit`.
8. **Three.js scene** — build functions, paddle, pool, tween/animation, `pullPaddle`, `fastRun`, `resetAll`.
9. **Controls / wiring** — button + toggle + slider listeners; `mark`, `toggle`, `showBanner`.
10. **Orbit + resize + loop** — `setupControls`, `resize`, `animate`, `init`. `init` runs on `window load`.

## Core model & invariants

- Constants: `POP = 4000` beads; default `p = 0.20` red; default paddle `N = 50`.
- `bin = {red, white}` is the **live** composition; interventions mutate it. `binFrac()` = current red fraction.
- `baseP`, `baseN` are the **basis for theoretical limits**. They change only on deliberate, announced system changes (supplier slider, paddle size). Other toggles do NOT change the basis.
- **A pull is one `doPull()`**, pipeline order:
  1. `scoopOnce()` — hypergeometric draw of `N` from the current bin, **without replacement within the scoop**; beads are otherwise returned (independent pulls) unless removeReds is on.
  2. if `keepBest`: scoop twice, take `Math.min`.
  3. `applyRework(reds)` — each red bead re-drawn up to `reworkPasses` times; becomes white with prob `1 - binFrac()`.
  4. if `removeReds`: subtract the final reds from `bin.red` permanently; `syncPool()` recolors the 3D pile.
  5. if `tampering`: distort the **reported** value (see Tampering). The physical beads still show the true scoop.
  6. if `incentives`: accrue `cost`, drop `morale`. No effect on reds.
  7. assign to next worker if `workersOn`.
  Returns `{reds(reported), trueReds, n, worker, tampered, kick, basisN, basisP}`. `recordResult` pushes the same fields (minus kick) into `results[]`.
- `results[]` items: `{reds, n, worker, tampered, trueReds, basisN, basisP}`. Each stores its own `n` and basis so the chart can segment correctly when paddle/supplier changed mid-run.

## The twelve interventions (and what they prove)

Grouped exactly as the UI groups them.

**Change the system (genuinely lowers defects):**
- **Supplier quality** slider → sets `p`/`baseP`, resets bin to `p*POP`. The honest fix.
- **Remove red beads** toggle (`removeReds`) → scooped reds don't return; bin purifies; chart breaks below the (unchanged) limit = a real detectable improvement.
- **Paddle size** 50/25/10 (`N`/`baseN`) → fewer holes lowers the *count* but not the *rate*. A trap; pair with "show %".

**Inspect & sort (lowers the number, not the system):**
- **Pull twice, keep the better** (`keepBest`).
- **Re-pull the reds** 0/1/2 passes (`reworkPasses`) → rework; ~÷5 per pass at rising cost.

**Management theater (moves nothing):**
- **Exhort** (momentary banner) — no effect.
- **Incentives & blame** (`incentives`) — cost + morale meters; no effect on reds.
- **Quota** slider (`quota`) — draws a target line; tallies % "failing" though in control.
- **Tamper after every pull** (`tampering`) — Nelson's funnel; doubles variance.

**Chart options (change the view, not the process — intentionally NOT marked on the chart):**
- **Limits from the data** (`limitsFromData`).
- **Show as defect rate %** (`showRate`).
- **Six willing workers** (`workersOn`) — rotates `WORKERS[]`, colors points by `WCOL[]`, shows a leaderboard that's statistically flat.

## Control chart specifics (`renderChart`)

- **Segmented limits.** The run is split at each optimization marker (`changeMarks` indices where `0 < i < n`). Each segment computes its own UCL/CL/LCL from the basis of its first point, drawn as **stepped horizontal lines**. This is the "recompute limits when the process changes" behavior. Only the current (last) segment is labeled, on the right.
- **`segLimits(vals, bN, bP)`**: if `limitsFromData` and ≥4 points → `c = mean`, `sd = sample stdev`; else theoretical:
  - count units: `c = bN*bP`, `sd = sqrt(bN*bP*(1-bP))`.
  - rate units: `c = bP*100`, `sd = sqrt(bP*(1-bP)/bN)*100`.
  - UCL/LCL = `c ± 3·sd` (LCL clamped ≥ 0 for drawing).
- Defaults (N=50, p=0.20): center **10.0**, UCL **18.5**, LCL **1.5**.
- **Signals** (`detectSignals`), computed **within each segment** (rules reset at known changes), flagged points get an amber ring + a line in `#signalNote`:
  - R1: 1 point beyond 3σ.
  - R2: 8 in a row on one side of center.
  - R3: 6 in a row trending up/down.
  - R4: 2 of 3 in a row beyond 2σ on the same side.
  - When ≥10 pulls and no signal: "In control — only common-cause variation."
- Markers: dashed brass vertical lines at every `changeMarks` entry via `mark(label)`. Drawn the instant a change is picked (even before the next pull, even with zero pulls); they settle to the segment boundary `bX()` as data fills in. Labels stack to avoid collisions.
- `val(rec)` returns count or rate depending on `showRate`; `yMax` adapts to limits/data/quota; `ticks()` picks gridline spacing.

## Tampering details (important: it's an abstraction)

Nelson funnel **rule 2** applied to the *reported* number, not the beads:
- `reported = round(reds + tamperOffset)`, clamped ≥ 0.
- `kick = reported - reds` (logged + drawn as a red vertical line from true→reported on the chart point).
- `tamperOffset -= (reported - baseN*baseP)`.
This roughly **doubles the variance**, so the chart goes out of control while the bin is untouched. The 3D paddle shows the **true** scoop; the readout/chart show the **reported** value. The visible "hit" (camera shake + red flash via `tamperHit`) fires only on single animated pulls, not on `fastRun` (which would be 25 shakes).

## 3D scene notes

- Custom orbit: `azimuth`/`polar`/`radius` around `target`; `updateCamera()` each frame; pointer drag + wheel zoom in `setupControls`. `autoSpin` idles a slow rotation.
- Bin = transparent walls + brass rim. Pool = one `InstancedMesh` of ~1700 beads; `syncPool()` recolors red instances to track `binFrac()` so removing reds visibly cleans the pile (`poolRedList`, `R0`, baseline 0.20).
- Paddle = board + handle + 50 sockets/beads. `GRID = {50:[5,10],25:[5,5],10:[2,5]}`; `layoutSample()` re-lays the visible sockets/beads when `N` changes; `showSample/hideSample/assignSampleColors` manage the revealed scoop.
- Pull animation = a small tween state machine (`startTween`/`updateTween`): dip into bin → reveal scoop → lift and tilt to camera.

## Event log

`logEvent(html, type)` prepends to `logData[]` (cap 60), rendered into `#logList`. Types: `tamper` (red, with ↯, includes the over-correction kick), `sys` (brass: resets, supplier/paddle changes, exhortations, bulk runs). Tamper entries are the highlighted ones.

## Conventions when extending

- **Adding an intervention:** (1) add a state var in section 1; (2) add a control to the right card with the existing `.toggle` / `.field`+`.seg` / slider markup; (3) wire a listener in section 9 that flips the var, calls `updateModeTag()` if it belongs on the readout tag, and calls `mark('label')` **if it's a real process change** (not a view option); (4) fold its effect into the `doPull` pipeline or into `renderChart`.
- Keep `mark()` calls for **process changes only**. View-only toggles (limits-from-data, show-rate, workers) deliberately do not draw markers.
- Anything that changes `baseP`/`baseN` must also `mark()` so the limits segment correctly.
- After editing the inline script, sanity-check JS syntax (e.g. extract the last `<script>` block and run `node --check`).

## Known simplifications / open ideas

- Data-driven limits need ≥4 points per segment, else that segment falls back to theoretical (prevents wild bands off 2 points).
- Only 4 of the Nelson rules are implemented (the core WECO set). Not yet added: 15-in-a-row hugging the centerline, 4-of-5 beyond 1σ.
- `syncPool` caps the visible pile's red fraction at the 20% baseline (can't render *more* than baseline red), which only matters if the supplier slider goes above 20%.
- Tamper's bead/number mismatch is intentional but worth a tooltip if it confuses users.
