<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial fill — first concrete constitution)
Modified principles: N/A (all new, replacing template placeholders)
Added sections: Core Principles (5), Technical Stack, Development Workflow, Governance
Removed sections: N/A
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gate present; principle names now concrete
  ✅ .specify/templates/spec-template.md — No constitution-specific references requiring change
  ✅ .specify/templates/tasks-template.md — T003 lint task pattern aligns with Principle III (Linting Gate)
Deferred TODOs: none
-->

# Agile Serious Games Constitution

## Core Principles

### I. TypeScript-First (NON-NEGOTIABLE)

Every source file MUST be TypeScript (`.ts` / `.tsx`). Plain `.js` files are forbidden in `src/`.
Type annotations MUST cover all public function signatures and exported identifiers.
`any` is forbidden — use `unknown` with type guards, or narrow types explicitly.
`tsconfig.json` MUST enable `strict: true`. Non-strict builds MUST NOT be merged.
Type coverage MUST NOT regress across PRs. `tsc --noEmit` MUST pass on every build.

### II. Test Coverage (NON-NEGOTIABLE)

Tests MUST be written for every new feature and bug fix before the PR is merged.
Coverage MUST NOT drop below the project baseline (enforced via `vitest --coverage` thresholds in CI).
Removing or disabling a test requires explicit justification in the PR description.
The Red-Green-Refactor TDD cycle is the preferred development flow.
Tests live co-located with their subject (`src/**/*.test.ts(x)`) or in a top-level `tests/` directory.

### III. Linting Gate (NON-NEGOTIABLE)

`npm run lint` (ESLint) MUST pass with zero errors before any PR is merged.
`// eslint-disable` suppression MUST include a comment explaining the specific reason.
New lint rules MUST NOT be disabled without a documented decision.
CI MUST block deployment on any lint failure. Lint warnings MUST be resolved, not silenced over time.

### IV. Component Architecture

React components MUST remain presentational where possible — no business logic inside render.
Simulation and game logic MUST live in pure TypeScript functions, testable without React.
Three.js scene code MUST be isolated from React component trees (custom hooks or service modules).
No component MUST reach into another component's internal state directly — use props or context.

### V. Simplicity & YAGNI

Implement only what the current user story requires — no speculative abstractions.
Complexity MUST be justified: if adding an abstraction layer, document the specific pain it solves.
Prefer explicit code over clever code — a clear 3-line block beats a clever one-liner.
Dependencies MUST be evaluated before adding — prefer platform/standard library where sufficient.

## Technical Stack

**Language**: TypeScript (strict mode) + React 18 + React Router 6
**3D Rendering**: Three.js (scene logic isolated from React component trees)
**Build**: Vite 5
**Testing**: Vitest + @vitest/coverage-v8 (coverage thresholds enforced in CI)
**Linting**: ESLint 10 with eslint-plugin-react and eslint-plugin-react-hooks
**Type checking**: `tsc --noEmit` runs as part of CI, MUST pass with zero errors
**Deployment**: GitHub Pages via `gh-pages`
**Package manager**: npm (lock file committed and kept up to date)

## Development Workflow

All work begins from a feature branch — no direct commits to `main`.

PR checklist (all four gates MUST pass before merge):
1. `npm run lint` — zero ESLint errors
2. `npm run test` — all Vitest tests pass
3. `npm run coverage` — coverage at or above baseline threshold
4. `tsc --noEmit` — zero TypeScript errors

Tests MUST be added or updated in the same PR as the feature or fix they cover.
Commit messages follow Conventional Commits: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`.
CI enforces all four gates above and blocks deployment on failure.

## Governance

This constitution supersedes all other development practices for this project.
Amendments require: (1) documented rationale, (2) incremented version, (3) propagation check across `.specify/templates/`.
All PRs and code reviews MUST verify compliance with Principles I–V.
Complexity exceptions (e.g., a justified `any` cast) MUST be tracked in the PR description and the plan's Complexity Tracking table.
Refer to `.specify/memory/constitution.md` (this file) as the authoritative runtime development guidance.

**Version**: 1.0.0 | **Ratified**: 2026-06-19 | **Last Amended**: 2026-06-19
