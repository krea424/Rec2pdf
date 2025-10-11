# Accessibility Checklist

| Area | Stato | Note |
| --- | --- | --- |
| Semantica titoli | ⚠️ | `Create` usa molte `<div>` per sezioni principali; valutare `section`/`h2` per struttura (vedi `src/pages/Create.jsx`). |
| Pulsanti icon-only | ⚠️ | Alcuni `IconButton` hanno label ARIA corretta, altri (es. pulsanti `Sparkles` in WorkspaceNavigator) affidano significato al testo interno; verificare focus order e descrizioni. |
| Contrasto | ✅ | Tema boardroom utilizza gradienti e testo chiaro; verificare contrasto di badge con `text-indigo-200` su sfondo `bg-indigo-500/10`. |
| Focus visibile | ✅/⚠️ | Molti CTA hanno `focus-visible:ring`; alcuni link (badge filtri salvati) sono `<button>` senza stile focus evidente. |
| Tastiera | ⚠️ | Liste scrollabili (WorkspaceNavigator) gestite via `<button>`: ok per attivazione, ma mancano scorciatoie per cambiare pannelli (es. collapse). |
| ARIA Live | ⚠️ | Log pipeline presentati come testo statico; valutare `aria-live` per aggiornamenti dinamici. |
| Audio Player | ✅ | `<audio>` nativo gestisce accessibilità; aggiungere `aria-label` descrittivo potrebbe aiutare screen reader. |
| Form field | ⚠️ | Alcuni input (es. workspace builder) privi di `id/for`; label visive ma non programmatiche. |
