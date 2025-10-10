# Rec2PDF Interface Guidelines

These guidelines codify the consulting-grade UX overhaul of the Rec2PDF web application. They align brand storytelling with production-ready implementation details so designers and engineers can ship coherent experiences.

## Core Principles
- **Evidence-led simplicity**: Surface only the tasks a document producer needs in the current stage. Every screen must pass the "single-intent" test—if a component does not clarify the next action, it is removed or deferred to secondary navigation.
- **Narrative continuity**: Workspace, prompt, and publishing status appear in a shared header strip across the app. Users never lose the thread of where content is in the pipeline.
- **Resilient collaboration**: The UI must withstand intermittent connectivity and multi-device reviews. All components expose loading and offline states, and the layout remains usable on 1280px monitors or tablets.
- **Measurable accessibility**: Every new workflow is validated against WCAG 2.2 AA. Contrast ratios, focus handling, and keyboard flows are tracked in automated tests and manual QA.

## Layout Grid
- **Breakpoints**: 1280px base (desktop), 960px condense (laptop/tablet landscape), 768px stacked (tablet portrait), 480px compact (mobile fallback for diagnostics only).
- **Grid**: 12-column fluid grid with 24px gutters on desktop; collapse to 8 columns with 16px gutters below 960px; single-column stack below 768px.
- **Spacing scale**: 4px increments (`4, 8, 12, 16, 20, 24, 32, 40, 48, 64`). Components must snap to the scale to keep rhythm consistent between cards, drawers, and modals.
- **Containers**: Primary canvas constrained to `max-width: 1360px`, centered with 32px padding at ≥1280px and 20px padding below.

## Typography Scale
- **Font family**: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Scale**: `Display 32/40`, `Headline 24/32`, `Title 20/28`, `Body 16/24`, `Caption 14/20`, `Micro 12/16` (`font-size/line-height` in px).
- **Weight usage**: Display/Headline at 600, Title at 600/500 for emphasis, Body and below at 400. Never combine more than two weights on a single view.
- **Code/metadata**: Use `"JetBrains Mono", "Fira Code", monospace` for logs and pipeline IDs.

## Component Usage
- **Shell**: `AppFrame` orchestrates header, sidebar, and work area. Sidebar switches between Navigator, Library, and Diagnostics. Header hosts workspace selector, prompt badge, and publish status pill.
- **Navigation**: `NavigatorRail` replaces the legacy tab bar. Icons default to 24px line style with text labels appearing on hover or when the rail expands at 960px.
- **Primary actions**: Adopt the `ActionButton` component (formerly `PrimaryCTAButton`). It exposes props `{ tone: "brand" | "neutral" | "danger", size: "md" | "lg", icon }` and enforces uppercase labels only when tone is `brand`.
- **Forms**: Inputs use the `FieldStack` wrapper for label, helper text, validation, and optional inline progress. All fields must define `aria-describedby` to hook into FieldStack messaging.
- **Data visualization**: Pipeline status charts use the `StageTimeline` component with stepped progress dots and tooltips describing backend log references.

## State Patterns
- **Loading**: Prefer skeletons for surfaces larger than 240px height. Buttons show inline spinners with `aria-live="polite"` messages. Avoid global blocking loaders.
- **Success**: Provide toast confirmations via `useToaster` with 5s default lifetime. Toast copy should include the workspace name for audit context.
- **Error**: All components emit structured error objects `{ code, title, body, action }`. `ErrorBoundaryPanel` renders fallback UI, and components allow retry without forcing navigation resets.
- **Offline**: Use the `useConnectivityBanner` hook to pin a status bar at the top when Supabase or backend APIs are unreachable. Local drafts persist to IndexedDB until connectivity resumes.

## Keyboard Shortcuts
- `Ctrl/Cmd + K`: Open global command palette for workspace switching and prompt search.
- `Ctrl/Cmd + Shift + U`: Upload or record new audio. Disabled if the user lacks workspace selection.
- `Ctrl/Cmd + E`: Open the Markdown editor for the currently selected artifact.
- `?`: Display overlay with contextual help and shortcut reference.
- All shortcuts must be discoverable through the command palette and documented in the Help overlay.

## Accessibility Expectations
- Maintain minimum 4.5:1 contrast for text and 3:1 for large UI icons. Buttons in the brand tone must be tested against both light and dark backgrounds.
- Every interactive element requires a visible focus ring with 2px thickness and 4px corner radius. Do not rely solely on color changes for focus.
- Announce view changes with `aria-live="assertive"` messages when navigation occurs programmatically (e.g., auto-opening the Markdown editor after upload).
- Provide logical tab order: header → sidebar → main content → dialogs. Modals trap focus and restore it to the triggering element on close.
- Ensure screen reader labels include workspace, prompt, and artifact metadata so multi-document workflows remain distinguishable.

## Implementation Checklist
1. Scaffold screens using the grid constants above and verify responsiveness in Chrome DevTools for each breakpoint.
2. Compose views from `AppFrame`, `NavigatorRail`, `ActionButton`, `FieldStack`, and `StageTimeline`. Avoid bespoke wrappers unless they extend these primitives.
3. Wire state management through the established hooks (`useWorkspace`, `usePipelineRuns`, `useToaster`, `useConnectivityBanner`).
4. Register keyboard shortcuts in `useGlobalHotkeys` and write integration tests to confirm discoverability in the command palette.
5. Run the accessibility smoke suite (`npm run test:a11y`, forthcoming) and manual screen reader sweeps before merging.

Following these standards keeps the Rec2PDF interface cohesive as new pipeline capabilities ship.
