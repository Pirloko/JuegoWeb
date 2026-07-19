import { getSupabase } from '@/services/supabase/client';

/** Precio snack pack 5 corazones (CLP). Debe coincidir con RPC energy_pack_price_clp. */
export const ENERGY_PACK_PRICE_CLP = 990;

export interface EnergyStatus {
  hearts: number;
  max: number;
  refillSec: number;
  nextRefillAt: string | null;
  lastRefillAt?: string | null;
  energyWaived?: boolean;
  sessionId?: string | null;
}

function parseEnergy(raw: unknown): EnergyStatus {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    hearts: Number(o.hearts) || 0,
    max: Number(o.max) || 5,
    refillSec: Number(o.refillSec) || 1200,
    nextRefillAt: o.nextRefillAt != null ? String(o.nextRefillAt) : null,
    lastRefillAt: o.lastRefillAt != null ? String(o.lastRefillAt) : null,
    energyWaived: Boolean(o.energyWaived),
    sessionId: o.sessionId != null ? String(o.sessionId) : null,
  };
}

export async function fetchUserEnergy(): Promise<EnergyStatus> {
  const { data, error } = await getSupabase().rpc('get_user_energy');
  if (error) throw new Error(error.message);
  return parseEnergy(data);
}

/** Abre game_session. Exige ≥1 corazón (salvo pase) pero no gasta. */
export async function beginLevelAttempt(levelId: string): Promise<EnergyStatus> {
  const { data, error } = await getSupabase().rpc('begin_level_attempt', {
    p_level_id: levelId,
  });
  if (error) {
    const msg = error.message || '';
    if (/out of energy/i.test(msg)) {
      throw new Error('OUT_OF_ENERGY');
    }
    throw new Error(msg);
  }
  return parseEnergy(data);
}

export function formatRefillCountdown(nextRefillAt: string | null, now = Date.now()): string | null {
  if (!nextRefillAt) return null;
  const ms = new Date(nextRefillAt).getTime() - now;
  if (ms <= 0) return 'ya';
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Checkout one-shot Mercado Pago → pack de corazones (rellena al máximo). */
export async function startEnergyPackCheckout(): Promise<{ url: string }> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Debes iniciar sesión');

  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base) throw new Error('Supabase no configurado');

  const res = await fetch(`${base}/functions/v1/create-energy-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      success_url: `${window.location.origin}/pago/ok?energy=1`,
      cancel_url: `${window.location.origin}/levels?energy_cancel=1`,
    }),
  });

  const json = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !json.url) {
    throw new Error(json.error ?? 'No se pudo iniciar la compra del pack');
  }
  return { url: json.url };
}
