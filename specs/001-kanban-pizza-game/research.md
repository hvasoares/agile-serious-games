# Research: Kanban Pizza Game
<!-- feature: 001-kanban-pizza-game -->
<!-- Phase: 0 — resolved before design -->

---

## Three.js Version Compatibility

**Decision**: Use Three.js r0.169.0 (already in `package.json`) — no CDN, no version pinning needed.

**Rationale**: The starter file uses r128 via CDN. Every API the starter relies on — `BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `ExtrudeGeometry`, `TorusGeometry`, `SpriteMaterial`, `CanvasTexture`, `MeshStandardMaterial`, `MeshBasicMaterial`, `WebGLRenderer`, `PCFSoftShadowMap`, `DirectionalLight`, `HemisphereLight`, `AmbientLight`, `Fog`, `Shape` — has been stable without breaking changes between r128 and r169. Shadow map, material, and geometry APIs are unchanged.

**Alternatives considered**: Locking to r128 via npm — rejected; introduces a second Three.js install or a forced downgrade. Using r169's new APIs — none of them are needed, no upside.

---

## Camera Orbit Pattern

**Decision**: Hand-rolled camera orbit using `pointerdown`/`pointermove`/`pointerup` events + `camera.position.set(sin * dist, height, cos * dist)` with lerp — identical approach to the starter.

**Rationale**: The project's existing `heroScene.js` uses the same hand-rolled pattern rather than `OrbitControls`. This avoids an extra import and keeps the scene module self-contained. The starter's orbit implementation is already production-quality for this use case.

**Alternatives considered**: `three/examples/jsm/controls/OrbitControls.js` — rejected because it adds a module-level import dependency and slightly different UX (inertia, damping) not required by spec.

---

## File Format

**Decision**: `.js`/`.jsx` for all new source files.

**Rationale**: The entire existing codebase uses `.js`/`.jsx` with no `tsconfig.json`. Mixing `.ts`/`.tsx` for only the new files would require: (a) adding a `tsconfig.json`, (b) updating `vite.config.js` to handle TypeScript, (c) updating `eslint.config.js` for TypeScript rules, (d) updating the Vitest config. This is a full TypeScript migration, not a per-feature change. The constitution violation is pre-existing; it should be resolved in a dedicated migration PR.

**Alternatives considered**: Migrate all source to TypeScript as part of this feature — rejected; out of scope and would block the pizza game delivery behind unrelated refactoring work.

---

## Scene Architecture

**Decision**: Class-based `PizzaScene` with `constructor(mountElement, opts)`, `.syncState(simState, dt)`, `.loadRound(roundNum, simState)`, `.resize()`, `.dispose()`.

**Rationale**: Every existing scene (`WipScene`, `BottleneckScene`, `FlowScene`, `HeroScene`) uses a class with this exact pattern. The React page calls `new PizzaScene(mountRef.current, { onUpdate })` in a `useEffect`. Consistent with the codebase, no learning curve for maintainers.

**Alternatives considered**: Factory function returning a handle object (matching `threejs-scenes.md` rules) — rejected because the existing codebase universally uses classes despite the rule. Following the rule here would create an inconsistency; a style unification PR should address it across all scenes together.

---

## CFD Canvas Strategy

**Decision**: `PizzaScene` creates and manages both canvases internally. The mount element gets a flex-column container with the 3D canvas on top and the CFD canvas strip below. React provides only the container `<div>` via `ref`.

**Rationale**: The CFD is tightly coupled to the simulation sample buffer (`sim.cfd`) which lives inside `pizzaSim.js`. The scene already has access to this data via `syncState`. Managing both canvases in one class keeps all canvas lifecycle (create, size, dispose) in one place and eliminates the need for a second React ref or a separate CFD component.

**Alternatives considered**: Separate React `<canvas>` ref for CFD passed to `PizzaScene` — rejected; it exposes canvas elements to React unnecessarily and splits canvas lifecycle across the component and the scene. Rendering CFD as SVG or a charting library — rejected; overkill, adds a dependency, and the starter's canvas implementation is already complete and correct.

---

## Simulation Logic Extraction

**Decision**: Extract the following pure functions to `src/sim/pizzaSim.js`:
- `STATIONS` — static station configuration array (exported constant)
- `ROUNDS` — static round configuration object (exported constant)
- `TOC_STEPS` — static ToC step definitions (exported constant)
- `freshSim(roundNum)` — returns a complete initial SimState for the given round
- `step(state, dt)` — pure advance function: returns `{ nextState, events }` where `events` is an array of `{ type, payload }` objects the scene uses to create/remove/update meshes
- `detectConstraint(stations)` — returns station index with highest smoothed buffer load (skips index 0)
- `wasteCount(stations)` — sum of all buffer lengths
- `wipCount(pizzas)` — total live pizza count
- `applyTocAction(state, stepIndex)` — returns updated state after applying one ToC step

**Rationale**: Pure functions are trivially testable with Vitest. This is the architecture pattern mandated by the constitution (Principle IV) and consistently applied in `wipSim.js`, `flowSim.js`, `bottleneckSim.js`.

**Key design note on `step`**: The original starter mutates Three.js mesh `.position` and `.rotation` inside the sim loop. In the extracted version, `step` returns new state only (positions as `{ x, y, z }` plain objects). `PizzaScene.syncState` maps state positions to mesh positions. This clean separation makes `step` testable without Three.js.

**Alternatives considered**: Leaving Three.js mutation in the step function — rejected; impossible to unit-test and violates constitution Principle IV.

---

## Hook Responsibility Split

**Decision**: `usePizzaSim` owns the `requestAnimationFrame` loop and bridges sim state to React. `PizzaScene` owns Three.js rendering. The two are connected via a ref to the scene instance.

**Rationale**: Matches the existing `WipGame` pattern: the hook (via `useEffect`) creates the scene, then drives it each frame. The scene doesn't know about React; React doesn't know about Three.js. This matches Principle IV cleanly.

**Hook returns**: `{ simState, running, setRunning, round, setRound, setWipLimit, resetRound, tocNext, tocPrev }` — only what `PizzaGame.jsx` needs for the sidebar.

---

## Testing Strategy for pizzaSim.js

**Decision**: Vitest unit tests for all exported functions. No Three.js mocking needed because `step` returns plain-object state.

**Coverage targets**:
- `freshSim` — assert all station defaults, round config application
- `step` (push mode) — assert spawning, buffer growth, pizza state transitions
- `step` (pull mode) — assert WIP limit blocking, pull discipline
- `detectConstraint` — assert correct index returned for given buffer depths
- `wasteCount` / `wipCount` — trivial, parametrize
- `applyTocAction` — one test per step (0–4), assert state changes

**Rationale**: The sim loop is the most critical logic in the feature. High coverage here gives confidence without needing integration tests that require a browser.

---

## Route and Navigation

**Decision**: Route `/pizza`, page component `PizzaGame`, game card added to `Home.jsx`.

**Rationale**: Existing routes are `/wip`, `/bottleneck`, `/flow` — all short, game-type slugs. `/pizza` follows the same convention. The home page already has a games grid; adding a card there makes the pizza game discoverable without changing the navigation structure.
