# Advanced Mode Discovery

## 1. Executive Summary
- Analisi desk della pagina `Create.jsx` per mappare flusso advanced mode e individuare attriti.
- Identificate duplicazioni CTA e ridondanze informative tra hero e card registrazione, potenziali cause di indecisione.
- Raccolta indiretta di esigenze su workspace/prompt/pipeline tramite revisione codice e telemetria disponibile (assenza di interviste dirette nel contesto corrente).
- Definiti user journey end-to-end e metriche baseline da monitorare prima di interventi IA.
- Azioni aperte: condurre interviste con utenti senior/stakeholder e review con product team per validare requisiti.

## 2. Flusso attuale (Create.jsx)
1. **Hero pipeline & CTA primaria** – Card principale con stato pipeline e pulsante "Avvia pipeline executive" condizionata da `canStartPipeline`. 【F:rec2pdf-frontend/src/pages/Create.jsx†L210-L233】【F:rec2pdf-frontend/src/pages/Create.jsx†L450-L468】
2. **Metriche highlight** – Griglia di card highlight legate a performance/progressi (`highlightCards`). Attualmente orientate alla valorizzazione ma non legate a interazioni specifiche. 【F:rec2pdf-frontend/src/pages/Create.jsx†L469-L506】
3. **Sezione Registrazione** – Modulo registrazione/upload con timer, controlli audio, CTA secondarie: avvio pipeline, download audio, reset sessione. 【F:rec2pdf-frontend/src/pages/Create.jsx†L507-L588】【F:rec2pdf-frontend/src/pages/Create.jsx†L1048-L1105】
4. **Workspace & prompt setup** – Card per selezione workspace, progetto, prompt, profilo PDF, inclusi pulsanti per aprire settings e applicare profili. Stato guidato da `context` e `workspaceProfileSelection`. 【F:rec2pdf-frontend/src/pages/Create.jsx†L589-L880】
5. **Pipeline stages timeline** – Componenti che visualizzano fasi (`context.PIPELINE_STAGES`) con badge stato, log e download esiti. Serve da feedback ma aggiunge complessità visiva. 【F:rec2pdf-frontend/src/pages/Create.jsx†L881-L1045】
6. **Sezione knowledge base & prompt library** – Moduli per allegati, note, libreria prompt con toggle info contestuali. 【F:rec2pdf-frontend/src/pages/Create.jsx†L1123-L1498】
7. **Sidebar diagnostica & fallback base mode** – Condizionale tra advanced (`AdvancedCreatePage`) e `BaseHome`. Switch in coda file. 【F:rec2pdf-frontend/src/pages/Create.jsx†L1499-L1689】

## 3. Pain point principali
- **CTA duplicate e naming incoerente** – Due pulsanti di avvio pipeline (hero e card registrazione) con label diverse; possono generare indecisione o percezione di flussi separati. 【F:rec2pdf-frontend/src/pages/Create.jsx†L450-L468】【F:rec2pdf-frontend/src/pages/Create.jsx†L1072-L1085】
- **Condizioni di abilitazione nascoste** – Messaggio "Registra o carica un audio" legato allo stato `canStartPipeline` è distante dalla card registrazione; utenti possono non capire perché CTA è disabilitata. 【F:rec2pdf-frontend/src/pages/Create.jsx†L458-L466】【F:rec2pdf-frontend/src/pages/Create.jsx†L1058-L1094】
- **Sovraccarico informativo** – Sezioni workspace/prompt dense di opzioni (profili, librerie, allegati) senza progressive disclosure; rischio di curva apprendimento ripida per senior non tecnici. 【F:rec2pdf-frontend/src/pages/Create.jsx†L589-L1122】
- **Feedback pipeline dispersivo** – Timeline e log generano scroll verticale; mancano anchor/summary post-run per accesso rapido a output. 【F:rec2pdf-frontend/src/pages/Create.jsx†L881-L1045】
- **Assenza di distinzione tra azioni preparatorie vs esecuzione** – Step hero suggerisce linearità ma UI presenta sezioni parallele, potenziale confusione su ordine ottimale.

