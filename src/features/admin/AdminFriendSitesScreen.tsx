import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createFriendSite,
  deleteFriendSite,
  fetchFriendSitesAdmin,
  isValidFriendSiteUrl,
  normalizeFriendSiteUrl,
  updateFriendSite,
  type FriendSiteRow,
  type FriendSiteTag,
  type FriendSiteWriteInput,
} from '@/services/supabase/friendSites';
import './admin.css';

const EMPTY: FriendSiteWriteInput = {
  name: '',
  blurb: '',
  url: '',
  tag: 'Amigo',
  sort_order: 0,
  is_active: true,
};

export default function AdminFriendSitesScreen() {
  const [sites, setSites] = useState<FriendSiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FriendSiteWriteInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSites(await fetchFriendSitesAdmin());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar sitios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId('new');
    setForm({
      ...EMPTY,
      sort_order: sites.length === 0 ? 0 : Math.max(...sites.map((s) => s.sort_order)) + 1,
    });
  }

  function startEdit(site: FriendSiteRow) {
    setEditingId(site.id);
    setForm({
      name: site.name,
      blurb: site.blurb,
      url: site.url,
      tag: site.tag,
      sort_order: site.sort_order,
      is_active: site.is_active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const url = normalizeFriendSiteUrl(form.url);

    if (!name) {
      setError('Escribe el nombre del sitio');
      return;
    }
    if (name.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    if (!form.url.trim()) {
      setError('Escribe el enlace (ej. https://ejemplo.com)');
      return;
    }
    if (!isValidFriendSiteUrl(url)) {
      setError('El enlace no es válido. Usa algo como https://ejemplo.com');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: FriendSiteWriteInput = {
        ...form,
        name,
        blurb: form.blurb.trim(),
        url,
      };
      if (editingId === 'new') {
        await createFriendSite(payload);
      } else if (editingId) {
        await updateFriendSite(editingId, payload);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(site: FriendSiteRow) {
    if (!confirm(`¿Eliminar "${site.name}"?`)) return;
    try {
      await deleteFriendSite(site.id);
      if (editingId === site.id) cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <main className="admin">
      <header className="admin-header">
        <Link className="admin-back" to="/admin">
          ←
        </Link>
        <h1>Admin · Sitios amigos</h1>
        <button type="button" className="admin-add" onClick={startCreate} aria-label="Nuevo sitio">
          +
        </button>
      </header>

      <div className="admin-toolbar">
        <Link className="btn-ghost admin-link" to="/admin/niveles">
          Niveles
        </Link>
        <Link className="btn-ghost admin-link" to="/admin/seasons">
          Temporadas
        </Link>
      </div>

      {loading && <p className="admin-msg">Cargando…</p>}
      {error && <p className="admin-error">{error}</p>}

      {editingId && (
        <form className="admin-form" onSubmit={(e) => void onSubmit(e)}>
          <h2 className="admin-form-title">
            {editingId === 'new' ? 'Nuevo sitio amigo' : 'Editar sitio'}
          </h2>
          <label className="admin-field">
            <span>Nombre</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={80}
              autoComplete="off"
              required
            />
          </label>
          <label className="admin-field">
            <span>Descripción corta</span>
            <input
              type="text"
              value={form.blurb}
              onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))}
              maxLength={160}
              placeholder="Por qué lo recomendamos"
              autoComplete="off"
            />
          </label>
          <label className="admin-field">
            <span>URL</span>
            <input
              type="text"
              inputMode="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="ejemplo.com o https://ejemplo.com"
              autoComplete="off"
              required
            />
          </label>
          <label className="admin-field">
            <span>Etiqueta</span>
            <select
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value as FriendSiteTag }))}
            >
              <option value="Amigo">Amigo</option>
              <option value="Recomendado">Recomendado</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Orden</span>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) =>
                setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))
              }
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <span>Activo (visible para jugadores)</span>
          </label>
          <div className="admin-form-actions">
            <button type="button" className="btn-ghost" onClick={cancelEdit}>
              Cancelar
            </button>
            <button type="submit" className="btn-cta" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {!loading && (
        <ul className="admin-list">
          {sites.map((site) => (
            <li key={site.id} className="admin-row">
              <div className="admin-row-main">
                <strong>
                  {site.name}
                  {!site.is_active && <span className="admin-pill">inactivo</span>}
                </strong>
                <small>
                  {site.tag} · #{site.sort_order} · {site.url}
                </small>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="btn-ghost" onClick={() => startEdit(site)}>
                  Editar
                </button>
                <button type="button" className="btn-ghost" onClick={() => void onDelete(site)}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
          {sites.length === 0 && !editingId && (
            <p className="admin-msg">No hay sitios. Toca + para agregar.</p>
          )}
        </ul>
      )}
    </main>
  );
}
