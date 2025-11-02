# ExecPlan — Rec2pdf Frontend Refactor (Base B & Advanced Slim)

## Purpose / Big Picture
Deliver a streamlined creation experience: Base mode becomes a quick-start workspace dashboard with contextual cards, unified uploads, and a single record toggle; Advanced mode is pared down to parameter configuration plus the library. Success is observed through reduced on-screen redundancy, clearer hierarchy, and preserved recording/upload flows.

## Progress
- [x] Milestone 1 (Audit + TODO scaffolding) — (2025-02-14 12:00Z)
- [x] Milestone 2 (Base B header cards & uploads) — (2025-02-14 15:45Z · summary cards + unified upload bar)
- [x] Milestone 3 (Recording toggle + accessibility polish) — (2025-02-14 18:10Z · unified Registra/Stop CTA)
- [ ] Milestone 4 (Advanced slim view + library handoff) — (2025-02-15 09:40Z · InputManager palette e controlli allineati alla UI Base B)
- [ ] Milestone 5 (Tests, docs, screenshots, feature flag) — (…)

## Surprises & Discoveries
- Observation: BaseHome already encapsulates pipeline/upload separation; uploading new assets likely extends `UploadCard` without altering provider APIs.
  Evidence: `src/features/base/UploadCard.jsx` handles recording, audio details, and existing upload button via context.
- Observation: Advanced view replicates Base information through `SetupPanel` highlight cards and pipeline call-to-action; these become removal candidates when slimming Advanced mode.
  Evidence: `src/features/advanced/SetupPanel.jsx` renders highlight cards + "Executive create hub" messaging.

## Decision Log
- Decision: Use BaseHome as the canonical structure, augmenting it instead of re-building from scratch.
  Rationale: Aligns with requirement "Punto di partenza UI: interfaccia Base mode B"; ensures minimal regression risk.
  Date/Author: 2025-02-14 / gpt-5-codex
- Decision: Introduce reusable card primitives in Base scope rather than cross-mode shared components for now.
  Rationale: Keeps Task 1 lightweight; future extraction possible after confirming layouts.
  Date/Author: 2025-02-14 / gpt-5-codex
- Decision: Riutilizzare le superfici traslucide e le pill button del Base mode B dentro InputManager, mantenendo varianti Boardroom tramite surfaces dedicate anziché dipendere da theme legacy.
  Rationale: Consente uno switch visivo morbido tra Base e Advanced senza duplicare tokens Tailwind eterogenei.
  Date/Author: 2025-02-15 / gpt-5-codex

## Outcomes & Retrospective
- Milestone 2: Base mode now surfaces workspace, project, prompt, and session cards summarizing key context while keeping pipeline below the fold. Upload controls are unified into audio/Markdown/TXT buttons backed by a shared dropzone with validation.
- Milestone 3: Recording CTA refactored into a single toggle button with Mic/Stop iconography, ARIA state, and disabled handling to eliminate duplicated “Rec/Registra” controls.

## Context and Orientation
- Framework: React 18 + Vite + Tailwind (see `src/main.jsx`, `src/index.css`).
- Routing: `src/App.jsx` orchestrates routes `/create`, `/library`, `/editor` and handles uploads (`handleMarkdownFilePicked`, `handleTextFilePicked`).
- Mode switching: `src/context/ModeContext.jsx` toggles base/advanced, with keyboard shortcuts (b/a).
- Base mode UI: `src/features/base/BaseHome.jsx`, `UploadCard.jsx`, `PipelinePanel.jsx`.
- Advanced mode UI: `src/pages/Create.jsx` (AdvancedCreatePage), `src/features/advanced/SetupPanel.jsx`, `InputManager.jsx`, `PipelineOverview.jsx`.
- Library: `src/pages/Library.jsx` plus `components/WorkspaceNavigator.jsx`.

## Plan of Work
1. **Milestone 1**: Annotate current components with TODO markers for Base/Advanced adjustments. Capture responsibilities: where to add cards, unify upload controls, remove duplicate CTA. No functional changes.
2. **Milestone 2**: Implement Base header cards + session status aggregator, using workspace/prompt helpers from `App.jsx` or context.
3. **Milestone 3**: Replace dual record/stop controls with toggle button; integrate .md/.txt uploads + dropzone on Base.
4. **Milestone 4**: Strip Advanced view to parameter controls only; gate pipeline/panels by mode; surface link from Base to Advanced Library.
5. **Milestone 5**: Add feature flag for Advanced slim UI fallback, update docs, capture screenshots, run unit + E2E tests.

## Concrete Steps
- `pnpm install` (if needed) → `pnpm test:unit` + `pnpm test:e2e` for regression.
- `pnpm dev` for manual QA on `/create` (base/advanced) and `/library`.
- Capture before/after via Playwright screenshot helper or manual instrumentation.

## Validation and Acceptance
- Hierarchy: Base view surfaces single primary CTA (record toggle) with supporting actions secondary.
- Typography: card titles `text-sm`, meta `text-xs`, maintain existing Tailwind scale.
- Spacing: maintain 8px multiples via `gap-4`, `p-4`, `p-6` classes.
- Color/Contrast: reuse existing theme tokens (emerald/sky) to satisfy WCAG AA backgrounds vs text.
- Navigation: ModeContext ensures `b`/`a` shortcuts; CTA for Library uses router navigation + mode toggle.
- Performance: Ensure no blocking queries introduced; advanced removals should reduce DOM weight.

## Idempotence and Recovery
- Introduce `ENABLE_SLIM_ADVANCED_UI` flag in Mode context to allow quick revert.
- Keep Base pipeline components untouched for fallback; guard new UI behind conditional checks referencing the flag.

## Artifacts and Notes
- TODO markers in Base/Advanced components referencing tasks.
- Future commits will include screenshot artifacts stored under `docs/assets/` or similar.

## Interfaces and Dependencies
- Reuse context methods: `handleMarkdownFilePicked`, `handleTextFilePicked`, `processTextUpload` (via App context).
- Potentially leverage existing `Button`, `Card` primitives in `src/components/ui` if available.
