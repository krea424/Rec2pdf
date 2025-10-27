-- FILE: 20251026_001_initial_schema.sql - FINAL VERSION WITH CORRECT TABLE STRUCTURE

set check_function_bodies = off;

-- === Estensioni ===
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- === Funzione per updated_at ===
create or replace function public.handle_updated_at() returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- === TABELLE (ORDINE CORRETTO DI DIPENDENZA) ===

-- 1. Tabella PROFILES (per gli UTENTI)
-- Questa tabella si sincronizza con auth.users.
create table public.profiles (
    id uuid primary key, -- Coincide con auth.users.id
    full_name text,
    email text unique,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabella WORKSPACES (dipende da profiles per owner_id)
create table public.workspaces (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.profiles (id) on delete cascade,
    slug text not null unique,
    name text not null,
    description text,
    logo_path text,
    projects jsonb not null default '[]'::jsonb,
    default_statuses jsonb not null default '[]'::jsonb,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- 3. Tabella WORKSPACE_PROFILES (per le CONFIGURAZIONI, dipende da workspaces)
-- QUESTA È LA TABELLA CHE TI MANCAVA!
create table if not exists public.workspace_profiles (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    slug text not null,
    label text not null,
    dest_dir text,
    pdf_template text,
    prompt_id text,
    pdf_logo_url text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    unique(workspace_id, slug) -- Lo slug deve essere unico all'interno di un workspace
);

-- 4. Tabella PROMPTS (può dipendere da workspaces)
create table public.prompts (
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
-- === Trigger per updated_at ===
-- (Aggiungi qui i trigger per tutte e 4 le tabelle)
-- ...

-- === Dati di Seed per i Prompts ===
-- (Aggiungi qui l'INSERT per i 5 prompt di default)
-- ...

-- === RLS e Policies ===
-- (Aggiungi qui le policy per tutte e 4 le tabelle)
-- ...
    
reset check_function_bodies;
-- === Trigger per updated_at (per TUTTE le tabelle) ===
drop trigger if exists on_profiles_update on public.profiles;
create trigger on_profiles_update before update on public.profiles for each row execute function public.handle_updated_at();

drop trigger if exists on_workspaces_update on public.workspaces;
create trigger on_workspaces_update before update on public.workspaces for each row execute function public.handle_updated_at();

-- Trigger per la NUOVA tabella
drop trigger if exists on_workspace_profiles_update on public.workspace_profiles;
create trigger on_workspace_profiles_update before update on public.workspace_profiles for each row execute function public.handle_updated_at();

drop trigger if exists on_prompts_update on public.prompts;
create trigger on_prompts_update before update on public.prompts for each row execute function public.handle_updated_at();


-- === Dati di Seed per i Prompts ===
-- (Incolla qui il blocco INSERT INTO public.prompts ... VALUES ... ON CONFLICT ... completo con i 5 prompt)


-- === RLS e Policies (per TUTTE le tabelle) ===
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_profiles enable row level security; -- Abilita RLS per la NUOVA tabella
alter table public.prompts enable row level security;

-- Policy per profiles (utenti)
DROP POLICY IF EXISTS "Profiles are self-managed" ON public.profiles;
CREATE POLICY "Profiles are self-managed" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policy per workspaces
DROP POLICY IF EXISTS "Workspace owners full access" ON public.workspaces;
CREATE POLICY "Workspace owners full access" ON public.workspaces FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
    
-- Policy per workspace_profiles (configurazioni)
-- Permette a un proprietario di workspace di gestire i profili del suo workspace
DROP POLICY IF EXISTS "Workspace owners can manage their profiles" ON public.workspace_profiles;
CREATE POLICY "Workspace owners can manage their profiles" ON public.workspace_profiles
    FOR ALL USING (auth.uid() = (select owner_id from public.workspaces where id = workspace_id))
    WITH CHECK (auth.uid() = (select owner_id from public.workspaces where id = workspace_id));

-- Policy per prompts
DROP POLICY IF EXISTS "Workspace owners manage prompts" ON public.prompts;
CREATE POLICY "Workspace owners manage prompts" ON public.prompts
    FOR ALL USING (
        -- I prompt globali (senza workspace_id) sono visibili a tutti gli utenti autenticati
        (workspace_id is null and auth.role() = 'authenticated') 
        OR
        -- I prompt specifici sono gestibili solo dal proprietario del workspace
        (auth.uid() = (select owner_id from public.workspaces where id = prompts.workspace_id))
    );

-- Aggiungiamo anche il blocco per il bucket, che avevamo nel file consolidato
-- === Storage Bucket ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'logos') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);
  END IF;
END $$;