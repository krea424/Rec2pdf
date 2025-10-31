import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import PipelineOverview from "../PipelineOverview";
import { MemoryRouter } from "react-router-dom";

const themes = {
  default: {
    card: "card",
    input: "input",
    input_hover: "input-hover",
    log: "log",
  },
};

const stageIcon = () => <span data-testid="stage-icon" />;

const baseContext = {
  headerStatus: { text: "Pronto", className: "status" },
  setShowRawLogs: vi.fn(),
  showRawLogs: false,
  progressPercent: 75,
  completedStagesCount: 3,
  totalStages: 4,
  pipelineComplete: false,
  logs: [],
  PIPELINE_STAGES: [
    { key: "transcode", label: "Transcode", description: "Descrizione", icon: stageIcon },
  ],
  pipelineStatus: { transcode: "running" },
  activeStageKey: "transcode",
  failedStage: null,
  stageMessages: { transcode: "Processing" },
  STAGE_STATUS_STYLES: {
    idle: "idle",
    running: "running",
    done: "done",
    failed: "failed",
  },
  STAGE_STATUS_LABELS: {
    idle: "Idle",
    running: "Running",
    done: "Done",
    failed: "Failed",
  },
  logs: [],
};

const renderOverview = (override = {}) =>
  render(
    <MemoryRouter>
      <PipelineOverview
        context={{ ...baseContext, ...override }}
        theme="default"
        themes={themes}
        isBoardroom={false}
        boardroomPrimarySurface="primary"
        boardroomStageStyles={{ idle: "idle", running: "running", done: "done", failed: "failed" }}
        boardroomStageMessageSurface="message"
        boardroomConnectorColors={{ done: "done", failed: "failed", base: "base" }}
        HeaderIcon={() => <span data-testid="header-icon" />}
      />
    </MemoryRouter>
  );

describe("PipelineOverview", () => {
  it("renders pipeline stages and toggles raw log view", async () => {
    const user = userEvent.setup();
    const setShowRawLogs = vi.fn();
    renderOverview({ setShowRawLogs });

    expect(screen.getByText(/transcode/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /mostra log grezzi/i }));
    expect(setShowRawLogs).toHaveBeenCalledWith(expect.any(Function));
  });

  it("shows completion details when pipeline is done", () => {
    renderOverview({ pipelineComplete: true });
    expect(screen.getByText(/pipeline completata/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vai alla library/i })).toBeInTheDocument();
  });
});
