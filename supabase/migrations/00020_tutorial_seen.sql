-- Tutorial de primera vez: flag en el perfil de la cuenta.

alter table public.profiles
  add column if not exists tutorial_seen_at timestamptz;

comment on column public.profiles.tutorial_seen_at is
  'Cuando el usuario completó o saltó el tutorial. NULL = aún no lo vio.';
