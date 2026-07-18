-- FASE 9 — Alinear paths de Storage con PNG del repo
-- Los seeds usaban .webp; las imágenes locales son .png.
-- Ejecutar en SQL Editor, luego subir archivos con:
--   npm run upload:images
-- (requiere SUPABASE_SERVICE_ROLE_KEY en .env)

update public.levels
set
  image_path = 'level-' || sort_order::text || '/full.png',
  thumb_path = 'level-' || sort_order::text || '/thumb.png'
where image_path like '%.webp'
   or thumb_path like '%.webp';
