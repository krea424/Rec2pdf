# Rec2PDF Toolchain Overview 
v3.0.0

This document provides a technical illustration of the `rec2pdf` toolchain, from file upload to the final, high-quality PDF.

### 1. Input: The User's Action

The process begins in the `rec2pdf-frontend` when a user on the `CreatePage` performs one of these actions:

*   **Records audio:** The browser's `MediaRecorder` API captures audio, storing it in the `audioBlob` state.
*   **Uploads an audio file:** The selected file is stored in `audioBlob`.
*   **Uploads a Markdown or TXT file:** The user selects a text-based file.

### 2. The "Avvia pipeline executive" Button

Clicking this button triggers the `processViaBackend` function in `App.jsx`, the main entry point for backend processing.

### 3. The Backend API Call

`processViaBackend` gathers all necessary information and sends it to the `rec2pdf-backend` via a `POST` request to the `/api/process` endpoint. The payload is a `FormData` object containing:

*   The audio file (`audioBlob`).
*   The destination directory (`destDir`).
*   The filename slug (`slug`).
*   The `promptState`, which includes:
    *   `promptId`: The ID of the selected prompt template.
    *   `focus`: Text from the "focus del monologo" field.
    *   `notes`: Text from the "note personali" field.
*   Workspace and project information.
*   A custom PDF logo, if provided.

### 4. The Backend: `server.js`

The `rec2pdf-backend`'s `server.js` (an Express.js app) listens at `/api/process`. Here’s the request handling process:

1.  **File Upload:** `multer` middleware saves the uploaded audio to a temporary server directory.

2.  **Pipeline Execution:** The backend executes a sequence of shell commands, updating the frontend on the status of each stage via Server-Sent Events (SSE).

    **Key Stages:**

    a.  **Transcoding:** `ffmpeg` converts the uploaded audio to a 16kHz mono WAV file, the required format for the Whisper model.

    b.  **Transcription:** A local `whisper` command transcribes the WAV file to a `.txt` file containing the raw transcript.

    c.  **Markdown Generation (`generateMarkdown` function):** This is the AI-driven step.
        *   The function is called with the transcript file path and the `promptPayload` (including `focus` and `notes`).
        *   A detailed prompt is constructed.
        *   The `gemini` command-line tool is executed with the full prompt and transcript.
        *   The `gemini` tool sends the prompt to the Gemini API and receives the generated Markdown.
        *   The output is cleaned (e.g., removing Markdown code fences) and saved to a `.md` file.

    d.  **PDF Publishing (`publishWithTemplateFallback` function):** The final step converts the Markdown to a professional PDF.
        *   The system first attempts to use `publish.sh`, a flexible script that can be configured with different PDF engines and templates.
        *   **Templates:** The script uses HTML (`.html`) or LaTeX (`.tex`) templates from the `Templates` directory to define the PDF's layout, fonts, and colors. For example, `verbale_meeting.html` is designed for a polished meeting report.
        *   **CSS Styling:** For HTML templates, a corresponding CSS file (e.g., `verbale_meeting.css`) provides extensive styling customization.
        *   **Pandoc Fallback:** If `publish.sh` fails, the system uses `pandoc`, a universal document converter. `pandoc` can also use the HTML or LaTeX templates and supports various PDF engines like `wkhtmltopdf`, `weasyprint`, or `xelatex`.
        *   **High-Quality Output:** The combination of `pandoc` and well-designed templates (with CSS for HTML or LaTeX commands for `.tex`) ensures a high-quality final PDF, complete with headers, footers, logos, and other branding for a professional look.

### 5. The Final Result

The generated PDF is saved to the user-specified directory. The frontend receives a "complete" event, and the user can then access the PDF from their file system or the application's library.

In essence, the `rec2pdf` toolchain is a sophisticated pipeline that combines:

*   **A React frontend** for user interaction.
*   **A Node.js backend** to orchestrate the workflow.
*   **Best-in-class open-source tools** like `ffmpeg`, `whisper`, and `pandoc`.
*   **The power of the Gemini LLM** for content generation.
*   **A flexible templating system** for creating high-quality, professional PDFs.

This architecture allows for extensive customization of both the content and appearance of the final output.
