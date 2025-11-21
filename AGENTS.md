# Rec2PDF — AGENT ORIENTATION

This handbook captures the current state of the repo for autonomous contributors. Pair it with `README.md`, `docs/`, and release notes whenever you scope new work.

## 1. Mission & Architecture
- **Goal**: Transform raw recordings (audio or uploaded Markdown) into structured Markdown plus branded PDFs, optionally syncing assets to Supabase buckets.
- **Architecture**: Node.js/Express backend drives the audio → transcript → Markdown → PDF workflow and persists metadata; React 18 + Vite frontend orchestrates user onboarding, workspace selection, diagnostics, and job progress tracking.
- **Async Job Queue (v13)**: Uploading audio/text now creates a record in Supabase table `jobs`; Supabase webhooks hit `/api/worker/trigger` (guarded by `WORKER_SECRET`) to start `runPipeline`. The worker updates job state and output paths; the frontend polls `/api/jobs/:id`.
- **External Services**: Supabase (auth, storage, RLS policies), WhisperX CLI with fallback to Whisper CLI, `ffmpeg`, `pandoc` + LaTeX toolchain (xelatex), optional HTML engines (`wkhtmltopdf` or `weasyprint`), Google Gemini + OpenAI through `aiProviders`, optional Hugging Face embeddings.
- **Local State**: Backend caches JSON (`workspaces.json`, `prompts.json`), logos, and templates under `~/.rec2pdf/`; templates/logos synced with Supabase buckets when configured.

## 2. Repository Layout
- `rec2pdf-backend/`: Express server (`server.js` ~9k LOC), domain services (`services/*.js`), knowledge ingestion script (`scripts/ingest.js`), Jest specs under `__tests__/`, Supabase migrations & SQL helpers in `supabase/`, and evaluation utilities under `tests/`.
- `rec2pdf-frontend/`: React+Vite SPA (`src/App.jsx`, `src/main.jsx`), contexts, hooks, UI components, Tailwind config, Vitest suites in `src/**/__tests__`, and Playwright E2E specs inside `tests/e2e/`.
- `Scripts/`: Operational shell utilities; `publish.sh` is the canonical Markdown→PDF converter shared by backend + docs.
- `Templates/`: LaTeX defaults (`default.tex`, `header_footer.tex`, `cover.tex`) plus HTML variants and related assets.
- `docs/`: Product, UX, and operational references (accessibility checklist, advanced guide, release notes, Supabase RLS matrix, deployment runbooks, user journeys, prompt analysis, etc.).
- `assets/`: Logos and branding artifacts mirrored by frontend assets and PDF templates.
- `knowledge_sources/`: Workspace/project-specific `.md/.txt` corpora for ingestion into the `knowledge_chunks` table.
- `Dockerfile`, `docker-compose.yml`: Local container entrypoints; backend dev server exposed on port 8080.
- Misc helpers: `backups/`, `project_structure.txt`, `downloaded-logs-*.json`, diagrams, and transcripts for audits.

## 3. Backend Essentials (`rec2pdf-backend/server.js`)
### Bootstrapping & Services
- Loads `.env` via `dotenv` (including `.env.local`) and resolves repo paths for scripts/templates/assets.
- Creates Supabase client when `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` exist; falls back to a local-dev mode without auth.
- Initializes service layer: `RAGService` (knowledge search via `match_knowledge_chunks`), `PromptService`, AI orchestrator (`services/aiOrchestrator.js`) that negotiates text + embedding providers defined in `services/aiProviders.js`, and defensive utils (`services/utils.js`).
- Constants expose Supabase buckets (`audio-uploads`, `text-uploads`, `processed-media`, `logos`), job table name (`jobs`), and local filesystem roots.
- Environment Routing: The pipeline supports Dev/Prod isolation.
Frontend: Injects environment ('development' | 'production') into the request.
Database: jobs table has an environment column.
Routing: Supabase SQL Triggers (pg_net) route the job to Ngrok (Dev) or Cloud Run (Prod) based on this column.


