-- Extiende oferta Julio 2026 ($3.590) hasta el fin de la temporada
update public.seasons
set
  price_clp = 5990,
  offer_price_clp = 3590,
  offer_starts_at = '2026-07-01 00:00:00+00',
  offer_ends_at = '2026-08-01 00:00:00+00'
where slug = '2026-07';
