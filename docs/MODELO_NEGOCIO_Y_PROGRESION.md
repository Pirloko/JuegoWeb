# Modelo de negocio y progresión — puntocachero

Documento fuente de verdad del modelo acordado (free-to-play + pase 30 días
por especiales + estrellas entre temporadas). La implementación va **fase a
fase**; no adelantar fases.

Mercado objetivo: Rancagua → Chile → LATAM. Precio bajo × volumen. Sin
publicidad como pilar.

---

## 1. Resumen ejecutivo

| Pieza | Regla |
| ----- | ----- |
| Acceso base | **Gratis siempre**: jugar y revelar niveles tipo **imagen**. |
| Premium | **Pase ~30 días**: jugar/revelar niveles **GIF/video** de **todas** las temporadas **ya liberadas por estrellas**. |
| Progresión | **Estrellas** abren el camino temporada → temporada. El pase **no** salta metas. |
| Tras expirar el pase | Lo ya revelado (GIF/video) **sigue en galería con movimiento**. No se revelan especiales **nuevos** sin renovar. |
| Vidas | Energía con refill por tiempo; pack de vidas = IAP secundario. Con pase: beneficio suave (ver §3.3). |
| Ritmo | Temporada ≈ 30 días. Evitar binge-vacío (goteo / 3★ / teaser T+1; ver fases). |

**Frase de producto:** *Estrellas = mapa. Pase = llave de los especiales del mapa ya explorado. Lo conquistado es tuyo.*

---

## 2. Reglas de producto (fuente de verdad)

### 2.1 Monetización

1. No ads como modelo principal.
2. Free puede completar la ruta de niveles **imagen** y avanzar temporadas si cumple ★.
3. Niveles `media_type ∈ {gif, video}` = **especiales**:
   - Sin pase activo: no jugar / no revelar ese nivel; la ruta free **sigue** (saltar o ver candado premium y continuar al siguiente free).
   - Con pase activo **y** temporada liberada por ★: puede jugar y revelar.
4. Al completar un especial con pase válido: galería guarda el media; **permanece reproducible con movimiento** aunque el pase expire.
5. Centro del cobro = contenido especial, no las vidas.

### 2.2 Estrellas por nivel (reutilizar lógica actual)

Misma regla que `starsForLevel` en `src/features/progression/progression.ts`
(y réplica SQL en badges):

- 1★ si `best_pct ≥ targetPct`
- 2★ si `best_pct ≥ min(targetPct + 15, umbral3)`
- 3★ si `best_pct ≥ max(95, targetPct)`

### 2.3 Meta de temporada (gate Tₙ → Tₙ₊₁)

- Cada temporada tiene `stars_required_to_unlock_next` (configurable en DB).
- Tabla **default de diseño** (ajustable por admin / migración seed):

| Desde | Hacia | ★ mínimas | Notas |
| ----- | ----- | --------- | ----- |
| T1 | T2 | 20 | Ej. ~10 niveles → techo 30★ |
| T2 | T3 | 28 | Sube exigencia |
| T3 | T4 | 36 | Idem |
| T4+ | … | +8 por escalón (cap razonable p.ej. 60) | Configurable |

La temporada 1 está siempre disponible (tras auth / onboarding).

### 2.4 Fórmula anti soft-lock (obligatoria)

Definiciones por temporada `S`:

- `L_free` = niveles con `media_type = 'image'`
- `L_special` = niveles con `media_type ∈ {gif, video}`
- `cap_free(S) = 3 × |L_free|`  (máximo de ★ obtenibles sin pase)
- `stars_required_to_unlock_next(S) ≤ cap_free(S)` **siempre**

**Estrellas que cuentan para el gate** (jugador free o paid):

- Cuentan: ★ de niveles **imagen** completados.
- ★ de especiales: **solo cuentan si** el jugador los completó (implica que en algún momento tuvo pase / derecho a jugarlos).
- Sin pase, un especial no jugado aporta **0★** y **no bloquea** el orden de los free.

Validación admin/CI: al publicar o editar temporada, rechazar configs donde
`stars_required_to_unlock_next > 3 × count(image levels)`.

Premium se presenta como **bonus de colección + ★ extra**, no como peaje
oculto para no quedar atrapado.

### 2.5 Contenido por nivel (técnico ya alineado)

- Admin: Imagen | GIF | Video.
- Phaser: siempre poster (`image_path`) — foto fija al conquistar.
- GIF/video: React al completar + galería, sujeto a §2.1.
- Foto de perfil obligatoria si GIF/video (fondo de partida).

### 2.6 Vidas / energía (producto)

Estado actual del repo: vidas = **por partida** (`config.lives`), se acaban en
esa run; no hay energía persistente ni timer global.

Modelo objetivo:

- Pool de **corazones/energía** (p.ej. máx 5).
- **No** se gasta al iniciar: se pierde **1 corazón al fallar** (enemigo o tiempo).
- Refill 1 corazón cada `N` minutos (p.ej. 20–30) hasta el máx.
- Sin corazones: no se puede empezar; esperar **o** comprar pack (IAP).
- **Beneficio pase:** con pase activo, **fallar no consume** corazones.
  (Sin vidas in-match aparte: corazones = vidas.)

