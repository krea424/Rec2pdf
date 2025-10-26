-- FILE: 20240801_add_metadata_to_workspaces.sql
-- DESC: Adds a metadata column to workspaces for storing color/client/versioning information.

alter table if exists public.workspaces
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.workspaces
set metadata = coalesce(metadata, '{}'::jsonb);

create index if not exists workspaces_metadata_idx
  on public.workspaces using gin (metadata);
