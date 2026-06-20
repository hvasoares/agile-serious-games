# Vitest Test Rules — agile-serious-games

Files: `src/**/*.test.ts`, `src/**/*.test.tsx`
Runner: Vitest. Coverage: `@vitest/coverage-v8` with 80% line/function/branch threshold.

## What to test

Test observable behavior, not implementation details.
`src/sim/` pure functions are the primary test target — they have no side-effects and need no mocks.
React components are tested for user-visible behavior (render output, interactions), not internal state.

## Coverage gate

`npm run coverage` enforces thresholds (80% lines/functions/branches on `src/sim/`).
Coverage MUST NOT drop below baseline. New sim functions need tests in the same PR.
Do not add `istanbul ignore` or `c8 ignore` without a comment and PR justification.

## File placement

Co-locate tests with their subject OR use `src/sim/__tests__/` (current convention).
Test file names mirror source: `wipSim.ts` → `wipSim.test.ts`.

## Test structure — AAA

Each test: one Arrange block, one Act, one or more Assert on the same logical outcome.

```ts
import { describe, it, expect } from 'vitest';
import { advanceTick } from '../wipSim';

describe('advanceTick', () => {
  it('moves a card to the next column when WIP limit allows', () => {
    // Arrange
    const state: WipState = buildState({ wipLimit: 3 });

    // Act
    const next = advanceTick(state);

    // Assert
    expect(next.columns[1].cards).toHaveLength(1);
    expect(next.columns[0].cards).toHaveLength(0);
  });
});
```

## Describing behavior, not methods

Group by scenario, not by function name when multiple behaviors exist.

```ts
describe('WIP limit enforcement', () => {
  it('blocks a card when the next column is at limit', () => { ... });
  it('allows a card when the next column has capacity', () => { ... });
});
```

## Parametrize with `it.each`

Use `it.each` for the same behavior across multiple inputs — avoids duplicate test bodies.

```ts
it.each([
  [1, 0, 'underloaded'],
  [3, 3, 'at limit'],
  [5, 3, 'overloaded'],
])('classifies WIP %i against limit %i as %s', (wip, limit, expected) => {
  expect(classifyWip(wip, limit)).toBe(expected);
});
```

## No mocks for sim logic

`src/sim/` functions are pure — never mock them or their dependencies.
Mocks are only for unmanaged external boundaries (timers, browser APIs).
Use `vi.useFakeTimers()` for game loop tests that depend on `Date.now()` or `setTimeout`.

## React component tests

Use `@testing-library/react` + `@testing-library/user-event`.
Query by role or label, not by class or test-id (prefer accessible queries).
Do not test internal state — test what the user sees or triggers.

```tsx
it('shows blocked indicator when card is blocked', () => {
  render(<Card title="Deploy" blocked={true} onMove={() => {}} />);
  expect(screen.getByRole('status', { name: /blocked/i })).toBeInTheDocument();
});
```

## Tooling

- `npm run test` — single run (CI)
- `npm run test:watch` — watch mode (dev)
- `npm run coverage` — coverage report with thresholds