### 2.7 Ritmo de temporada (~30 días)

- Ideal: no soltar el 100% el día 1 (goteo 2–3×/semana) + caza de 3★ + teaser T+1.
- **Implementado (Fase 8):** `levels.available_at` (admin); tiles “Pronto”; banner de ritmo;
  teaser T+1 en los últimos 7 días de `ends_at`.
- Always-on sin goteo: dejar `available_at` null y perfeccionar ★ / colección.

---

## 3. Estado actual del repo vs modelo objetivo

### 3.1 Reutilizar

| Área | Hoy | Encaje |
| ---- | --- | ------ |
| `starsForLevel` + tests | ✓ | Base del gate por ★ |
| `media_type` / `media_path` + poster Phaser | ✓ | Especiales |
| Galería + `RevealedMedia` | ✓ | Colección con movimiento |
| `seasons`, `subscriptions`, `season_entitlements`, MP webhook | ✓ | Base de pago; hay que **redefinir semántica** |
| Admin niveles (tipo media + foto perfil) | ✓ (UX reciente) | Mantener |
| `complete_level` RPC + progreso | ✓ | Extender checks |

### 3.2 Cambiar / reemplazar

| Hoy | Objetivo |
| --- | -------- |
| Free = `sort_order ≤ 7`; pago = niveles 8+ (`FREE_LEVEL_MAX`, `gated`) | Free = todos los **imagen**; pago = solo **gif/video** |
| Pase = acceso a niveles 8–70 (sub global o entitlement permanente) | Pase ~30 días = llave de **especiales** en temporadas **ya liberadas por ★** |
| Entitlement permanente por season | Alinear a ventana 30 días / sub `authorized` + `current_period_end` |
| Sin gate T→T+1 por ★ | `stars_required_to_unlock_next` + RPC/cliente |
| Vidas solo in-match | + energía persistente (fases) |
| Especial completado gateado si no hay pase | Media revelada **sigue legible** sin pase activo |

### 3.3 Beneficio pase + vidas (decisión cerrada en este doc)

Con pase activo: **fallar no consume corazones**.  
Sin pase: se pierde 1 corazón al fallar (enemigo o tiempo).

---

## 4. Fases de implementación

### Fase 1 — Contrato de progresión en TypeScript (sin cambiar paywall)

**Qué:** helpers puros + tests para:

- tabla/default de ★ requeridas entre temporadas;
- `cap_free` / validación anti soft-lock;
- ★ contables para el gate (imagen siempre; especial solo si completado);
- API estable documentada para UI/RPC posteriores.

**No hace:** migraciones, cambio de `FREE_LEVEL_MAX` / `gated`, vidas persistentes.

**Criterios de aceptación:**

- [x] Funciones exportadas en `progression.ts` (o módulo hermano) con tests vitest verdes.
- [x] Casos: free alcanza gate con solo imagen; special sin completar no cuenta; `required > cap_free` → inválido.
- [x] `npm run build` verde.
- [x] Este documento existe y describe Fase 1 como hecho al cerrar la fase.

**Estado:** completada (helpers + tests). Pendiente OK humano para Fase 2.

### Fase 2 — Schema: gates de temporada por ★

**Qué:** migración SQL:

- `seasons.stars_required_to_unlock_next int not null` (default según tabla §2.3);
- helper SQL `season_star_cap_free(season_id)` y check/documentación;
- (opcional) RPC `can_access_season(season_id)` basada en ★ de la temporada anterior.

**Criterios de aceptación:**

- [x] Migración `00025_season_star_gates.sql`.
- [x] Helpers: `level_stars_from_pct`, `season_star_cap_free`, `season_countable_stars`, `can_access_season`.
- [x] Clamp anti soft-lock (trigger seasons + levels).
- [x] Admin puede leer/escribir el campo; tipos TS + RPCs en cliente.
- [x] `npm run build` verde.
- [x] Migración aplicada en remoto (`supabase db push`).

**Estado:** completada. Pendiente OK humano para Fase 3 (paywall de especiales).

### Fase 3 — Paywall de especiales (rompe gate 1–7)

**Qué:** sustituir “niveles 8+ = pase” por “gif/video = pase + temporada liberada”:

- `can_play_level` / `complete_level` / unlock chain;
- cliente: `needsPass` por `media_type`, no por `sort_order`;
- copy UI: “estrellas abren temporada; pase abre especiales”.

**Criterios de aceptación:**

- [x] Migración `00026_specials_paywall.sql` (helpers + RPC + backfill).
- [x] Imagen free; GIF/video exige pase en server y cliente.
- [x] Especiales sin pase saltables en la ruta (`previous_required_levels_completed`).
- [x] Copy niveles / home / pase actualizado.
- [x] `npm run build` verde.
- [x] Migración en remoto.

**Estado:** completada. Pendiente OK humano para Fase 4 (galería sin pase).

### Fase 4 — Galería: revelado persiste con movimiento sin pase

