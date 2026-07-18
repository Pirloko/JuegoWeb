-- Permite al usuario autenticado eliminar su propia cuenta (auth.users).
-- El resto de datos (perfil, progreso, medallas, sesiones, subs locales)
-- cae en cascada vía FK a profiles / auth.users.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Solo el propio usuario; nunca aceptar un id externo.
  delete from auth.users where id = v_uid;

  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.delete_own_account() is
  'Elimina la cuenta del usuario autenticado. SECURITY DEFINER; solo auth.uid().';

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
