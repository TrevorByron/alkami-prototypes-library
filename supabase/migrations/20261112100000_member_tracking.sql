-- Tracking for the Habits and Secrets awards (src/lib/awards.ts):
--   member_visits         one row per member per day they opened the library
--   profiles.easter_eggs  small flags for hidden things a member found
-- Both are written only through the functions below, so a member can only
-- ever record their own activity. Safe to re-run.
--
-- Apply this BEFORE merging the app change that writes them.

create table if not exists public.member_visits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

alter table public.member_visits enable row level security;

drop policy if exists "Members read their own visits" on public.member_visits;
create policy "Members read their own visits"
  on public.member_visits for select to authenticated
  using (user_id = auth.uid() and public.is_alkami_member());

alter table public.profiles
  add column if not exists easter_eggs text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_easter_eggs_check;
alter table public.profiles
  add constraint profiles_easter_eggs_check check (easter_eggs <@ array['contributors']::text[]);

-- Records that the signed-in member opened the library on p_day (their local
-- date). Only today, yesterday or tomorrow in UTC are accepted, which covers
-- every time zone without letting anyone backfill a streak.
create or replace function public.record_visit(p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_alkami_member() then
    raise exception 'Only signed-in members can record a visit';
  end if;
  if p_day < (timezone('utc', now())::date - 1) or p_day > (timezone('utc', now())::date + 1) then
    return;
  end if;
  insert into public.member_visits (user_id, day) values (auth.uid(), p_day) on conflict do nothing;
end;
$$;

revoke all on function public.record_visit(date) from public;
grant execute on function public.record_visit(date) to authenticated;

-- Marks an easter egg as found for the signed-in member.
create or replace function public.record_easter_egg(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_alkami_member() then
    raise exception 'Only signed-in members can record an easter egg';
  end if;
  if p_key <> all (array['contributors']) then
    return;
  end if;
  update public.profiles
     set easter_eggs = array(select distinct unnest(easter_eggs || array[p_key]))
   where id = auth.uid();
end;
$$;

revoke all on function public.record_easter_egg(text) from public;
grant execute on function public.record_easter_egg(text) to authenticated;
