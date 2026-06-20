# TypeScript Rules — agile-serious-games

All source files MUST be `.ts` or `.tsx`. No `.js` files in `src/`.

## Strictness

`tsconfig.json` requires `strict: true`. Every build runs `tsc --noEmit` — zero errors to merge.
Never use `any`. Alternatives:
- `unknown` + type guard for truly unknown external data
- Union types for limited value sets
- Generics for reusable containers

```ts
// bad
function tick(state: any): any { ... }

// good
function tick(state: SimState): SimState { ... }
```

## Annotations

Annotate all exported functions, their parameters, and return types.
Omit annotations on local variables when inference is obvious.
Use `interface` for object shapes passed across module boundaries.
Use `type` aliases for unions, intersections, and computed types.

```ts
export interface WipState {
  columns: Column[];
  wipLimit: number;
  tick: number;
}

export function advanceTick(state: WipState): WipState { ... }
```

## Narrowing over casting

Prefer type guards and narrowing over `as` casts.
`as` is allowed only at system boundaries (JSON parsing, DOM APIs) — add a comment.

```ts
// ok at boundary
const raw = JSON.parse(text) as unknown;
if (!isWipState(raw)) throw new Error('invalid state shape');
```

## Enums

Prefer `const` object + `typeof` value union over `enum` — avoids TS enum pitfalls.

```ts
const Direction = { LEFT: 'left', RIGHT: 'right' } as const;
type Direction = typeof Direction[keyof typeof Direction];
```

## Module boundaries

Export only what callers need. Internal helpers stay unexported.
Barrel `index.ts` files are fine for `sim/` and `scenes/` — keep them thin.
