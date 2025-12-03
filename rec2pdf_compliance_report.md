
# Report di Compliance GDPR & AI Act: Rec2PDF

**Data:** 03 Dicembre 2025
**Autore:** Senior Privacy & AI Compliance Consultant

---

## 1) Executive Summary

Questa analisi evidenzia lo stato di conformità dell'applicazione SaaS B2B Rec2PDF rispetto al GDPR e al nuovo AI Act. Sebbene l'architettura mostri una buona base di partenza grazie all'uso di Supabase per la segregazione dei dati (RLS), emergono rischi significativi che richiedono un intervento prioritario. Lo stato di compliance attuale è valutato come **basso**.

-   **Rischio Principale - Dati Particolari e Sub-processing AI:** Rec2PDF tratta contenuti (audio/testo di riunioni) che possono contenere "categorie particolari di dati personali" (art. 9 GDPR, es. dati sanitari, opinioni politiche). Questi dati vengono inviati a fornitori di AI terzi (es. OpenAI, Google), spesso localizzati extra-UE, senza un'adeguata base giuridica e senza un controllo esplicito da parte del cliente (Titolare del trattamento).
-   **Gap Contrattuale e di Ruolo:** Manca una chiara definizione dei ruoli (Titolare/Responsabile). Rec2PDF agisce come **Responsabile del trattamento** per conto dei suoi clienti B2B, ma non sembra disporre di un Data Processing Agreement (DPA) standard da sottoporre ai clienti, né averne siglati con i propri sub-responsabili (Supabase, provider AI).
-   **Mancanza di Governance dei Dati:** Non sono evidenti policy o meccanismi tecnici per la gestione del ciclo di vita del dato, in particolare per la **retention** e la **cancellazione sicura** dei file audio, delle trascrizioni e degli embedding della knowledge base.
-   **Gap di Trasparenza (GDPR & AI Act):** L'informativa privacy è presumibilmente generica e non informa adeguatamente gli utenti finali e i clienti sull'uso di sub-processori AI, sui trasferimenti di dati extra-UE e sul fatto che i contenuti sono generati da un'IA, come richiesto dall'AI Act.

**Azioni Prioritarie (No-Regret Actions - 0-30 giorni):**

1.  **Stop al Training sui Dati:** Verificare e forzare immediatamente, a livello di codice, l'uso delle API dei provider AI in modalità "zero data retention" / "opt-out from training" (es. tramite header specifici o accordi commerciali) per impedire che i dati dei clienti vengano usati per addestrare i modelli.
2.  **Redazione Documenti Legali Chiave:** Predisporre urgentemente un'informativa privacy dettagliata, un Data Processing Agreement (DPA) standard per i clienti B2B e avviare la raccolta dei DPA dei sub-responsabili (Supabase, provider AI).
3.  **Implementare Trasparenza AI:** Introdurre nel frontend (UI) e nell'output (PDF) chiari avvisi che il contenuto è "generato o assistito da Intelligenza Artificiale".
4.  **Policy di Retention Semplice:** Definire e implementare una prima policy di data retention di default (es. cancellazione automatica dei file audio originali dopo 30 giorni dalla processazione).

---

## 2) Data & Processing Map (GDPR)

La tabella seguente mappa i flussi di dati personali identificati nell'ecosistema Rec2PDF.

