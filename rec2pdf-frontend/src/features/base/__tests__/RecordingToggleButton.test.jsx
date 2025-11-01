import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecordingToggleButton from "../RecordingToggleButton";

describe("RecordingToggleButton", () => {
  it("renders mic icon and registra label when idle", () => {
    render(<RecordingToggleButton onToggle={() => {}} recording={false} />);

    expect(screen.getByRole("button", { name: /registra/i })).toBeInTheDocument();
    expect(screen.getByText("Registra")).toBeInTheDocument();
  });

  it("renders stop icon and label when recording", () => {
    render(<RecordingToggleButton onToggle={() => {}} recording />);

    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(<RecordingToggleButton onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("disables interaction when disabled", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(<RecordingToggleButton onToggle={onToggle} disabled />);

    await user.click(screen.getByRole("button"));

    expect(onToggle).not.toHaveBeenCalled();
  });
});
