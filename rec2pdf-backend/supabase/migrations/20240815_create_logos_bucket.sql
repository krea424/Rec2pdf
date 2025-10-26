insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public access for logos'
  ) then
    create policy "Public access for logos"
      on storage.objects
      for select
      using (bucket_id = 'logos');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Service role full access for logos'
  ) then
    create policy "Service role full access for logos"
      on storage.objects
      for all
      using (auth.role() = 'service_role' and bucket_id = 'logos')
      with check (auth.role() = 'service_role' and bucket_id = 'logos');
  end if;
end
$$;
