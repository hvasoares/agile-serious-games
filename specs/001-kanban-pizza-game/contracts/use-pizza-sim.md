# Contract: usePizzaSim
<!-- feature: 001-kanban-pizza-game -->
<!-- Phase: 1 — UI contract -->

`src/hooks/usePizzaSim.js` — React hook that owns the `requestAnimationFrame` game loop and bridges sim state to the `PizzaGame` page. No Three.js imports; no direct DOM access.

---

## Signature

```js
function usePizzaSim(initialRound = 1)
```

**Parameters**:
- `initialRound` — `1|2|3` — the round to load when the hook mounts

**Returns**:
```js
{
  simState,       // SimState — current simulation snapshot (read-only for JSX)
  running,        // boolean — true while the game loop is advancing
  setRunning,     // (bool) => void
  round,          // 1|2|3 — currently loaded round
  setRound,       // (roundNum: 1|2|3) => void — resets sim to that round
  setWipLimit,    // (stationIdx: number, value: number) => void
  resetRound,     // () => void — reloads current round from scratch
  tocNext,        // () => void — applies current ToC step and advances to next
  tocPrev,        // () => void — navigates back one ToC step (display only, no state revert)
}
```

---

## Behaviour

### Initialization (`useEffect` on mount)

1. Creates `freshSim(initialRound)` and stores in a ref.
2. Creates a `PizzaScene` instance pointed at the mount element (the scene ref is passed down from `PizzaGame` via a `sceneRef` parameter — see Wiring below).
3. Calls `scene.loadRound(initialRound, simState)`.
4. Starts the `requestAnimationFrame` loop.

### Game loop (each frame)

```
now = performance.now()
dt = clamp((now - lastT) / 1000, 0, 0.05)
lastT = now

if (running) {
  nextState = step(simState, dt)
  simStateRef.current = nextState
  scene.syncState(nextState, dt)
  setSimState(nextState)   // triggers React re-render for sidebar
}
scene.render()             // always renders (camera orbit still needs to update)
requestAnimationFrame(loop)
```

`dt` is clamped to 50 ms maximum to avoid spiral-of-death on tab-background return.

### setRound

1. Sets `round` state.
2. Calls `freshSim(roundNum)` to get new state.
3. Calls `scene.loadRound(roundNum, newState)`.
4. Sets `running = false`.

### setWipLimit

1. Mutates `simStateRef.current.stations[stationIdx].cap = value` directly (no re-render needed; the cap is read by `step()` next frame).
2. If the station has a `fixedCap`, the call is ignored.

### resetRound

Equivalent to calling `setRound(round)` with the current round — reloads from scratch.

### tocNext

1. Reads `simState.tocStep`.
2. Calls `applyTocAction(simState, tocStep)` to get updated state.
3. If `tocStep < 4`, increments `tocStep`.
4. Marks `tocApplied = max(tocApplied, tocStep + 1)`.
5. If `running === false`, starts the loop (applying a ToC step auto-starts).

### tocPrev

1. Decrements `tocStep` (display navigation only).
2. Does NOT revert any state changes from previously applied steps.

---

## Wiring with PizzaGame.jsx

`usePizzaSim` needs access to the `PizzaScene` instance which is created inside the page's `useEffect`. To avoid prop drilling or circular dependencies, the hook accepts a `sceneRef` parameter:

```js
// PizzaGame.jsx
const sceneRef = useRef(null)
const { simState, running, setRunning, ... } = usePizzaSim(1, sceneRef)

useEffect(() => {
  sceneRef.current = new PizzaScene(mountRef.current, { onUpdate: setMetrics })
  return () => sceneRef.current?.dispose()
}, [])
```

The hook checks `sceneRef.current` before calling scene methods; the loop starts only after the scene is available.

Alternatively, the hook can own the scene creation entirely if `mountRef` is passed in:

```js
// simpler approach (recommended)
const { simState, ... } = usePizzaSim(1, mountRef)
// hook creates new PizzaScene(mountRef.current, ...) internally
```

**Decision**: The hook creates the scene internally. This matches the existing pattern in `WipGame` where the scene is created inside `useEffect` without a separate hook.

---

## State Exposed to JSX

`simState` is exposed as React state (via `useState`). The hook updates it on every frame when `running === true`. The page uses it to render:
- Round intro text and button active states
- Station WIP limit sliders and live queue/occupant readouts
- Metrics (delivered, waste, wip, avg lead time)
- ToC step panel (step text, dots, applied message)
- Coaching message

To avoid re-render storm, consider: only calling `setSimState` when a meaningful metric changes (delivered count, waste count, station buffer lengths). The Three.js render is not tied to React state.

---

## What usePizzaSim Does NOT Do

- No Three.js imports or DOM access
- No routing or navigation
- No direct canvas manipulation (all canvas work is in `PizzaScene`)
- No persistence or external API calls
