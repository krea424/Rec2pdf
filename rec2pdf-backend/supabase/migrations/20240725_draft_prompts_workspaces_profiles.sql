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
    
reset check_function_bodies;