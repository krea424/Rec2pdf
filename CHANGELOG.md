# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Consulting-grade UI standards captured in `docs/UI.md`, covering layout grid, typography, accessibility, and keyboard patterns for the revamped interface.

### Changed
- Frontend navigation now uses the `NavigatorRail` shell with consolidated workspace/prompt context in the global header.
- Primary call-to-action components have been renamed to `ActionButton` and wired into the shared shell alongside refreshed toast, error, and offline patterns.

### Migration
- Replace imports of `PrimaryCTAButton` (and related props `variant`, `isUppercase`) with `ActionButton` using the new props `{ tone, size, icon }`. Default to `tone="brand"` and `size="md"` to preserve styling.
- Update navigation layouts to mount `NavigatorRail` within `AppFrame`. Legacy tab containers should move child routes into the rail panels or the new command palette shortcuts.
- Ensure feature branches reference the UI contract in `docs/UI.md` and validate keyboard shortcuts plus accessibility expectations before deployment.
