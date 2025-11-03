import { fireEvent, render, screen } from "@testing-library/react";
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
  activeWorkspaceProfiles: [],
  activeWorkspaceProfile: null,
  workspaceProfileSelection: {},
  workspaceProfileLocked: false,
  applyWorkspaceProfile: vi.fn(() => ({ ok: true })),
  clearWorkspaceProfile: vi.fn(),
  setErrorBanner: vi.fn(),
  setCustomPdfLogo: vi.fn(),
  customPdfLogo: null,
  fmtTime: vi.fn(() => "00:10"),
  elapsed: 10,
  recording: false,
  busy: false,
  mediaSupported: true,
  recorderSupported: true,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  secureOK: true,
  workspaceSelection: {
    workspaceId: "",
    projectId: "",
    projectName: "",
    status: "",
  },
  workspaces: [],
  workspaceProjects: [],
  handleSelectWorkspaceForPipeline: vi.fn(),
  activeWorkspace: {},
  projectCreationMode: false,
  projectDraft: "",
  projectStatusDraft: "",
  setProjectDraft: vi.fn(),
  setProjectStatusDraft: vi.fn(),
  handleCancelProjectDraft: vi.fn(),
  handleCreateProjectFromDraft: vi.fn(),
  handleSelectProjectForPipeline: vi.fn(),
  statusCreationMode: false,
  availableStatuses: [],
  statusDraft: "",
  setStatusDraft: vi.fn(),
  handleCreateStatusFromDraft: vi.fn(),
  handleSelectStatusForPipeline: vi.fn(),
  handleRefreshWorkspaces: vi.fn(),
  workspaceLoading: false,
  openSettingsDrawer: vi.fn(),
  destDir: "",
  setDestDir: vi.fn(),
  DEFAULT_DEST_DIR: "/Users/",
  destIsPlaceholder: false,
  showDestDetails: false,
  setShowDestDetails: vi.fn(),
  slug: "",
  setSlug: vi.fn(),
  mime: "audio/mp3",
  fmtBytes: vi.fn(() => "1 MB"),
  audioBlob: null,
  audioUrl: "",
  processViaBackend: vi.fn(),
  resetAll: vi.fn(),
  onPickFile: vi.fn(),
  handleMarkdownFilePicked: vi.fn(),
  handleTextFilePicked: vi.fn(),
  fileInputRef: { current: { click: vi.fn() } },
  markdownInputRef: { current: { click: vi.fn() } },
  textInputRef: { current: { click: vi.fn() } },
  prompts: [],
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
  pdfTemplates: [],
  pdfTemplatesLoading: false,
  pdfTemplatesError: '',
  pdfTemplateSelection: { fileName: '', type: '', css: '' },
  handleSelectPdfTemplate: vi.fn(),
  clearPdfTemplateSelection: vi.fn(),
  refreshPdfTemplates: vi.fn(),
  pipelineComplete: false,
  resetInputSelections: vi.fn(),
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
        boardroomInfoSurface="info"
      />
    </MemoryRouter>
  );

describe("InputManager", () => {
  it("omits manual upload and pipeline triggers", () => {
    renderInputManager();

    expect(
      screen.queryByRole("button", { name: /avvia pipeline/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /carica audio/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /carica markdown/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /carica txt/i })
    ).not.toBeInTheDocument();
  });

  it("shows completion call-to-action when pipeline is complete", () => {
    renderInputManager({ pipelineComplete: true });
    expect(screen.getByText(/pipeline completata/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vai alla library/i })).toBeInTheDocument();
  });

  it("does not show clip playback or reset controls", () => {
    renderInputManager();

    expect(screen.queryByText(/clip caricata/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nessuna clip disponibile/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /scarica audio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nuova sessione/i })).not.toBeInTheDocument();
  });

  it("rende disponibile la selezione template quando il profilo non è bloccato", () => {
    renderInputManager({
      pdfTemplates: [
        { fileName: "default.tex", name: "1_Default.tex", type: "tex" },
        { fileName: "semplice", name: "2_semplice", type: "pandoc" },
      ],
    });

    expect(screen.getByLabelText(/Seleziona template PDF/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /1_Default\.tex/i })).toBeInTheDocument();
  });

  it("mostra il riepilogo del template quando il profilo è bloccato", () => {
    renderInputManager({
      workspaceProfileLocked: true,
      activeWorkspaceProfile: {
        id: "profile-1",
        label: "Profilo demo",
        pdfTemplate: "verbale_meeting",
        pdfTemplateType: "html",
        pdfTemplateCss: "verbale_meeting.css",
      },
    });

    expect(screen.queryByLabelText(/Seleziona template PDF/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Template profilo/i)).toBeInTheDocument();
    expect(screen.getByText(/verbale_meeting$/i)).toBeInTheDocument();
  });

  it("permette di azzerare le selezioni manuali", () => {
    const resetInputSelections = vi.fn();
    renderInputManager({ resetInputSelections });

    fireEvent.click(
      screen.getByRole("button", { name: /azzera selezioni/i })
    );

    expect(resetInputSelections).toHaveBeenCalledTimes(1);
  });
});
