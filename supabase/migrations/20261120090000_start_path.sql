-- Where a prototype opens: a path, query or hash added to its link when someone
-- launches it, so they land on the prototype and not the console around it.
-- It is a separate column because a MANTL share rewrites `url` every time.
-- Only the owner may change it (a trigger, as for custom thumbnails). Safe to re-run.

alter table public.prototypes
  add column if not exists start_path text
  check (start_path is null or char_length(start_path) <= 500);

comment on column public.prototypes.start_path is 'Added to url when the prototype is launched: "/accounts", "#/loans", "?screen=2" or a path under the link. Not touched by MANTL shares.';

create or replace function public.guard_start_path()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.start_path is distinct from old.start_path
     and auth.uid() is not null
     and not public.is_prototype_owner(old.id) then
    raise exception 'Only the owner of a prototype can change its start page';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_start_path on public.prototypes;
create trigger guard_start_path
  before update of start_path on public.prototypes
  for each row execute function public.guard_start_path();
