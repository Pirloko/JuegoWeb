import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { LevelConfigJson, SeasonRow } from '@/types/database';
import {
  createLevel,
  defaultLevelConfig,
  fetchAllLevelsAdmin,
  fetchLevelAdmin,
  fetchSeasonsAdmin,
  pathsForSortOrder,
  updateLevel,
  uploadLevelImage,
} from '@/services/supabase/admin';
import {
  formatBytes,
  prepareLevelImage,
} from '@/services/images/prepareLevelImage';
import './admin.css';

export default function AdminLevelEditScreen() {
  const { levelId } = useParams<{ levelId: string }>();
  const [search] = useSearchParams();
  const isNew = !levelId || levelId === 'new';
  const navigate = useNavigate();

  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [seasonId, setSeasonId] = useState(search.get('season') ?? '');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [config, setConfig] = useState<LevelConfigJson>(defaultLevelConfig);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [existingThumbPath, setExistingThumbPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchSeasonsAdmin();
        if (cancelled) return;
        setSeasons(list);
        setSeasonId((prev) => prev || search.get('season') || list[0]?.id || '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar temporadas');
      } finally {
        if (!cancelled && isNew) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, search]);

  useEffect(() => {
    if (!isNew || !seasonId) return;
    void (async () => {
      try {
        const all = await fetchAllLevelsAdmin(seasonId);
        const max = all.reduce((m, l) => Math.max(m, l.sort_order), 0);
        setSortOrder(max + 1);
      } catch {
        // ignore — deja 1 por defecto
      }
    })();
  }, [isNew, seasonId]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const row = await fetchLevelAdmin(levelId!);
        if (cancelled) return;
        if (!row) {
          setError('Nivel no encontrado');
          return;
        }
        setName(row.name);
        setSortOrder(row.sort_order);
        setIsActive(row.is_active);
        setSeasonId(row.season_id);
        setExistingImagePath(row.image_path);
        setExistingThumbPath(row.thumb_path);
        setConfig({ ...defaultLevelConfig(), ...row.config });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew, levelId]);

  function patchConfig(partial: Partial<LevelConfigJson>) {
    setConfig((c) => ({ ...c, ...partial }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSaving(true);

    try {
      if (!seasonId) throw new Error('Elige una temporada');
      if (!name.trim()) throw new Error('Nombre requerido');

      const defaultPaths = pathsForSortOrder(sortOrder);
      const compressNotes: string[] = [];

      async function uploadPrepared(kind: 'full' | 'thumb', file: File, basePath: string) {
        setInfo(`Comprimiendo ${kind === 'full' ? 'imagen' : 'thumbnail'}…`);
        const prepared = await prepareLevelImage(file, kind);
        const finalPath = basePath.replace(/\.(png|webp|jpe?g)$/i, `.${prepared.ext}`);
        await uploadLevelImage(finalPath, prepared.blob, prepared.contentType);
        compressNotes.push(
          `${kind}: ${formatBytes(prepared.originalBytes)} → ${formatBytes(prepared.finalBytes)}`,
        );
        return finalPath;
      }

      let imagePath = existingImagePath ?? defaultPaths.image_path;
      let thumbPath = existingThumbPath ?? defaultPaths.thumb_path;

      if (fullFile) {
        imagePath = await uploadPrepared('full', fullFile, defaultPaths.image_path);
      }
      if (thumbFile) {
        thumbPath = await uploadPrepared('thumb', thumbFile, defaultPaths.thumb_path);
      } else if (fullFile && (isNew || !existingThumbPath)) {
        thumbPath = await uploadPrepared('thumb', fullFile, defaultPaths.thumb_path);
      }

      const payload = {
        season_id: seasonId,
        name: name.trim(),
        sort_order: sortOrder,
        is_active: isActive,
        config,
        image_path: imagePath,
        thumb_path: thumbPath,
      };

      setInfo('Guardando nivel…');
      const row = isNew ? await createLevel(payload) : await updateLevel(levelId!, payload);

      setExistingImagePath(imagePath);
      setExistingThumbPath(thumbPath);
      setFullFile(null);
      setThumbFile(null);
      setInfo(
        compressNotes.length ? `Guardado · ${compressNotes.join(' · ')}` : 'Guardado',
      );
      if (isNew) {
        navigate(`/admin/levels/${row.id}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="screen-loading">Cargando…</div>;
  }

  const enemyCount = config.enemies?.length ?? 0;
  const enemySpeed = config.enemies?.[0]?.speed ?? 200;
  const hasBomb = config.powerUps?.some((p) => p.type === 'bomb') ?? false;
  const hasLightning = config.powerUps?.some((p) => p.type === 'lightning') ?? false;
  const hasShield = config.powerUps?.some((p) => p.type === 'shield') ?? false;
  const hasFreeze = config.powerUps?.some((p) => p.type === 'freeze') ?? false;
  const hasSpeed = config.powerUps?.some((p) => p.type === 'speed') ?? false;
  const hasHeart = config.powerUps?.some((p) => p.type === 'heart') ?? false;

  return (
    <main className="admin">
      <header className="admin-header">
        <Link className="admin-back" to="/admin">
          ←
        </Link>
        <h1>{isNew ? 'Nuevo nivel' : 'Editar nivel'}</h1>
        <span className="admin-spacer" />
      </header>

      <form className="admin-form" onSubmit={(ev) => void onSubmit(ev)}>
        <label className="admin-field">
          <span>Temporada</span>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            required
            disabled={!isNew}
          >
            <option value="">—</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
        </label>

        <div className="admin-row-fields">
          <label className="admin-field">
            <span>Orden</span>
            <input
              type="number"
              min={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              required
            />
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Activo
          </label>
        </div>

        <fieldset className="admin-fieldset">
          <legend>Gameplay</legend>
          <div className="admin-row-fields">
            <label className="admin-field">
              <span>Objetivo %</span>
              <input
                type="number"
                min={1}
                max={100}
                value={config.targetPct}
                onChange={(e) => patchConfig({ targetPct: Number(e.target.value) })}
              />
            </label>
            <label className="admin-field">
              <span>Vidas</span>
              <input
                type="number"
                min={1}
                max={9}
                value={config.lives}
                onChange={(e) => patchConfig({ lives: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="admin-row-fields">
            <label className="admin-field">
              <span>Vel. jugador</span>
              <input
                type="number"
                min={50}
                max={600}
                value={config.playerSpeed}
                onChange={(e) => patchConfig({ playerSpeed: Number(e.target.value) })}
              />
            </label>
            <label className="admin-field">
              <span>minTimeMs</span>
              <input
                type="number"
                min={0}
                step={500}
                value={config.minTimeMs ?? 8000}
                onChange={(e) => patchConfig({ minTimeMs: Number(e.target.value) })}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Enemigos</legend>
          <div className="admin-row-fields">
            <label className="admin-field">
              <span>Cantidad</span>
              <input
                type="number"
                min={1}
                max={6}
                value={enemyCount || 1}
                onChange={(e) => {
                  const n = Math.max(1, Number(e.target.value));
                  const speed = config.enemies?.[0]?.speed ?? 200;
                  patchConfig({
                    enemies: Array.from({ length: n }, () => ({ type: 'basic', speed })),
                  });
                }}
              />
            </label>
            <label className="admin-field">
              <span>Velocidad</span>
              <input
                type="number"
                min={50}
                max={400}
                value={enemySpeed}
                onChange={(e) => {
                  const speed = Number(e.target.value);
                  const n = config.enemies?.length || 1;
                  patchConfig({
                    enemies: Array.from({ length: n }, () => ({ type: 'basic', speed })),
                  });
                }}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Power-ups</legend>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={hasBomb}
              onChange={(e) => {
                const rest = (config.powerUps ?? []).filter((p) => p.type !== 'bomb');
                patchConfig({
                  powerUps: e.target.checked
                    ? [
                        ...rest,
                        {
                          type: 'bomb',
                          spawn: { delayMs: 8000, max: 2 },
                          params: { radiusCells: 10 },
                        },
                      ]
                    : rest,
                });
              }}
            />
            Bomba
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={hasLightning}
              onChange={(e) => {
                const rest = (config.powerUps ?? []).filter((p) => p.type !== 'lightning');
                patchConfig({
                  powerUps: e.target.checked
                    ? [
                        ...rest,
                        {
                          type: 'lightning',
                          spawn: { delayMs: 12000, max: 1 },
                          params: { targets: 1 },
                        },
                      ]
                    : rest,
                });
              }}
            />
            Rayo
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={hasShield}
              onChange={(e) => {
                const rest = (config.powerUps ?? []).filter((p) => p.type !== 'shield');
                patchConfig({
                  powerUps: e.target.checked
                    ? [
                        ...rest,
                        {
                          type: 'shield',
                          spawn: { delayMs: 10000, max: 2 },
                          params: { durationMs: 5000 },
                        },
                      ]
                    : rest,
                });
              }}
            />
            Escudo
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={hasFreeze}
              onChange={(e) => {
                const rest = (config.powerUps ?? []).filter((p) => p.type !== 'freeze');
                patchConfig({
                  powerUps: e.target.checked
                    ? [
                        ...rest,
                        {
                          type: 'freeze',
                          spawn: { delayMs: 11000, max: 2 },
                          params: { durationMs: 4000 },
                        },
                      ]
                    : rest,
                });
              }}
            />
            Congelación
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={hasSpeed}
              onChange={(e) => {
                const rest = (config.powerUps ?? []).filter((p) => p.type !== 'speed');
                patchConfig({
                  powerUps: e.target.checked
                    ? [
                        ...rest,
                        {
                          type: 'speed',
                          spawn: { delayMs: 9000, max: 2 },
                          params: { multiplier: 1.4, durationMs: 5000 },
                        },
                      ]
                    : rest,
                });
              }}
            />
            Velocidad
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={hasHeart}
              onChange={(e) => {
                const rest = (config.powerUps ?? []).filter((p) => p.type !== 'heart');
                patchConfig({
                  powerUps: e.target.checked
                    ? [
                        ...rest,
                        {
                          type: 'heart',
                          spawn: { delayMs: 15000, max: 1 },
                          params: { lives: 1 },
                        },
                      ]
                    : rest,
                });
              }}
            />
            Corazón (+1 vida)
          </label>
        </fieldset>

        <fieldset className="admin-fieldset">
          <legend>Imágenes (Storage)</legend>
          <p className="admin-hint">
            Sube PNG/JPEG/WebP de hasta 15 MB. Se convierte a WebP y se comprime bajo 400 KB
            automáticamente (full ≤1280px, thumb ≤480px). Paths: level-{sortOrder}/full.webp
          </p>
          <label className="admin-field">
            <span>Imagen completa</span>
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => setFullFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="admin-field">
            <span>Thumbnail (opcional)</span>
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </fieldset>

        {error && <p className="admin-error">{error}</p>}
        {info && <p className="admin-ok">{info}</p>}

        <button className="admin-save" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </main>
  );
}
