-- FILE: 20240725_draft_prompts_workspaces_profiles.sql
-- DESC: Creates foundational tables (profiles, workspaces, prompts) and RLS policies.

set check_function_bodies = off;

-- === Estensioni necessarie (vengono create qui per sicurezza) ===
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- === Definizione Tabelle ===
create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text,
    email text unique,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles (id) on delete cascade,
    slug text not null unique,
    name text not null,
    description text,
    logo_path text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  workspace_id uuid references public.workspaces (id) on delete cascade,
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

-- === Abilitazione RLS ===
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.prompts enable row level security;

-- === Policy di Sicurezza ===
DROP POLICY IF EXISTS "Profiles are self-managed" ON public.profiles;
CREATE POLICY "Profiles are self-managed" ON public.profiles
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Workspace owners full access" ON public.workspaces;
CREATE POLICY "Workspace owners full access" ON public.workspaces
    FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
    
DROP POLICY IF EXISTS "Workspace owners manage prompts" ON public.prompts;
CREATE POLICY "Workspace owners manage prompts" ON public.prompts
    FOR ALL USING (auth.uid() = (select w.owner_id from public.workspaces w where w.id = prompts.workspace_id))
    WITH CHECK (auth.uid() = (select w.owner_id from public.workspaces w where w.id = prompts.workspace_id));

-- === Indici per performance ===
create index if not exists workspaces_slug_idx on public.workspaces (slug);
create index if not exists prompts_slug_idx on public.prompts (slug);
create index if not exists prompts_workspace_id_idx on public.prompts (workspace_id);

-- === Funzione e Trigger per updated_at ===
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_profiles_update on public.profiles;
create trigger on_profiles_update before update on public.profiles for each row execute function public.handle_updated_at();

drop trigger if exists on_workspaces_update on public.workspaces;
create trigger on_workspaces_update before update on public.workspaces for each row execute function public.handle_updated_at();

drop trigger if exists on_prompts_update on public.prompts;
create trigger on_prompts_update before update on public.prompts for each row execute function public.handle_updated_at();

-- === Storage bucket (non era in questo file ma lo aggiungiamo per completezza) ===
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'logos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES ('logos', 'logos', false, 5242880);
    RAISE NOTICE 'Bucket "logos" created.';
  ELSE
    RAISE NOTICE 'Bucket "logos" already exists.';
  END IF;
END $$;    
-- === Seed dei dati di default per i prompts ===
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
  -- ... INCOLLA QUI GLI ALTRI 4 BLOCCHI DI DATI DEI PROMPT ...
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
reset check_function_bodies;