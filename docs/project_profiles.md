# Project Profile Presets

## Overview
Project profiles group together the repeatable setup an engagement lead needs when launching a new pipeline run. Applying a profile should configure the workspace form in a single interaction, eliminating repeated manual inputs.

## Target Capabilities
- **Single selection**: Picking a profile fills destination folder, slug, prompt/template, and PDF branding assets in the Create form.
- **Workspace scoped**: Profiles live under a workspace so each client or initiative can own bespoke presets.
- **Editable presets**: Users can create, update, and remove profiles without leaving the app shell, using the existing workspace management surfaces.

## Data Model Extensions
Extend workspace records with a `profiles` array. Each profile keeps only project-specific assets; the global web/app logo is intentionally excluded because it is shared across the entire product.

```jsonc
{
  "id": "workspace-123",
  "name": "Enterprise Delivery",
  "profiles": [
    {
      "id": "profile-001",
      "label": "Quarterly Strategy Deck",
      "destDir": "/Volumes/Shared/Strategy/Q1",
      "promptId": "prompt-quarterly",
      "pdfTemplate": "strategy-template.docx",
      "pdfLogoPath": "logos/workspace-123/profile-001/pdf-logo.png"
    }
  ]
}
```

### Field Notes
- `destDir`: Absolute or workspace-relative path the pipeline writes to; validate existence before saving.
- `promptId`: References an entry from the prompt library; ensure the prompt is accessible to the current workspace.
- `pdfTemplate`: Identifier for the document template that the backend can load when rendering PDFs.
- `pdfLogoPath`: Stored under `DATA_DIR/logos/<workspaceId>/<profileId>/` and surfaced to the frontend when applying the profile.

## API Requirements
1. **Workspace payloads**: Update create/update endpoints to accept profile data alongside base workspace fields.
2. **Profile CRUD**: Introduce `/api/workspaces/:workspaceId/profiles` routes for creating, editing, deleting profiles and uploading PDF logos via multipart forms.
3. **Asset download**: Provide a signed or direct download route to fetch the stored PDF logo when a profile is applied.

## Frontend Integration
- **State**: Load profiles into the app context and add an `applyWorkspaceProfile(profileId)` helper to hydrate `destDir`, `slug`, prompt state, and PDF logo.
- **Create form**: Insert a “Profilo preconfigurato” select above destination/logo inputs. Selecting a profile pre-populates and locks the relevant fields until the user opts to unlink.
- **Profile authoring**: Extend `WorkspaceNavigator` or `SettingsDrawer` with dialogs to create or edit profiles, including file pickers for PDF logos and validation messaging.

## UX Considerations
- Show a visual cue (chip or badge) when a profile is active so users know fields are preset.
- Allow manual overrides with a “Scollega profilo” action, reverting the form to standalone mode.
- Log profile usage (telemetry) to quantify the reduction in setup time per pipeline run.

