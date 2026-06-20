# Contract: PizzaScene
<!-- feature: 001-kanban-pizza-game -->
<!-- Phase: 1 — UI contract -->

`src/scenes/pizzaScene.js` — Three.js scene class managing the 3D pizza production line and the Cumulative Flow Diagram canvas. No React imports.

---

## Class Interface

```js
class PizzaScene {
  constructor(mountElement, { onUpdate })
  loadRound(roundNum, initialSimState)
  syncState(simState, dt)
  resize()
  dispose()
}
```

---

## Constructor

```js
constructor(mountElement, { onUpdate })
```

**Parameters**:
- `mountElement` — `HTMLElement` — the container div provided by the React page via `ref`
- `opts.onUpdate` — `(metrics) => void` — callback invoked each frame with sidebar metrics

**Side effects**:
- Creates a flex-column wrapper div inside `mountElement`
- Creates and appends the Three.js `WebGLRenderer` canvas (top, flex:1)
- Creates and appends the CFD `<canvas>` strip (bottom, fixed height ~248px)
- Initialises the Three.js scene, camera, lights, counter/belt geometry, station pads, worker figures
- Does NOT start any animation loop (the hook owns `requestAnimationFrame`)

**onUpdate callback shape**:
```js
{
  delivered: number,    // pizzas delivered this round
  waste: number,        // total items in all station buffers
  wip: number,          // total live pizzas
  lead: string,         // avg lead time formatted as "X.Xs" or "—"
  t: number,            // elapsed sim time
  stationStats: [       // one entry per station
    { key: string, bufferLen: number, occupantLen: number, slots: number }
  ]
}
```

---

## loadRound

```js
loadRound(roundNum, initialSimState)
```

**Parameters**:
- `roundNum` — `1|2|3`
- `initialSimState` — `SimState` from `freshSim(roundNum)`

**Behaviour**:
- Removes all pizza meshes from the Three.js scene
- Clears the fading queue
- Re-positions the constraint ring (hidden)
- Clears and redraws the CFD canvas (blank)
- Does not rebuild static geometry (counter, stations, workers — those are created once)

---

## syncState

```js
syncState(simState, dt)
```

Called by the hook each animation frame (when `running === true`).

**Parameters**:
- `simState` — current `SimState` returned by `step()`
- `dt` — delta time in seconds

**Behaviour**:
1. For each pizza in `simState.pizzas`:
   - Creates a Three.js mesh if one doesn't exist for this pizza's `id`
   - Updates mesh `position` from `pizza.pos`
   - Updates mesh `rotation.y` (spin if `state === 'working'`)
   - Applies visual progression (sauce opacity, toppings visibility, crust bake colour)
2. Removes meshes for pizzas that no longer exist in `simState.pizzas` (delivered)
3. Animates worker figures (arm movement, drift toward bottleneck in pull mode)
4. Updates constraint ring position and pulse
5. Ticks the fade-out queue (delivered pizza float-up effect)
6. Redraws CFD canvas if `simState.cfd` has grown since last draw
7. Updates camera orbit (lerp angle)
8. Calls `renderer.render(scene, camera)`
9. Calls `opts.onUpdate(metrics)`

**Mesh registry**: The scene maintains a `Map<pizzaId, THREE.Group>` to avoid creating duplicate meshes on each call.

---

## resize

```js
resize()
```

Called by the React page on `ResizeObserver` events.

**Behaviour**:
- Reads `mountElement.clientWidth` / `clientHeight`
- Updates `renderer.setSize(w, h3d)` where `h3d = total height - CFD strip height`
- Updates `camera.aspect` and calls `camera.updateProjectionMatrix()`
- Redraws CFD canvas at new dimensions

---

## dispose

```js
dispose()
```

Called by the React `useEffect` cleanup function.

**Behaviour**:
- Removes all event listeners (pointer, wheel, resize observer)
- Traverses the scene and calls `.dispose()` on all geometries and materials
- Calls `renderer.dispose()`
- Removes the wrapper div from `mountElement`

---

## Resource Management

All `THREE.BufferGeometry` and `THREE.Material` instances created at construction time are collected in arrays. Pizza mesh geometries/materials are collected at pizza-creation time. All are disposed in `dispose()`.

```js
// collected at construction
const geos = []   // push each new geometry
const mats = []   // push each new material

// per pizza mesh
function makePizzaMesh(pizza) {
  const geo = new THREE.ExtrudeGeometry(...)
  geos.push(geo)
  // ...
}

// in dispose()
geos.forEach(g => g.dispose())
mats.forEach(m => m.dispose())
renderer.dispose()
```

---

## CFD Drawing

The scene exposes no public CFD API. Internally it calls `drawCFD(simState.cfd, simState.delivered)` after each `syncState` frame where the sample count has changed. The CFD canvas dimensions are updated in `resize()`.

---

## What PizzaScene Does NOT Do

- No React imports or JSX
- No simulation logic (all computation is done in `pizzaSim.js` before `syncState` is called)
- No routing or navigation
- No DOM elements other than the two canvases inside the provided `mountElement`
