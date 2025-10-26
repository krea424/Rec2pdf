-- FILE: 20240730_create_workspaces_profiles.sql
-- DESC: Introduces workspace/profile metadata tables with JSON support and updated_at triggers.

set check_function_bodies = off;

create extension if not exists "pgcrypto";

-- Helper function to keep updated_at in sync
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Ensure base tables exist with the expected shape
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  logo_path text,
  projects jsonb not null default '[]'::jsonb,
  default_statuses jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  slug text not null unique default ('profile-' || gen_random_uuid()::text),
  dest_dir text,
  pdf_logo_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- === Workspaces table adjustments ===
alter table if exists public.workspaces
  drop constraint if exists workspaces_owner_id_fkey,
  drop constraint if exists workspaces_slug_key;

create unique index if not exists workspaces_slug_idx on public.workspaces (slug);

alter table if exists public.workspaces
  add constraint workspaces_slug_key unique using index workspaces_slug_idx;

-- Add JSONB columns for projects and default statuses
alter table if exists public.workspaces
  add column if not exists projects jsonb not null default '[]'::jsonb,
  add column if not exists default_statuses jsonb not null default '[]'::jsonb;

-- Backfill null JSON values, if any
update public.workspaces set projects = coalesce(projects, '[]'::jsonb);
update public.workspaces set default_statuses = coalesce(default_statuses, '[]'::jsonb);

-- Refresh updated_at trigger
drop trigger if exists set_updated_at_workspaces on public.workspaces;
create trigger set_updated_at_workspaces
before update on public.workspaces
for each row execute function public.handle_updated_at();

-- === Profiles table adjustments ===
-- Remove legacy Supabase auth FK to allow standalone profile creation
alter table if exists public.profiles
  drop constraint if exists profiles_id_fkey,
  drop constraint if exists profiles_slug_key;

alter table if exists public.profiles
  alter column id set default gen_random_uuid();

-- Add workspace linkage and metadata fields
alter table if exists public.profiles
  add column if not exists workspace_id uuid,
  add column if not exists slug text,
  add column if not exists dest_dir text,
  add column if not exists pdf_logo_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Ensure metadata defaults are populated on existing rows
update public.profiles set metadata = '{}'::jsonb where metadata is null;

-- Generate slugs for existing rows if missing
update public.profiles
set slug = coalesce(slug, ('profile-' || gen_random_uuid()::text));

-- Add NOT NULL constraint to slug after backfill
alter table if exists public.profiles
  alter column slug set default ('profile-' || gen_random_uuid()::text),
  alter column slug set not null;

-- Attach FK to workspaces with cascade delete (if not already present)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_workspace_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_workspace_id_fkey
      foreign key (workspace_id)
      references public.workspaces (id)
      on delete cascade;
  end if;
end;
$$;

-- Create indexes for lookup performance
create unique index if not exists profiles_slug_idx on public.profiles (slug);

alter table if exists public.profiles
  add constraint profiles_slug_key unique using index profiles_slug_idx;
create index if not exists profiles_workspace_id_idx on public.profiles (workspace_id);

-- Refresh updated_at trigger
drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles
before update on public.profiles
for each row execute function public.handle_updated_at();

reset check_function_bodies;
