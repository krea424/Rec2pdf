
# Rec2PDF - From Voice to Document

<p align="center">
  <img src="https://placehold.co/300x150/d3e8ff/333333?text=Rec2PDF" alt="Rec2PDF Logo">
</p>

<p align="center">
  <strong>Automatizza la verbalizzazione dei tuoi meeting.</strong><br>
  Rec2PDF è un'applicazione web intelligente che trasforma le registrazioni audio in documenti PDF strutturati, completi di trascrizione, riassunto e punti chiave.
</p>

<p align="center">
  <a href="#about-the-project">About</a> •
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Indice

1.  [About The Project](#about-the-project)
2.  [Features](#features)
3.  [Tech Stack](#tech-stack)
4.  [Architecture Overview](#architecture-overview)
5.  [Getting Started](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation](#installation)
6.  [Usage](#usage)
7.  [Project Structure](#project-structure)
8.  [Roadmap](#roadmap)
9.  [Contributing](#contributing)
10. [License](#license)
11. [Contact](#contact)

---

## About The Project

In un mondo dove i meeting online e le registrazioni sono all'ordine del giorno, la documentazione manuale è diventata un collo di bottiglia. Ore preziose vengono sprecate per riascoltare, trascrivere e riassumere le discussioni. **Rec2PDF nasce per risolvere questo problema.**

Il nostro obiettivo è fornire uno strumento semplice, potente e automatizzato che si integri nel flusso di lavoro di professionisti, team aziendali e studenti, garantendo che nessuna informazione critica vada persa e che la documentazione sia rapida, accurata e professionale.

## Features

*   **📝 Trascrizione Automatica:** Converte file audio (WAV, MP3, etc.) in testo con alta precisione.
*   **🤖 Riassunto AI-Powered:** Estrae automaticamente i punti salienti, le decisioni prese e le azioni da intraprendere (action items).
*   **📄 Esportazione PDF Professionale:** Genera un documento PDF ben formattato, pronto per essere archiviato o condiviso.
*   **💻 Interfaccia Web Intuitiva:** Un'esperienza utente pulita e semplice, accessibile da qualsiasi browser.
*   **🔒 Sicuro e Privato:** Progettato con la privacy dei dati come priorità.

## Tech Stack

Il progetto è diviso in due componenti principali: un backend per l'elaborazione e un frontend per l'interazione con l'utente.

*   **Frontend:**
    *   [React](https://reactjs.org/)
    *   [Vite](https://vitejs.dev/)
    *   [Tailwind CSS](https://tailwindcss.com/)
*   **Backend:**
    *   [Node.js](https://nodejs.org/)
    *   [Express.js](https://expressjs.com/)
*   **Motori AI/ML (proposti):**
    *   **Speech-to-Text:** API come OpenAI Whisper, Google Speech-to-Text.
    *   **Summarization/NLP:** Modelli basati su architetture Transformer (es. GPT).
*   **Database (proposto):**
    *   MongoDB o PostgreSQL per la gestione degli utenti e dei documenti.

## Architecture Overview

The application follows a client-server architecture:

*   **Frontend (`rec2pdf-frontend`):** A React-based single-page application (SPA) built with Vite and styled with Tailwind CSS. It handles all user interactions, including:
    *   Recording audio from the microphone using the browser's `MediaRecorder` API.
    *   Uploading audio files.
    *   Communicating with the backend to process the audio.
    *   Displaying the progress and results to the user.

*   **Backend (`rec2pdf-backend`):** A Node.js server using the Express framework. It exposes a REST API for the frontend and orchestrates a pipeline of command-line tools to process the audio:
    1.  It receives an audio file (either recorded or uploaded) from the frontend.
    2.  It uses `ffmpeg` to convert the audio to a standard WAV format.
    3.  It uses the `whisper` command-line tool to transcribe the audio to text.
    4.  It uses a custom shell function (`genMD`) to generate a Markdown file from the transcription, likely adding structure and summarization.
    5.  It uses `ppubr`/`PPUBR` or `pandoc` to convert the Markdown file into a PDF.
    6.  It returns the path to the generated PDF to the frontend.

In summary, the frontend provides a user-friendly interface for capturing audio, while the backend acts as a wrapper around a set of powerful command-line tools that perform the core audio processing and document generation tasks.

## Getting Started

Segui questi passaggi per configurare una copia del progetto in locale.

### Prerequisites

Assicurati di avere Node.js e npm installati sul tuo sistema.
*   **Node.js** (v18.x o superiore)
*   **npm** (v9.x o superiore)

```sh
node -v
npm -v
```

### Installation

1.  **Clona il repository**
    ```sh
    git clone https://github.com/your-username/Rec2pdf.git
    cd Rec2pdf
    ```

2.  **Configura il Backend**
    ```sh
    cd rec2pdf-backend
    npm install
    ```
    Crea un file `.env` nella root di `rec2pdf-backend` e aggiungi le chiavi API necessarie:
    ```env
    # .env example
    PORT=3001
    OPENAI_API_KEY=sk-...
    ```

3.  **Configura il Frontend**
    ```sh
    cd ../rec2pdf-frontend
    npm install
    ```
    Il frontend si aspetta che il backend sia in esecuzione sulla porta 3001. Se cambiata, configura un proxy nel file `vite.config.js`.

## Usage

Per avviare l'applicazione, è necessario eseguire sia il server backend che il client frontend in due terminali separati.

1.  **Avvia il server Backend**
    ```sh
    cd rec2pdf-backend
    npm start
    ```
    Il server sarà in ascolto su `http://localhost:3001`.

2.  **Avvia il client Frontend**
    ```sh
    cd rec2pdf-frontend
    npm run dev
    ```
    L'applicazione sarà accessibile nel tuo browser all'indirizzo `http://localhost:5173` (o la porta indicata da Vite).

## Project Structure

```
/Users/moromoro/Desktop/Rec2pdf/
├── rec2pdf-backend/        # Backend Node.js
│   ├── node_modules/
│   ├── server.js           # Entry point del server Express
│   └── package.json
├── rec2pdf-frontend/             # Frontend React
│   ├── public/
│   ├── src/                # Codice sorgente React
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js
├── README.md               # Questo file
```

## Roadmap

*   [ ] **Q4 2025: Sviluppo MVP**
    *   [ ] Sistema di autenticazione e gestione utenti.
    *   [ ] Integrazione di un sistema di pagamento (Stripe).
    *   [ ] Dashboard utente per la gestione dei documenti.
*   [ ] **Q1 2026: Funzionalità Avanzate**
    *   [ ] Trascrizione in tempo reale da microfono.
    *   [ ] Supporto multilingua.
    *   [ ] Template PDF personalizzabili.
*   [ ] **Q2 2026: Integrazioni**
    *   [ ] Integrazione con Google Drive, Dropbox.
    *   [ ] API per sviluppatori.
    *   [ ] Integrazione con Slack e Microsoft Teams.

Vedi le [open issues](https://github.com/your-username/Rec2pdf/issues) per una lista completa delle funzionalità proposte (e dei bug conosciuti).

## Contributing

I contributi sono ciò che rende la comunità open source un posto fantastico per imparare, ispirare e creare. Qualsiasi contributo tu faccia è **molto apprezzato**.

1.  Forka il Progetto
2.  Crea il tuo Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Committa le tue modifiche (`git commit -m 'Add some AmazingFeature'`)
4.  Pusha sul Branch (`git push origin feature/AmazingFeature`)
5.  Apri una Pull Request

## License

Distribuito sotto la licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## Contact

Project Lead - [Il Tuo Nome](mailto:tua-email@example.com)

Link al Progetto: [https://github.com/your-username/Rec2pdf](https://github.com/your-username/Rec2pdf)
