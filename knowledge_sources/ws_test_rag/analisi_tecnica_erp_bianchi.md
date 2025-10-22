---
title: "Analisi Preliminare: Integrazione ERP Legacy"
project: "Project Phoenix"
company: "Innovatech Solutions"
client: "Global Foods Inc."
author: "Giulia Bianchi (Lead Developer)"
version: "v1.0"
date: 2025-10-12
id: "phoenix-tech-analysis-erp-legacy-20251012-it"
tags: [tecnico, integrazione, erp-legacy, as400, etl, batch, connettore-custom, project-phoenix]
---

# Analisi Preliminare: Integrazione ERP Legacy
**Autore:** Giulia Bianchi (Lead Developer, Innovatech Solutions)

L’ERP legacy di Global Foods è basato su **AS/400** e non espone **API moderne** (REST/GraphQL). I meccanismi di integrazione disponibili sono limitati a **estrazioni file** e query su tabelle DB2, con job schedulati nelle finestre notturne. Questo contesto introduce vincoli su **latenza dei dati**, **idempotenza** dei caricamenti e **qualità** (formati eterogenei, codifiche). Per rispettare tali vincoli, propongo di sviluppare un **connettore custom** che esegua **estrazioni batch notturne** (CSV/Parquet), depositi i file in uno **storage sicuro** (es. bucket con versioning e policy di accesso) e attivi una pipeline **ETL** per validazione, normalizzazione (anagrafiche, codici lotti, unità di misura) e caricamento nel SCM.

Il connettore includerà: mapping schemi (ordini, consegne, anagrafiche), controlli di **qualità e completezza**, **checksum** e registrazione tecnica (log/metadata) per audit. La strategia riduce l’impatto sui sistemi transazionali ed è compatibile con i processi esistenti. In Fase 3 valuteremo l’introduzione di un **gateway ODBC** e micro-batch più frequenti per ridurre la latenza, nonché opzioni di **API wrapping** se/quando disponibili sul legacy.
