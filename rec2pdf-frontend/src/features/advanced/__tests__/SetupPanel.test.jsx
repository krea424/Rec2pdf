import { render, screen } from "@testing-library/react";
import SetupPanel from "../SetupPanel";

const makeThemes = () => ({
  default: {
    card: "card",
  },
});

describe("SetupPanel", () => {
  it("renders hero summary with status badge", () => {
    render(
      <SetupPanel
        isBoardroom={false}
        theme="default"
        themes={makeThemes()}
        heroSteps={[
          { key: "setup", label: "Setup", description: "Descrizione" },
          { key: "context", label: "Contesto", description: "Parametri" },
          { key: "deliver", label: "Deliver", description: "PDF" },
        ]}
        statusBadgeLabel="Pronto"
        stageStyleBadge="badge"
        highlightSurface="highlight"
        heroTitleClass="title"
        heroSubtitleClass="subtitle"
        labelToneClass="label"
        boardroomPrimarySurface="primary"
        HeaderIcon={() => <span data-testid="header-icon">H</span>}
      />
    );

    expect(screen.getByText(/Executive create hub/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Imposta il contesto, monitora la pipeline e lascia che l'ai generi un pdf executive con effetto wow./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    expect(screen.getByText("Contesto")).toBeInTheDocument();
    expect(screen.getByTestId("header-icon")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /pipeline executive/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Registra o carica un audio/i)).not.toBeInTheDocument();
  });
});
