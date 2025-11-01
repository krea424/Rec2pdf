import { render, screen, within } from "@testing-library/react";
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
  activePrompt: {
    id: "prompt-1",
    title: "Prompt Strategia",
    summary: "Allinea gli output alla strategia.",
    cueCards: [{ key: "agenda" }, { key: "summary" }],
  },
  promptCompletedCues: ["agenda"],
  activeWorkspaceProfile: {
    id: "profile-1",
    label: "Profilo Strategia",
    slug: "strategia",
    destDir: "strategy",
    promptId: "prompt-2",
    pdfTemplate: "template-letter",
  },
  workspaceProfileSelection: {
    workspaceId: "ws-1",
    profileId: "profile-1",
  },
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
  it("renders workspace, project, prompt and profile summaries", () => {
    renderCards();

    expect(screen.getByText("Workspace Alpha")).toBeInTheDocument();
    expect(screen.getByText("Kickoff")).toBeInTheDocument();
    expect(screen.queryByText("Input sessione")).not.toBeInTheDocument();

    const promptCard = screen.getByText("Prompt guida").closest("article");
    expect(promptCard).not.toBeNull();
    const promptMatches = within(promptCard).getAllByText("Prompt Strategia");
    expect(promptMatches[0]).toBeInTheDocument();

    const profileCard = screen.getByText("Profilo").closest("article");
    expect(profileCard).not.toBeNull();
    expect(within(profileCard).getByText("Profilo Strategia")).toBeInTheDocument();
    expect(within(profileCard).queryByText("strategia")).not.toBeInTheDocument();
    expect(within(profileCard).queryByText("template-letter")).not.toBeInTheDocument();
  });

  it("does not render prompt selection controls", () => {
    renderCards();

    expect(screen.queryByRole("combobox", { name: /prompt/i })).not.toBeInTheDocument();
  });
});
