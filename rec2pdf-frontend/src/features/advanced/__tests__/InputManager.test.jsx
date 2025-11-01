import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import InputManager from "../InputManager";
import { MemoryRouter } from "react-router-dom";

const themes = {
  default: {
    card: "card",
    input: "input",
    input_hover: "input-hover",
    button: "button",
  },
};

const baseContext = {
  activeWorkspaceProfiles: [
    { id: "profile-1", label: "Profilo 1" },
    { id: "profile-2", label: "Profilo 2" },
  ],
  activeWorkspaceProfile: { id: "profile-1", label: "Profilo 1" },
  workspaceProfileSelection: { profileId: "profile-1" },
  workspaceProfileLocked: false,
  applyWorkspaceProfile: vi.fn(() => ({ ok: true })),
  clearWorkspaceProfile: vi.fn(),
  setErrorBanner: vi.fn(),
  setCustomPdfLogo: vi.fn(),
  customPdfLogo: null,
  workspaceSelection: {
    workspaceId: "workspace-1",
    projectId: "project-1",
    projectName: "Progetto A",
    status: "In progress",
  },
  workspaces: [
    { id: "workspace-1", name: "Workspace A", client: "Acme" },
  ],
  workspaceProjects: [
    { id: "project-1", name: "Discovery" },
  ],
  handleSelectWorkspaceForPipeline: vi.fn(),
  activeWorkspace: {
    versioningPolicy: {
      namingConvention: "slug",
      retentionLimit: 5,
    },
  },
  projectCreationMode: false,
  projectDraft: "",
  projectStatusDraft: "",
  setProjectDraft: vi.fn(),
  setProjectStatusDraft: vi.fn(),
  handleCancelProjectDraft: vi.fn(),
  handleCreateProjectFromDraft: vi.fn(),
  handleSelectProjectForPipeline: vi.fn(),
  statusCreationMode: false,
  availableStatuses: ["In progress", "Done"],
  statusDraft: "",
  setStatusDraft: vi.fn(),
  handleCreateStatusFromDraft: vi.fn(),
  handleSelectStatusForPipeline: vi.fn(),
  handleRefreshWorkspaces: vi.fn(),
  workspaceLoading: false,
  openSettingsDrawer: vi.fn(),
  destDir: "/tmp",
  setDestDir: vi.fn(),
  DEFAULT_DEST_DIR: "/Users/",
  destIsPlaceholder: false,
  showDestDetails: false,
  setShowDestDetails: vi.fn(),
  slug: "sessione",
  setSlug: vi.fn(),
  prompts: [
    {
      id: "prompt-1",
      title: "All hands",
      persona: "Advisor",
    },
  ],
  promptLoading: false,
  promptState: { focus: "", notes: "", cueProgress: {} },
  handleSelectPromptTemplate: vi.fn(),
  handleClearPromptSelection: vi.fn(),
  promptFavorites: [],
  handleTogglePromptFavorite: vi.fn(),
  handleRefreshPrompts: vi.fn(),
  activePrompt: null,
  handlePromptFocusChange: vi.fn(),
  handlePromptNotesChange: vi.fn(),
  handleTogglePromptCue: vi.fn(),
  handleCreatePrompt: vi.fn(),
  handleDeletePrompt: vi.fn(),
};

const renderInputManager = (override = {}) =>
  render(
    <MemoryRouter>
      <InputManager
        context={{ ...baseContext, ...override }}
        theme="default"
        themes={themes}
        isBoardroom={false}
        boardroomPrimarySurface="primary"
        boardroomSecondarySurface="secondary"
        boardroomChipSurface="chip"
      />
    </MemoryRouter>
  );

describe("InputManager", () => {
  it("exposes only parameter controls", () => {
    renderInputManager();

    expect(
      screen.getByRole("combobox", { name: /profilo preconfigurato/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /workspace/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /carica audio/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /rec/i })
    ).not.toBeInTheDocument();
  });

  it("clears the workspace profile when the empty option is selected", async () => {
    const user = userEvent.setup();
    const clearWorkspaceProfile = vi.fn();

    renderInputManager({ clearWorkspaceProfile });

    await user.selectOptions(
      screen.getByRole("combobox", { name: /profilo preconfigurato/i }),
      ""
    );

    expect(clearWorkspaceProfile).toHaveBeenCalled();
  });
});
