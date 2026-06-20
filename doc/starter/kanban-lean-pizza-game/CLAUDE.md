# CLAUDE.md — Kanban Pizzeria Flow Simulator

## What this is
A single self-contained HTML file (`kanban-pizza-sim.html`) that runs a 3D, real-time
**Kanban Pizza Game** simulation in the browser. It's a teaching/showcase tool that turns
the agile42 Kanban Pizza Game and Lean/Theory-of-Constraints concepts into something a team
can watch, tune, and measure live. No build step, no dependencies to install — Three.js is
loaded from a CDN.

- **Stack:** plain HTML/CSS/JS + Three.js r128 (CDN) for the 3D scene; a 2D `<canvas>` for the chart.
- **Structure:** one file. Top `<style>`, the markup (`header` / `main` with a left column + right `aside`),
  then one big `<script>` holding the whole simulation.
- **No frameworks, no localStorage/bundler.** State lives in a single `sim` object rebuilt per round.

## The teaching model (what the sim demonstrates)
Pizzas flow left→right through **5 stations**: Cut base → Sauce → Top → Oven → Deliver.
Each station has a visible **worker character** (chef) and a fixed number of physical work
"slots" (hands). The **oven is the hard constraint**: max 3 slices, fixed bake time, so it
caps real throughput no matter what upstream does.

Core data model per pizza: a `stage` (0–4), a `state` (`queue`/`moving`/`working`/`handoff`),
a `born` timestamp, and a `reached` high-water mark. Each station holds `occupants` (being
worked) and a `buffer` (queue waiting in front of it). Two flow modes:
- **push** — workers greedily grab raw work to stay busy; buffers are unbounded → piles build up.
- **pull** — a station only accepts work when it has room (WIP limit) → flow, less waste.

## Rounds
1. **Round 1 — Silos (push, no limits):** five specialists each locally optimize. Half-made
   pizzas **stack up at every slow step** (visible heaps in front of Sauce, Top, and the Oven).
   Sliders locked. Lesson: local optimization → huge WIP + long lead time, throughput still
   capped by the oven. "Started ≠ done."
2. **Round 2 — Pull (WIP limits):** same line, one rule: pull only when there's room. A full
   station stalls the one before it; idle workers drift over to help the bottleneck. Same
   delivery, far less waste, lead time roughly halves.
3. **Round 3 — Tune (your call):** sliders unlocked; the user balances the line themselves.
   Cranking limits high drifts back toward Round 1 chaos with no throughput gain.

## Round 3 add-on: Theory of Constraints (optional, behind a radio toggle)
A "Guided: Theory of Constraints" switch (only visible on Round 3) replaces the sliders panel
with a 5-step walkthrough of Goldratt's focusing steps, each applying a real change to the sim:
1. **Identify** — a pulsing ring marks the station with the deepest smoothed buffer load
   (station 0 / intake is excluded). Default to oven if the line hasn't run yet.
2. **Exploit** — protect the constraint's time so it never starves.
3. **Subordinate** — pace raw-work release to the constraint's cycle time → upstream piles drain,
   lead time drops, throughput unchanged.
4. **Elevate** — add a 4th oven slot → throughput actually rises.
5. **Repeat** — re-detect; the constraint has **moved** (typically to Top), restarting the loop.

Verified behavior (headless): subordinate alone cuts lead time ~21s→~9s with identical delivery;
elevate raises delivery (~51→~56) and shifts the constraint downstream.

## Live Cumulative Flow Diagram (CFD)
A real CFD renders on a `<canvas>` strip beneath the 3D scene (collapsible via Hide/Show).
- Sampled every 0.4s of sim time from cumulative `reached[]` counts + `delivered`.
- **Stacked bands bottom→top:** Done (large blue base), Deliver, Oven, Top, Sauce, Cut — each
  in its station color. Band math is `reached[i] - reached[i+1]`; cumulative tops sum to total started.
- **Annotations match the reference chart:** a vertical bracket = current **WIP** ("N tasks /
  In progress"), and a horizontal dashed gap with a marker = **avg lead time**.
- Monotonic by construction (a proper CFD never decreases). Resets per round so each run is clean.

## Other UI / interaction
- 3D camera: drag to orbit, scroll to zoom.
- Right `aside`: round picker, station WIP sliders (with live `▦pile · working/hands` readout),
  live metrics (Delivered / Waste / In progress / Avg lead time), Start-Pause / Reset, legend,
  and a reactive coaching line that changes with the current state.
- Constraint/bottleneck stations glow red when their pile gets deep.

## Conventions & gotchas (for future edits)
- **Everything is one file**; keep it that way unless asked. Three.js is **r128** — no
  `CapsuleGeometry`, no `OrbitControls`; use cylinders/spheres and the hand-rolled camera.
- A pizza in a **buffer must be `state:'queue'`, never `'working'`** — otherwise it "works"
  while queued and bypasses the slot cap (this was a real bug; the oven cap must always bind).
- Reset `prog=0` when a pizza is **pulled into a work slot**.
- `slots` = physical hands (always binds); `cap` = WIP/buffer discipline (pull mode). The oven's
  `fixedCap` is its slot count.
- Station durations/slots are tuned so push mode piles at Sauce, Top, AND oven (not just one).
  Current tuning: Cut(1.0s,3 slots), Sauce(1.6s,2), Top(2.2s,2), Oven(3.6s,3/fixedCap 3), Deliver(0.8s,2).
- Declaration order matters (TDZ): top-level calls (`loadRound(1)`, render loop start) are at the
  very end, after all `const`s. Don't move them up.
- Validate after edits: extract the last `<script>` and run `node --check`; the flow/CFD logic
  can be sanity-checked headlessly by mirroring the queue model without Three.js.

## Possible next steps (discussed, not yet built)
- Workers physically carrying pizzas hand-to-hand; sweep leftover piles off the table at round end.
- Round 3 "Elevate" growing a visible second oven rack in 3D.
- End-of-round CFD snapshots side by side; hover tooltips on the CFD following the mouse.
- Round 3 (game) extension: second recipe (rocket-salad pizza) + customer orders; a scoreboard.
