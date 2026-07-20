import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { LevelConfigJson, LevelMediaType, SeasonRow } from '@/types/database';
import type { PowerUpConfig } from '@/types/level';
import {
  createLevel,
  defaultLevelConfig,
  fetchAllLevelsAdmin,
  fetchLevelAdmin,
  fetchSeasonsAdmin,
  pathsForSortOrder,
  updateLevel,
  uploadLevelImage,
  uploadLevelMedia,
} from '@/services/supabase/admin';
import { formatBytes, prepareLevelImage } from '@/services/images/prepareLevelImage';
import { prepareLevelMedia } from '@/services/images/prepareLevelMedia';
import './admin.css';

/** ISO → valor para input datetime-local (hora local). */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(v).toISOString();
}

type PowerDef = {
  type: PowerUpConfig['type'];
  icon: string;
  label: string;
  hint: string;
  make: () => PowerUpConfig;
};

const POWER_DEFS: PowerDef[] = [
  {
    type: 'bomb',
    icon: '💣',
    label: 'Bomba',
    hint: 'Zona',
    make: () => ({
      type: 'bomb',
      spawn: { delayMs: 8000, max: 2 },
      params: { radiusCells: 10 },
    }),
  },
  {
    type: 'lightning',
    icon: '⚡',
    label: 'Rayo',
    hint: 'Mata',
    make: () => ({
      type: 'lightning',
      spawn: { delayMs: 12000, max: 1 },
      params: { targets: 1 },
    }),
  },
  {
    type: 'shield',
    icon: '🛡️',
    label: 'Escudo',
    hint: 'Protege',
    make: () => ({
      type: 'shield',
      spawn: { delayMs: 10000, max: 2 },
      params: { durationMs: 5000 },
    }),
  },
  {
    type: 'freeze',
    icon: '❄️',
    label: 'Hielo',
    hint: 'Congela',
    make: () => ({
      type: 'freeze',
      spawn: { delayMs: 11000, max: 2 },
      params: { durationMs: 4000 },
    }),
  },
  {
    type: 'speed',
    icon: '💨',
    label: 'Turbo',
    hint: 'Rápido',
    make: () => ({
      type: 'speed',
      spawn: { delayMs: 9000, max: 2 },
      params: { multiplier: 1.4, durationMs: 5000 },
    }),
  },
  {
    type: 'heart',
    icon: '❤️',
    label: 'Vida',
    hint: '+1',
    make: () => ({
      type: 'heart',
      spawn: { delayMs: 15000, max: 1 },
      params: { lives: 1 },
    }),
  },
  {
    type: 'clock',
    icon: '⏱️',
    label: 'Reloj',
    hint: '+15s',
    make: () => ({
      type: 'clock',
      spawn: { delayMs: 14000, max: 2 },
      params: { addSec: 15 },
    }),
  },
];

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
  const [availableAtLocal, setAvailableAtLocal] = useState('');
  const [config, setConfig] = useState<LevelConfigJson>(defaultLevelConfig);
  const [fullFile, setFullFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [existingThumbPath, setExistingThumbPath] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<LevelMediaType>('image');
  const [requiresPass, setRequiresPass] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [existingMediaPath, setExistingMediaPath] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
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
        /* ignore */
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
        setAvailableAtLocal(isoToLocalInput(row.available_at));
        setSeasonId(row.season_id);
        setExistingImagePath(row.image_path);
        setExistingThumbPath(row.thumb_path);
        setMediaType(row.media_type ?? 'image');
        setRequiresPass(Boolean(row.requires_pass));
        setExistingMediaPath(row.media_path ?? null);
        setSourceUrl(row.source_url ?? '');
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

  function togglePower(def: PowerDef, on: boolean) {
    const rest = (config.powerUps ?? []).filter((p) => p.type !== def.type);
    patchConfig({ powerUps: on ? [...rest, def.make()] : rest });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSaving(true);

    try {
      if (!seasonId) throw new Error('Elige una temporada');
      if (!name.trim()) throw new Error('Nombre requerido');
      if (sourceUrl.trim() && !/^https?:\/\//i.test(sourceUrl.trim())) {
        throw new Error('El link de origen debe empezar con http(s)://');
      }

      const defaultPaths = pathsForSortOrder(sortOrder);
      const compressNotes: string[] = [];

      // Foto fija siempre obligatoria: es el fondo que se revela en partida.
      if (!fullFile && !existingImagePath) {
        throw new Error(
          mediaType === 'image'
            ? 'Sube la imagen del nivel'
            : 'Sube la foto de perfil (fondo que se revela en partida)',
        );
      }

      let mediaPath = existingMediaPath;
      if (mediaType === 'image') {
        mediaPath = null;
      } else if (mediaFile) {
        setInfo('Validando media…');
        const prepared = await prepareLevelMedia(mediaFile, mediaType);
        mediaPath = `level-${sortOrder}/media.${prepared.ext}`;
        setInfo('Subiendo media…');
        await uploadLevelMedia(mediaPath, prepared.file, prepared.contentType);
      } else if (!mediaPath) {
        throw new Error(mediaType === 'gif' ? 'Sube el GIF del nivel' : 'Sube el video del nivel');
      }

      async function uploadPrepared(kind: 'full' | 'thumb', file: File, basePath: string) {
        setInfo(`Comprimiendo ${kind === 'full' ? 'imagen' : 'miniatura'}…`);
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
        media_type: mediaType,
        media_path: mediaPath,
        source_url: sourceUrl.trim() || null,
        available_at: localInputToIso(availableAtLocal),
        requires_pass: requiresPass,
      };

      setInfo('Guardando nivel…');
      const row = isNew ? await createLevel(payload) : await updateLevel(levelId!, payload);

      setExistingImagePath(imagePath);
      setExistingThumbPath(thumbPath);
      setExistingMediaPath(mediaPath);
      setFullFile(null);
      setThumbFile(null);
      setMediaFile(null);
      setInfo(compressNotes.length ? `Guardado · ${compressNotes.join(' · ')}` : 'Guardado');
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

  return (
    <main className="admin admin-level-form">
      <header className="admin-header">
        <Link className="admin-back" to="/admin/niveles">
          ←
        </Link>
        <h1>{isNew ? 'Nuevo nivel' : 'Editar nivel'}</h1>
        <span className="admin-spacer" />
      </header>

      <form className="admin-form" onSubmit={(ev) => void onSubmit(ev)}>
        {/* —— Datos básicos —— */}
        <fieldset className="admin-fieldset">
          <legend>Datos básicos</legend>

          <label className="admin-field">
            <span>Temporada</span>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              required
              disabled={!isNew}
            >
              <option value="">Elige temporada</option>
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
              placeholder="Ej. Mirador cachero"
            />
          </label>

          <div className="admin-row-fields">
            <label className="admin-field">
              <span>Nº de orden</span>
              <input
                type="number"
                min={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                required
              />
            </label>
            <label className="admin-check admin-check--card">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Visible para jugadores
            </label>
          </div>

          <label className="admin-field">
            <span>Disponible desde (goteo · vacío = ya)</span>
            <input
              type="datetime-local"
              value={availableAtLocal}
              onChange={(e) => setAvailableAtLocal(e.target.value)}
            />
          </label>
        </fieldset>

        {/* —— Dificultad —— */}
        <fieldset className="admin-fieldset">
          <legend>Dificultad</legend>
          <div className="admin-row-fields">
            <label className="admin-field">
              <span>Meta de conquista %</span>
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
              <span>Cronómetro (segundos)</span>
              <input
                type="number"
                min={0}
                max={600}
                step={5}
                value={config.timeLimitSec ?? 120}
                onChange={(e) => patchConfig({ timeLimitSec: Number(e.target.value) })}
              />
            </label>
            <label className="admin-field">
              <span>Velocidad del jugador</span>
              <input
                type="number"
                min={50}
                max={600}
                value={config.playerSpeed}
                onChange={(e) => patchConfig({ playerSpeed: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="admin-hint">
            Cronómetro: <strong>120</strong> es el default. Pon <strong>0</strong> para jugar sin
            límite de tiempo.
          </p>
        </fieldset>

        {/* —— Enemigos —— */}
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

        {/* —— Power-ups —— */}
        <fieldset className="admin-fieldset">
          <legend>Power-ups</legend>
          <p className="admin-hint">Toca para activar o desactivar en este nivel.</p>
          <div className="admin-power-grid">
            {POWER_DEFS.map((def) => {
              const on = (config.powerUps ?? []).some((p) => p.type === def.type);
              return (
                <button
                  key={def.type}
                  type="button"
                  className={`admin-power-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => togglePower(def, !on)}
                >
                  <span aria-hidden>{def.icon}</span>
                  <strong>{def.label}</strong>
                  <small>{def.hint}</small>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* —— Contenido del nivel —— */}
        <fieldset className="admin-fieldset">
          <legend>Contenido del nivel</legend>
          <p className="admin-hint">
            Elige qué desbloquea el jugador al completar. En partida siempre se revela una{' '}
            <strong>foto fija</strong>; el GIF/video solo se ve después, en el resultado y la
            galería.
          </p>

          <div className="admin-media-type" role="group" aria-label="Tipo de contenido">
            {(
              [
                { id: 'image', label: 'Imagen', hint: 'Solo foto' },
                { id: 'gif', label: 'GIF', hint: 'Con movimiento' },
                { id: 'video', label: 'Video', hint: 'Máx. 20 s' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`admin-media-chip${mediaType === opt.id ? ' is-on' : ''}`}
                aria-pressed={mediaType === opt.id}
                onClick={() => {
                  setMediaType(opt.id);
                  if (opt.id === 'image') setMediaFile(null);
                }}
              >
                <strong>{opt.label}</strong>
                <small>{opt.hint}</small>
              </button>
            ))}
          </div>

          <label className="admin-check admin-check--card">
            <input
              type="checkbox"
              checked={requiresPass}
              onChange={(e) => setRequiresPass(e.target.checked)}
            />
            <span>
              Requiere membresía (pase)
              <small className="admin-check-sub">
                Si está apagado, el nivel es gratis aunque tenga GIF o video
              </small>
            </span>
          </label>

          {mediaType !== 'image' && (
            <>
              <label className="admin-field">
                <span>
                  {mediaType === 'gif' ? '1. Archivo GIF (premio)' : '1. Archivo de video (premio)'}
                </span>
                <input
                  type="file"
                  accept={mediaType === 'gif' ? 'image/gif' : 'video/mp4,video/webm'}
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="admin-hint">
                {mediaType === 'gif' ? 'GIF hasta 12 MB.' : 'MP4/WebM ≤ 20 s y 12 MB.'} Se
                reproduce al completar el nivel y en la galería.
              </p>
              {mediaFile && <p className="admin-ok">{mediaFile.name}</p>}
              {existingMediaPath && !mediaFile && (
                <p className="admin-hint">Actual: {existingMediaPath}</p>
              )}
            </>
          )}

          <label className="admin-field">
            <span>
              {mediaType === 'image'
                ? 'Imagen del nivel (fondo en partida)'
                : '2. Foto de perfil (fondo en partida)'}
            </span>
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => setFullFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="admin-hint">
            {mediaType === 'image'
              ? 'PNG/JPEG/WebP hasta 15 MB (se comprime sola). Es lo que se revela al conquistar.'
              : 'Frame o portada del GIF/video. Obligatoria: es lo único que se ve mientras se juega (sin movimiento). PNG/JPEG/WebP hasta 15 MB.'}
            {existingImagePath ? ` · Actual: ${existingImagePath}` : ''}
          </p>
          {fullFile && <p className="admin-ok">{fullFile.name}</p>}

          <label className="admin-field">
            <span>Miniatura para listados (opcional)</span>
            <input
              type="file"
              accept="image/png,image/webp,image/jpeg"
              onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {thumbFile && <p className="admin-ok">{thumbFile.name}</p>}

          <label className="admin-field">
            <span>Link de origen (opcional)</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </label>
        </fieldset>

        {/* —— Avanzado —— */}
        <details className="admin-advanced">
          <summary>Avanzado · anti-trampas</summary>
          <label className="admin-field">
            <span>Tiempo mínimo para validar victoria (ms)</span>
            <input
              type="number"
              min={0}
              step={500}
              value={config.minTimeMs ?? 8000}
              onChange={(e) => patchConfig({ minTimeMs: Number(e.target.value) })}
            />
          </label>
          <p className="admin-hint">
            El servidor ignora un “gané” más rápido que esto (evita cheats). Habitual:{' '}
            <strong>8000 = 8 segundos</strong>. No es el cronómetro de la partida.
          </p>
        </details>

        {error && <p className="admin-error">{error}</p>}
        {info && <p className="admin-ok">{info}</p>}

        <button className="admin-save" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : isNew ? 'Crear nivel' : 'Guardar cambios'}
        </button>
      </form>
    </main>
  );
}
