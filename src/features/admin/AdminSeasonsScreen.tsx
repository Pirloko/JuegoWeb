import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  adminGrantEnergyPack,
  adminGrantSeasonPass,
  createSeason,
  fetchSeasonsAdmin,
  updateSeason,
  type SeasonWriteInput,
} from '@/services/supabase/admin';
import { useAuth } from '@/features/auth/auth-context';
import { seasonPricing } from '@/services/supabase/seasons';
import { formatClp } from '@/types/database';
import type { SeasonRow } from '@/types/database';
import './admin.css';

function emptyForm(): SeasonWriteInput {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const start = `${y}-${m}-01T00:00:00.000Z`;
  const endMonth = now.getUTCMonth() + 2;
  const endY = endMonth > 12 ? y + 1 : y;
  const endM = String(((endMonth - 1) % 12) + 1).padStart(2, '0');
  return {
    slug: `${y}-${m}`,
    name: now.toLocaleString('es-CL', { month: 'long', year: 'numeric' }),
    starts_at: start,
    ends_at: `${endY}-${endM}-01T00:00:00.000Z`,
    price_clp: 5990,
    offer_price_clp: 3590,
    offer_starts_at: start,
    offer_ends_at: `${y}-${m}-15T00:00:00.000Z`,
    is_active: true,
    stars_required_to_unlock_next: 20,
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16);
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function AdminSeasonsScreen() {
  const { user } = useAuth();
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SeasonWriteInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [grantSeasonId, setGrantSeasonId] = useState('');
  const [grantMsg, setGrantMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSeasons(await fetchSeasonsAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startEdit(s: SeasonRow) {
    setEditingId(s.id);
    setForm({
      slug: s.slug,
      name: s.name,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      price_clp: s.price_clp,
      offer_price_clp: s.offer_price_clp,
      offer_starts_at: s.offer_starts_at,
      offer_ends_at: s.offer_ends_at,
      is_active: s.is_active,
      stars_required_to_unlock_next: s.stars_required_to_unlock_next ?? 20,
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: SeasonWriteInput = {
        ...form,
        name: form.name.trim(),
        slug: form.slug.trim(),
        offer_price_clp: form.offer_price_clp || null,
        offer_starts_at: form.offer_starts_at,
        offer_ends_at: form.offer_ends_at,
      };
      if (editingId) await updateSeason(editingId, payload);
      else await createSeason(payload);
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function grantSelf() {
    if (!user || !grantSeasonId) return;
    setGrantMsg(null);
    try {
      const s = seasons.find((x) => x.id === grantSeasonId);
      const amount = s ? seasonPricing(s).effectiveClp : 3590;
      await adminGrantSeasonPass(user.id, grantSeasonId, amount);
      setGrantMsg('Pase otorgado a tu cuenta');
    } catch (e) {
      setGrantMsg(e instanceof Error ? e.message : 'No se pudo otorgar');
    }
  }

  async function grantSelfEnergy() {
    if (!user) return;
    setGrantMsg(null);
    try {
      await adminGrantEnergyPack(user.id);
      setGrantMsg('Pack de corazones otorgado (lleno al máximo)');
    } catch (e) {
      setGrantMsg(e instanceof Error ? e.message : 'No se pudo otorgar pack');
    }
  }

  return (
    <main className="admin">
      <header className="admin-header">
        <Link className="admin-back" to="/admin">
          ←
        </Link>
        <h1>Admin · Temporadas</h1>
        <button type="button" className="admin-add" onClick={startCreate} aria-label="Nueva">
          +
        </button>
      </header>

      {loading && <p className="admin-msg">Cargando…</p>}
      {error && <p className="admin-error">{error}</p>}

      <form className="admin-form" onSubmit={(ev) => void onSubmit(ev)}>
        <h2 className="admin-form-title">{editingId ? 'Editar temporada' : 'Nueva temporada'}</h2>
        <label className="admin-field">
          <span>Slug (YYYY-MM)</span>
          <input
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            required
            pattern="\d{4}-\d{2}"
          />
        </label>
        <label className="admin-field">
          <span>Nombre</span>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </label>
        <div className="admin-row-fields">
          <label className="admin-field">
            <span>Inicio</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.starts_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, starts_at: fromLocalInput(e.target.value) ?? f.starts_at }))
              }
              required
            />
          </label>
          <label className="admin-field">
            <span>Fin</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.ends_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, ends_at: fromLocalInput(e.target.value) ?? f.ends_at }))
              }
              required
            />
          </label>
        </div>
        <div className="admin-row-fields">
          <label className="admin-field">
            <span>Precio lista CLP</span>
            <input
              type="number"
              min={1}
              value={form.price_clp}
              onChange={(e) => setForm((f) => ({ ...f, price_clp: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="admin-field">
            <span>Oferta CLP</span>
            <input
              type="number"
              min={0}
              value={form.offer_price_clp ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  offer_price_clp: e.target.value ? Number(e.target.value) : null,
                }))
              }
            />
          </label>
        </div>
        <div className="admin-row-fields">
          <label className="admin-field">
            <span>Oferta desde</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.offer_starts_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, offer_starts_at: fromLocalInput(e.target.value) }))
              }
            />
          </label>
          <label className="admin-field">
            <span>Oferta hasta</span>
            <input
              type="datetime-local"
              value={toLocalInput(form.offer_ends_at)}
              onChange={(e) =>
                setForm((f) => ({ ...f, offer_ends_at: fromLocalInput(e.target.value) }))
              }
            />
          </label>
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Activa
        </label>
        <label className="admin-field">
          <span>★ para liberar la siguiente temporada</span>
          <input
            type="number"
            min={0}
            max={60}
            value={form.stars_required_to_unlock_next}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                stars_required_to_unlock_next: Number(e.target.value),
              }))
            }
            required
          />
        </label>
        <p className="admin-hint">
          Debe ser alcanzable solo con niveles imagen (máx. 3★ × cantidad de fotos). Si pones de
          más, el servidor lo baja al techo free automáticamente.
        </p>
        <button type="submit" className="btn-cta" disabled={saving}>
          {saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Crear'}
        </button>
      </form>

      <ul className="admin-list">
        {seasons.map((s) => {
          const p = seasonPricing(s);
          return (
            <li key={s.id} className="admin-row">
              <button type="button" className="admin-row-main" onClick={() => startEdit(s)}>
                <span className="admin-order">{s.slug.slice(5)}</span>
                <span className="admin-row-meta">
                  <strong>{s.name}</strong>
                  <span>
                    {s.is_active ? 'Activa' : 'Inactiva'} · {formatClp(p.effectiveClp)}
                    {p.onOffer ? ' oferta' : ''} · gate {s.stars_required_to_unlock_next ?? 0}★
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="admin-grant">
        <h2 className="admin-form-title">Otorgar pase (test)</h2>
        <label className="admin-field">
          <span>Temporada</span>
          <select value={grantSeasonId} onChange={(e) => setGrantSeasonId(e.target.value)}>
            <option value="">—</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-ghost" onClick={() => void grantSelf()}>
          Darme pase de esa temporada (+30 días)
        </button>
        <h2 className="admin-form-title">Otorgar pack corazones (test)</h2>
        <button type="button" className="btn-ghost" onClick={() => void grantSelfEnergy()}>
          Rellenar mis corazones al máximo
        </button>
        {grantMsg && <p className="admin-msg">{grantMsg}</p>}
      </section>
    </main>
  );
}
