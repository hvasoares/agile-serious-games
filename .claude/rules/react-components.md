# React Component Rules — agile-serious-games

Files: `src/components/*.tsx`, `src/pages/*.tsx`, `src/hooks/*.ts`

## Components are presentational

No business logic or simulation math inside a component body.
Components receive state via props or context — they render and dispatch, nothing more.
Heavy computation belongs in `src/sim/` pure functions called from hooks.

```tsx
// bad — sim logic in component
function WipGame() {
  const next = { ...state, columns: state.columns.map(col => advanceColumn(col)) };
  ...
}

// good — delegate to hook/sim
function WipGame() {
  const { state, advance } = useWipSim();
  ...
}
```

## Props typing

Every component MUST have an explicit props interface.
Use `React.FC` only if you need children typing — otherwise just type the props argument.

```tsx
interface CardProps {
  title: string;
  blocked: boolean;
  onMove: (id: string) => void;
}

export function Card({ title, blocked, onMove }: CardProps) { ... }
```

## Hooks

Custom hooks live in `src/hooks/`. Each hook has one clear responsibility.
Hooks that wrap simulation loops return `{ state, dispatch }` or `{ state, actions }`.
Never call a hook conditionally — React rules of hooks apply strictly.

```ts
// src/hooks/useWipSim.ts
export function useWipSim(initialState: WipState) {
  const [state, setState] = useState(initialState);
  const advance = useCallback(() => setState(s => advanceTick(s)), []);
  return { state, advance };
}
```

## Three.js in React

Never mount or mutate a Three.js scene inside a component render function.
Use `useRef` + `useEffect` to hand the canvas to a scene module.
Scene lifecycle (init / tick / dispose) is fully owned by `src/scenes/`.

```tsx
export function GameCanvas({ sceneKey }: { sceneKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const scene = createScene(canvasRef.current!);
    return () => scene.dispose();
  }, [sceneKey]);

  return <canvas ref={canvasRef} />;
}
```

## State

Prefer `useState` for local UI state, `useReducer` for multi-field sim state.
Lift state to the lowest common ancestor — no global store unless two+ unrelated subtrees need it.
Context is for cross-cutting concerns (theme, current game config) — not for per-tick sim data.

## ESLint

`eslint-plugin-react-hooks` runs in CI. Comply with exhaustive-deps.
Suppress `react-hooks/exhaustive-deps` only with a comment explaining the stable reference.