### Security & Middleware
- Applies strict CORS allowlist (localhost ports + production origins), JSON + urlencoded parsers, and multipart upload handling via `multer`.
- `authenticateRequest` checks `Authorization: Bearer <token>` header or `token/access_token` query params; in non-Supabase mode it injects a `local-dev` user for faster testing.
- `ensureProfileForUser` syncs Supabase `profiles` table on each authenticated request.

### Async Pipeline Flow
- `/api/worker/trigger`: Called by Supabase webhook on `jobs` inserts; verifies `x-worker-secret` using `WORKER_SECRET` and spawns `runPipeline`.
- `runPipeline(jobRecord)` loads referenced audio/markdown/logo from Supabase Storage, normalizes audio via `ffmpeg`, transcribes with WhisperX (speaker diarization) and falls back to Whisper CLI when needed, enriches transcripts with RAG context (`knowledge_chunks`) and configured prompts, generates Markdown via `aiOrchestrator`, then renders PDF using `Scripts/publish.sh` (LaTeX default, HTML fallback, custom logos/templates). Outputs uploaded back to `processed-media` and job status rows updated.
- Stage logging feeds `stageEvents` consumed by the frontend progress UI; errors propagate to `worker_log` and job status `failed`.

### Traditional REST Endpoints
- `/api/rec2pdf`, `/api/ppubr`, `/api/ppubr-upload`: Legacy synchronous flows still available for direct audio → PDF or Markdown → PDF conversions (useful in local/dev scenarios). Accept `audio`, `markdown`, `pdfLogo` fields.
- `/api/transcribe-only`: Runs the transcription stack without publishing.
- `/api/markdown`, `/api/storage`, `/api/file`: CRUD helpers for Markdown artifacts and file downloads.
- `/api/pre-analyze`: Runs lightweight AI analysis on uploaded snippets before full pipeline execution.
- `/api/jobs/:id`: Authenticated polling endpoint exposing job status + output paths (frontend uses `useJobPolling`).

### Workspace, Prompt & Knowledge Management
- `/api/workspaces`: CRUD operations backed by JSON persisted under `~/.rec2pdf/workspaces.json` (with Supabase sync when available). Supports metadata, default status lists, and Supabase assignment fields.
- `/api/workspaces/:workspaceId/knowledge`: Lists uploaded `.md/.txt`, accepts uploads, deletes files; data stored under `knowledge_sources/<workspaceId>/...` for ingestion.
- `/api/workspaces/:workspaceId/profiles`: Router managing workspace profiles + branded logos; accepts `multipart/form-data`, validates extensions (`png/jpg/jpeg/svg/pdf`), stores locally + Supabase `logos` bucket, exposes `/logo` download endpoints.
- `/api/prompts`: CRUD for Markdown prompt templates (persisted locally + Supabase). `PromptService` caches descriptors referenced throughout the pipeline and ingest script.

### Diagnostics & Utilities
- `/api/diag`: Verifies CLI dependencies (`ffmpeg`, `whisperx`, `pandoc`, HTML engines) and Supabase connectivity, returning human-readable logs for the Settings panel.
- `/api/ai/providers`: Exposes the provider map so the UI can list Gemini/OpenAI/HuggingFace options.
- `/api/rag/baseline` & `/api/rag/debug`: Developer aids for evaluating RAG quality.
- Local temp files tracked + cleaned via `registerTempFile`/`registerTempDir` to avoid leaking artifacts.

