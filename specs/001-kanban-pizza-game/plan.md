# Implementation Plan: Kanban Pizza Game

**Branch**: `001-kanban-pizza-game` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-kanban-pizza-game/spec.md`

---

## Summary

Port the Kanban Pizzeria Flow Simulator (from `doc/starter/kanban-lean-pizza-game/`) into the existing React + Vite application as a new game route `/pizza`. The game teaches Kanban/Lean/Theory of Constraints through a 3D real-time pizza production line with three progressively challenging rounds. Simulation logic is extracted to a pure-function module; the Three.js scene follows the class-based pattern of `WipScene`/`BottleneckScene`/`FlowScene`; the React page follows the `GameLayout` + inline-sidebar pattern of `WipGame`.

---

## Technical Context

**Language/Version**: JavaScript ES2022 + JSX — following the project's existing `.js`/`.jsx` convention. See Constitution Check.

**Primary Dependencies**: React 18, react-router-dom 6, Three.js r0.169.0, Vitest + @vitest/coverage-v8 (all already in `package.json`).

**Storage**: None — all state is ephemeral in memory, rebuilt on each round reset.

**Testing**: Vitest matching `src/**/*.test.{js,jsx}` per `vite.config.js`. Coverage enforced on `src/sim/**/*.js` with 80% line/function/branch threshold.

**Target Platform**: Modern evergreen browsers (Chrome, Firefox, Safari, Edge). Mobile layout in scope.

**Project Type**: Web application — React SPA, GitHub Pages deploy via `npm run deploy`.

**Performance Goals**: 60 fps Three.js render loop. CFD resampled every 0.4 s sim-time. Metrics update each frame. Max ~75 pizza meshes (push) / ~40 (pull).

**Constraints**: Single-page, no server, no localStorage. Three.js r0.169.0 (npm), hand-rolled camera orbit via pointer events. `base: '/agile-serious-games/'` already in vite.config.js.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript First | ⚠️ PRE-EXISTING VIOLATION | All existing source is `.js`/`.jsx`; no `tsconfig.json`. New feature uses `.js`/`.jsx` for codebase consistency. TypeScript migration is a separate initiative. See Complexity Tracking. |
| II. Coverage ≥ 80% | ✅ Required | `pizzaSim.js` pure functions ship with `pizzaSim.test.js`; threshold enforced in `vite.config.js`. |
| III. Lint Gate | ✅ Required | All new `src/**/*.{js,jsx}` files covered by existing `eslint.config.js`; zero errors at PR. |
| IV. Architecture | ✅ Compliant | Sim logic → `src/sim/pizzaSim.js` (pure, no React/Three.js). Scene → `src/scenes/pizzaScene.js` (Three.js class, no React). Hook → `src/hooks/usePizzaSim.js`. Page → `src/pages/PizzaGame.jsx` (React only). |
| V. Simplicity / YAGNI | ✅ Compliant | No abstractions beyond three rounds and ToC mode, both in spec. No speculative hooks or patterns. |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-kanban-pizza-game/
├── plan.md              ← this file
├── research.md          ← Phase 0
├── data-model.md        ← Phase 1
├── quickstart.md        ← Phase 1
├── contracts/
│   ├── pizza-scene.md   ← Phase 1
│   └── use-pizza-sim.md ← Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             ← /speckit-tasks output (not created here)
```

### Source Code

```text
src/
├── sim/
│   ├── pizzaSim.js              ← NEW: pure simulation functions
│   └── __tests__/
│       └── pizzaSim.test.js     ← NEW: Vitest tests
├── scenes/
│   └── pizzaScene.js            ← NEW: Three.js scene class (3D + CFD)
├── hooks/
│   └── usePizzaSim.js           ← NEW: rAF loop + state bridge
├── pages/
│   ├── PizzaGame.jsx            ← NEW: game page with sidebar
│   └── Home.jsx                 ← MODIFY: add pizza game card
└── App.jsx                      ← MODIFY: add /pizza route
```

**Structure Decision**: Single-project layout matching existing convention. All new files drop into existing `sim/`, `scenes/`, `hooks/`, `pages/` directories. No new top-level directories.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Pre-existing TypeScript violation (Principle I) | All existing source is `.js`/`.jsx`; using `.ts` only for the new files would create a mixed codebase and require a partial tsconfig conflicting with current Vite/ESLint setup. | Full TypeScript migration of all existing files is out of scope. Should be a dedicated PR. |
| Two-canvas setup (3D Three.js + 2D CFD) | The spec requires a live Cumulative Flow Diagram as a stacked-band time-series chart; Three.js WebGL cannot render this natively. | The CFD canvas is managed entirely inside `pizzaScene.js`. React remains unaware of both canvases. Zero React-side complexity added. |
