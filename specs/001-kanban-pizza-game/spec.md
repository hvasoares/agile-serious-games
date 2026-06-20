# Feature Specification: Kanban Pizza Game
<!-- feature: 001-kanban-pizza-game -->
<!-- Created: 2026-06-19 -->
<!-- Status: Draft -->
<!-- Input: bring the doc/starter/kanban-lean-pizza-game/ as the first game -->

---

## User Scenarios & Testing

### P1 — Observe the cost of local optimization (Round 1: Silos)

**User Journey:**
A facilitator opens the game with a team. Everyone watches Round 1 start automatically in push mode: each worker grabs new work greedily, queues pile up in front of slow stations, and deliveries lag far behind work started. The facilitator pauses and asks "why are we still not delivering if everyone is so busy?"

**Value:**
Creates a visceral "aha" moment: locally optimizing each step produces global waste. The team sees that "started ≠ done" without needing a lecture.

**Independent Test:**
Two observers watch Round 1 for 2 minutes and can independently identify where the biggest queues accumulate and why deliveries are low relative to work started.

**Acceptance Scenarios:**
1. Given Round 1 is selected and the simulation starts, queues visibly grow in front of slower stations within 30 seconds.
2. Given the simulation is running, the live metrics show a growing "Waste (stuck)" count and a low "Delivered" count relative to work started.
3. Given the simulation is running, a coaching message explains why piling happens without the user needing to ask.
4. Given the user pauses the simulation, all motion stops immediately and metrics hold their last values.

---

### P2 — Experience pull flow with WIP limits (Round 2: Pull)

**User Journey:**
After Round 1's chaos, the facilitator selects Round 2. The same line now operates under WIP limits: when a station is full, the one feeding it stops. Workers drift toward the busiest area. The queue piles shrink, deliveries stabilize.

**Value:**
Users directly experience how a single systemic rule (WIP limit) reduces waste and shortens lead time — without changing who works or how fast each step is.

**Independent Test:**
A learner can explain the difference in behaviour between Round 1 and Round 2 after watching both for 2 minutes each, citing specific metric changes.

**Acceptance Scenarios:**
1. Given Round 2 is selected, each station shows an active WIP limit that prevents work from piling up beyond that limit.
2. Given a station's buffer is at its WIP limit, the upstream station visibly pauses or slows down.
3. Given the simulation runs to 2 minutes, average lead time in Round 2 is measurably lower than at the same point in Round 1.
4. Given the user resets the simulation, all queues clear and metrics return to zero.

---

### P3 — Tune the line and explore Theory of Constraints (Round 3: Self-directed)

**User Journey:**
The learner takes control in Round 3. They drag WIP limit sliders to experiment, watching how high limits drift back toward Round 1 chaos and tight limits can starve the oven. Optionally, they activate the Theory of Constraints guided walkthrough and follow the 5 focusing steps — identifying the constraint, exploiting it, subordinating the rest, elevating capacity, and repeating.

**Value:**
Converts observation into hands-on experimentation. The ToC guided mode teaches a repeatable improvement method applicable beyond the simulation.

**Independent Test:**
A learner can reach a balanced line configuration (steady delivery, shallow buffers, stable lead time) independently within 5 minutes of Round 3.

**Acceptance Scenarios:**
1. Given Round 3 is active, all WIP limit sliders are interactive and changes take effect immediately on the running simulation.
2. Given the ToC guided mode is activated, the 5-step panel replaces the slider panel and each step applies a concrete change to the simulation when confirmed.
3. Given the learner completes all 5 ToC steps, the oven gains capacity and the coaching message confirms the constraint has moved downstream.
4. Given the learner sets all limits very high, the simulation drifts back toward Round 1 behaviour and a coaching message warns about high WIP.

---

## Functional Requirements