**Qué:** signed URL / RLS permiten **leer** `media_path` si `user_level_progress.status = completed`, aunque `has_season_pass` sea false. Jugar de nuevo el nivel especial sigue exigiendo pase.

**Criterios de aceptación:**

- [x] Migración `00027_gallery_media_persists.sql` (`can_read_level_image`).
- [x] Galería reproduce GIF/video revelado sin pase.
- [x] Especial completed sin pase → galería (no rejugar); deep-link `?level=`.
- [x] `npm run build` verde.
- [x] Migración en remoto.

**Estado:** completada. Pendiente OK humano para Fase 5.

### Fase 5 — Semántica pase 30 días + copy paywall

**Qué:** alinear `has_season_pass` / periodos (`current_period_end`); entitlements admin con expiry o solo sub; pantallas de pase con reglas §2.1.

**Criterios de aceptación:**

- [x] Migración `00028_pass_30_day_window.sql` (`expires_at`, `subscription_is_current`, `pass_expires_at`).
- [x] `has_season_pass` / `has_active_subscription` respetan vencimiento.
- [x] Cliente usa RPC; UI muestra vigencia; copy pase/mi pase.
- [x] `npm run build` verde.
- [x] Migración en remoto.

**Estado:** completada. Pendiente OK humano para Fase 6 (energía).

### Fase 6 — Energía / corazones persistentes

**Qué:** tabla o campos de energía + refill timer; gastar al start; UI; beneficio pase §3.3.

**Criterios de aceptación:**

- [x] Migración `00029_user_energy.sql` (máx 5, refill 20 min, `begin_level_attempt`).
- [x] Sin energía no inicia (salvo pase vigente que no gasta).
- [x] UI niveles + HUD; enforce server-side al iniciar intento.
- [x] `npm run build` verde.
- [x] Migración en remoto.

**Estado:** completada. Pendiente OK humano para Fase 7 (IAP pack vidas).

### Fase 7 — IAP pack de vidas (secundario)

**Qué:** producto de refill inmediato (Mercado Pago one-shot + admin/test).

**Criterios de aceptación:**

- [x] Migración `00030_energy_pack.sql` (`energy_pack_purchases`, `grant_energy_pack`).
- [x] Edge `create-energy-checkout` + webhook `energy|userId|amount`.
- [x] Compra rellena pool al máximo; no sustituye al pase.
- [x] UI niveles + pantalla sin corazones; admin grant test.
- [x] `npm run build` verde.
- [x] Migración en remoto.

**Estado:** completada. Pendiente OK humano para Fase 8 (goteo / teaser).

### Fase 8 — Ritmo de temporada (goteo / teaser)

**Qué:** `available_at` por nivel; teaser T+1 en últimos 7 días; UI “próximamente” + caza 3★.

**Criterios de aceptación:**

- [x] Migración `00031_level_available_at.sql` + enforce en `begin_level_attempt` / `complete_level`.
- [x] Admin: campo “Disponible desde” (vacío = ya).
- [x] Tiles `upcoming` + banner de ritmo (drip / 3★ / al día).
- [x] Teaser T+1 en home y niveles (ventana 7 días antes de `ends_at`).
- [x] Helpers + tests en `progression.ts`.
- [x] `npm run build` verde.
- [x] Migración en remoto.

**Estado:** completada.

## 5. Qué NO entra en v1 de este trabajo

- Publicidad.
- Multijugador / ranking global / social abierto.
- Tienda de monedas genérica.
- Soft-lock que obligue a pagar para T2.
- Cambiar la fórmula de ★ por nivel (salvo bug).
- Extraer frame automático del video (admin sube foto de perfil).
- Over-engineering de goteo el día 1 de código.

---

## 6. Riesgos

| Riesgo | Impacto | Mitigación |
| ------ | ------- | ---------- |
| Migrar de gate 1–7 a especiales rompe jugadores mid-season | Alto | Fase 3 con migración de progreso + copy; seed de ★ caps |
| Entitlements permanentes vs pase 30 días | Medio | Fase 5; admin grant con `expires_at` |
| Soft-lock por demasiados especiales | Alto | Validación `required ≤ cap_free` (Fase 1–2) |
| Energía frustra en web sin push | Medio | Timers cortos + pase sin consumo + packs |
| Binge en 3 días | Medio | Fase 8; mientras, 3★ + teaser |

### Decisiones abiertas (no bloquean Fase 1)

1. Precio exacto CLP del pase (negocio; ya hay `price_clp` en seasons).
2. ¿Niveles especiales aparecen en la lista como “Premium” o se ocultan hasta tener pase? (recomendación: visibles con candado).
3. ¿Un pase global 30 días (sub actual) vs pase atado a “temporada calendario”? El modelo acordado: **pase 30 días desbloquea especiales de todas las temporadas ya liberadas por ★** → encaja mejor con `subscriptions.authorized` global + chequeo de ★ por season.

---

## 7. Orden de trabajo operativo

1. Cerrar Fase 1 (helpers + tests) → OK humano.
2. Fase 2 → OK.
3. … sin adelantar.

Cada fase: producto usable, `npm run build` verde, enforce server-side cuando la regla sea de negocio.
