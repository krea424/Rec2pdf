# Codex Execution Plans (ExecPlans) — Template UI/UX

This ExecPlan is a living document. Keep **Progress**, **Surprises & Discoveries**, **Decision Log**, **Outcomes** up to date.

## Purpose / Big Picture
State the user-visible improvement (clarity, hierarchy, speed-to-task, reduced cognitive load) and how to observe it.

## Progress
- [ ] Milestone 1 …
- [ ] Milestone 2 …
(Use timestamps like (2025-10-30 17:15Z))

## Surprises & Discoveries
- Observation: …
  Evidence: …

## Decision Log
- Decision: …
  Rationale: …
  Date/Author: …

## Outcomes & Retrospective
What worked, what remains, lessons learned.

## Context and Orientation
Summarize current frontend stack (framework, router, component lib, CSS/tokens). Name key files/dirs with full paths.

## Plan of Work
Prose. Exact edits per file (paths, components, functions). Name any new tokens/components.

## Concrete Steps
Exact commands (dev server, build). Expected console/server output. Routes to visit.

## Validation and Acceptance
Behavioral checks + quick heuristics:
- **Hierarchy**: primary CTA above the fold; max 1 primary action per view.
- **Typography**: 1–2 font sizes per block, consistent leading; responsive scale.
- **Spacing**: 8-pt grid; vertical rhythm consistent.
- **Color/Contrast**: meet WCAG AA; tokens documented.
- **Navigation**: current section highlighted; back/forward predictable.
- **Performance**: Lighthouse ≥ X on key routes.

## Idempotence and Recovery
Safe to re-run. Rollback notes if changing routes or tokens.

## Artifacts and Notes
Small diffs/snippets only, just enough to prove success.

## Interfaces and Dependencies
Name libraries and design-token interfaces you will create/use (e.g., `src/styles/tokens.ts`, `@radix-ui/*`, etc.).
