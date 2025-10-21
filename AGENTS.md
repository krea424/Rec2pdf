# Rec2PDF — AGENT ORIENTATION

This guide distills the repository essentials for autonomous contributors. Use it alongside `README.md` and documents in `docs/` when planning work.

## 1. System Overview
- **Goal**: Convert recorded speech into structured Markdown and branded PDF deliverables with optional Supabase-backed storage.
- **Architecture**: Node.js Express backend orchestrating audio → transcript → Markdown → PDF, React+Vite frontend managing workspaces, onboarding, diagnostics, and Supabase interactions.
- **Key External Services**: Supabase (auth, storage); OpenAI Whisper CLI; `ffmpeg`; `pandoc`/LaTeX toolchain; optional HTML→PDF engines (`wkhtmltopdf` or `weasyprint`).
- **Local State**: Backend persists configuration and cached assets under `~/.rec2pdf/` (workspaces, prompts, uploaded logos, template cache).

## 2. Repository Layout
- `rec2pdf-backend/`: Express server (`server.js`) + Jest tests in `__tests__/`.
- `rec2pdf-frontend/`: Vite React SPA. Entry in `src/App.jsx`; routing + contexts; component tests under `src/components/**/__tests__`; Playwright E2E specs in `tests/e2e/`.
- `Scripts/publish.sh`: Shell pipeline to render Markdown into PDF using templates under `Templates/`.
- `Templates/`: LaTeX defaults (`default.tex`, `header_footer.tex`, `cover.tex`) and HTML fallback assets.
- `docs/`: Product, UX, and operational references (accessibility checklist, advanced guide, release notes, etc.).
- `assets/`: Logos and branding artifacts used by both frontend and PDF generation.

## 3. Backend Essentials (`rec2pdf-backend/server.js`)
- **Startup**:
  - Loads env via `dotenv`.
  - Configures Supabase client when `SUPABASE_URL` & `SUPABASE_SERVICE_KEY` exist; otherwise runs in dev mode without auth.
  - Resolves repository-aware paths: publish script (`Scripts/publish.sh`), templates, frontend assets.
  - Applies CORS allowlist (localhost + production Vercel origins) and JSON body parsing.
- **Auth Middleware**:
  - `Authorization: Bearer <token>` header or `token`/`access_token` query parameter.
  - Falls back to `local-dev` user when Supabase is not configured.
- **Persistent Filesystem** (default `~/.rec2pdf`):
  - `workspaces.json`, `prompts.json`, profile logo cache, template cache.
- **Diagnostics**:
  - `/api/diag` inspects `ffmpeg`, Whisper, Pandoc availability and reports environment issues.
  - `/api/health` unauthenticated liveness check.
- **Pipeline Endpoints**:
  - `/api/rec2pdf`: Primary audio upload. Handles `multer` form fields (`audio`, optional `pdfLogo`), normalizes audio via `ffmpeg`, runs Whisper CLI, stitches Markdown, invokes publish script with fallback to Pandoc, uploads assets to Supabase storage, tracks progress logs.
  - `/api/ppubr` & `/api/ppubr-upload`: Publish/republish Markdown or Markdown uploads into PDF with optional logo overrides.
  - `/api/markdown`: GET/PUT to fetch or store Markdown artifacts, integrated with Supabase buckets.
- **Workspace & Prompt Management**:
  - CRUD endpoints under `/api/workspaces` and `/api/prompts`. Operate on JSON persisted locally; support template descriptors and default status lists.
- **Utilities**:
  - `run`/`zsh` wrappers for child processes.
  - Defensive temp-file registration/cleanup.
  - Extensive status logging per pipeline phase (`transcode`, `transcribe`, `prompt`, `publish`, etc.) consumed by frontend progress UI.

### Backend Dependencies & Tools
- Node.js ≥ 18, npm ≥ 9.
- CLI tools expected on PATH: `ffmpeg`, `whisper` (OpenAI CLI install), `pandoc`, `xelatex` (for LaTeX templates), `wkhtmltopdf` or `weasyprint` for HTML templates.
- Supabase service role key grants storage/admin operations; rotate secrets when sharing environments.
- Knowledge base ingestion: execute `npm run ingest -- --workspaceId=<id>` inside `rec2pdf-backend/` after populating `knowledge_sources/<id>/` with `.txt`/`.md` files. The script chunking (250 parole con overlap 50) invia embedding `text-embedding-3-small` verso la tabella `knowledge_chunks`; assicurati di applicare la migrazione SQL `rec2pdf-backend/supabase/migrations/20240506_add_workspace_id_to_knowledge_chunks.sql` per creare la colonna `workspace_id` e l'indice correlato.

### Running & Testing
```bash
cd rec2pdf-backend
npm install            # once per environment
npm run dev            # starts Express on :7788
npm test               # Jest API tests in __tests__/
```
Ensure `.env` defines Supabase + OpenAI keys; **never** reuse committed secrets in new deployments.

## 4. Frontend Essentials (`rec2pdf-frontend/`)
- **Framework**: React 18 with Vite, TailwindCSS, React Router (v7).
- **Entry Points**:
  - `src/main.jsx`: Bootstraps `App`.
  - `src/App.jsx`: Houses route tree, contexts, and orchestration for onboarding, workspace selection, markdown editor flows, and Supabase interactions.
