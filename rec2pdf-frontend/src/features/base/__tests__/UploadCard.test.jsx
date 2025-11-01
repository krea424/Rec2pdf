import { fireEvent, render, screen } from "@testing-library/react";
import UploadCard from "../UploadCard.jsx";
import { AppContext } from "../../../hooks/useAppContext.jsx";

const buildContextValue = (overrides = {}) => ({
  recording: false,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  busy: false,
  fmtTime: (value) => `00:00:${String(value).padStart(2, "0")}`,
  elapsed: 0,
  level: 0.35,
  permission: "prompt",
  permissionMessage: "",
  mediaSupported: true,
  recorderSupported: true,
  fileInputRef: { current: null },
  onPickFile: vi.fn(),
  audioBlob: null,
  fmtBytes: (bytes) => `${bytes} B`,
  mime: "",
  markdownInputRef: { current: null },
  handleMarkdownFilePicked: vi.fn(),
  lastMarkdownUpload: null,
  textInputRef: { current: null },
  handleTextFilePicked: vi.fn().mockResolvedValue(undefined),
  lastTextUpload: null,
  setErrorBanner: vi.fn(),
  ...overrides,
});

const renderUploadCard = (contextOverrides = {}) => {
  const value = buildContextValue(contextOverrides);
  const utils = render(
    <AppContext.Provider value={value}>
      <UploadCard />
    </AppContext.Provider>,
  );
  return { ...utils, context: value };
};

const simulateDrop = (node, file) => {
  fireEvent.dragEnter(node, {
    dataTransfer: { items: [{ kind: "file" }], files: [file] },
  });
  fireEvent.drop(node, { dataTransfer: { files: [file] } });
};

describe("UploadCard", () => {
  it("renders upload controls for audio, markdown and text", () => {
    renderUploadCard();

    expect(screen.getByText(/Carica audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Carica \.md/i)).toBeInTheDocument();
    expect(screen.getByText(/Carica \.txt/i)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /Trascina qui file audio, Markdown o testo/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nessun file audio caricato/i)).toBeInTheDocument();
    expect(screen.getByText(/Nessun file \.md caricato/i)).toBeInTheDocument();
    expect(screen.getByText(/Nessun file \.txt caricato/i)).toBeInTheDocument();
  });

  it("delegates dropped markdown files to the markdown handler", () => {
    const { context } = renderUploadCard();
    const dropzone = screen.getByRole("region", { name: /Trascina/i });
    const file = new File(["# Heading"], "note.md", { type: "text/markdown" });

    simulateDrop(dropzone, file);

    expect(context.handleMarkdownFilePicked).toHaveBeenCalledTimes(1);
    const [event] = context.handleMarkdownFilePicked.mock.calls[0];
    expect(event.target.files[0]).toBe(file);
  });

  it("delegates dropped text files to the text handler", () => {
    const { context } = renderUploadCard();
    const dropzone = screen.getByRole("region", { name: /Trascina/i });
    const file = new File(["contenuto"], "outline.txt", { type: "text/plain" });

    simulateDrop(dropzone, file);

    expect(context.handleTextFilePicked).toHaveBeenCalledTimes(1);
    const [event] = context.handleTextFilePicked.mock.calls[0];
    expect(event.target.files[0]).toBe(file);
  });

  it("delegates dropped audio files to the audio picker", () => {
    const onPickFile = vi.fn();
    const { context } = renderUploadCard({ onPickFile });
    const dropzone = screen.getByRole("region", { name: /Trascina/i });
    const file = new File(["binary"], "voice-note.m4a", { type: "audio/m4a" });

    simulateDrop(dropzone, file);

    expect(onPickFile).toHaveBeenCalledTimes(1);
    const [event] = onPickFile.mock.calls[0];
    expect(event.target.files[0]).toBe(file);
    // Ensure we keep other handlers untouched when audio is dropped
    expect(context.handleMarkdownFilePicked).not.toHaveBeenCalled();
    expect(context.handleTextFilePicked).not.toHaveBeenCalled();
  });

  it("shows an error banner when dropping unsupported files", () => {
    const setErrorBanner = vi.fn();
    renderUploadCard({ setErrorBanner });
    const dropzone = screen.getByRole("region", { name: /Trascina/i });
    const file = new File(["{}"], "data.json", { type: "application/json" });

    simulateDrop(dropzone, file);

    expect(setErrorBanner).toHaveBeenCalledWith({
      title: "Formato non supportato",
      details: "Trascina un file audio, .md o .txt valido.",
    });
  });
});

