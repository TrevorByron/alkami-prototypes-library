-- Lets a prototype's owner set their own thumbnail for it.
--
-- The picture itself lives in the existing public prototype-thumbnails bucket,
-- under custom/<prototype id>/. Its link is stored in custom_thumbnail_url, a
-- separate column from thumbnail_url, so sharing from Prototyping in MANTL
-- again (which rewrites thumbnail_url) never replaces the owner's choice. Cards
-- show custom_thumbnail_url first and fall back to thumbnail_url.
--
-- Owner only. "Owner" is public.is_prototype_owner(): the owner, the creator,
-- or the member linked to the owner's Slack account. Other members can still
-- edit a prototype's other details; only this column and these files are
-- restricted. Safe to re-run.
--
-- Apply this BEFORE merging the app change that writes the column.

alter table public.prototypes
  add column if not exists custom_thumbnail_url text;

comment on column public.prototypes.custom_thumbnail_url is 'A thumbnail the owner uploaded; shown instead of thumbnail_url. Not touched by MANTL shares.';

-- Row security cannot limit one column, so a trigger refuses a change to it by
-- anyone but the owner. No signed-in user (the dashboard, the service role)
-- means an admin, which is allowed.
create or replace function public.guard_custom_thumbnail()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.custom_thumbnail_url is distinct from old.custom_thumbnail_url
     and auth.uid() is not null
     and not public.is_prototype_owner(old.id) then
    raise exception 'Only the owner of a prototype can change its thumbnail';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_custom_thumbnail on public.prototypes;
create trigger guard_custom_thumbnail
  before update of custom_thumbnail_url on public.prototypes
  for each row execute function public.guard_custom_thumbnail();

-- The bucket is public to read. Owners may add and remove files, but only under
-- custom/<their prototype's id>/, so the files the MANTL register function
-- writes, and other people's prototypes, are untouched.
drop policy if exists "Members can add custom thumbnails" on storage.objects;
drop policy if exists "Members can remove custom thumbnails" on storage.objects;
drop policy if exists "Owners can add custom thumbnails" on storage.objects;
create policy "Owners can add custom thumbnails"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'prototype-thumbnails'
    and (storage.foldername(name))[1] = 'custom'
    and case when (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_prototype_owner(((storage.foldername(name))[2])::uuid) else false end
  );

drop policy if exists "Owners can remove custom thumbnails" on storage.objects;
create policy "Owners can remove custom thumbnails"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'prototype-thumbnails'
    and (storage.foldername(name))[1] = 'custom'
    and case when (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             then public.is_prototype_owner(((storage.foldername(name))[2])::uuid) else false end
  );
