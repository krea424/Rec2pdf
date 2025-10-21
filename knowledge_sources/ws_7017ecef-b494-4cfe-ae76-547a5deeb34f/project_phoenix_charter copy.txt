---
title: "Project Phoenix: Project Charter"
project: "Project Phoenix"
company: "Innovatech Solutions"
client: "Global Foods Inc."
author: "Mario Rossi (Project Manager)"
version: "v1.0"
date: 2025-10-05
id: "phoenix-charter-20251005-it"
tags: [charter, project-phoenix, innovatech-solutions, global-foods, supply-chain, scm, erp-legacy, governance]
---

# Project Phoenix: Project Charter

**Azienda:** Innovatech Solutions  
**Cliente:** Global Foods Inc.  
**Progetto:** Project Phoenix — Digitalizzazione della catena di approvvigionamento

## Executive Summary
Project Phoenix mira a digitalizzare la supply chain di Global Foods Inc. integrando l’ERP legacy (AS/400) con un nuovo sistema di Supply Chain Management (SCM) cloud-based. L’iniziativa prevede un pilota rapido su due stabilimenti, la messa a disposizione di dashboard KPI in tempo quasi reale e l’attivazione di un portale fornitori. Il vincolo principale è l’integrazione con un ERP privo di API moderne; per questo verrà realizzato un connettore custom basato su estrazioni batch notturne. Il successo sarà misurato con riduzione dei costi logistici, miglioramento dell’OTIF e maggiore tracciabilità.

## Obiettivi di Business
- **Ridurre i costi di logistica del 15%** entro il Q4 2026.
- **Aumentare l’OTIF (On-Time In-Full) dal 86% al 95%** entro il Q2 2026.
- **Ridurre i lead time di approvvigionamento del 25%** entro il Q3 2026.
- **Incrementare la tracciabilità lotti al 100%** per i prodotti EU-bound entro il Q2 2026.

## Scope del Progetto
**Inclusi:**
- Disegno e implementazione di un **SCM cloud** con dashboard KPI (OTIF, lead time, fill-rate, stockout).
- **Integrazione con ERP legacy** tramite connettore custom (estrazioni batch notturne + job di ingest ETL).
- **Portale fornitori** per conferme d’ordine, ASN, tracking spedizioni e gestione non conformità.
- **Pilota** su due stabilimenti italiani (Milano, Parma) e 20 fornitori core.

**Esclusi:**
- Replatforming completo dell’**ERP legacy**.
- Sostituzione dell’hardware di magazzino e dei WMS locali.
- Roll-out globale extra-EU nella prima ondata.
- Reingegnerizzazioni di processi non attinenti alla supply chain.

## Stakeholder Principali
- **Mario Rossi** — Project Manager, Innovatech Solutions.
- **Giulia Bianchi** — Lead Developer, Innovatech Solutions.
- **Luca Verdi** — Business Analyst, Innovatech Solutions.
- **Sofia Neri** — Product Owner / Cliente, Global Foods Inc.

## Timeline di Massima
- **Fase 1: Analisi & Solution Design** — **Ottobre 2025**.
- **Fase 2: Sviluppo & Pilota (Milano, Parma)** — **Novembre 2025 – Gennaio 2026**.
- **Fase 3: Roll-out EU & Stabilizzazione** — **Febbraio 2026 – Aprile 2026**.

## Rischi Identificati
| Rischio | Impatto | Mitigazione |
|---|---|---|
| Integrazione con ERP legacy (assenza API) | Ritardi su flussi dati critici | Connettore custom con estrazioni batch notturne; sandbox e test end-to-end anticipati |
| Qualità e coerenza dei dati fornitori | KPI inattendibili, errori nei piani | Data cleansing iniziale; data contract con fornitori; controlli di qualità automatici |
| Resistenza al cambiamento operativo | Adozione lenta del portale | Piano di change management; formazione ruolo-based; quick wins nel pilota |
