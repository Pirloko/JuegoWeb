-- Temporadas sin fecha de fin: la vigencia la marca starts_at + is_active.
-- La "activa" es la is_active con starts_at más reciente ya llegada.
-- Teaser T+1: últimos 7 días antes del starts_at de la siguiente (cliente).

alter table public.seasons
  drop constraint if exists seasons_dates;

alter table public.seasons
  alter column ends_at drop not null;

comment on column public.seasons.ends_at is
  'Deprecated: opcional/legacy. La app ya no lo usa; la temporada no tiene fin fijo.';

-- Limpiar fines: a partir de ahora solo importa starts_at.
update public.seasons set ends_at = null;
