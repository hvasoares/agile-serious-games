# Quickstart & Validation Guide: Kanban Pizza Game
<!-- feature: 001-kanban-pizza-game -->
<!-- Phase: 1 -->

This guide describes how to run and validate the Kanban Pizza Game feature end-to-end. It is not an implementation guide — see [data-model.md](./data-model.md) and [contracts/](./contracts/) for data and interface specs.

---

## Prerequisites

- Node.js 18+ installed
- `npm install` already run (dependencies in `package.json`)
- Working directory: repo root (`/agile-serious-games/`)

---

## Dev Server

```bash
npm run dev
```

Open: `http://localhost:5173/agile-serious-games/#/pizza`

The pizza game page should load. If it doesn't navigate there automatically, click the pizza game card on the home page (`/#/`).

---

## Manual Validation Scenarios

### Scenario 1 — Round 1 demonstrates push chaos

1. Open `/#/pizza`. The page loads with Round 1 selected.
2. Press **Start**.
3. After 30 seconds of sim time:
   - **Expected**: Sauce and Oven station buffer counts visible in sidebar are climbing (3+).
   - **Expected**: "Waste (stuck)" metric is higher than "Delivered".
   - **Expected**: Coaching message mentions piling or "started ≠ done".
4. Press **Pause** — all motion should stop immediately; metrics should hold.

### Scenario 2 — Round 2 demonstrates pull discipline

1. Select **Round 2** in the round picker.
2. Confirm sliders show preset WIP limits (not ∞).
3. Press **Start**.
4. After 2 minutes of sim time:
   - **Expected**: No station buffer exceeds its WIP limit.
   - **Expected**: "Avg lead time" is measurably lower than it was in Round 1 at the same elapsed time.
   - **Expected**: "Waste (stuck)" stays low relative to "Delivered".
5. Press **Reset** — all queues clear, metrics return to zero, sim stops.

### Scenario 3 — Round 3 slider tuning

1. Select **Round 3**.
2. Press **Start**.
3. Drag the Oven slider to its maximum — confirm cap does not change (Oven is fixed).
4. Drag the Sauce slider to 5 (high WIP).
   - **Expected**: Coaching message warns about high WIP.
5. Drag the Sauce slider back to 2.
   - **Expected**: Coaching message shifts to balanced-flow message.

### Scenario 4 — Theory of Constraints guided mode

1. Select **Round 3**, confirm simulation is stopped.
2. Enable the **"Guided: Theory of Constraints"** toggle.
   - **Expected**: Sliders panel is replaced by the ToC step panel.
3. Press **Apply & next** (Step 1 — Identify):
   - **Expected**: A ring appears on the 3D scene around the identified constraint station.
   - **Expected**: Simulation auto-starts.
   - **Expected**: Applied message appears: "✓ Constraint identified and ringed".
4. Press **Apply & next** (Step 2 — Exploit):
   - **Expected**: Applied message appears.
5. Press **Apply & next** (Step 3 — Subordinate):
   - **Expected**: Applied message mentions feed paced to constraint.
   - **Expected**: After ~30 s, visible upstream piles drain.
6. Press **Apply & next** (Step 4 — Elevate):
   - **Expected**: Applied message confirms oven elevated to 4 slots.
   - **Expected**: Delivered count increases noticeably (compare to pre-elevate baseline).
7. Press **Apply & next** (Step 5 — Repeat):
   - **Expected**: Applied message says constraint has moved.
   - **Expected**: Ring moves to a different station (likely Top/station index 2).

### Scenario 5 — CFD is monotonic and updates live

1. Load Round 1, press Start, let it run for 1 minute.
2. Observe the CFD strip below the 3D scene:
   - **Expected**: All bands accumulate upward — no band shrinks over time.
   - **Expected**: WIP bracket and avg lead time annotation are visible.
3. Click **Hide** → CFD strip collapses.
4. Click **Show** → CFD strip expands and redraws correctly.

### Scenario 6 — Home page navigation

1. Navigate to `/#/`.
2. Confirm a "Kanban Pizzeria" game card is visible alongside the existing games.
3. Click it — confirm it navigates to `/#/pizza`.
4. Click "← Back" — confirm it returns to `/#/`.

---

## Automated Tests

```bash
# Run all tests
npm run test

# Run with coverage report
npm run coverage
```

**Expected outputs**:
- All tests in `src/sim/__tests__/pizzaSim.test.js` pass.
- Coverage for `src/sim/pizzaSim.js`:
  - Lines: ≥ 80%
  - Functions: ≥ 80%
  - Branches: ≥ 80%

**Key test cases in pizzaSim.test.js**:

| Test | What it validates |
|------|------------------|
| `freshSim(1)` returns push mode | Round 1 initialises with `mode: 'push'` and unlimited caps |
| `freshSim(2)` returns pull mode | Round 2 initialises with `mode: 'pull'` and preset caps |
| `step` spawns pizzas in push mode | After 1 s sim-time, `pizzas.length > 0` |
| `step` respects WIP cap in pull mode | Buffer never exceeds `cap` for any station |
| `step` advances pizza stage correctly | A pizza reaches `stage: 4` after sufficient time |
| `detectConstraint` returns correct index | Given stations with specific buffer depths, returns the right index |
| `detectConstraint` skips index 0 | Never returns 0 (intake queue is not a real bottleneck) |
| `wasteCount` sums all buffers | Returns correct total across 5 stations |
| `applyTocAction(state, 0)` sets constraint | `state.constraint` is set to detected index |
| `applyTocAction(state, 3)` adds oven slot | `stations[constraint].slots` incremented by 1 |

---

## Lint Check

```bash
npm run lint
```

**Expected**: Zero errors across all new files in `src/sim/`, `src/scenes/`, `src/hooks/`, `src/pages/`.

---

## Build Check

```bash
npm run build
```

**Expected**: Build completes without errors. Verifies no broken imports, missing files, or circular dependencies.

---

## References

- Sim data model: [data-model.md](./data-model.md)
- Scene interface: [contracts/pizza-scene.md](./contracts/pizza-scene.md)
- Hook interface: [contracts/use-pizza-sim.md](./contracts/use-pizza-sim.md)
- Starter implementation (authoritative reference for mechanics): `doc/starter/kanban-lean-pizza-game/kanban-pizza-sim.html`