| Categoria Dato | Origine / Sistema | Dati Personali (PII)? | Cat. Particolari (Art. 9)? | Soggetti Interessati | Finalità | Base Giuridica (Art. 6) / Condizione (Art. 9) | Ruolo Rec2PDF | Fornitori Terzi | Retention (ipotesi) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dati Account Utente** | Supabase Auth | Sì (email, nome, cognome, ruolo, IP) | No | Utenti finali (dipendenti del cliente B2B) | Gestione account, autenticazione, autorizzazione | Esecuzione di misure precontrattuali e contrattuali (art. 6.1.b) | **Titolare** | Supabase | Fino a cancellazione account + periodo di grace |
| **File Audio/Testo Input** | Upload utente (Supabase Storage) | Sì (voce, contenuti discussi) | **Sì (Alto Rischio)** | Partecipanti alle riunioni registrate | Trascrizione e analisi per generare il verbale | **Per conto del cliente:** esecuzione contratto (art. 6.1.b). **Per dati art. 9:** il cliente deve avere una base giuridica (es. consenso dei partecipanti, art. 9.2.a) | **Responsabile** | Supabase | Da definire (GAP) |
| **Trascrizioni / Diarizzazioni** | Provider AI (es. OpenAI) | Sì (testo derivato dall'audio) | **Sì (Alto Rischio)** | Partecipanti alle riunioni | Generazione del draft del documento | Come sopra | **Responsabile** | Provider AI (OpenAI, Google) | Da definire (GAP) |
| **Documenti Knowledge Base (RAG)** | Upload utente (Supabase Storage) | Sì (potenziali PII nei documenti) | Sì (potenziale) | Persone menzionate nei documenti | Fornire contesto al modello AI (RAG) | Come sopra | **Responsabile** | Supabase | Fino a cancellazione da parte del cliente |
| **Embedding Vettoriali** | Provider AI (es. OpenAI Ada) | **Sì (pseudonimi)** | Potenzialmente inferibili | Persone menzionate nei documenti | Indicizzazione per ricerca semantica (RAG) | Come sopra | **Responsabile** | Provider AI, Supabase (pg_vector) | Sincronizzata con i documenti sorgente |
| **Documento Finale (MD/PDF)** | Backend (server.js) | Sì (aggrega tutti i dati precedenti) | **Sì (Alto Rischio)** | Partecipanti alle riunioni | Fornitura del servizio contrattuale | Come sopra | **Responsabile** | Supabase (Storage) | Fino a cancellazione da parte del cliente |
| **Log Applicativi e Diagnostica** | Backend, Frontend, Supabase | Sì (user ID, IP, URL, metadati, potenziali snippet di dati in errori) | Potenzialmente | Utenti finali | Sicurezza, monitoraggio, debugging | Legittimo interesse (art. 6.1.f) | **Titolare** | Supabase, potenziale servizio di logging terzo | Breve periodo (es. 30-90 giorni) |

---

## 3) Gap Analysis GDPR

| Principio / Obbligo | Descrizione del Gap | Articoli GDPR | Gravità | Priorità |
| :--- | :--- | :--- | :--- | :--- |
| **Liceità, Correttezza e Trasparenza** | L'informativa privacy (presumibilmente) non è adeguata. Non menziona i sub-responsabili (Supabase, provider AI), i trasferimenti extra-UE, né fornisce dettagli sul trattamento di categorie particolari di dati. Gli utenti non sono pienamente consapevoli di dove finiscono i loro dati. | 12, 13, 14 | **Alta** | **Altissima** |
| **Ruoli Titolare/Responsabile** | Manca un Data Processing Agreement (DPA, art. 28) da far sottoscrivere ai clienti B2B. Questo lascia Rec2PDF esposta a responsabilità improprie e non definisce gli obblighi del cliente (Titolare) nel raccogliere lecitamente i dati (es. consenso dei partecipanti alla riunione). | 28, 26, 4.7, 4.8 | **Alta** | **Altissima** |
| **Gestione Sub-Responsabili** | Non è chiaro se Rec2PDF abbia siglato DPA con Supabase e i provider AI. Non viene richiesta l'autorizzazione al cliente per l'uso di tali sub-processori. | 28.2, 28.4 | **Alta** | **Altissima** |
| **Trasferimenti Extra-UE** | L'uso di provider AI basati in USA (es. OpenAI, Google) costituisce un trasferimento di dati extra-UE. Senza un meccanismo valido (es. DPF - EU-U.S. Data Privacy Framework, SCC + TIA) il trasferimento è illecito. | 44, 45, 46 | **Alta** | **Altissima** |
| **Limitazione delle Finalità** | Rischio che i provider AI usino i dati per finalità ulteriori (es. training dei modelli). Questo sarebbe un grave "purpose creep". | 5.1.b | **Alta** | **Altissima** |
| **Minimizzazione dei Dati** | - I log potrebbero contenere dati personali non necessari al debugging.<br>- L'audio originale potrebbe essere conservato indefinitamente, anche se non più necessario dopo la generazione del PDF. | 5.1.c | **Media** | **Alta** |
| **Limitazione della Conservazione** | **GAP Critico:** Manca una policy di data retention definita e automatizzata. I dati (audio, trascrizioni, PDF) rischiano di rimanere sui server indefinitamente, aumentando la superficie di rischio. | 5.1.e, 17 | **Alta** | **Alta** |
| **Diritti degli Interessati** | Mancano meccanismi chiari e accessibili per l'esercizio dei diritti (accesso, rettifica, cancellazione, portabilità). Poiché Rec2PDF è Responsabile, dovrebbe fornire al cliente (Titolare) gli strumenti per adempiere a tali richieste. | 15-22 | **Alta** | **Alta** |
| **Integrità e Riservatezza (Sicurezza)** | L'architettura basata su Supabase RLS è un ottimo punto di partenza (privacy by design), ma la sua corretta implementazione e manutenzione è critica. I log non protetti o la gestione debole degli URL firmati possono creare vulnerabilità. | 5.1.f, 32 | **Media** | **Media** |
| **Accountability** | Mancano il Registro delle Attività di Trattamento (art. 30), una DPIA (Data Protection Impact Assessment, art. 35) per il trattamento di dati particolari su larga scala tramite AI, e la nomina di un DPO (Data Protection Officer, art. 37), che potrebbe essere obbligatoria. | 5.2, 24, 30, 35, 37 | **Alta** | **Alta** |

---

## 4) Gap Analysis AI Act

**Classificazione del Sistema:**
-   **Ruolo di Rec2PDF:** Rec2PDF non è un "provider" di modelli di fondazione, ma un "**deployer**" (o "utilizzatore" in un contesto B2B) che integra un sistema di General-Purpose AI (GPAI) di terzi (es. GPT, Gemini) in un'applicazione con uno scopo specifico.
-   **Livello di Rischio:** Sulla base delle finalità descritte (verbalizzazione di riunioni), Rec2PDF ricadrebbe principalmente nella categoria a **rischio minimo**. **Tuttavia**, il rischio può aumentare se i clienti utilizzano l'output per finalità che ricadono in aree ad alto rischio (es. valutazione delle performance dei dipendenti basata sul verbale, allegato a una pratica legale). Rec2PDF deve considerare questo "dual-use" potenziale.

**Obblighi Principali per Rec2PDF come Deployer e Gap Corrispondenti:**

| Obbligo AI Act (per Deployer) | Descrizione e Applicazione a Rec2PDF | Gap Attuale e Raccomandazioni |
| :--- | :--- | :--- |
| **Obbligo di Trasparenza (Art. 52)** | Gli utenti finali devono essere chiaramente informati che stanno interagendo con un sistema di IA. I contenuti generati artificialmente (testi, riassunti) devono essere marcati come tali in modo che siano riconoscibili. | **GAP Alto:** Attualmente, l'utente potrebbe non sapere che il testo è stato generato o modificato da un'IA. <br>**Raccomandazione:** Inserire un'etichetta ben visibile nell'interfaccia di editing ("Testo generato da AI") e un watermark/nota a piè di pagina nel PDF finale ("Questo documento è stato generato con l'assistenza di Intelligenza Artificiale"). |
| **Data Governance e Qualità dei Dati** | Sebbene l'obbligo principale sia del provider del modello, il deployer ha la responsabilità di assicurare che i dati di input (prompt) non siano distorti o discriminatori, per quanto possibile. | **GAP Medio:** Questo si sovrappone agli obblighi GDPR. Rec2PDF deve fornire strumenti al cliente (Titolare) per garantire la qualità e la liceità dei dati inseriti (es. documenti della knowledge base). |
| **Sorveglianza Umana (Human Oversight)** | I sistemi di IA devono essere progettati per consentire un controllo umano efficace. L'utente deve poter supervisionare, intervenire o ignorare l'output dell'IA. | **STATO BUONO:** L'architettura sembra già prevedere questa funzionalità, permettendo all'utente di modificare il Markdown generato dall'IA prima di finalizzare il PDF. Questo è un punto di forza da mantenere e valorizzare. |
| **Robustezza, Accuratezza e Sicurezza** | Il deployer deve utilizzare il sistema di IA in accordo con le istruzioni d'uso fornite dal provider e monitorarne il funzionamento. | **GAP Basso:** Occorre assicurarsi di gestire correttamente gli errori dell'API, le "allucinazioni" del modello e di presentare all'utente i risultati con il giusto grado di cautela (es. "bozza da revisionare"). |

---

## 5) Risk Register

| Rischio | Causa | Impatto (Reputazionale, Legale, Finanziario) | Probabilità | Livello Rischio | Contromisure Raccomandate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sanzione GDPR per trattamento illecito di dati art. 9** | Invio di dati sensibili a provider AI senza base giuridica adeguata. | Alto | Alta | **Critico** | DPA con cliente, opt-out training, strumenti di anonimizzazione. |
| **Sanzione GDPR per trasferimento dati extra-UE illegale** | Utilizzo di API di provider AI in USA senza un valido meccanismo di trasferimento (DPF/SCC). | Alto | Alta | **Critico** | Verificare adesione provider al DPF; configurare endpoint API in UE se disponibili. |
| **Data breach multi-tenant** | Errore nella configurazione o in una migrazione delle policy RLS di Supabase. | Altissimo | Bassa | **Alto** | Review periodica delle policy RLS, test di penetrazione specifici per l'isolamento dei tenant. |
| **Violazione della riservatezza per uso dei dati per training** | Mancata configurazione dell'opt-out dal training da parte dei provider AI. | Altissimo | Media | **Alto** | Forzare a livello di codice l'uso di API "no-training"; validare contrattualmente (DPA). |
| **Mancata conformità all'AI Act (obblighi di trasparenza)** | Assenza di etichette "AI-generated" nell'UI e negli output. | Medio | Alta | **Medio** | Implementare etichettatura come da raccomandazioni. |
| **Conservazione indefinita dei dati (data spill)** | Assenza di policy di data retention. | Alto | Alta | **Alto** | Implementare policy e job di cancellazione automatica. |
| **Accesso non autorizzato ai log** | Log contenenti PII archiviati in modo non sicuro o con accessi non granulari. | Medio | Media | **Medio** | Sanitizzare i log da PII, applicare retention breve, controllare gli accessi. |

---

## 6) Roadmap di Remediation

### Fase 1: Azioni Urgenti (0-30 Giorni)

-   **Owner: Engineering**
    -   **Azione:** Modificare tutte le chiamate API ai provider AI per includere header/parametri di "opt-out" dal training.
    -   **Azione:** Se possibile, configurare le chiamate per usare endpoint localizzati nella UE.
-   **Owner: Legal / Product**
    -   **Azione:** Redigere e pubblicare una nuova Informativa Privacy dettagliata.
    -   **Azione:** Redigere un Data Processing Agreement (DPA) standard da integrare nei contratti con i clienti B2B.
    -   **Azione:** Contattare Supabase, OpenAI, Google per richiedere i loro DPA e verificare l'adesione al DPF.
-   **Owner: Product / Frontend**
    -   **Azione:** Implementare un banner o etichetta chiara nell'UI che informa l'utente dell'uso di IA.
    -   **Azione:** Aggiungere un watermark/nota a piè di pagina negli output PDF.

### Fase 2: Consolidamento (30-90 Giorni)

-   **Owner: Engineering / Backend**
    -   **Azione:** Progettare e implementare un sistema di data retention configurabile per workspace (es. "cancella audio dopo X giorni", "cancella PDF dopo Y giorni").
    -   **Azione:** Sviluppare una funzione di "cancellazione account" che elimini tutti i dati dell'utente (dati account e, se unico utente del workspace, tutti i dati del workspace).
    -   **Azione:** Rivedere il sistema di logging per minimizzare i dati personali registrati.
-   **Owner: Security / DevOps**
    -   **Azione:** Eseguire un audit completo e documentato delle policy RLS di Supabase.
-   **Owner: Legal**
    -   **Azione:** Completare la raccolta dei DPA e creare un registro dei sub-responsabili.
    -   **Azione:** Avviare la stesura di una Data Protection Impact Assessment (DPIA).

### Fase 3: Maturità e Privacy by Design (90-180 Giorni)

-   **Owner: Engineering / Product**
    -   **Azione:** Sviluppare una funzionalità di "esportazione dati" (portabilità, art. 20 GDPR) per i clienti.
    -   **Azione:** Esplorare tecniche di pseudonimizzazione/anonimizzazione da applicare prima di inviare i dati ai provider AI (es. sostituzione dei nomi propri).
    -   **Azione:** Creare un pannello di controllo "Privacy & Sicurezza" per i clienti amministratori del workspace.
-   **Owner: Security**
    -   **Azione:** Implementare un sistema di audit log per tracciare gli accessi ai dati sensibili.
-   **Owner: Legal**
    -   **Azione:** Nominare un DPO (interno o esterno).
    -   **Azione:** Finalizzare e storicizzare la DPIA e il Registro delle Attività di Trattamento.

---

## 7) Checklist Operativa di Compliance (per Release)

Per ogni nuova feature o modifica significativa, il team deve verificare i seguenti punti:

-   [ ] **Nuovi Dati Personali?**
    -   [ ] La feature introduce nuove categorie di dati personali?
    -   [ ] Se sì, aggiornare la Data Map e il Registro dei Trattamenti.
    -   [ ] Valutare se l'informativa privacy necessita di un aggiornamento.
-   [ ] **Nuovo Fornitore Terzo?**
    -   [ ] La feature usa una nuova API, libreria o servizio esterno che processa dati personali?
    -   [ ] Se sì, qualificarlo come sub-responsabile e notificare il team Legal per la gestione del DPA.
-   [ ] **Impatto sul Ciclo di Vita del Dato?**
    -   [ ] I nuovi dati sono coperti dalle policy di retention esistenti?
    -   [ ] I nuovi dati vengono correttamente cancellati tramite le procedure esistenti?
    -   [ ] I nuovi dati sono inclusi nell'export per la portabilità?
-   [ ] **Impatto AI Act?**
    -   [ ] La feature introduce un nuovo uso di IA o modifica quello esistente?
    -   [ ] Se sì, assicurarsi che gli obblighi di trasparenza (etichettatura) siano rispettati.
-   [ ] **Sicurezza e Accessi?**
    -   [ ] I nuovi dati sono correttamente protetti dalle policy RLS?
    -   [ ] Gli accessi ai nuovi dati sono limitati al principio del "need-to-know"?
    -   [ ] Il logging è stato implementato in modo da non registrare dati sensibili?

---

## 8) Open Questions (Informazioni Mancanti)

Per una valutazione definitiva, è necessario che il team Rec2PDF chiarisca i seguenti punti.

| Domanda | Perché è Necessaria | Ruolo da Coinvolgere |
| :--- | :--- | :--- |
| 1. In quali **region geografiche** sono ospitati i servizi Supabase e gli endpoint AI che utilizzate? | Fondamentale per mappare i trasferimenti di dati e determinare i meccanismi di conformità necessari (es. DPF, SCC). | CTO / Engineering Lead |
| 2. Esistono già dei **Data Processing Agreement (DPA)** firmati con Supabase, OpenAI, Google o altri provider? Quali sono i loro termini? | La loro assenza è un gap critico. I termini definiscono responsabilità, limiti d'uso e procedure in caso di breach. | Legal / CTO |
| 3. Qual è la **configurazione esatta delle API** dei provider AI? State già utilizzando opzioni "zero-retention" o "opt-out"? | Rispondere a questa domanda è l'azione più urgente per mitigare il rischio di uso improprio dei dati. | Engineering Lead |
| 4. Chi sono i **clienti target** di Rec2PDF (es. studi legali, settore sanitario, consulenza)? | Il settore di appartenenza dei clienti influenza il tipo e la sensibilità dei dati trattati, e quindi il livello di rischio complessivo. | Product Owner / CEO |
| 5. Esiste una figura interna o esterna con responsabilità formali sulla **protezione dei dati (DPO)**? | L'assenza indica una mancanza di accountability strutturata. La nomina potrebbe essere obbligatoria. | CEO / Legal |
| 6. Come sono gestiti i **log applicativi**? Dove sono archiviati, chi vi ha accesso, e per quanto tempo sono conservati? | I log sono una potenziale fonte di data leak. La loro governance è una misura di sicurezza essenziale. | DevOps / Security Lead |
| 7. È previsto un modello di deployment **on-premise** oltre al SaaS? | Un'offerta on-premise cambierebbe radicalmente il modello di responsabilità, spostando molti obblighi direttamente sul cliente. | Product Owner / CTO |
