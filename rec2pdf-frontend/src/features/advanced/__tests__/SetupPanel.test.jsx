import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SetupPanel from "../SetupPanel";

const makeThemes = () => ({
  default: {
    card: "card",
  },
});

const heroSteps = [
  { key: "setup", label: "Setup", description: "Descrizione" },
  { key: "record", label: "Record", description: "Rec" },
  { key: "deliver", label: "Deliver", description: "PDF" },
];

const highlightCards = [
  { key: "workspace", label: "Workspace", value: "Acme", meta: "Meta", icon: () => <span>W</span> },
];

describe("SetupPanel", () => {
  it("renders pipeline summary and disables start button when prerequisites missing", () => {
    render(
      <SetupPanel
        isBoardroom={false}
        theme="default"
        themes={makeThemes()}
        heroSteps={heroSteps}
        highlightCards={highlightCards}
        stageLabel="In attesa"
        stageDescription="Descrizione stage"
        statusBadgeLabel="Idle"
        stageStyleBadge="badge"
        progressPercent={42}
        highlightSurface="highlight"
        mutedTextClass="muted"
        heroTitleClass="title"
        heroSubtitleClass="subtitle"
        labelToneClass="label"
        boardroomPrimarySurface="primary"
        onStartPipeline={vi.fn()}
        canStartPipeline={false}
        HeaderIcon={() => <span data-testid="header-icon">H</span>}
      />
    );

    expect(screen.getByText("42%")).toBeInTheDocument();
    const startButton = screen.getByRole("button", { name: /pipeline executive/i });
    expect(startButton).toBeDisabled();
    expect(
      screen.getByText(/registra o carica un audio per attivare l'esecuzione/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByTestId("header-icon")).toBeInTheDocument();
  });

  it("calls callbacks when actions are triggered", async () => {
    const user = userEvent.setup();
    const onStartPipeline = vi.fn();

    render(
      <SetupPanel
        isBoardroom={false}
        theme="default"
        themes={makeThemes()}
        heroSteps={heroSteps}
        highlightCards={highlightCards}
        stageLabel="Pronto"
        stageDescription="Descrizione"
        statusBadgeLabel="Running"
        stageStyleBadge="badge"
        progressPercent={100}
        highlightSurface="highlight"
        mutedTextClass="muted"
        heroTitleClass="title"
        heroSubtitleClass="subtitle"
        labelToneClass="label"
        boardroomPrimarySurface="primary"
        onStartPipeline={onStartPipeline}
        canStartPipeline
        HeaderIcon={() => <span />}
      />
    );

    await user.click(screen.getByRole("button", { name: /pipeline executive/i }));
    expect(onStartPipeline).toHaveBeenCalled();
  });
});
