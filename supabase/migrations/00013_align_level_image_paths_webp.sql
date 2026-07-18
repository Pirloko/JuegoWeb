-- Alinea paths de niveles a .webp (formato que genera el admin al comprimir).
-- Ejecutar tras 00012 si los jugadores aún ven la foto de demo.

update public.levels
set
  image_path = regexp_replace(image_path, '\.(png|jpe?g)$', '.webp', 'i'),
  thumb_path = regexp_replace(thumb_path, '\.(png|jpe?g)$', '.webp', 'i')
where image_path ~* '\.(png|jpe?g)$'
   or thumb_path ~* '\.(png|jpe?g)$';

-- Revisa el resultado:
-- select sort_order, name, image_path, thumb_path from public.levels order by sort_order;
