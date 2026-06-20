# Kanban Pizza Game — Tasks

Feature: `001-kanban-pizza-game`
Generated from: plan.md · spec.md · data-model.md · contracts/ · research.md · quickstart.md

---

## Phase 1 — Setup

Goal: scaffold feature directories and confirm tooling covers new paths before any implementation.

- [X] T001 Create feature directories `src/sim/`, `src/scenes/`, `src/hooks/`, `src/pages/` (if absent) and add empty index stubs
- [X] T002 Verify ESLint config and Vitest `testPathPattern` cover `src/sim/**` and `src/scenes/**` — update `eslint.config.js` and `vite.config.js` if needed

Checkpoint: `npm run lint` and `npm test` complete without errors on empty stubs.

---

## Phase 2 — Foundational

Goal: implement and test the pure simulation engine and shared infrastructure. **All user story phases depend on this phase completing first.**

- [X] T003 Implement `freshSim(roundNum)` factory — returns initial `SimState` with correct `mode` (push/pull), per-round `wip[5]` array, and `STATION_DEFS` applied to `stations` in `src/sim/pizzaSim.js`
- [X] T004 Implement `step(simState, dt)` pure function — full pizza lifecycle state machine (spawn → queue → moving → working → handoff → deliver for push mode), CfdSample appended every 0.4 s sim time to `simState.cfd` in `src/sim/pizzaSim.js`
- [X] T005 Extend `step()` with pull-mode WIP cap enforcement — `handoff` blocks when next station's `buffer.length >= wip[i+1]` in `src/sim/pizzaSim.js`
- [X] T006 [P] Implement `detectConstraint(stations)` — returns index of station with deepest `buffer`; never returns 0 (intake is never the bottleneck) in `src/sim/pizzaSim.js`
- [X] T007 [P] Implement `wasteCount(stations)` and `wipCount(stations)` aggregator functions in `src/sim/pizzaSim.js`
- [X] T008 [P] Implement `applyTocAction(state, stepIndex)` for all 5 ToC steps — 0 Identify (sets `constraint`), 1 Exploit (coaching signal), 2 Subordinate (adjusts inbound cap), 3 Elevate (increments `stations[constraint].slots`), 4 Repeat (re-runs `detectConstraint`) in `src/sim/pizzaSim.js`
- [X] T009 [P] Write Vitest unit tests for `freshSim`, `step` (push + pull modes), `detectConstraint`, `wasteCount`, `wipCount`, and `applyTocAction` — all scenarios from quickstart.md test table in `src/sim/pizzaSim.test.js`
- [ ] T010 [P] Implement `PizzaScene` class — constructor (mountElement, opts), `loadRound(initialSimState, roundNum)`, `syncState(simState, dt)`, `dispose()` — Three.js belt, 5 station pads, and worker figures; pizza mesh map kept as `Map<id, THREE.Group>`; ResizeObserver attached in constructor, removed in dispose in `src/scenes/PizzaScene.js`
- [ ] T011 [P] Implement `usePizzaSim(initialRound)` hook — rAF game loop, exposes `{ simState, running, setRound, setWipLimit, tocNext, tocPrev, sceneRef }` per contract in `src/hooks/usePizzaSim.js`

Checkpoint: `npm run coverage` passes ≥ 80 % lines/functions/branches on `src/sim/`.

---

## Phase 3 — US1 (P1): Push Chaos — Round 1 Base Game

Goal: learner opens the game, sees Round 1 push simulation running, reads climbing sidebar metrics, and reads the coaching message about piling. Route wired into existing app.

Acceptance: navigate to `/#/pizza` → push mode starts → Sauce/Oven buffer counts climb to 3+ → Delivered stays low → coaching message visible.

- [ ] T012 [US1] Add `/pizza` route to `src/App.jsx` and add a pizza game card to the game selection landing page in `src/App.jsx`
- [X] T013 [US1] Create `PizzaGame` page component — mounts `PizzaScene` via `useRef` in `useEffect`; renders two-column layout (canvas left, sidebar right) in `src/pages/PizzaGame.jsx`
- [X] T014 [US1] Implement round picker (Round 1 / 2 / 3 buttons) and start/pause/reset controls in sidebar in `src/pages/PizzaGame.jsx`
- [X] T015 [US1] Wire `PizzaScene` `onUpdate` callback to sidebar metrics display — delivered, waste, wip live count, avg lead, elapsed in `src/pages/PizzaGame.jsx`
- [X] T016 [US1] Implement coaching message panel — push chaos message ("Work piling upstream — started ≠ finished") shown while `simState.mode === 'push'` and buffers growing in `src/pages/PizzaGame.jsx`

