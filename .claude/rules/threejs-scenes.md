# Three.js Scene Rules — agile-serious-games

Files: `src/scenes/*.ts`

## Isolation principle

Three.js code MUST NOT appear inside React components or hooks.
Scenes are plain TypeScript modules — no React imports, no hooks, no JSX.
React hands a `canvas` element in; the scene owns everything inside it.

## Scene interface

Every scene module exports a `createScene` factory that returns a handle object.
The handle exposes `tick`, `setState`, and `dispose` — nothing else.

```ts
export interface SceneHandle {
  tick: (state: SimState) => void;
  dispose: () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(...);

  // build initial geometry here

  return {
    tick(state) {
      // update geometry from state — pure data-driven update
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
    },
  };
}
```

## State-driven rendering

Scenes are driven by sim state, not internal Three.js state.
On each `tick(state)` call, update object positions/colors from the state value.
Never read back from Three.js objects to derive game logic — that flows from `src/sim/`.

## Resource management

Every `new THREE.X` that allocates GPU memory MUST be matched with a `.dispose()` call.
Collect disposables at construction time; free them all in the `dispose()` handle method.
Resize handling: attach a `ResizeObserver` on the canvas inside `createScene`; detach in `dispose`.

```ts
const geometries: THREE.BufferGeometry[] = [];
const materials: THREE.Material[] = [];

function makeCard() {
  const geo = new THREE.BoxGeometry(1, 0.6, 0.05);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  geometries.push(geo);
  materials.push(mat);
  return new THREE.Mesh(geo, mat);
}

// in dispose:
geometries.forEach(g => g.dispose());
materials.forEach(m => m.dispose());
renderer.dispose();
```

## Typing Three.js

Import types from `three` directly — avoid `@types/three` gaps.
Use `THREE.Object3D`, `THREE.Mesh<G, M>` generics where precision helps.
Keep a typed map of scene objects for state-driven updates:

```ts
interface SceneObjects {
  cards: Map<string, THREE.Mesh>;
  columns: THREE.Group[];
}
```

## Testing scenes

Scene modules are hard to unit-test (WebGL). Rely on:
1. Integration test: confirm `createScene` returns the handle without throwing (headless canvas).
2. Visual verification: run `npm run dev` and observe in browser.
Do not mock Three.js internals — too fragile.
