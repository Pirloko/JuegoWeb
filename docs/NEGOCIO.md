# Modelo de negocio — JuegoWeb

**Estado:** implementado (migración `00009`+`00011`, paywall, suscripción Mercado Pago).  
**Mercado:** Chile · moneda **CLP**.  
**Producto:** Suscripción mensual — acceso a niveles 8–70 mientras esté activa.

---

## Resumen en una frase

Gratis niveles **1–7**; para **8–70** te suscribes **mensualmente** (Mercado Pago). Tú cancelas cuando quieras; al cancelar pierdes el acceso de pago. Progreso e imágenes reveladas se conservan.

---

## Temporadas

| Concepto | Definición |
|---|---|
| Temporada | Ej. `2026-07` (Julio 2026), `2026-08` (Agosto 2026)… |
| Cadencia | Una temporada nueva por mes calendario |
| Niveles por temporada | **70** |
| Free | Niveles **1–7** de cada temporada |
| De pago | Niveles **8–70** (requiere suscripción activa) |

Progreso e imágenes de Julio **no se mezclan** con Agosto.

---

## Producto: Suscripción mensual

- Cobro recurrente **cada mes** vía Mercado Pago (preapproval).
- Mientras `subscriptions.status = authorized`: acceso a niveles **8–70 de cualquier temporada**.
- El usuario **cancela en Mercado Pago** (nosotros no lo hacemos por él).
- Al cancelar / pausar: se pierde el acceso de pago; free 1–7 y galería completada se mantienen.
- Precio: lista u oferta de la temporada activa (ej. **$3.590 CLP/mes** en oferta).

Compatibilidad: entitlements legacy (`season_entitlements`, p. ej. admin) siguen dando acceso.

---

## Precios (CLP · Chile)

| Concepto | Precio |
|---|---|
| Precio lista / mes | **$5.990 CLP** |
| Precio oferta / mes | **$3.590 CLP** |

La oferta se activa por fechas en `seasons` (Admin), no hardcodeada en el cliente.

---

## Reglas de producto

1. Sin sub: jugar 1–7; al tocar 8+ → paywall “Suscripción mensual”.
2. Con sub activa: jugar 1–70 de las temporadas.
3. Galería / progreso completado: **se conserva** al cancelar.
4. Cancelación: responsabilidad del usuario en Mercado Pago.

---

## UX

- **Home / Niveles:** temporada + “Suscripción · $X/mes”.
- **Paywall:** precio /mes; CTA “Suscribirme”; aviso de cancelación en MP.
- **Mi suscripción:** estado + link “Gestionar / cancelar” a Mercado Pago.

---

## Pagos (Mercado Pago · Chile)

- Edge Function `create-checkout` → **preapproval** mensual.
- Edge Function `create-energy-checkout` → preference one-shot (pack corazones).
- Webhook `mp-webhook` → RPC `upsert_subscription_from_mp` / `grant_season_pass` /
  `grant_energy_pack` (`energy|userId|amount`).
- Tabla `subscriptions` + helper `has_season_pass` (sub activa **o** entitlement legacy).
- Admin puede otorgar acceso de prueba vía `grant_season_pass` y pack vía `grant_energy_pack`.
- IAP Apple/Google: fuera de alcance.

---

## Datos

```text
seasons (… price_clp, offer_…)
levels.season_id, sort_order 1..70

subscriptions (
  user_id PK, status, mp_preapproval_id, amount_clp, current_period_end, …
)

season_entitlements (legacy / admin)
```

Free: `sort_order <= 7`.  
Paid: `sort_order >= 8` → suscripción `authorized` o entitlement.

---

## Checklist

- [x] Temporadas + entitlements (`00009`)
- [x] Suscripciones + `has_season_pass` (`00011`)
- [x] Paywall / Mi suscripción
- [x] Mercado Pago preapproval + webhook
- [x] Admin temporadas / grant legacy

---

## Fuera de alcance (por ahora)

- Cancelar la sub desde dentro de la app (solo link a MP).
- Gemas / ranking de pago / IAP.

---

*Documento vivo del modelo de negocio. Si choca con el código, prevalece este modelo hasta que se actualice aquí a propósito.*