Checkpoint: navigate `/#/pizza`, start Round 1, observe Sauce/Oven counts ≥ 3 in sidebar; Delivered count low; coaching message visible; pause stops sim; reset clears metrics to zero.

---

## Phase 4 — US2 (P2): Pull Discipline — Round 2

Goal: learner selects Round 2, observes preset WIP limits enforced by the simulation, sees queues stabilise and average lead time drop compared to Round 1.

Acceptance: Round 2 active → no buffer exceeds its WIP limit → avg lead measurably lower than Round 1 → stuck count low relative to delivered.

- [X] T017 [US2] Implement `setRound(n)` in `usePizzaSim` — resets `simState` via `freshSim(n)` and calls `sceneRef.current.loadRound(...)` in `src/hooks/usePizzaSim.js`
- [X] T018 [US2] Display read-only WIP limit badges per station in sidebar for Round 2 — badges only, no interactive sliders in `src/pages/PizzaGame.jsx`
- [X] T019 [US2] Update coaching message logic — pull mode message ("Pull discipline active — queues draining") shown when `mode === 'pull'` and buffers stable in `src/pages/PizzaGame.jsx`
- [X] T020 [US2] Implement round stat snapshot panel — captures Round 1 delivered / avg lead on round switch and shows comparison alongside Round 2 live metrics in `src/pages/PizzaGame.jsx`

Checkpoint: select Round 2, start, run 2 min — no buffer exceeds its cap; avg lead lower than Round 1; switch back to Round 1 → metrics reset to zero on reset.

---

## Phase 5 — US3 (P3): Interactive Slider Tuning — Round 3

Goal: learner drags WIP limit sliders during a live Round 3 simulation; changes apply immediately without resetting the round; Oven is guarded as fixed; high-WIP coaching message triggers.

Acceptance: Round 3 active → WIP sliders visible → Oven slider disabled → Sauce slider to 5 triggers high-WIP warning → Sauce back to 2 shows balanced flow.

- [X] T021 [P] [US3] Implement `setWipLimit(stationIndex, value)` in `usePizzaSim` — mutates WIP cap on live `simState` without resetting round in `src/hooks/usePizzaSim.js`
- [X] T022 [US3] Render WIP limit sliders (range inputs, min 1, max 6) for each non-Oven station in sidebar for Round 3, each wired to `setWipLimit` in `src/pages/PizzaGame.jsx`
- [X] T023 [US3] Guard Oven (stationIndex 3) — render slider as `disabled`; show tooltip "Oven capacity is fixed" in `src/pages/PizzaGame.jsx`
- [X] T024 [US3] Implement live coaching: if any active wip > 4 show "High WIP — queues will grow"; if all ≤ 3 show "Balanced flow — lead time stabilising" in `src/pages/PizzaGame.jsx`

Checkpoint: select Round 3, start, drag Oven slider (confirm disabled), drag Sauce to 5 (high-WIP warning), drag back to 2 (balanced flow message), confirm sim never resets while dragging.

---

## Phase 6 — US4 (P4): Theory of Constraints Guided Mode

Goal: learner activates Guided ToC toggle on Round 3; 5-step ToC panel replaces sliders; constraint ring appears on identified station; each step applies a state change and shows a coaching message; Repeat step moves the ring.

Acceptance: ToC toggle visible → applying all 5 steps in sequence → constraint ring at Oven on Identify → ring moves on Repeat → delivered increases after Elevate → unique coaching message per step.

- [X] T025 [US4] Implement `tocNext()` / `tocPrev()` in `usePizzaSim` — calls `applyTocAction(state, tocStep)` and advances/retreats `tocStep` in `src/hooks/usePizzaSim.js`
- [X] T026 [US4] Implement Guided ToC toggle button in `PizzaGame` sidebar for Round 3 — toggling guided mode swaps slider panel for ToC step panel in `src/pages/PizzaGame.jsx`
- [X] T027 [US4] Render ToC step panel — current step tag, title, body text from `TocStep` definition, "Apply Next" and "Back" buttons wired to `tocNext` / `tocPrev` in `src/pages/PizzaGame.jsx`
- [X] T028 [US4] Auto-start simulation when learner applies step 0 (Identify) if sim is not already running in `src/hooks/usePizzaSim.js`
- [X] T029 [P] [US4] Implement constraint ring mesh in `PizzaScene.syncState` — ring positions over `simState.constraint` station index, pulses (opacity oscillation) while active, hidden when `constraint === null` in `src/scenes/PizzaScene.js`
- [X] T030 [US4] Define per-step ToC coaching messages (0–4) and display in coaching panel, replacing the push/pull message while guided mode is active in `src/pages/PizzaGame.jsx`

