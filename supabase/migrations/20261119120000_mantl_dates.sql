-- Prototyping in MANTL re-registers every prototype in its gallery after each
-- publish, so every MANTL row's updated_at read as the latest publish of any
-- prototype ("23 hrs ago" on all of them). register-prototype now passes each
-- prototype's own dates from its gallery metadata (source_meta.created and
-- source_meta.updated); this trigger makes updated_at match the prototype's
-- last share, and a new row's created_at its first.
--
-- Without those dates (a publish from before the workflow sent them), a
-- re-registration with the same commit keeps the row's updated_at: nothing
-- about the prototype changed. Safe to re-run.

create or replace function public.use_mantl_dates()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  shared timestamptz;
  first_shared timestamptz;
begin
  if new.source <> 'mantl' then
    return new;
  end if;

  begin
    shared := nullif(new.source_meta ->> 'updated', '')::timestamptz;
  exception when others then
    shared := null;
  end;
  begin
    first_shared := nullif(new.source_meta ->> 'created', '')::timestamptz;
  exception when others then
    first_shared := null;
  end;

  if shared is not null then
    new.updated_at := shared;
  elsif tg_op = 'UPDATE' and (new.source_meta ->> 'commit') is not distinct from (old.source_meta ->> 'commit') then
    new.updated_at := old.updated_at;
  end if;

  -- created is only a day, and the gallery stamped most older prototypes with
  -- the day it was set up, so it is used for new rows only: a row registered
  -- earlier already has the moment it first arrived here.
  if tg_op = 'INSERT' and first_shared is not null then
    new.created_at := first_shared;
  end if;

  return new;
end;
$$;

revoke all on function public.use_mantl_dates() from public;

-- Named to sort after prototypes_touch_updated_at: Postgres runs triggers on
-- the same event in name order, and this one has the last word.
drop trigger if exists prototypes_use_mantl_dates on public.prototypes;
create trigger prototypes_use_mantl_dates
  before insert or update on public.prototypes
  for each row execute procedure public.use_mantl_dates();
