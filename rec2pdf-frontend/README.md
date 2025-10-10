# Rec2PDF UI (Vite + React + Tailwind)

## UI & UX Principles
Rec2PDF's refreshed interface is guided by a consulting-grade experience strategy that balances enterprise governance with fast editorial workflows. The approach focuses on:
- **Single-intent workspaces** that expose only the next actionable step in the audio → Markdown → PDF pipeline.
- **Narrative continuity** by surfacing workspace, prompt, and publishing context in the global shell.
- **Resilient collaboration** patterns with offline drafts, granular error handling, and auditable toasts.
- **WCAG 2.2 AA accessibility** as a non-negotiable quality gate for every release.

Refer to the [interface guidelines](../docs/UI.md) for the detailed layout grid, typography scale, component contracts (e.g., `NavigatorRail`, the renamed `ActionButton`), keyboard shortcuts, and accessibility checklist. Every feature branch should be reviewed against that document before code review.

## Requirements
- Node.js >= 18
- Backend available at `http://localhost:7788` (see `rec2pdf-backend` project)
- `.env.local` containing Supabase keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

## Local Development
```bash
npm install
npm run dev
# visit http://localhost:5173
```
In the header, configure the backend URL if it differs from the default. Use the **Diagnostica** panel to verify CLI/toolchain readiness.

## Build & Smoke Tests
```bash
npm run build       # compile the production bundle
npm run preview     # serve the static build at http://localhost:4173
# npm run test:a11y # forthcoming automated accessibility sweep aligned with the new UI contract
```
Run the preview build when validating layout grid adherence, responsive breakpoints, or keyboard shortcuts listed in the UI guidelines. Capture regressions and migration notes in the changelog entry for the release.