## 4. Insight da stakeholder & utenti senior
> **Nota:** non è stato possibile condurre interviste dirette nell'ambiente corrente. Si propone il seguente piano d'azione:
- Stakeholder prodotto: validare priorità (workspace templating vs velocità pipeline) e definire success criteria.
- Utenti senior (consultant / project manager): investigare bisogni su riuso prompt, controllo versioni workspace, e trasparenza pipeline.
- Domande guida suggerite:
  - Quali step della preparazione report richiedono più tempo attualmente?
  - Quanto spesso riutilizzate configurazioni workspace/prompt tra clienti?
  - Quali segnali vi servono per fidarvi dell'output IA senza rivedere manualmente tutto?
  - Dove vorreste vedere alert diagnostici o suggerimenti AI nel flusso?
- Output atteso: mappa requisiti must-have/nice-to-have, definizione di feature guardrails per automazioni IA.

## 5. User journey proposto (stato attuale)
1. **Seleziona workspace & progetto** – Utente sceglie workspace, applica profilo, conferma prompt. 【F:rec2pdf-frontend/src/pages/Create.jsx†L589-L880】
   - *Metriche baseline*: % sessioni con workspace selezionato, tempo medio speso nel modulo (strumentabile via event tracking `advanced.settings.workspace_shortcut`).
2. **Prepara input audio** – Registra o carica audio, controlla qualità, opzionalmente scarica copia. 【F:rec2pdf-frontend/src/pages/Create.jsx†L507-L588】【F:rec2pdf-frontend/src/pages/Create.jsx†L1048-L1105】
   - *Metriche baseline*: tasso di upload completati, durata media registrazione, uso CTA download.
3. **Avvia pipeline** – Attiva pipeline dal pulsante (hero o card) e monitora avanzamento timeline. 【F:rec2pdf-frontend/src/pages/Create.jsx†L450-L468】【F:rec2pdf-frontend/src/pages/Create.jsx†L881-L1045】
   - *Metriche baseline*: conversione `audio pronto → pipeline avviata`, tempo medio fase per fase (`context.pipelineStatus`).
4. **Revisione output & follow-up** – Consulta log, scarica PDF, modifica prompt/markdown se necessario. 【F:rec2pdf-frontend/src/pages/Create.jsx†L881-L1045】【F:rec2pdf-frontend/src/pages/Create.jsx†L1398-L1498】
   - *Metriche baseline*: % completamenti pipeline, download PDF/Markdown, ricorrenza ri-run pipeline.
5. **Gestione knowledge base** – Allegati, note, libreria prompt per iterazioni successive. 【F:rec2pdf-frontend/src/pages/Create.jsx†L1123-L1397】
   - *Metriche baseline*: utilizzo prompt library (`PromptLibrary` interactions), allegati aggiunti per sessione.

## 6. Metriche baseline consigliate
| Area | Metrica | Fonte attuale | Note |
| --- | --- | --- | --- |
| Engagement workspace | `advanced.settings.workspace_shortcut` event | `trackEvent` su apertura settings. 【F:rec2pdf-frontend/src/pages/Create.jsx†L200-L206】 | Estendere con payload su profili applicati.
| Attivazione pipeline | Conteggio `processViaBackend` invocazioni | Hero & card CTA. 【F:rec2pdf-frontend/src/pages/Create.jsx†L450-L468】【F:rec2pdf-frontend/src/pages/Create.jsx†L1072-L1085】 | Normalizzare naming CTA e distinguere origini.
| Drop-off pre-avvio | Tasso sessioni con audio ma nessun avvio | Derivabile confrontando upload vs avvii (richiede evento upload completato).
| Tempo completamento pipeline | Durata `context.pipelineStatus` per stage | UI già calcola `context.elapsed`. 【F:rec2pdf-frontend/src/pages/Create.jsx†L521-L530】 | Loggare stage start/end lato backend.
| Qualità output | Download PDF/Markdown post-run | Link esistenti nella timeline. 【F:rec2pdf-frontend/src/pages/Create.jsx†L932-L1018】 | Strumentare con eventi `pipeline.download_pdf`/`pipeline.download_markdown`.

## 7. Prossimi passi & validazione
- **Interviste**: programmare sessioni con 3-5 utenti senior + 2 stakeholder prodotto per validare pain point e priorità IA.
- **Allineamento prodotto**: workshop rapido per confermare requisiti raccolti, definire MVP Advanced Mode IA e metriche successo.
- **Design iteration**: esplorare redesign CTA (single primary + progressive disclosure), timeline condensata e onboarding guidato.
- **Preparazione fase IA**: una volta validati requisiti, definire backlog sperimentazioni (prompt dinamici, suggerimenti pipeline, automazioni knowledge base).

