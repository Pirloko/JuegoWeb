import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_PROJECT_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!mpToken || !supabaseUrl || !anonKey) {
      return json({ error: "Mercado Pago / Supabase no configurados en la Edge Function" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return json({ error: "Sesión inválida" }, 401);
    if (!user.email) return json({ error: "Tu cuenta necesita un email para suscribirse" }, 400);

    const body = (await req.json()) as {
      season_id?: string;
      success_url?: string;
      cancel_url?: string;
    };
    if (!body.season_id || !body.success_url || !body.cancel_url) {
      return json({ error: "Faltan season_id, success_url o cancel_url" }, 400);
    }

    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("*")
      .eq("id", body.season_id)
      .eq("is_active", true)
      .maybeSingle();

    if (seasonError || !season) return json({ error: "Temporada no encontrada" }, 404);

    // Ya tiene sub activa → no crear otra
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.status === "authorized") {
      return json({ error: "Ya tienes una suscripción activa" }, 409);
    }

    // Legacy entitlement de esta season también cuenta
    const { data: existing } = await supabase
      .from("season_entitlements")
      .select("season_id")
      .eq("season_id", body.season_id)
      .maybeSingle();
    if (existing) return json({ error: "Ya tienes acceso a esta temporada" }, 409);

    const now = Date.now();
    const onOffer =
      season.offer_price_clp != null &&
      season.offer_starts_at &&
      season.offer_ends_at &&
      now >= new Date(season.offer_starts_at).getTime() &&
      now < new Date(season.offer_ends_at).getTime();
    const amountClp = Number(onOffer ? season.offer_price_clp : season.price_clp);
    if (!Number.isFinite(amountClp) || amountClp <= 0) {
      return json({ error: "Precio inválido" }, 400);
    }

    // back_url de preapproval debe ser HTTPS en producción; en local usamos cancel como fallback
    const backUrl = body.success_url.startsWith("https://")
      ? body.success_url
      : body.cancel_url.startsWith("https://")
        ? body.cancel_url
        : body.success_url;

    const preapprovalBody = {
      reason: "Suscripción mensual puntocachero — niveles 8–70",
      external_reference: user.id,
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amountClp,
        currency_id: "CLP",
      },
      back_url: backUrl,
      status: "pending",
    };

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalBody),
    });

    const pref = (await mpRes.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
      error?: string;
      status?: string;
    };

    if (!mpRes.ok) {
      const detail = pref.message ?? pref.error ?? JSON.stringify(pref);
      return json({ error: `Mercado Pago: ${detail}` }, 502);
    }

    const sandbox = Deno.env.get("MERCADOPAGO_SANDBOX") === "true";
    const url = sandbox ? (pref.sandbox_init_point ?? pref.init_point) : pref.init_point;
    if (!url) return json({ error: "Mercado Pago no devolvió URL de suscripción" }, 500);

    return json({ url, preapproval_id: pref.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
