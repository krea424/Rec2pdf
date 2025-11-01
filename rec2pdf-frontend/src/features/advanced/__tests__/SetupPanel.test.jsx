import { render, screen } from "@testing-library/react";
import SetupPanel from "../SetupPanel";

const makeThemes = () => ({
  default: {
    card: "card",
  },
});

describe("SetupPanel", () => {
  it("renders nothing while the hero panel is retired", () => {
    const { container } = render(
      <SetupPanel
        isBoardroom={false}
        theme="default"
        themes={makeThemes()}
        heroSteps={[]}
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

    expect(container.firstChild).toBeNull();
  });
});