- **State & Context**:
  - `context/ModeContext.tsx`: Determines Base vs Advanced mode flags (driven by Supabase user metadata).
  - `hooks/useBackendDiagnostics.js`: Polls backend `/api/diag` to feed health banners.
  - `supabaseClient.js`: Configures browser-side Supabase client using `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`.
- **Key Components**:
  - `components/layout/AppShell.jsx`: Layout chrome, onboarding banners, settings drawer toggle.
  - `components/layout/SettingsDrawer.jsx`: Surfaces diagnostics, branding upload, workspace defaults.
  - `components/WorkspaceNavigator.jsx`: Lists local/cloud assets with filters, actions (re-run pipeline, download PDF/Markdown, assign status).
  - `components/MarkdownEditorModal.jsx`: Inline Markdown editing and republish triggers.
  - `features/base/*`: Simpler pipeline UI for Base mode; advanced dashboards live under `features/advanced/`.
- **Routes**:
  - `/login`: `components/LoginPage.jsx`.
  - `/create`: Main pipeline UI.
  - `/library`: Cloud + local asset navigator.
  - `/editor`: Markdown editor view.

### Frontend Environment & Scripts
```bash
cd rec2pdf-frontend
npm install
npm run dev            # Vite dev server on :5173
npm run build          # Production build output in dist/
npm run test:unit      # Vitest unit suite (with Testing Library)
npm run test:e2e       # Playwright specs (mocked backend expectations)
npm run test:ui        # Vitest UI watcher
```
Environment variables reside in `.env.local` (not committed). Required keys mirror Supabase project (URL, anon key), plus optional brand defaults.

### Styling & Assets
- Tailwind configured in `tailwind.config.js`.
- Core CSS in `src/index.css`.
- Logos & themeable assets in `src/assets/` (mirrors repository-level `assets/` for PDF branding).

## 5. Publishing Pipeline (`Scripts/` & `Templates/`)
- `Scripts/publish.sh`: Canonical Markdown → PDF converter.
  - Validates Pandoc presence; loads LaTeX templates by default.
  - Supports HTML templates via `WORKSPACE_PROFILE_TEMPLATE[_CSS|_RESOURCE_PATH]` env vars; auto-selects HTML engine (`wkhtmltopdf`/`weasyprint`) or errors.
  - Cleans temp files on exit; writes output alongside input Markdown.
- `Templates/`: Modify or extend to brand PDFs. Maintain Pandoc placeholders (`$body$`, `$logo$`, etc.). HTML template variants can sit next to CSS/assets directories with matching names.
- Agents extending templates should update documentation in `docs/` and tests under `rec2pdf-backend/__tests__/` (e.g., `templates.test.js`) to avoid regressions.

## 6. Environment & Secrets Management
- Backend `.env` expects at minimum: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, optionally `PORT`, `HOST`, `PUBLISH_SCRIPT`, `TEMPLATES_DIR`, `ASSETS_DIR`.
- Frontend `.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REC2PDF_API_BASE` (pointing to backend), plus feature flags (e.g., `VITE_DEFAULT_MODE`).
- **Do not** commit live service keys. Rotate any exposed credentials and coordinate with project maintainers when cloning environments.
- Supabase storage buckets, paths, and policies are encoded in backend logic; update both backend constants and frontend selectors when adding new buckets.

## 7. Quality & Regression Guardrails
- Always run backend Jest suite and frontend unit tests before submitting changes.
- For pipeline adjustments, execute an end-to-end dry run:
  1. Start backend (`npm run dev`) and frontend (`npm run dev`).
  2. Upload a sample audio file; confirm progress logs for `transcode`, `transcribe`, `prompt`, `publish`.
  3. Verify generated Markdown and PDF appear in both local workspace and Supabase storage.
- Inspect `docs/ACCESSIBILITY_CHECKLIST.md` after UI updates; maintain ARIA labels and keyboard focus cues.
- Check `README.md` “Novità” and `docs/RELEASE_NOTES.md` for feature expectations; keep them in sync when shipping changes.

## 8. Additional References
- `docs/ADVANCED_GUIDE.md`: Deep dive into advanced mode workflows.
- `docs/project_profiles.md`: Workspace template descriptors.
- `docs/UI.md` & `docs/UI_AUDIT.md`: Visual guidelines.
- `Manuale utente – Workspace Navigator mul.md`: User-facing library walkthrough.
- `CHANGELOG.md`: Historical changes; update when introducing notable features.

## 9. Agent Playbook
- **Before coding**: confirm environment tooling (`ffmpeg`, Whisper, Pandoc) via `/api/diag` or running `npm run dev` + checking logs.
- **Implementations**: adhere to existing logging schema (phase, status) so frontend progress UI remains consistent.
- **API extensions**: Document new endpoints in `README.md`, extend Supabase client wrappers, and update Playwright mocks if payloads change.
- **Template changes**: Update backend template resolution tests and ensure `publish.sh` logic covers new formats.
- **Deployment**: Frontend targets Vercel (`vercel.json`), backend expects containerized deployment (see `rec2pdf-backend/Dockerfile`). Adjust infrastructure configs when altering ports or env requirements.

Keep this file updated whenever architecture, build tooling, or operational expectations change; it is the primary quickstart for future automation agents.