### Knowledge Ingestion (`scripts/ingest.js`)
- Run with `npm run ingest -- --workspaceId=<id> [--projectId=<slug|uuid>] [--embeddingProvider=gpt-4o-mini-embed|...]`.
- Scans `knowledge_sources/<workspaceId>/[projectId]/` for `.md/.txt`, parses YAML front matter, chunks content at 250 tokens with 50 overlap, generates embeddings via provider resolved in `aiProviders`, and bulk inserts into Supabase `knowledge_chunks` (requires migrations `20240506_add_workspace_id_to_knowledge_chunks.sql` & `20240703_create_match_knowledge_chunks_function.sql`).
- Requires `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and provider API keys (`OPENAI_API_KEY`, `GOOGLE_API_KEY`, etc.).

### Tests
- `npm test`: Jest + Supertest suites (`__tests__/*.test.js`) covering templates, pipeline mocks, workspace CRUD, etc.
- `npm run test:rag-eval`: Custom evaluation harness under `tests/rag_evaluation/` for scoring retrieval quality.

## 4. Frontend Essentials (`rec2pdf-frontend/`)
- **Stack**: React 18, Vite 5, TailwindCSS, React Router v7, lucide-react icons, Supabase JS client.
- **Entrypoints**: `src/main.jsx` bootstraps `App`; `src/App.jsx` wires routing (`/login`, `/create`, `/library`, `/editor`), contexts, and layout shell.
- **State & Context**: `context/ModeContext.tsx` toggles Base vs Advanced UI per Supabase metadata; `AnalyticsContext.tsx` surfaces observability events; `PromptsContext.jsx` caches prompt catalogs.
- **Hooks**: `useBackendDiagnostics` polls `/api/diag` for banners, `useJobPolling` tracks `jobs` status, `useMicrophoneAccess` handles recording permissions, `useAppContext` centralizes API base paths + auth state.
- **Components**: `components/layout/AppShell.jsx` + `SettingsDrawer.jsx` render chrome, diagnostics, and workspace defaults; `WorkspaceNavigator.jsx`, `LibraryPanel.jsx`, `CloudLibraryPanel.jsx` manage asset browsing; `MarkdownEditorModal.jsx` enables inline edits + republish actions; `SetupAssistant`, `CommandPalette`, `SpeakerMapper`, and `PermissionBanner` support onboarding flows.
- **Features**: Modules under `features/base/`, `features/advanced/`, and `features/settings/` orchestrate dashboards, Base-mode wizard, Advanced analytics, and Supabase-linked defaults.
- **Tests**: `npm run test:unit` executes Vitest + Testing Library suites inside `src/**/__tests__/`; `npm run test:e2e` runs Playwright specs in `tests/e2e/` (with Axe accessibility assertions). `npm run test:ui` launches the Vitest UI watcher.
- **Build/Dev**: `npm run dev` (Vite on :5173), `npm run build` outputs `dist/`, `npm run preview` serves build artifacts.
- **Env**: `.env.local` (never committed) must include `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REC2PDF_API_BASE`, optional `VITE_DEFAULT_MODE`, brand defaults, and feature flags.

## 5. Publishing Pipeline (`Scripts/` & `Templates/`)
- `Scripts/publish.sh` is the shared Markdown→PDF executor:
  - Validates Pandoc, resolves repo roots, cleans temp files.
  - Selects templates via env (`WORKSPACE_PROFILE_TEMPLATE`, `WORKSPACE_PROFILE_TEMPLATE_CSS`, `WORKSPACE_PROFILE_TEMPLATE_RESOURCE_PATH`), falling back to LaTeX default. HTML templates require an available engine; `PREFERRED_HTML_ENGINE` overrides detection, otherwise it picks `wkhtmltopdf`→`weasyprint`.
  - Auto-inlines CSS when provided, builds HTML resource paths, and injects header/footer/cover for LaTeX flows.
  - Accepts `CUSTOM_PDF_LOGO` override; otherwise uses `assets/thinkDOC.pdf`.
  - Writes PDFs alongside the Markdown source.
- `Templates/` holds LaTeX + HTML variants users can extend. Maintain Pandoc placeholders (`$body$`, `$logo$`, etc.) when editing; mirror assets next to HTML templates and update docs/tests accordingly.

## 6. Data, Docs & Assets
- **Doc set**: `docs/ADVANCED_GUIDE.md`, `docs/ACCESSIBILITY_CHECKLIST.md`, `docs/RELEASE_NOTES.md`, `docs/UI*.md`, `docs/project_profiles.md`, `docs/operations/*.md`, `docs/architecture/supabase_rls_access_matrix.md`, plus research PDFs (`analisi_mercato...`, etc.). Use these to keep UX and ops guidance synchronized with code changes.
- **Prompts & Profiles**: Sample prompt definitions live under `rec2pdf-backend/prompts/`; workspace template descriptors documented in `docs/project_profiles.md`.
- **Knowledge sources**: Provide `.md/.txt` corpora under `knowledge_sources/<workspace>/<project>` before running ingestion. Keep backups within `backups/` when cloning environments.
- **Assets**: `assets/` root contains brand logos (PDF/SVG) reused by frontend (`rec2pdf-frontend/src/assets/`) and PDF generation.

## 7. Environment & Secrets
- Backend `.env` should define at minimum: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `WORKER_SECRET`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, optional `HUGGING_FACE_TOKEN`, `PORT`, `HOST`, `PUBLISH_SCRIPT`, `TEMPLATES_DIR`, `ASSETS_DIR`, `LOCAL_STATE_DIR`, CLI overrides, and ngrok webhook URLs when developing locally.
- Supabase storage bucket names (`audio-uploads`, `text-uploads`, `processed-media`, `logos`) are hard-coded; adjust both backend constants and storage policies before renaming.
- Rotate any leaked secrets immediately; never commit live credentials. `.env.local` + Supabase keys stay out of version control.
- Local dev for async queue requires ngrok (expose backend on HTTPS), Supabase webhook configured for `jobs` INSERT events, and `WORKER_SECRET` shared between Supabase and backend.

## 8. Quality & Regression Guardrails
- Always run backend Jest suite and frontend unit tests before submitting patches. For pipeline changes, also trigger `npm run test:rag-eval` if retrieval logic is touched.
- Validate CLI dependencies via `/api/diag` (or Settings drawer) after modifying audio/transcription/publishing stacks.
- For end-to-end changes, spin up backend (`npm run dev` or Docker) + frontend (`npm run dev`), create a sample job, and confirm stage logs show `transcode → transcribe → prompt → publish` in Supabase `jobs` and local logs.
- UI updates must respect the accessibility checklist (`docs/ACCESSIBILITY_CHECKLIST.md`) and Playwright Axe assertions; update snapshots/specs if behavior changes.
- Update `README.md` “Novità”, `docs/RELEASE_NOTES.md`, and `CHANGELOG.md` when shipping notable features or env requirements.
- Keep Supabase migrations (`rec2pdf-backend/supabase/migrations/*.sql`) consistent with server expectations; run `supabase db push` after editing schema or policies.

## 9. Additional References
- `docs/ADVANCED_GUIDE.md`: Deep dive into advanced dashboards/workflows.
- `docs/PROMPT_SYSTEM_ANALYSIS.md`: Prompt strategy rationale.
- `docs/UI.md` & `docs/UI_AUDIT.md`: Visual + audit guidelines.
- `Manuale utente – Workspace Navigator mul.md`: End-user walkthrough for the asset library UI.
- `docs/operations/deploy_backend_container.md`: Container deployment notes.
- `docs/operations/migrations.md`: Supabase migration process.

## 10. Agent Playbook
- **Before coding**: Check `/api/diag`, verify CLI tooling (ffmpeg, whisperx, pandoc) and Supabase connectivity. Ensure `jobs` webhook/`WORKER_SECRET` are configured when touching async flows.
- **Implementation**: Follow existing logging schema (`stage`, `status`) so frontend polling stays consistent. Use helpers in `services/utils.js` for temp file management and path resolution.
- **API extensions**: Document new endpoints in `README.md`, update frontend API clients (`rec2pdf-frontend/src/api/`), contexts/hooks, and Playwright mocks/tests if payloads change. Consider Supabase schema updates + migrations.
- **Template or publish changes**: Update `Scripts/publish.sh`, `Templates/`, backend template resolution logic, and Jest tests (e.g., `__tests__/templates.test.js`). Reflect new branding options in docs.
- **Deployment**: Frontend targets Vercel (`vercel.json`), backend expects containerized deployment (see `rec2pdf-backend/Dockerfile`); keep env var lists synchronized across Docker, ngrok setups, and Supabase project settings.

Keep `AGENTS.md` aligned with architectural or operational changes; this is the quick-start reference for future automation agents.
