import { getSupabase } from '@/services/supabase/client';
import type { SeasonEntitlement, SeasonRow, SubscriptionRow } from '@/types/database';
import { effectivePriceClp, isOfferActive } from '@/types/database';

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
  const sub = await fetchMySubscription();
  return sub?.status === 'authorized';
}

/** Acceso de pago: suscripción activa o entitlement legacy de esa temporada. */
export async function hasSeasonPass(seasonId: string): Promise<boolean> {
  if (await hasActiveSubscription()) return true;

  const { data, error } = await getSupabase()
    .from('season_entitlements')
    .select('season_id')
    .eq('season_id', seasonId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
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

/** true si el cobro usa link estático (sin webhook automático). */
export function usesStaticPaymentLink(): boolean {
  return Boolean(import.meta.env.VITE_MERCADOPAGO_PAYMENT_LINK?.trim());
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
      cancel_url: `${window.location.origin}/pase/${seasonId}?cancel=1`,
    }),
  });

  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'No se pudo iniciar la suscripción');
  }
  return { url: json.url };
}
