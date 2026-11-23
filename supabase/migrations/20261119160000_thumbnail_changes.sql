-- How many times a prototype's custom thumbnail has been set, for the
-- Thumbnail Perfectionist award. The old files are deleted on replace, so the
-- count has to be kept. Only this trigger moves it: it goes up by one whenever
-- custom_thumbnail_url changes to a new image (removing one does not count),
-- and a direct write to the column is ignored. Safe to re-run.

alter table public.prototypes
  add column if not exists thumbnail_changes integer not null default 0;

create or replace function public.count_thumbnail_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.thumbnail_changes := old.thumbnail_changes
    + case when new.custom_thumbnail_url is not null
                and new.custom_thumbnail_url is distinct from old.custom_thumbnail_url
           then 1 else 0 end;
  return new;
end;
$$;

drop trigger if exists count_thumbnail_changes on public.prototypes;
create trigger count_thumbnail_changes
  before update on public.prototypes
  for each row execute function public.count_thumbnail_changes();
