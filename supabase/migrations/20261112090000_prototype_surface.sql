-- Which Mantl product surface a prototype is for, so the Surfaces awards can
-- count them. Optional: existing prototypes stay unset until their owner picks
-- one in Edit details. Safe to re-run.
--
-- Apply this BEFORE merging the app change that writes the column.

alter table public.prototypes
  add column if not exists surface text;

alter table public.prototypes drop constraint if exists prototypes_surface_check;
alter table public.prototypes
  add constraint prototypes_surface_check check (surface is null or surface in ('console', 'self_serve'));
