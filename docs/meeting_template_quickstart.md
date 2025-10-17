# Verbale meeting – quickstart template

Il template HTML `verbale_meeting` richiede un front matter strutturato e l'attivazione del relativo layout. I passaggi chiave:

1. Installare un motore HTML → PDF (ad es. `wkhtmltopdf` o `weasyprint`).
2. Esportare le variabili d'ambiente o configurare il profilo workspace perché punti a `Templates/verbale_meeting.html` e al relativo CSS.
3. Selezionare il prompt **Verbale riunione executive** (`prompt_meeting_minutes`) dalla libreria prompt.
4. Compilare il front matter YAML includendo i tre array richiesti: `action_items`, `key_points`, `transcript`.

## Esempio di front matter minimale
```yaml
---
title: "Weekly leadership sync"
pdfRules:
  layout: verbale_meeting
styles.css: Templates/verbale_meeting.css
metadata:
  meeting:
    date: "2025-02-12"
    duration: "45 minuti"
    participants:
      list:
        - "Sara (CEO)"
        - "Davide (COO)"
action_items:
  - description: "Condividere il report di avanzamento"
    assignee:
      name: "Davide"
      role: "COO"
    due_date: "2025-02-16"
key_points:
  - "Budget Q2 confermato"
  - "Nuovo lancio marketing il 5 marzo"
transcript:
  - speaker: "Sara"
    timestamp: "00:00:10"
    paragraphs:
      - "Aggiornamento generale sul trimestre."
---
```

Il corpo del markdown dovrebbe poi includere i titoli:

- `## Riepilogo esecutivo`
- `## Decisioni e approvazioni`
- `## Azioni assegnate`
- `## Punti chiave`
- `## Trascrizione integrale`

Per un esempio completo consultare anche [`docs/sample_verbale_meeting.md`](sample_verbale_meeting.md).
