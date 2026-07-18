import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Webhook Mercado Pago → suscripciones (preapproval) + pagos recurrentes.
 */
Deno.serve(async (req) => {
  const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_PROJECT_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!mpToken || !supabaseUrl || !serviceKey) {
    return new Response("misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    let topic =
      url.searchParams.get("type") ??
      url.searchParams.get("topic") ??
      null;
    let entityId: string | null =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id");

    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await req.json()) as {
          type?: string;
          action?: string;
          data?: { id?: string | number };
          resource?: string;
          topic?: string;
        };
        if (body.type) topic = body.type;
        if (body.topic) topic = body.topic;
        if (body.data?.id != null) entityId = String(body.data.id);
        if (!entityId && body.resource) {
          entityId = body.resource.split("/").pop() ?? null;
        }
      }
    }

    if (!entityId || entityId === "null") {
      return ok();
    }

    // ── Suscripción / preapproval ──────────────────────────────────────
    const isSubscriptionTopic =
      topic === "subscription_preapproval" ||
      topic === "subscription_authorized_payment" ||
      topic === "preapproval" ||
      (typeof topic === "string" && topic.includes("subscription"));

    if (isSubscriptionTopic || topic === "subscription_preapproval") {
      await syncPreapproval(mpToken, supabase, entityId);
      return ok();
    }

    // ── Pago (puede ser el cobro mensual de la sub) ─────────────────────
    if (!topic || topic === "payment") {
      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${entityId}`, {
        headers: { Authorization: `Bearer ${mpToken}` },
      });
      if (!payRes.ok) {
        console.error("MP payment fetch failed", entityId, await payRes.text());
        return new Response("payment fetch failed", { status: 502 });
      }

      const payment = (await payRes.json()) as {
        id: number;
        status: string;
        transaction_amount: number;
        external_reference?: string;
        metadata?: Record<string, unknown>;
        point_of_interaction?: {
          transaction_data?: { subscription_id?: string };
        };
      };

      // Si el pago trae subscription_id, sincronizar preapproval
      const subId = payment.point_of_interaction?.transaction_data?.subscription_id;
      if (subId) {
        await syncPreapproval(mpToken, supabase, String(subId));
        return ok();
      }

      // Cobro one-shot legacy: external_reference user|season|amount
      if (payment.status === "approved" && payment.external_reference?.includes("|")) {
        const parts = payment.external_reference.split("|");
        const userId = parts[0];
        const seasonId = parts[1];
        const amountClp = Number(parts[2] ?? payment.transaction_amount);
        if (userId && seasonId && amountClp > 0) {
          const { error } = await supabase.rpc("grant_season_pass", {
            p_user_id: userId,
            p_season_id: seasonId,
            p_amount_clp: Math.round(amountClp),
            p_provider: "mercadopago",
            p_provider_ref: String(payment.id),
          });
          if (error) console.error("grant_season_pass failed", error);
        }
        return ok();
      }

      // Pago de suscripción: external_reference = user_id
      if (payment.status === "approved" && payment.external_reference) {
        const userId = payment.external_reference;
        // Buscar preapproval del usuario o activar con id de pago como ref temporal
        const { data: existing } = await supabase
          .from("subscriptions")
          .select("mp_preapproval_id, amount_clp")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing?.mp_preapproval_id) {
          await syncPreapproval(mpToken, supabase, existing.mp_preapproval_id);
        } else {
          await supabase.rpc("upsert_subscription_from_mp", {
            p_user_id: userId,
            p_status: "authorized",
            p_mp_preapproval_id: `payment-${payment.id}`,
            p_amount_clp: Math.round(Number(payment.transaction_amount) || 3590),
            p_current_period_end: null,
          });
        }
      }

      return ok();
    }

    return ok();
  } catch (e) {
    console.error("mp-webhook error", e);
    return new Response("error", { status: 500 });
  }
});

type SupabaseRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{ data: { mp_preapproval_id?: string; amount_clp?: number } | null }>;
      };
    };
  };
};

async function syncPreapproval(
  mpToken: string,
  supabase: SupabaseRpc,
  preapprovalId: string,
) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${mpToken}` },
  });
  if (!res.ok) {
    console.error("MP preapproval fetch failed", preapprovalId, await res.text());
    return;
  }

  const pre = (await res.json()) as {
    id: string;
    status: string;
    external_reference?: string;
    auto_recurring?: {
      transaction_amount?: number;
      end_date?: string;
      next_payment_date?: string;
    };
  };

  const userId = pre.external_reference;
  if (!userId) {
    console.error("preapproval sin external_reference", pre.id);
    return;
  }

  const mpStatus = (pre.status || "").toLowerCase();
  let status: "pending" | "authorized" | "paused" | "cancelled" = "pending";
  if (mpStatus === "authorized") status = "authorized";
  else if (mpStatus === "paused") status = "paused";
  else if (mpStatus === "cancelled" || mpStatus === "canceled") status = "cancelled";
  else if (mpStatus === "pending") status = "pending";
  else if (mpStatus === "authorized" || mpStatus === "active") status = "authorized";

  const amountClp = Math.round(Number(pre.auto_recurring?.transaction_amount) || 3590);
  const periodEnd =
    pre.auto_recurring?.next_payment_date ??
    pre.auto_recurring?.end_date ??
    null;

  const { error } = await supabase.rpc("upsert_subscription_from_mp", {
    p_user_id: userId,
    p_status: status,
    p_mp_preapproval_id: pre.id,
    p_amount_clp: amountClp > 0 ? amountClp : 3590,
    p_current_period_end: periodEnd,
  });

  if (error) {
    console.error("upsert_subscription_from_mp failed", error);
  }
}

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
