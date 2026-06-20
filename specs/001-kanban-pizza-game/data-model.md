# Data Model: Kanban Pizza Game
<!-- feature: 001-kanban-pizza-game -->
<!-- Phase: 1 -->

All state is ephemeral — rebuilt via `freshSim(roundNum)` on each round load. No persistence layer.

---

## SimState

The single mutable simulation snapshot. Owned by `usePizzaSim` hook; passed to `PizzaScene.syncState` each frame; read-only by `PizzaGame.jsx` for sidebar rendering.

| Field | Type | Description |
|-------|------|-------------|
| `t` | `number` | Elapsed sim time in seconds |
| `round` | `1\|2\|3` | Active round number |
| `mode` | `'push'\|'pull'` | Flow mode; determines buffer cap enforcement |
| `delivered` | `number` | Cumulative count of completed pizzas |
| `leadSum` | `number` | Sum of all individual lead times (for avg calculation) |
| `spawnTimer` | `number` | Countdown until next pizza spawn |
| `pizzas` | `Pizza[]` | All live pizza items in the system |
| `stations` | `StationState[]` | Runtime state for each of the 5 stations |
| `started` | `number` | Cumulative count of pizzas ever spawned (CFD top line) |
| `reached` | `number[5]` | `reached[i]` = cumulative count of pizzas that have entered stage `i` |
| `cfd` | `CfdSample[]` | Time-series samples for the Cumulative Flow Diagram |
| `cfdTimer` | `number` | Countdown until next CFD sample (0.4 s sim-time) |
| `toc` | `boolean` | Whether Theory of Constraints guided mode is active |
| `tocStep` | `number` | Current ToC step index (0–4); -1 when ToC is off |
| `tocApplied` | `number` | How many ToC steps have been applied (applied ≤ tocStep) |
| `constraint` | `number` | Station index identified as the constraint; -1 if undetected |
| `exploit` | `boolean` | Whether Step 2 (Exploit) has been applied |
| `subordinate` | `boolean` | Whether Step 3 (Subordinate) has been applied |

---

## Pizza

A single work item flowing through the 5-station line.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Unique incrementing identifier |
| `stage` | `0\|1\|2\|3\|4` | Current station index (0=Cut, 1=Sauce, 2=Top, 3=Oven, 4=Deliver) |
| `state` | `'queue'\|'moving'\|'working'\|'handoff'` | Current lifecycle state (see State Machine below) |
| `born` | `number` | `t` value when pizza was spawned (for lead time calculation) |
| `reached` | `number` | Highest station index this pizza has entered (for CFD monotonicity) |
| `prog` | `number` | Work progress at current station in seconds (0 → `station.dur`) |
| `pos` | `{x,y,z}` | Current world-space position (plain object, not THREE.Vector3) |
| `target` | `{x,y,z}\|null` | Target position for interpolation during `'moving'` state |

### Pizza State Machine

```
spawn → [queue] → (station has a free slot) → [moving to work slot]
      → [working] → (prog >= dur) → [handoff]
      → (next station has buffer room) → [moving to buffer slot] → [queue] at next stage
      → (stage === 4 and handoff) → delivered (removed from state)
```

**Invariant**: A pizza in a `buffer[]` array MUST have `state === 'queue'`, never `'working'`. Violation causes the pizza to "work" while queued and bypass the slot cap — this was a bug in the starter's history.

---

## StationState

Runtime state for one of the 5 stations. Derived from static `STATION_DEFS` at `freshSim` time.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Identifier (`'cut'`, `'sauce'`, `'top'`, `'bake'`, `'deliver'`) |
| `name` | `string` | Display name |
| `dur` | `number` | Processing time per pizza in seconds |
| `slots` | `number` | Physical work slots (max concurrent pizzas being worked) |
| `baseSlots` | `number` | Original slot count (for reset after Elevate step) |
| `cap` | `number` | WIP limit for buffer (enforced in pull mode); `99` = unlimited in push mode |
| `load` | `number` | Smoothed exponential average of `buffer.length` (constraint detection signal) |
| `occupants` | `Pizza[]` | Pizzas currently being worked at this station |
| `buffer` | `Pizza[]` | Pizzas waiting in queue in front of this station |

### Station Definitions (static)

| Index | Key | Name | Duration | Slots | Fixed Cap |
|-------|-----|------|----------|-------|-----------|
| 0 | `cut` | Cut base | 1.0 s | 3 | — |
| 1 | `sauce` | Sauce | 1.6 s | 2 | — |
| 2 | `top` | Top | 2.2 s | 2 | — |
| 3 | `bake` | Oven | 3.6 s | 3 | 3 (fixed) |
| 4 | `deliver` | Deliver | 0.8 s | 2 | — |

The Oven's `fixedCap:3` means `slots` and `cap` are always identical and cannot be changed by WIP sliders. The Oven is the hard constraint.

---

## Round

Static configuration for each round. Defined as a constant object; not mutated at runtime.

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Display title |
| `mode` | `'push'\|'pull'` | Flow mode |
| `intro` | `string` | Introductory banner text |
| `wip` | `number[5]` | Initial WIP caps per station; `99` = unlimited |
| `lock` | `boolean` | Whether WIP sliders are locked (true in Round 1) |

| Round | Mode | WIP caps | Lock |
|-------|------|----------|------|
| 1 | push | [99,99,99,99,99] | true |
| 2 | pull | [2,2,2,3,2] | false |
| 3 | pull | [2,2,3,3,2] | false |

---

## TocStep

Static definition for each of the 5 Theory of Constraints focusing steps.

| Field | Type | Description |
|-------|------|-------------|
| `tag` | `string` | Step label (e.g., `'Step 1 — Identify'`) |
| `title` | `string` | Step headline |
| `body` | `string` | Explanatory text (may contain HTML `<b>` tags) |
| `applied` | `string` | Confirmation message shown after the step is applied |

The 5 steps and their sim-side effects:

| Step | Name | Effect on SimState |
|------|------|-------------------|
| 0 | Identify | Sets `state.constraint` to detected station index |
| 1 | Exploit | Sets `state.exploit = true` (coaching signal) |
| 2 | Subordinate | Sets `state.subordinate = true`; `step()` adjusts feed rate and inbound cap |
| 3 | Elevate | Increments `stations[constraint].slots` by 1; updates `cap` if fixedCap |
| 4 | Repeat | Re-runs `detectConstraint`, sets `state.constraint` to new value |

---

## CfdSample

One snapshot in the CFD time series, taken every 0.4 s of sim-time.

| Field | Type | Description |
|-------|------|-------------|
| `t` | `number` | Sim time at sample |
| `reached` | `number[5]` | Copy of `state.reached` at sample time |
| `done` | `number` | Copy of `state.delivered` at sample time |

**Invariant**: `reached[i] >= reached[i+1]` for all `i` (monotonic by construction). `done <= reached[4]`. The CFD never decreases.

---

## Relationships

```
SimState
  ├── pizzas[]: Pizza[]          (live items; removed on delivery)
  ├── stations[]: StationState[] (runtime view of the 5 stations)
  │     ├── occupants[]: Pizza[] (subset of pizzas[])
  │     └── buffer[]: Pizza[]    (subset of pizzas[])
  └── cfd[]: CfdSample[]         (append-only, capped at 600)
```

A `Pizza` is referenced from exactly one of: `stations[i].buffer[]` or `stations[i].occupants[]`. On delivery it is removed from both `stations` and `pizzas`.
