import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACK_PRICE_CLP = 990;
const PACK_TITLE = "Pack 5 corazones — puntocachero";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_PROJECT_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!mpToken || !supabaseUrl || !anonKey) {
      return json({ error: "Mercado Pago / Supabase no configurados" }, 500);
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

    const body = (await req.json()) as {
      success_url?: string;
      cancel_url?: string;
    };
    if (!body.success_url || !body.cancel_url) {
      return json({ error: "Faltan success_url o cancel_url" }, 400);
    }

    const externalRef = `energy|${user.id}|${PACK_PRICE_CLP}`;
    const preference = {
      items: [
        {
          id: "energy-pack-5",
          title: PACK_TITLE,
          quantity: 1,
          unit_price: PACK_PRICE_CLP,
          currency_id: "CLP",
        },
      ],
      payer: user.email ? { email: user.email } : undefined,
      external_reference: externalRef,
      back_urls: {
        success: body.success_url,
        failure: body.cancel_url,
        pending: body.success_url,
      },
      auto_return: body.success_url.startsWith("https://") ? "approved" : undefined,
      statement_descriptor: "PUNTOCACHERO",
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    const pref = (await mpRes.json()) as {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
      message?: string;
      error?: string;
    };

    if (!mpRes.ok || (!pref.init_point && !pref.sandbox_init_point)) {
      console.error("MP preference failed", pref);
      return json(
        { error: pref.message ?? pref.error ?? "No se pudo crear el cobro del pack" },
        502,
      );
    }

    const sandbox = Deno.env.get("MERCADOPAGO_SANDBOX") === "true";
    const url = sandbox
      ? (pref.sandbox_init_point ?? pref.init_point)
      : (pref.init_point ?? pref.sandbox_init_point);

    return json({ url, preference_id: pref.id, amount_clp: PACK_PRICE_CLP });
  } catch (e) {
    console.error("create-energy-checkout", e);
    return json({ error: e instanceof Error ? e.message : "Error interno" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
