-- DRAFT: foundational multi-tenant structures for prompts, workspaces and profiles
-- NOTE: This is a preliminary proposal meant for review before execution in shared environments.

set check_function_bodies = off;

-- === Table definitions ===
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
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    title text not null,
    body text not null,
    is_default boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (workspace_id, title)
);

-- === Storage bucket (logos) ===
select
    case
        when exists(select 1 from storage.buckets where id = 'logos') then
            'bucket logos already present'
        else
            storage.create_bucket('logos', jsonb_build_object('public', false, 'file_size_limit', 5242880))
    end as logos_bucket_status;

-- === RLS enablement ===
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.prompts enable row level security;

-- Profiles: users can manage their own profile document.
create policy if not exists "Profiles are self-managed" on public.profiles
    for all using (auth.uid() = id)
    with check (auth.uid() = id);

-- Workspaces: only owners can see or mutate their workspaces for now.
create policy if not exists "Workspace owners full access" on public.workspaces
    for all using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

-- Prompts: ownership derived from workspace relation.
create policy if not exists "Workspace owners manage prompts" on public.prompts
    for all using (
        auth.uid() = (
            select w.owner_id from public.workspaces w where w.id = public.prompts.workspace_id
        )
    )
    with check (
        auth.uid() = (
            select w.owner_id from public.workspaces w where w.id = public.prompts.workspace_id
        )
    );

-- Service role bypasses RLS via Supabase; keep this reminder for reviewers.
comment on table public.profiles is 'Draft tenant profile registry. Service role bypasses RLS; reviewers must vet before release.';
comment on table public.workspaces is 'Draft workspace catalog managed by owners. Review collaborative policies before production.';
comment on table public.prompts is 'Draft workspace prompt definitions. Extend policies when collaborators are introduced.';

reset check_function_bodies;
