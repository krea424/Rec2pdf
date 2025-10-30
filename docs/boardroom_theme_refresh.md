# Boardroom Theme Refresh · Handoff 2025

Questa nota documenta l’aggiornamento palette/typography/spacing del tema “boardroom”, i nuovi pattern di card e step indicator, le micro-interazioni e i controlli di accessibilità necessari per l’implementazione 2025.

## 1. Design token aggiornati

| Token | Descrizione | Valori Tailwind |
| --- | --- | --- |
| Spacing frazionari | Estendono il ritmo verticale executive | `3.25`, `4.5`, `5.5`, `7.5`, `13`, `15`, `17`, `18`, `22`, `25`, `26`, `30` (`px-*`, `py-*`, `gap-*`).【F:rec2pdf-frontend/tailwind.config.js†L6-L26】【F:rec2pdf-frontend/src/pages/Create.jsx†L344-L470】 |
| Typography | Display con Space Grotesk, body con Inter var | `font-display`/`font-sans` mappate sulle nuove famiglie; import da Google Fonts in `index.css`.【F:rec2pdf-frontend/tailwind.config.js†L27-L48】【F:rec2pdf-frontend/src/index.css†L1-L58】 |
| Palette boardroom | Gradiente ocean→teal→violet + surfaces traslucide | `colors.boardroom.*` (`ocean`, `abyss`, `midnight`, `cobalt`, `teal`, `mint`, `violet`) e nuove scale `surface`/`brand`/`accent`.【F:rec2pdf-frontend/tailwind.config.js†L29-L74】 |
| Shadow | Ombre profonde per superfici executive | Pattern di shadow nelle costanti e in `Create.jsx` (es. `shadow-[0_45px_120px_-60px_rgba(4,20,44,0.95)]`).【F:rec2pdf-frontend/tailwind.config.js†L20-L24】【F:rec2pdf-frontend/src/pages/Create.jsx†L208-L229】 |

## 2. Pattern componenti

- **Card hero e metriche**: usare `rounded-3xl/4xl`, superfici `boardroomPrimarySurface`/`boardroomSecondarySurface` e label uppercase con `labelToneClass`. Hover uniformi: `hover:border-brand-300/50` + `shadow-[0_26px_70px_-45px_rgba(31,139,255,0.6)]`.【F:rec2pdf-frontend/src/pages/Create.jsx†L332-L470】
- **Step indicator pipeline**: layout `pl-12` con connector animato `boardroom-connector-progress`, stage pill `rounded-3xl border px-5 py-4` e icona `h-4`. Status pill uppercase `px-2.5 py-1` con `font-display`. Messaggi di stato usano `boardroomStageMessageSurface` (`rounded-2xl border px-4 py-3`).【F:rec2pdf-frontend/src/pages/Create.jsx†L1478-L1645】
- **CTA primarie**: `themes.boardroom.button` fornisce gradiente brand→teal→violet, hover lift `hover:-translate-y-0.5` e ring `focus-visible:ring-brand-200/60`. Applicare a tutte le azioni principali in modalità advanced.【F:rec2pdf-frontend/src/App.jsx†L812-L832】
- **Prompt Library**: superfici `border-white/16 bg-white/[0.05] backdrop-blur-2xl` con controlli `boardroomControlIdle`/`boardroomControlActive` e shadow progressiva per stati attivi.【F:rec2pdf-frontend/src/components/PromptLibrary.jsx†L20-L28】

## 3. Micro-interazioni e motion

- **Progress bar**: `animate-boardroom-progress` crea scorrimento diagonale continuo sul gradiente brand→teal→violet (durata 2.4s ease-in-out).【F:rec2pdf-frontend/src/index.css†L9-L39】【F:rec2pdf-frontend/src/pages/Create.jsx†L408-L420】
- **Connector pipeline**: classe `boardroom-connector-progress` applicata quando lo stage precedente è `running`, con animazione verticale di 1.8s e gradiente teal/mint/violet.【F:rec2pdf-frontend/src/index.css†L41-L56】【F:rec2pdf-frontend/src/pages/Create.jsx†L1497-L1535】
- **Hover CTA**: il gradiente principale include `transition-all duration-300` e `hover:-translate-y-0.5`, con focus ring coerente e shadow profonda per comunicare affordance.【F:rec2pdf-frontend/src/App.jsx†L812-L832】

## 4. Contrasto e accessibilità

| Combinazione | Rapporto | Note |
| --- | --- | --- |
| `text-slate-100` su sfondo `#10345a` (`boardroom` pending) | 11.54:1 | >= AA testo normale.【cfc38c†L24-L28】【F:rec2pdf-frontend/src/pages/Create.jsx†L209-L221】 |
| Sfondo primario `#0b1a33` con testo `surface.50` | 15.84:1 | >= AAA testi grandi, usato per copy hero.【cfc38c†L24-L28】【F:rec2pdf-frontend/src/App.jsx†L812-L832】 |
| CTA `brand-500` su `#020b1a` | 5.82:1 | >= AA testo normale.【cfc38c†L24-L28】【F:rec2pdf-frontend/src/App.jsx†L812-L832】 |
| Badge teal `#5ce1d9` su log panel `#071a33` | 10.98:1 | >= AA large icons/testo.【cfc38c†L24-L28】【F:rec2pdf-frontend/src/index.css†L24-L58】 |

Focus ring: mantenere `focus-visible:ring-2` + offset 0 su CTA e stage pill; `Button` base aggiunge offset di sicurezza per varianti generiche.【F:rec2pdf-frontend/src/components/ui/Button.jsx†L5-L66】

## 5. Handoff per sviluppo

1. **Aggiorna layout**: applica i nuovi token a tutte le superfici advanced (`Create.jsx`, `PromptLibrary.jsx`, `AppShell`) seguendo le classi documentate sopra.
2. **Motion**: abilita le classi `animate-boardroom-progress` e `boardroom-connector-progress` solo quando `theme === 'boardroom'` per evitare regressioni negli altri temi.【F:rec2pdf-frontend/src/pages/Create.jsx†L1497-L1535】
3. **Tipografia**: verifica che i container principali includano `font-display` per heading e `font-sans` di default nel `body` (già impostato in `index.css`).【F:rec2pdf-frontend/src/index.css†L1-L58】
4. **QA**: riesegui il controllo contrasti con gli accoppiamenti tabellati e valida focus ring su CTA e step indicator; aggiornare screenshot QA se la view advanced è documentata.
