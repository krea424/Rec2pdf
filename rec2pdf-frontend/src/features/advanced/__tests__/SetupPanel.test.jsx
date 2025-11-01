import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import SetupPanel from "../SetupPanel";

const makeThemes = () => ({
  default: {
    card: "card",
  },
});

describe("SetupPanel", () => {
  it("renders summary items and triggers library navigation", async () => {
    const user = userEvent.setup();
    const onOpenLibrary = vi.fn();

    render(
      <SetupPanel
        isBoardroom={false}
        theme="default"
        themes={makeThemes()}
        boardroomPrimarySurface="primary"
        labelToneClass="label"
        heroTitleClass="title"
        heroSubtitleClass="subtitle"
        summaryItems={[
          {
            key: "workspace",
            label: "Workspace",
            value: "Acme",
            meta: "Cliente · Contoso",
          },
          {
            key: "project",
            label: "Progetto",
            value: "OKR",
            meta: "Stato · Draft",
          },
        ]}
        onOpenLibrary={onOpenLibrary}
      />
    );

    expect(screen.getByText(/configura parametri/i)).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("OKR")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /library avanzata/i }));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it("omits the CTA when no handler is provided", () => {
    render(
      <SetupPanel
        isBoardroom
        theme="default"
        themes={makeThemes()}
        boardroomPrimarySurface="primary"
        labelToneClass="label"
        heroTitleClass="title"
        heroSubtitleClass="subtitle"
        summaryItems={[]}
      />
    );

    expect(
      screen.queryByRole("button", { name: /library avanzata/i })
    ).not.toBeInTheDocument();
  });
});
