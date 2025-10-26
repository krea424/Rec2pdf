set check_function_bodies = off;

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  slug text not null unique,
  title text not null,
  summary text,
  description text,
  persona text,
  color text,
  tags jsonb not null default '[]'::jsonb,
  cue_cards jsonb not null default '[]'::jsonb,
  markdown_rules jsonb,
  pdf_rules jsonb,
  checklist jsonb,
  built_in boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

drop trigger if exists set_public_prompts_updated_at on public.prompts;
create trigger set_public_prompts_updated_at
before update on public.prompts
for each row
execute function public.set_current_timestamp_updated_at();

insert into public.prompts as p (
  id,
  legacy_id,
  slug,
  title,
  summary,
  description,
  persona,
  color,
  tags,
  cue_cards,
  markdown_rules,
  pdf_rules,
  checklist,
  built_in
)
values
  (
    uuid_generate_v5(uuid_ns_dns(), 'prompt_brief_creativo'),
    'prompt_brief_creativo',
    'brief_creativo',
    'Brief creativo',
    null,
    'Trasforma un brainstorming di concept in un brief chiaro per team creativi, con obiettivi, insight di audience e deliverable.',
    'Creative strategist',
    '#f472b6',
    jsonb_build_array('marketing', 'concept', 'campagna'),
    jsonb_build_array(
      jsonb_build_object('key', 'hook', 'title', 'Hook narrativo', 'hint', 'Qual è l''idea centrale che vuoi esplorare?'),
      jsonb_build_object('key', 'audience', 'title', 'Audience', 'hint', 'Descrivi il target ideale e il loro bisogno principale.'),
      jsonb_build_object('key', 'promise', 'title', 'Promessa', 'hint', 'Che trasformazione o beneficio vuoi comunicare?'),
      jsonb_build_object('key', 'proof', 'title', 'Proof point', 'hint', 'Cita esempi, dati o insight a supporto.')
    ),
    jsonb_build_object(
      'tone', 'Ispirazionale ma concreto, con verbi d''azione e payoff sintetici.',
      'voice', 'Seconda persona plurale, orientata al team.',
      'bulletStyle', 'Elenchi brevi con keyword evidenziate in **grassetto**.',
      'includeCallouts', true,
      'summaryStyle', 'Executive summary iniziale con tre bullet'
    ),
    jsonb_build_object(
      'accentColor', '#f472b6',
      'layout', 'bold',
      'includeCover', true,
      'includeToc', false
    ),
    jsonb_build_object(
      'sections', jsonb_build_array(
        'Executive summary',
        'Obiettivi della campagna',
        'Insight audience',
        'Tone of voice',
        'Deliverable e call-to-action'
      )
    ),
    true
  ),
  (
    uuid_generate_v5(uuid_ns_dns(), 'prompt_business_case'),
    'prompt_business_case',
    'business_case',
    'Business case',
    null,
    'Guida il ragionamento verso un business case strutturato: contesto, opportunità, analisi economica e piano d''azione.',
    'Business analyst',
    '#38bdf8',
    jsonb_build_array('strategy', 'analisi', 'finance'),
    jsonb_build_array(
      jsonb_build_object('key', 'scenario', 'title', 'Scenario', 'hint', 'Qual è il contesto competitivo e qual è la tensione principale?'),
      jsonb_build_object('key', 'value', 'title', 'Valore', 'hint', 'Quantifica benefici, risparmi o opportunità.'),
      jsonb_build_object('key', 'risks', 'title', 'Rischi', 'hint', 'Evidenzia rischi, mitigazioni e assunzioni critiche.'),
      jsonb_build_object('key', 'roadmap', 'title', 'Roadmap', 'hint', 'Descrivi le fasi operative e i responsabili.')
    ),
    jsonb_build_object(
      'tone', 'Professionale, sintetico e orientato ai numeri.',
      'voice', 'Prima persona plurale per coinvolgere stakeholder.',
      'bulletStyle', 'Liste puntate con metriche e KPI.',
      'includeCallouts', true,
      'summaryStyle', 'Sintesi in apertura con raccomandazione chiave.'
    ),
    jsonb_build_object(
      'accentColor', '#38bdf8',
      'layout', 'consulting',
      'includeCover', true,
      'includeToc', true
    ),
    jsonb_build_object(
      'sections', jsonb_build_array(
        'Executive summary',
        'Analisi del problema',
        'Opzioni valutate',
        'Impatto economico',
        'Piano di implementazione'
      )
    ),
    true
  ),
  (
    uuid_generate_v5(uuid_ns_dns(), 'prompt_meeting_minutes'),
    'prompt_meeting_minutes',
    'verbale_meeting',
    'Verbale riunione executive',
    'Genera verbali completi e azionabili a partire da trascrizioni di meeting.',
    'Trasforma la trascrizione di una riunione in un verbale pronto per il template HTML meeting. Apri il documento con un front matter YAML che imposti `pdfRules.layout: verbale_meeting` (o il campo `layout`) e opzionalmente `styles.css: Templates/verbale_meeting.css`. Il front matter deve includere tre array obbligatori: `action_items` (oggetti con description, assignee.name, assignee.role, due_date), `key_points` (voci sintetiche) e `transcript` (blocchi con speaker, role, timestamp, paragraphs). Struttura il corpo usando le sezioni esatte: ''Riepilogo esecutivo'', ''Decisioni e approvazioni'', ''Azioni assegnate'', ''Punti chiave'', ''Trascrizione integrale'' e chiudi con eventuali allegati o note operative.',
    'Chief of Staff',
    '#f97316',
    jsonb_build_array('meeting', 'verbale', 'operations'),
    jsonb_build_array(
      jsonb_build_object('key', 'context', 'title', 'Contesto', 'hint', 'Qual era lo scopo della riunione e quali team erano coinvolti?'),
      jsonb_build_object('key', 'decisions', 'title', 'Decisioni', 'hint', 'Quali decisioni o approvazioni sono state prese e da chi?'),
      jsonb_build_object('key', 'actions', 'title', 'Azioni', 'hint', 'Elenca le attività con owner, ruolo e scadenza stimata.'),
      jsonb_build_object('key', 'risks', 'title', 'Criticità', 'hint', 'Segnala blocchi, rischi aperti o richieste di follow-up.'),
      jsonb_build_object('key', 'transcript', 'title', 'Trascrizione', 'hint', 'Evidenzia passaggi chiave da riportare nel blocco transcript.')
    ),
    jsonb_build_object(
      'tone', 'Professionale e sintetico, orientato al follow-up.',
      'voice', 'Terza persona con riferimenti ai ruoli aziendali.',
      'bulletStyle', 'Liste numerate per decisioni e puntate per punti chiave.',
      'includeCallouts', true,
      'summaryStyle', 'Tabella o elenco iniziale con data, durata e partecipanti.'
    ),
    jsonb_build_object(
      'accentColor', '#f97316',
      'layout', 'verbale_meeting',
      'template', 'verbale_meeting.html',
      'includeCover', false,
      'includeToc', false
    ),
    jsonb_build_object(
      'sections', jsonb_build_array(
        'Riepilogo esecutivo',
        'Decisioni e approvazioni',
        'Azioni assegnate',
        'Punti chiave',
        'Trascrizione integrale'
      )
    ),
    true
  ),
  (
    uuid_generate_v5(uuid_ns_dns(), 'prompt_format_base'),
    'prompt_format_base',
    'format_base',
    'Format base',
    'Trasforma gli appunti in un documento Markdown professionale.',
    'Trasforma gli appunti in un documento Markdown professionale. La struttura del documento DEVE includere sezioni con i titoli esatti: ''Introduzione'', ''Punti Chiave'', ''Analisi Dettagliata'', ''Prossime Azioni''. Inserisci almeno una tabella con un massimo di 4 colonne e una tabella dei 3 principali rischi. NON usare backticks di codice per l''intero blocco di codice.',
    'Senior consultant',
    '#00FF00',
    jsonb_build_array('test', 'beta'),
    jsonb_build_array(
      jsonb_build_object('key', 'scenario', 'title', 'Scenario', 'hint', 'Qual è il contesto competitivo e qual è la tensione principale?'),
      jsonb_build_object('key', 'value', 'title', 'Valore', 'hint', 'Quantifica benefici, risparmi o opportunità.'),
      jsonb_build_object('key', 'risks', 'title', 'Rischi', 'hint', 'Evidenzia rischi, mitigazioni e assunzioni critiche.'),
      jsonb_build_object('key', 'roadmap', 'title', 'Roadmap', 'hint', 'Descrivi le fasi operative e i responsabili.')
    ),
    null,
    jsonb_build_object(
      'accentColor', '#38bdf8',
      'layout', 'consulting',
      'includeCover', true,
      'includeToc', true
    ),
    jsonb_build_object(
      'sections', jsonb_build_array(
        'Executive Summary',
        'Punti Chiave',
        'Analisi Dettagliata',
        'Prossime Azioni'
      )
    ),
    true
  ),
  (
    uuid_generate_v5(uuid_ns_dns(), 'prompt_post_mortem'),
    'prompt_post_mortem',
    'post_mortem',
    'Post-mortem & retrospettiva',
    null,
    'Racconta lezioni apprese, metriche e azioni correttive dopo un progetto o sprint, con tono costruttivo.',
    'Project manager',
    '#facc15',
    jsonb_build_array('retrospettiva', 'continuous improvement'),
    jsonb_build_array(
      jsonb_build_object('key', 'success', 'title', 'Successi', 'hint', 'Quali risultati hanno funzionato particolarmente bene?'),
      jsonb_build_object('key', 'metrics', 'title', 'Metriche', 'hint', 'Condividi indicatori e outcome misurabili.'),
      jsonb_build_object('key', 'lessons', 'title', 'Lezioni', 'hint', 'Quali pattern negativi hai osservato e come evitarli?'),
      jsonb_build_object('key', 'actions', 'title', 'Azioni', 'hint', 'Proponi next step, owner e tempistiche.')
    ),
    jsonb_build_object(
      'tone', 'Onesto ma orientato al miglioramento continuo.',
      'voice', 'Prima persona plurale, tono collaborativo.',
      'bulletStyle', 'Liste con emoji/simboli per evidenziare + e −.',
      'includeCallouts', false,
      'summaryStyle', 'Tabella iniziale con KPI e stato'
    ),
    jsonb_build_object(
      'accentColor', '#facc15',
      'layout', 'workshop',
      'includeCover', false,
      'includeToc', false
    ),
    jsonb_build_object(
      'sections', jsonb_build_array(
        'Contesto e obiettivi',
        'Metriche principali',
        'Cosa è andato bene',
        'Cosa migliorare',
        'Piano di azione'
      )
    ),
    true
  )
on conflict (slug) do update set
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

reset check_function_bodies;
