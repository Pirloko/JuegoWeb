-- Sitios amigos / recomendados (gestionados por admin).
-- Lectura: autenticados (solo activos). Escritura: is_admin().

create table public.friend_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  blurb text not null default '',
  url text not null,
  tag text not null default 'Amigo',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint friend_sites_name_len check (char_length(name) between 2 and 80),
  constraint friend_sites_blurb_len check (char_length(blurb) <= 160),
  constraint friend_sites_url_https check (url ~* '^https://'),
  constraint friend_sites_tag_check check (tag in ('Amigo', 'Recomendado'))
);

comment on table public.friend_sites is
  'Enlaces a sitios amigos/recomendados. CRUD solo admin; jugadores leen activos.';

create index friend_sites_active_sort_idx
  on public.friend_sites (sort_order, created_at)
  where is_active;

alter table public.friend_sites enable row level security;

grant select on table public.friend_sites to authenticated;
grant select, insert, update, delete on table public.friend_sites to authenticated;
grant all on table public.friend_sites to service_role;

-- Jugadores: solo activos
create policy "friend_sites_select_active"
on public.friend_sites
for select
to authenticated
using (is_active = true or (select public.is_admin()));

create policy "friend_sites_insert_admin"
on public.friend_sites
for insert
to authenticated
with check ((select public.is_admin()));

create policy "friend_sites_update_admin"
on public.friend_sites
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "friend_sites_delete_admin"
on public.friend_sites
for delete
to authenticated
using ((select public.is_admin()));
