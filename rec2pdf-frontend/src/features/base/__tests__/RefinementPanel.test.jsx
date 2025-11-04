import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RefinementPanel from "../RefinementPanel";
import { AppProvider } from "../../../hooks/useAppContext";

const buildContext = (overrides = {}) => ({
  refinedData: {
    transcription: "Prima riga\nSeconda riga",
  },
  activePrompt: {
    cueCards: [
      { key: "agenda", title: "Agenda", hint: "Definisci i punti principali" },
      { key: "summary", title: "Executive summary", hint: "Riassumi il risultato" },
    ],
  },
  promptState: { focus: "", notes: "", cueCardAnswers: {} },
  handlePromptFocusChange: vi.fn(),
  handlePromptNotesChange: vi.fn(),
  setPromptFocus: vi.fn(),
  setPromptNotes: vi.fn(),
  setCueCardAnswers: vi.fn(),
  processViaBackend: vi.fn(),
  closeRefinementPanel: vi.fn(),
  busy: false,
  audioBlob: {},
  backendUp: true,
  ...overrides,
});

const renderPanel = (overrides = {}) => {
  const context = buildContext(overrides);
  render(
    <AppProvider value={context}>
      <RefinementPanel />
    </AppProvider>
  );
  return context;
};

describe("RefinementPanel", () => {
  it("renders transcription and cue cards", () => {
    renderPanel();

    expect(screen.getByText(/Prima riga/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Agenda/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Executive summary/i)).toBeInTheDocument();
  });

  it("routes edits to focus, notes and cue cards", () => {
    const context = renderPanel();

    fireEvent.change(screen.getByLabelText(/Focus/i), { target: { value: "Nuovo focus" } });
    fireEvent.change(screen.getByLabelText(/Note personali/i), { target: { value: "Note aggiornate" } });
    fireEvent.change(screen.getByLabelText(/Agenda/i), { target: { value: "Dettagli agenda" } });

    expect(context.handlePromptFocusChange).toHaveBeenCalledWith("Nuovo focus");
    expect(context.handlePromptNotesChange).toHaveBeenCalledWith("Note aggiornate");
    expect(context.setCueCardAnswers).toHaveBeenCalled();
    const cueUpdater = context.setCueCardAnswers.mock.calls.at(-1)[0];
    expect(typeof cueUpdater).toBe("function");
    const updated = cueUpdater({});
    expect(updated).toMatchObject({ agenda: "Dettagli agenda" });
  });

  it("submits via container when all prerequisites are met", () => {
    const context = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Genera PDF/i }));

    expect(context.processViaBackend).toHaveBeenCalledTimes(1);
  });

  it("invokes close handler when the panel is dismissed", () => {
    const context = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /Chiudi/i }));

    expect(context.closeRefinementPanel).toHaveBeenCalledTimes(1);
  });

  it("disables submit when audio is missing", () => {
    const context = renderPanel({ audioBlob: null });
    const button = screen.getByRole("button", { name: /Genera PDF/i });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(context.processViaBackend).not.toHaveBeenCalled();
  });
});