- **FR-001** — The game renders a real-time animated 3D pizza production line with 5 stations (Cut → Sauce → Top → Oven → Deliver), each with a visible worker character.
- **FR-002** — Each pizza item shows its current stage visually (colour and toppings applied progressively as it moves through stations).
- **FR-003** — Round 1 operates in push mode: workers greedily pull new work; buffers are unbounded; queues accumulate at slow stations.
- **FR-004** — Round 2 operates in pull mode: each station respects a preset WIP limit; a full station blocks the one feeding it.
- **FR-005** — Round 3 operates in pull mode with user-adjustable WIP limit sliders; changes apply live to the running simulation.
- **FR-006** — Round 3 includes an optional Theory of Constraints guided mode that walks the user through the 5 focusing steps, applying incremental changes to the simulation at each step.
- **FR-007** — The game displays live metrics at all times: number of pizzas delivered, waste (stuck in queues), current WIP, and average lead time.
- **FR-008** — A Cumulative Flow Diagram renders beneath the 3D scene, updated continuously, showing stacked bands per station plus annotations for current WIP and average lead time.
- **FR-009** — Contextual coaching messages update automatically based on the simulation state (e.g., warn about growing queues, celebrate balanced flow).
- **FR-010** — Users can start, pause, and reset the simulation at any time without losing the current round selection.
- **FR-011** — The game is accessible as a route within the main application, navigable from a game-selection entry point.
- **FR-012** — The Oven station has a fixed capacity (not adjustable) to serve as a realistic constraint, and the simulation enforces this at all times.

---

## Key Entities

- **Pizza** — a work item with a current stage (0–4), a state (queued / moving / being worked / handing off), a birth timestamp, and a progress counter.
- **Station** — one of the 5 production steps; holds a set of active work slots (physical capacity) and a queue buffer (WIP discipline).
- **Round** — a named simulation scenario (Silos, Pull, Tune) with preset WIP limits, a flow mode, and introductory text.
- **Simulation State** — the complete snapshot at any instant: current round, elapsed time, all pizza positions and stages, all station occupancy and buffers, delivery count, and CFD samples.
- **Theory of Constraints Step** — one of 5 sequential actions (Identify / Exploit / Subordinate / Elevate / Repeat), each producing a concrete change to the simulation state when applied.

---

## Success Criteria

- **SC-001** — A learner with no prior Kanban knowledge can observe a meaningful contrast between push and pull modes within a single 5-minute session.
- **SC-002** — All three rounds can be played sequentially, in any order, without reloading the page or losing the game's state.
- **SC-003** — Live metrics (Delivered, Waste, WIP, Lead Time) update visibly within 1 second of simulation events.
- **SC-004** — The CFD correctly reflects the cumulative count of items at each stage and never decreases (monotonic bands).
- **SC-005** — A user completing all 5 ToC steps in guided mode observes a measurable increase in delivered pizzas and a shift of the identified constraint downstream.
- **SC-006** — The game passes all four project quality gates (lint, tests, coverage ≥ 80%, type-check) as part of the merge process.

---

## Assumptions

- The starter file (`doc/starter/kanban-lean-pizza-game/kanban-pizza-sim.html`) is the authoritative reference for simulation logic, 3D layout, and game mechanics; it is ported rather than used as-is.
- The game is integrated as a proper route in the existing React + Vite application, following project architecture rules (Three.js isolated in `src/scenes/`, simulation logic in `src/sim/`, React components in `src/components/`).
- Three.js r128 (or the version already in the project's `package.json`) is used for the 3D scene; no other 3D library is introduced.
- A game-selection landing page or navigation entry point exists (or will be created as part of this feature) so the pizza game is reachable within the app.
- The Oven's capacity is intentionally fixed at 3 slots to preserve the teaching constraint; this is not configurable by the user.
- Mobile layout is in scope for the first version: the aside panel collapses below the 3D scene on narrow screens.
- Browser support: modern evergreen browsers (Chrome, Firefox, Safari, Edge); no IE/legacy support.
