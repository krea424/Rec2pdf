import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BaseSummaryCards from "../BaseSummaryCards.jsx";
import { AppContext } from "../../../hooks/useAppContext.jsx";

const buildContextValue = (overrides = {}) => ({
  workspaceLoading: false,
  workspaceSelection: {
    workspaceId: "ws-1",
    projectId: "proj-1",
    projectName: "",
    status: "Bozza",
  },
  activeWorkspace: {
    name: "Workspace Alpha",
    client: "ACME Corp",
    status: "In lavorazione",
  },
  workspaceProjects: [{ id: "proj-1", name: "Kickoff" }],
  promptLoading: false,
  prompts: [
    { id: "prompt-1", title: "Prompt Strategia" },
    { id: "prompt-2", title: "Prompt Review" },
  ],
  promptState: { promptId: "prompt-1" },
  handleSelectPromptTemplate: vi.fn(),
  handleClearPromptSelection: vi.fn(),
  activePrompt: {
    id: "prompt-1",
    title: "Prompt Strategia",
    summary: "Allinea gli output alla strategia.",
    cueCards: [{ key: "agenda" }, { key: "summary" }],
  },
  promptCompletedCues: ["agenda"],
  recording: false,
  busy: false,
  elapsed: 42,
  fmtTime: (value) => `00:00:${String(value).padStart(2, "0")}`,
  audioBlob: { name: "memo.m4a", size: 1024, type: "audio/m4a" },
  fmtBytes: (bytes) => `${bytes} B`,
  mime: "audio/m4a",
  lastMarkdownUpload: { name: "note.md", size: 2048 },
  lastTextUpload: null,
  pipelineComplete: false,
  ...overrides,
});

const renderCards = (valueOverrides = {}) => {
  const value = buildContextValue(valueOverrides);
  return render(
    <AppContext.Provider value={value}>
      <BaseSummaryCards />
    </AppContext.Provider>,
  );
};

describe("BaseSummaryCards", () => {
  it("renders workspace, project, prompt and session summaries", () => {
    renderCards();

    expect(screen.getByText("Workspace Alpha")).toBeInTheDocument();
    expect(screen.getByText("Kickoff")).toBeInTheDocument();

    const promptCard = screen.getByText("Prompt guida").closest("article");
    expect(promptCard).not.toBeNull();
    const promptMatches = within(promptCard).getAllByText("Prompt Strategia");
    expect(promptMatches[0]).toBeInTheDocument();

    const sessionCard = screen.getByText("Input sessione").closest("article");
    expect(sessionCard).not.toBeNull();
    expect(within(sessionCard).getByText("Audio caricato")).toBeInTheDocument();
    expect(within(sessionCard).getAllByText(/memo\.m4a/i)[0]).toBeInTheDocument();
    expect(within(sessionCard).getAllByText(/note\.md/i)[0]).toBeInTheDocument();
  });

  it("allows switching and clearing the active prompt", async () => {
    const user = userEvent.setup();
    const handlers = {
      handleSelectPromptTemplate: vi.fn(),
      handleClearPromptSelection: vi.fn(),
    };

    renderCards(handlers);

    const select = screen.getByLabelText(/Seleziona/i);
    expect(select).toHaveValue("prompt-1");

    await user.selectOptions(select, "prompt-2");
    expect(handlers.handleSelectPromptTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "prompt-2" }),
    );

    await user.selectOptions(select, "");
    expect(handlers.handleClearPromptSelection).toHaveBeenCalled();
  });
});
