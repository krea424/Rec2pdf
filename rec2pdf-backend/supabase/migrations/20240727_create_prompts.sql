-- FILE: 20240727_create_prompts.sql
-- DESC: Seeds the prompts table with ALL default data. (CORRECTED & COMPLETE)

INSERT INTO public.prompts (legacy_id, slug, title, summary, description, persona, color, tags, cue_cards, markdown_rules, pdf_rules, checklist, built_in)
VALUES
    (
        'prompt_brief_creativo', 'brief_creativo', 'Brief creativo',
        'Trasforma un brainstorming di concept in un brief chiaro per team creativi.',
        'Trasforma un brainstorming di concept in un brief chiaro per team creativi, con obiettivi, insight di audience e deliverable.',
        'Creative strategist', '#f472b6', '["marketing", "concept", "campagna"]'::jsonb,
        '[{"key": "hook", "title": "Hook narrativo", "hint": "Qual è l''idea centrale che vuoi esplorare?"}, {"key": "audience", "title": "Audience", "hint": "Descrivi il target ideale e il loro bisogno principale."}, {"key": "promise", "title": "Promessa", "hint": "Che trasformazione o beneficio vuoi comunicare?"}, {"key": "proof", "title": "Proof point", "hint": "Cita esempi, dati o insight a supporto."}]'::jsonb,
        '{"tone": "Ispirazionale ma concreto, con verbi d''azione e payoff sintetici.", "voice": "Seconda persona plurale, orientata al team.", "bulletStyle": "Elenchi brevi con keyword evidenziate in **grassetto**.", "includeCallouts": true, "summaryStyle": "Executive summary iniziale con tre bullet"}'::jsonb,
        '{"accentColor": "#f472b6", "layout": "bold", "includeCover": true, "includeToc": false}'::jsonb,
        '{"sections": ["Executive summary", "Obiettivi della campagna", "Insight audience", "Tone of voice", "Deliverable e call-to-action"]}'::jsonb,
        true
    ),
    (
        'prompt_business_case', 'business_case', 'Business case',
        'Guida il ragionamento verso un business case strutturato.',
        'Guida il ragionamento verso un business case strutturato: contesto, opportunità, analisi economica e piano d''azione.',
        'Business analyst', '#38bdf8', '["strategy", "analisi", "finance"]'::jsonb,
        '[{"key": "scenario", "title": "Scenario", "hint": "Qual è il contesto competitivo e qual è la tensione principale?"}, {"key": "value", "title": "Valore", "hint": "Quantifica benefici, risparmi o opportunità."}, {"key": "risks", "title": "Rischi", "hint": "Evidenzia rischi, mitigazioni e assunzioni critiche."}, {"key": "roadmap", "title": "Roadmap", "hint": "Descrivi le fasi operative e i responsabili."}]'::jsonb,
        '{"tone": "Professionale, sintetico e orientato ai numeri.", "voice": "Prima persona plurale per coinvolgere stakeholder.", "bulletStyle": "Liste puntate con metriche e KPI.", "includeCallouts": true, "summaryStyle": "Sintesi in apertura con raccomandazione chiave."}'::jsonb,
        '{"accentColor": "#38bdf8", "layout": "consulting", "includeCover": true, "includeToc": true}'::jsonb,
        '{"sections": ["Executive summary", "Analisi del problema", "Opzioni valutate", "Impatto economico", "Piano di implementazione"]}'::jsonb,
        true
    ),
    (
        'prompt_meeting_minutes', 'verbale_meeting', 'Verbale riunione executive',
        'Genera verbali completi e azionabili a partire da trascrizioni di meeting.',
        'Trasforma la trascrizione di una riunione in un verbale pronto per il template HTML meeting...',
        'Chief of Staff', '#f97316', '["meeting", "verbale", "operations"]'::jsonb,
        '[{"key": "context", "title": "Contesto", "hint": "Qual era lo scopo della riunione...?"}, {"key": "decisions", "title": "Decisioni", "hint": "Quali decisioni...?"}, {"key": "actions", "title": "Azioni", "hint": "Elenca le attività..."}, {"key": "risks", "title": "Criticità", "hint": "Segnala blocchi..."}, {"key": "transcript", "title": "Trascrizione", "hint": "Evidenzia passaggi chiave..."}]'::jsonb,
        '{"tone": "Professionale e sintetico...", "voice": "Terza persona...", "bulletStyle": "Liste numerate...", "includeCallouts": true, "summaryStyle": "Tabella o elenco iniziale..."}'::jsonb,
        '{"accentColor": "#f97316", "layout": "verbale_meeting", "template": "verbale_meeting.html", "includeCover": false, "includeToc": false}'::jsonb,
        '{"sections": ["Riepilogo esecutivo", "Decisioni e approvazioni", "Azioni assegnate", "Punti chiave", "Trascrizione integrale"]}'::jsonb,
        true
    ),
    (
        'prompt_format_base', 'format_base', 'Format base',
        'Trasforma gli appunti in un documento Markdown professionale.',
        'Trasforma gli appunti in un documento Markdown professionale...',
        'Senior consultant', '#00FF00', '["test", "beta"]'::jsonb,
        '[{"key": "scenario", "title": "Scenario", "hint": "..."}, {"key": "value", "title": "Valore", "hint": "..."}, {"key": "risks", "title": "Rischi", "hint": "..."}, {"key": "roadmap", "title": "Roadmap", "hint": "..."}]'::jsonb,
        null,
        '{"accentColor": "#38bdf8", "layout": "consulting", "includeCover": true, "includeToc": true}'::jsonb,
        '{"sections": ["Executive Summary", "Punti Chiave", "Analisi Dettagliata", "Prossime Azioni"]}'::jsonb,
        true
    ),
    (
        'prompt_post_mortem', 'post_mortem', 'Post-mortem & retrospettiva',
        'Racconta lezioni apprese, metriche e azioni correttive dopo un progetto o sprint.',
        'Racconta lezioni apprese, metriche e azioni correttive dopo un progetto o sprint, con tono costruttivo.',
        'Project manager', '#facc15', '["retrospettiva", "continuous improvement"]'::jsonb,
        '[{"key": "success", "title": "Successi", "hint": "..."}, {"key": "metrics", "title": "Metriche", "hint": "..."}, {"key": "lessons", "title": "Lezioni", "hint": "..."}, {"key": "actions", "title": "Azioni", "hint": "..."}]'::jsonb,
        '{"tone": "Onesto ma orientato al miglioramento...", "voice": "Prima persona plurale...", "bulletStyle": "Liste con emoji...", "includeCallouts": false, "summaryStyle": "Tabella iniziale con KPI..."}'::jsonb,
        '{"accentColor": "#facc15", "layout": "workshop", "includeCover": false, "includeToc": false}'::jsonb,
        '{"sections": ["Contesto e obiettivi", "Metriche principali", "Cosa è andato bene", "Cosa migliorare", "Piano di azione"]}'::jsonb,
        true
    )
ON CONFLICT (slug) DO UPDATE SET
    legacy_id = excluded.legacy_id,
    title = excluded.title,
    summary = excluded.summary,
    description = excluded.description,
    persona = excluded.persona,
    color = excluded.color,
    tags = excluded.tags,
    cue_cards = excluded.cue_cards,
    markdown_rules = excluded.markdown_rules,
    pdf_rules = excluded.pdf_rules,
    checklist = excluded.checklist,
    built_in = excluded.built_in;