# Rec2PDF - From Voice to Document

<p align="center">
  <img src="/Users/moromoro/Desktop/Rec2pdf/logo_thinkDOC.svg" alt="Rec2PDF Logo" width="300">
</p>

<p align="center">
  <strong>Automatizza la verbalizzazione dei tuoi meeting.</strong><br>
  Rec2PDF è un'applicazione web che trasforma le registrazioni audio in documenti PDF strutturati, completi di trascrizione e analisi.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-usage">Usage</a>
</p>

---

## ✨ Features

*   **🎙️ Registrazione Browser:** Registra l'audio direttamente dal browser o carica un file esistente.
*   **🤖 Pipeline di Elaborazione:**
    *   Converte l'audio in un formato standard (`ffmpeg`).
    *   Trascrive l'audio in testo con alta precisione (`whisper`).
    *   Genera un documento strutturato in Markdown.
    *   Converte il Markdown in un **PDF professionale** (`pandoc`).
*   **🖥️ Interfaccia Web Intuitiva:** Un'esperienza utente pulita e semplice per gestire il processo.
*   **🔒 Sicuro e Privato:** L'elaborazione avviene localmente. I tuoi dati non lasciano la tua macchina.

## 🛠️ Tech Stack

Il progetto è un monorepo composto da un backend per l'elaborazione e un frontend per l'interfaccia utente.

*   **Frontend (`rec2pdf-frontend`):**
    *   [React](https://reactjs.org/)
    *   [Vite](https://vitejs.dev/)
    *   [Tailwind CSS](https://tailwindcss.com/)

*   **Backend (`rec2pdf-backend`):**
    *   [Node.js](https://nodejs.org/)
    *   [Express.js](https://expressjs.com/)
    *   [Multer](https://github.com/expressjs/multer) per la gestione degli upload.

## 🚀 Getting Started

Segui questi passaggi per configurare ed eseguire il progetto in locale.

### Prerequisites

Assicurati di avere i seguenti strumenti installati sul tuo sistema:

*   **Node.js:** `v18.x` o superiore.
*   **npm:** `v9.x` o superiore.
*   **ffmpeg:** Necessario per la conversione audio.
*   **Whisper:** Per la trascrizione.
*   **Pandoc:** Per la generazione dei PDF.

Puoi verificare le installazioni con:
```sh
node -v
npm -v
ffmpeg -version
whisper -h
pandoc --version
```

### Installation

1.  **Clona il repository**
    ```sh
    git clone https://github.com/krea424/Rec2pdf.git
    cd Rec2pdf
    ```

2.  **Installa le dipendenze del Backend**
    ```sh
    cd rec2pdf-backend
    npm install
    ```

3.  **Installa le dipendenze del Frontend**
    ```sh
    cd ../rec2pdf-frontend
    npm install
    ```

## Usage

Per avviare l'applicazione, è necessario eseguire sia il server backend che il client frontend in due terminali separati.

1.  **Avvia il server Backend**
    Dalla cartella `rec2pdf-backend`, esegui:
    ```sh
    npm start
    ```
    Il server sarà in ascolto su `http://localhost:7788` (o la porta configurata).

2.  **Avvia il client Frontend**
    Dalla cartella `rec2pdf-frontend`, esegui:
    ```sh
    npm run dev
    ```
    L'applicazione sarà accessibile nel tuo browser all'indirizzo indicato da Vite (solitamente `http://localhost:5173`).

## 🏛️ Project Structure

```
Rec2pdf/
├── rec2pdf-backend/        # Backend Node.js (Express)
│   ├── server.js           # Entry point del server
│   └── package.json
├── rec2pdf-frontend/       # Frontend React (Vite)
│   ├── src/                # Codice sorgente React
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
└── README.md               # Questo file
```

---

*Questo README è stato generato con l'assistenza di Gemini.*