-- Precio del pase mensual unificado: $1.990 CLP (sin oferta cruzada).
update public.seasons
set
  price_clp = 1990,
  offer_price_clp = null,
  offer_starts_at = null,
  offer_ends_at = null
where is_active = true;
