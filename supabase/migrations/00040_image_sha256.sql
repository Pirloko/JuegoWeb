-- Huella de la foto de fondo: evita reutilizar / re-subir la misma imagen
-- en otro nivel. El admin calcula SHA-256 del archivo original al subir.

alter table public.levels
  add column if not exists image_sha256 text;

comment on column public.levels.image_sha256 is
  'SHA-256 hex del archivo original de la foto de fondo. Unique: una foto = un nivel.';

-- Una sola fila por huella (null permitido solo para filas legacy; tras wipe no aplica).
create unique index if not exists levels_image_sha256_unique
  on public.levels (image_sha256)
  where image_sha256 is not null;
