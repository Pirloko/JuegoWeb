import { getSupabase } from '@/services/supabase/client';
import type { SeasonEntitlement, SeasonRow, SubscriptionRow } from '@/types/database';
import { effectivePriceClp, isOfferActive } from '@/types/database';

/** Precio mensual del pase (CLP). Fuente de verdad de marketing; checkout usa temporada en DB. */
export const PASS_MONTHLY_PRICE_CLP = 1990;

export async function fetchSeasons(): Promise<SeasonRow[]> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('*')
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SeasonRow[]) ?? [];
}

export async function fetchActiveSeason(): Promise<SeasonRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .lte('starts_at', now)
    .gt('ends_at', now)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data as SeasonRow;

  const { data: fallback, error: err2 } = await getSupabase()
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (err2) throw new Error(err2.message);
  return (fallback as SeasonRow) ?? null;
}

export async function fetchSeason(id: string): Promise<SeasonRow | null> {
  const { data, error } = await getSupabase().from('seasons').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as SeasonRow | null;
}

/** Próxima temporada por starts_at (teaser T+1). Incluye inactivas. */
export async function fetchNextSeason(after: SeasonRow): Promise<SeasonRow | null> {
  const { data, error } = await getSupabase()
    .from('seasons')
    .select('*')
    .gt('starts_at', after.starts_at)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SeasonRow) ?? null;
}

export async function fetchMyEntitlements(): Promise<SeasonEntitlement[]> {
  const { data, error } = await getSupabase().from('season_entitlements').select('*');
  if (error) throw new Error(error.message);
  return (data as SeasonEntitlement[]) ?? [];
}

export async function fetchMySubscription(): Promise<SubscriptionRow | null> {
  const { data, error } = await getSupabase().from('subscriptions').select('*').maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SubscriptionRow) ?? null;
}

export async function hasActiveSubscription(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('has_active_subscription');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Acceso de pago vigente (sub con periodo activo o entitlement no vencido). */
export async function hasSeasonPass(seasonId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('has_season_pass', {
    p_season_id: seasonId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Fecha de fin de pase (sub o entitlement), o null si no hay pase vigente. */
export async function fetchPassExpiresAt(seasonId: string): Promise<string | null> {
  const { data, error } = await getSupabase().rpc('pass_expires_at', {
    p_season_id: seasonId,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : data ? String(data) : null;
}

export function formatPassExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function seasonPricing(season: SeasonRow) {
  const onOffer = isOfferActive(season);
  return {
    listClp: season.price_clp,
    offerClp: season.offer_price_clp,
    effectiveClp: effectivePriceClp(season),
    onOffer,
  };
}

/** ¿El jugador liberó esta temporada por ★ de la anterior? (RPC Fase 2). */
export async function canAccessSeason(seasonId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('can_access_season', {
    p_season_id: seasonId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** ★ contables del usuario en una temporada (RPC). */
export async function fetchSeasonCountableStars(seasonId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('season_countable_stars', {
    p_season_id: seasonId,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : Number(data) || 0;
}

/** Techo free de ★ (3 × niveles imagen). */
export async function fetchSeasonStarCapFree(seasonId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('season_star_cap_free', {
    p_season_id: seasonId,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : Number(data) || 0;
}

/** true si el cobro usa link estático (sin webhook automático). */
export function usesStaticPaymentLink(): boolean {
  return Boolean(import.meta.env.VITE_MERCADOPAGO_PAYMENT_LINK?.trim());
}

/** Fin de vigencia del pase mensual (sub global o entitlement de la season activa). */
export async function fetchMembershipPassExpiry(): Promise<string | null> {
  const sub = await fetchMySubscription();
  if (sub?.status === 'authorized') {
    const end = sub.current_period_end ?? null;
    if (end && new Date(end).getTime() > Date.now()) {
      return end;
    }
  }
  const active = await fetchActiveSeason();
  if (!active) return null;
  return fetchPassExpiresAt(active.id);
}

export async function fetchMembershipPassActive(): Promise<boolean> {
  const expiry = await fetchMembershipPassExpiry();
  return Boolean(expiry && new Date(expiry).getTime() > Date.now());
}

/** Checkout del pase mensual (usa temporada activa para precio / MP). */
export async function startPassCheckout(): Promise<{ url: string }> {
  const season = await fetchActiveSeason();
  if (!season) throw new Error('No hay temporada activa');
  return startSeasonCheckout(season.id);
}

/**
 * Inicia suscripción mensual.
 * Si hay VITE_MERCADOPAGO_PAYMENT_LINK → link estático (parche).
 * Si no → Edge Function create-checkout (preapproval MP).
 */
export async function startSeasonCheckout(seasonId: string): Promise<{ url: string }> {
  const staticLink = import.meta.env.VITE_MERCADOPAGO_PAYMENT_LINK?.trim();
  if (staticLink) {
    return { url: staticLink };
  }

  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Debes iniciar sesión');

  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('Supabase no configurado');

  const res = await fetch(`${base}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      season_id: seasonId,
      success_url: `${window.location.origin}/pago/ok?season=${seasonId}`,
      cancel_url: `${window.location.origin}/pase?cancel=1`,
    }),
  });

  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'No se pudo iniciar la suscripción');
  }
  return { url: json.url };
}