Checkpoint: select Round 3 → activate Guided ToC → Apply Next × 5: ring at Oven after step 0; "Exploit" message after step 1; ring moves after step 4 (Repeat); delivered count higher after Elevate vs pre-Elevate baseline.

---

## Phase 7 — Polish & Cross-Cutting Concerns

- [X] T031 Implement CFD canvas rendering in `PizzaScene` — cumulative stacked bands per station (monotonic), WIP bracket annotation, avg lead annotation; redraws on each `syncState` if `simState.cfd` has grown in `src/scenes/PizzaScene.js`
- [X] T032 Implement CFD show/hide toggle in sidebar — collapses canvas strip; redraws at new dimensions on expand in `src/pages/PizzaGame.jsx`
- [X] T033 Implement pointer-based camera orbit in `PizzaScene` — `pointerdown` / `pointermove` / `pointerup` events with `dist` / `height` + lerp per research.md decision in `src/scenes/PizzaScene.js`
- [X] T034 Implement sidebar collapse for narrow viewports — sidebar reflows below the 3D canvas when viewport width < 640 px in `src/pages/PizzaGame.jsx`
- [ ] T035 Run full quickstart.md validation checklist against the running dev server; fix any regressions found across all routes

---

## Phase Dependencies

```
Phase 1 (Setup)
  └─► Phase 2 (Foundational)
        └─► Phase 3 (US1 — Push Chaos)
              └─► Phase 4 (US2 — Pull Discipline)
                    └─► Phase 5 (US3 — Slider Tuning)
                          └─► Phase 6 (US4 — ToC Guided)
                                └─► Phase 7 (Polish)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 — **BLOCKS all user story phases**
- **US1 (Phase 3)**: Depends on Phase 2 — first story; no story-level dependencies
- **US2 (Phase 4)**: Depends on Phase 2 + Phase 3 complete — round picker reuses PizzaGame layout from US1
- **US3 (Phase 5)**: Depends on Phase 4 — sliders extend Round 2 infrastructure
- **US4 (Phase 6)**: Depends on Phase 5 — ToC panel overlays Round 3 slider panel
- **Phase 7**: Depends on all user story phases

## User Story Dependencies

| Story | Depends on | Reason |
|-------|------------|--------|
| US1 (P1) | Foundational only | First story; establishes base layout |
| US2 (P2) | US1 complete | Round picker and transition reuse PizzaGame wiring |
| US3 (P3) | US2 complete | Slider panel extends Round 2 sidebar section |
| US4 (P4) | US3 complete | ToC panel overlays slider panel in Round 3 |

## Parallel Opportunities

**Within Phase 2 (Foundational)**:
- T006, T007, T008 (`detectConstraint`, `wasteCount`, `applyTocAction`) run in parallel once T003–T005 are complete
- T009 (tests), T010 (PizzaScene), T011 (usePizzaSim hook) all start in parallel after T003–T008

**Within Phase 5 (US3)**:
- T021 (`setWipLimit` hook logic) runs in parallel with T022–T024 (slider UI) — different files

**Within Phase 6 (US4)**:
- T029 (constraint ring in PizzaScene) runs in parallel with T025–T028 and T030 (hook + UI)

## Implementation Strategy

**MVP** (Phases 1–3, T001–T016): Working push chaos simulation with sidebar metrics and integrated route. Demonstrates the core teaching loop and validates the Three.js + React + sim architecture.

**Increment 2** (Phase 4, T017–T020): Adds Round 2 pull discipline and comparison panel.

**Increment 3** (Phase 5, T021–T024): Adds live slider tuning for Round 3 experimentation.

**Increment 4** (Phase 6, T025–T030): Completes the Theory of Constraints guided walkthrough.

**Increment 5** (Phase 7, T031–T035): CFD rendering, camera orbit, narrow-viewport layout, and full quickstart validation.
