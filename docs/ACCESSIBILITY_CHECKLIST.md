# Accessibility Checklist

| Area | Stato | Note |
| --- | --- | --- |
| Semantica titoli | ⚠️ | `Create` usa molte `<div>` per sezioni principali; valutare `section`/`h2` per struttura (vedi `src/pages/Create.jsx`). |
| Pulsanti icon-only | ⚠️ | Alcuni `IconButton` hanno label ARIA corretta, altri (es. pulsanti `Sparkles` in WorkspaceNavigator) affidano significato al testo interno; verificare focus order e descrizioni. |
| Contrasto | ✅ | Tema boardroom utilizza gradienti e testo chiaro; verificare contrasto di badge con `text-indigo-200` su sfondo `bg-indigo-500/10`. |
| Focus visibile | ✅/⚠️ | CTA principali e i controlli di WorkspaceNavigator ora usano `focus-visible` coerente; restano da verificare badge meno usati. |
| Tastiera | ⚠️ | Liste scrollabili (WorkspaceNavigator) gestite via `<button>`: ok per attivazione, ma mancano scorciatoie per cambiare pannelli (es. collapse). |
| ARIA Live | ✅/⚠️ | I log della pipeline usano ora `role="status"`/`aria-live="polite"`; valutare eventuali annunci per altre notifiche dinamiche. |
| Audio Player | ✅ | `<audio>` nativo gestisce accessibilità; aggiungere `aria-label` descrittivo potrebbe aiutare screen reader. |
| Form field | ⚠️ | Alcuni input (es. workspace builder) privi di `id/for`; label visive ma non programmatiche. |
