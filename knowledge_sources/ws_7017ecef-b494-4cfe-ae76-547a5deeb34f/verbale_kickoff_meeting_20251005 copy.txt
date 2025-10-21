---
title: "Verbale Kick-off — Project Phoenix"
project: "Project Phoenix"
company: "Innovatech Solutions"
client: "Global Foods Inc."
date: 2025-10-05
location: "Videoconferenza — MS Teams"
attendees:
  - "Mario Rossi (PM, Innovatech Solutions)"
  - "Giulia Bianchi (Lead Developer, Innovatech Solutions)"
  - "Luca Verdi (Business Analyst, Innovatech Solutions)"
  - "Sofia Neri (Product Owner, Global Foods Inc.)"
version: "v1.0"
id: "phoenix-kickoff-verbale-20251005-it"
tags: [verbale, kickoff, decisions, action-items, erp-legacy, scm, project-phoenix]
---

## Decisioni Chiave
- Confermati gli **obiettivi di business**: logistica −15%, OTIF 95%, lead time −25%.
- **Approccio di integrazione**: connettore custom con estrazioni batch notturne dall’ERP legacy (API moderne da valutare in Fase 3).
- **Perimetro pilota**: stabilimenti **Milano** e **Parma**; portale fornitori per 20 vendor prioritari.

## Action Items
| Azione | Responsabile | Scadenza |
|---|---|---|
| Mappare i flussi dati ERP (ordini, consegne, anagrafiche, lotti) | **Luca Verdi** | **2025-10-12** |
| Disegnare l’architettura del connettore batch (estrazione, staging, ETL) | **Giulia Bianchi** | **2025-10-15** |
| Allineamento stakeholder e approvazione del Charter | **Mario Rossi** | **2025-10-10** |

## Note Dettagliate
La riunione di kick-off ha allineato obiettivi, deliverable e perimetro del pilota. È stata ribadita l’importanza di misurare rapidamente i KPI chiave (OTIF, lead time, stockout) tramite dashboard condivise. È stato concordato di partire con un set minimo ma solido di integrazioni, per generare **quick wins** nei primi due mesi.

**Giulia Bianchi** ha evidenziato una **sfida tecnica con l’integrazione del sistema ERP legacy**: l’ERP AS/400 non espone API REST/GraphQL e i meccanismi di integrazione attuali sono basati su **estrazioni file** e job schedulati. Per minimizzare rischi, il team svilupperà un **connettore custom** che esegua **estrazioni batch notturne**, depositando i file su uno storage sicuro per poi avviare i processi di ingest ed elaborazione (ETL). Questo approccio consente di rispettare le finestre operative senza impattare i sistemi transazionali.
