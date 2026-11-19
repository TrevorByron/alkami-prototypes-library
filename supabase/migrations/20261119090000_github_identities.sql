-- Links a member's Alkami sign-in to the GitHub login that shares prototypes
-- from Prototyping in MANTL. Those rows arrive with only the login
-- (source_meta.author, e.g. "TrevorByron") and no owner, so the library could
-- not tell they were built by the member who signed in as trevor.borden@.
--
-- The app spots a GitHub login whose name looks like the member's and asks
-- "Is this you?". Yes links them (link_github_login): every MANTL prototype by
-- that login, past and future, is then owned by the member. No is remembered
-- so the question isn't asked again. Safe to re-run.

create table if not exists public.github_identities (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Lowercased: GitHub logins are case-insensitive.
  login text not null check (login = lower(login) and login <> ''),
  -- true: "Yes, that's me". false: "No, that's not me" (never asked again).
  linked boolean not null,
  decided_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, login)
);

-- A GitHub login belongs to one member.
create unique index if not exists github_identities_linked_login_idx
  on public.github_identities (login)
  where linked;

alter table public.github_identities enable row level security;

drop policy if exists "Alkami members can read GitHub identities" on public.github_identities;
create policy "Alkami members can read GitHub identities"
  on public.github_identities for select to authenticated
  using (public.is_alkami_member());

-- Members record their own "not me" answers directly; links go through
-- link_github_login so the prototypes move with them.
drop policy if exists "Members decline their own GitHub matches" on public.github_identities;
create policy "Members decline their own GitHub matches"
  on public.github_identities for insert to authenticated
  with check (profile_id = auth.uid() and not linked and public.is_alkami_member());

-- Any write to a MANTL prototype (register-prototype on every share, or the
-- link below) gives it to the member linked to its GitHub author.
create or replace function public.apply_github_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  if new.source = 'mantl' and coalesce(new.source_meta ->> 'author', '') <> '' then
    select profile.id, profile.name
      into member
      from public.github_identities identity
      join public.profiles profile on profile.id = identity.profile_id
     where identity.login = lower(new.source_meta ->> 'author')
       and identity.linked
     limit 1;
    if found then
      new.owner_id := member.id;
      new.owner_name := member.name;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_github_owner() from public;

drop trigger if exists prototypes_apply_github_owner on public.prototypes;
create trigger prototypes_apply_github_owner
  before insert or update on public.prototypes
  for each row execute procedure public.apply_github_owner();

-- The original touch trigger (core_tables), now skipped while
-- link_github_login moves prototypes to their member.
create or replace function public.touch_prototype_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.keep_updated_at', true), '') <> 'on' then
    new.updated_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

-- "Yes, that's me": links the login to the signed-in member and hands them
-- every MANTL prototype it already shared. Returns how many moved.
create or replace function public.link_github_login(github_login text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(btrim(coalesce(github_login, '')));
  moved integer;
begin
  if auth.uid() is null or not public.is_alkami_member() then
    raise exception 'Only Alkami members can link a GitHub login';
  end if;
  if normalized = '' then
    raise exception 'GitHub login is missing';
  end if;
  if exists (select 1 from public.github_identities where login = normalized and linked and profile_id <> auth.uid()) then
    raise exception 'That GitHub login is already linked to another member';
  end if;

  insert into public.github_identities (profile_id, login, linked)
  values (auth.uid(), normalized, true)
  on conflict (profile_id, login) do update set linked = true, decided_at = timezone('utc', now());

  -- The trigger above fills in owner_id and owner_name. A change of owner
  -- isn't an update to the prototype, so its "updated" time stays put.
  perform set_config('app.keep_updated_at', 'on', true);
  update public.prototypes
     set owner_id = auth.uid()
   where source = 'mantl'
     and lower(source_meta ->> 'author') = normalized;
  get diagnostics moved = row_count;
  perform set_config('app.keep_updated_at', '', true);
  return moved;
end;
$$;

revoke all on function public.link_github_login(text) from public;
grant execute on function public.link_github_login(text) to authenticated;

comment on table public.github_identities is 'Which GitHub login (Prototyping in MANTL author) is which member, and the matches a member said were not them.';
