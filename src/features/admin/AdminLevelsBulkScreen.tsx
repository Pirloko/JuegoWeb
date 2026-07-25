import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createLevel,
  fetchAllLevelsAdmin,
  fetchSeasonsAdmin,
  findLevelByImageSha256,
  formatImageDuplicate,
  pathsForLevel,
  uploadLevelImage,
} from '@/services/supabase/admin';
import { configForSeasonSlot, describeSlot, SEASON_CURVE_SLOTS } from '@/features/progression/levelCurve';
import { prepareLevelImage } from '@/services/images/prepareLevelImage';
import { sha256Hex } from '@/services/images/sha256';
import type { SeasonRow } from '@/types/database';
import './admin.css';

/** "foto2" antes que "foto10": el orden de los archivos define el de los niveles. */
const byName = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

type RowStatus = 'pending' | 'working' | 'done' | 'error' | 'duplicate';

interface PlannedLevel {
  file: File;
  slot: number;
  sha256: string;
  status: RowStatus;
  message: string | null;
}

/** Primeros `count` números libres a partir del 1 que no estén ya usados. */
function freeSlots(taken: ReadonlySet<number>, count: number): number[] {
  const slots: number[] = [];
  let candidate = 1;
  while (slots.length < count) {
    if (!taken.has(candidate)) slots.push(candidate);
    candidate += 1;
  }
  return slots;
}

export default function AdminLevelsBulkScreen() {
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [seasonId, setSeasonId] = useState(search.get('season') ?? '');
  const [takenSlots, setTakenSlots] = useState<Set<number>>(new Set());
  const [namePrefix, setNamePrefix] = useState('Nivel');
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState<PlannedLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchSeasonsAdmin();
        setSeasons(list);
        setSeasonId((prev) => prev || search.get('season') || list[0]?.id || '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar temporadas');
      } finally {
        setLoading(false);
      }
    })();
  }, [search]);

  const loadTaken = useCallback(async (sid: string) => {
    if (!sid) {
      setTakenSlots(new Set());
      return;
    }
    const levels = await fetchAllLevelsAdmin(sid);
    setTakenSlots(new Set(levels.map((l) => l.sort_order)));
  }, []);

  useEffect(() => {
    if (!seasonId) return;
    void loadTaken(seasonId).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Error al leer los niveles');
    });
  }, [seasonId, loadTaken]);

  const season = useMemo(() => seasons.find((s) => s.id === seasonId) ?? null, [seasons, seasonId]);

  async function onPickFiles(list: FileList | null) {
    setFinished(false);
    setError(null);
    const files = Array.from(list ?? []).sort((a, b) => byName.compare(a.name, b.name));
    if (files.length === 0) {
      setRows([]);
      return;
    }

    setScanning(true);
    setProgress(`Analizando ${files.length} fotos…`);
    try {
      const hashed: { file: File; sha256: string }[] = [];
      for (const file of files) {
        hashed.push({ file, sha256: await sha256Hex(file) });
      }

      const seenInBatch = new Map<string, string>();
      const candidates: { file: File; sha256: string; status: RowStatus; message: string | null }[] =
        [];

      for (const item of hashed) {
        const firstName = seenInBatch.get(item.sha256);
        if (firstName) {
          candidates.push({
            file: item.file,
            sha256: item.sha256,
            status: 'duplicate',
            message: `Duplicada en este lote (igual que «${firstName}»)`,
          });
          continue;
        }
        seenInBatch.set(item.sha256, item.file.name);

        const dup = await findLevelByImageSha256(item.sha256);
        if (dup) {
          candidates.push({
            file: item.file,
            sha256: item.sha256,
            status: 'duplicate',
            message: formatImageDuplicate(dup),
          });
          continue;
        }

        candidates.push({
          file: item.file,
          sha256: item.sha256,
          status: 'pending',
          message: null,
        });
      }

      const creatable = candidates.filter((c) => c.status === 'pending');
      const slots = freeSlots(takenSlots, creatable.length);
      let slotIdx = 0;
      setRows(
        candidates.map((c) => {
          if (c.status !== 'pending') {
            return { ...c, slot: 0 };
          }
          const slot = slots[slotIdx]!;
          slotIdx += 1;
          return { ...c, slot };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron analizar las fotos');
      setRows([]);
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }

  function patchRow(index: number, patch: Partial<PlannedLevel>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function createAll() {
    if (!season) {
      setError('Elige una temporada');
      return;
    }
    const pending = rows.filter((r) => r.status === 'pending' || r.status === 'error');
    if (pending.length === 0) {
      setError('No hay fotos nuevas para crear (todas son duplicadas o ya listas)');
      return;
    }

    setRunning(true);
    setFinished(false);
    setError(null);

    let created = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      if (row.status === 'done' || row.status === 'duplicate') continue;

      patchRow(i, { status: 'working', message: null });
      setProgress(`Nivel ${row.slot} · ${created + 1} de ${pending.length}`);

      try {
        // Re-check por si otro tab creó el mismo hash mientras tanto.
        const dup = await findLevelByImageSha256(row.sha256);
        if (dup) {
          patchRow(i, { status: 'duplicate', message: formatImageDuplicate(dup) });
          continue;
        }

        const paths = pathsForLevel(season.slug, row.slot);

        const full = await prepareLevelImage(row.file, 'full');
        const imagePath = `${paths.folder}/full.${full.ext}`;
        await uploadLevelImage(imagePath, full.blob, full.contentType);

        const thumb = await prepareLevelImage(row.file, 'thumb');
        const thumbPath = `${paths.folder}/thumb.${thumb.ext}`;
        await uploadLevelImage(thumbPath, thumb.blob, thumb.contentType);

        await createLevel({
          season_id: season.id,
          name: `${namePrefix.trim() || 'Nivel'} ${row.slot}`,
          sort_order: row.slot,
          is_active: isActive,
          config: configForSeasonSlot(row.slot),
          image_path: imagePath,
          thumb_path: thumbPath,
          media_type: 'image',
          media_path: null,
          source_url: null,
          available_at: null,
          requires_pass: false,
          image_sha256: row.sha256,
        });

        created += 1;
        patchRow(i, { status: 'done', message: 'Creado' });
      } catch (e) {
        patchRow(i, {
          status: 'error',
          message: e instanceof Error ? e.message : 'Error al crear',
        });
      }
    }

    setProgress(null);
    setRunning(false);
    setFinished(true);
    if (created > 0) {
      await loadTaken(season.id).catch(() => undefined);
    }
  }

  if (loading) {
    return <div className="screen-loading">Cargando…</div>;
  }

  const doneCount = rows.filter((r) => r.status === 'done').length;
  const errorCount = rows.filter((r) => r.status === 'error').length;
  const dupCount = rows.filter((r) => r.status === 'duplicate').length;
  const pendingCount = rows.filter((r) => r.status === 'pending' || r.status === 'error').length;
  const overflow = rows.filter((r) => r.slot > SEASON_CURVE_SLOTS).length;
  const creatableCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <main className="admin admin-level-form">
      <header className="admin-header">
        <Link className="admin-back" to="/admin/niveles">
          ←
        </Link>
        <h1>Crear en lote</h1>
        <span className="admin-spacer" />
      </header>

      <fieldset className="admin-fieldset">
        <legend>Temporada</legend>
        <label className="admin-field">
          <span>Dónde se crean</span>
          <select
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            disabled={running || scanning}
          >
            <option value="">Elige temporada</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-hint">
          Ya hay <strong>{takenSlots.size}</strong> niveles aquí. Los nuevos toman los números
          libres siguientes. Una misma foto no se puede usar en dos niveles.
        </p>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>Imágenes</legend>
        <label className="admin-field">
          <span>Fotos (una por nivel · sin repetir)</span>
          <input
            type="file"
            accept="image/png,image/webp,image/jpeg"
            multiple
            disabled={running || scanning}
            onChange={(e) => void onPickFiles(e.target.files)}
          />
        </label>
        <p className="admin-hint">
          Se ordenan por nombre de archivo. Si una foto ya está en otro nivel (o se repite en el
          lote), se bloquea y no se sube.
        </p>

        <div className="admin-row-fields">
          <label className="admin-field">
            <span>Nombre base</span>
            <input
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              maxLength={40}
              disabled={running}
              placeholder="Nivel"
            />
          </label>
          <label className="admin-check admin-check--card">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={running}
            />
            Visibles para jugadores
          </label>
        </div>
      </fieldset>

      {rows.length > 0 && (
        <fieldset className="admin-fieldset">
          <legend>
            {creatableCount} nuevas
            {dupCount > 0 ? ` · ${dupCount} bloqueadas` : ''}
          </legend>
          {overflow > 0 && (
            <p className="admin-hint">
              {overflow} pasan del nivel {SEASON_CURVE_SLOTS}: se crean igual, con la dificultad del
              tramo final.
            </p>
          )}
          <ul className="admin-bulk-list">
            {rows.map((row, i) => (
              <li key={`${row.file.name}-${i}`} className={`admin-bulk-row is-${row.status}`}>
                <span className="admin-order">{row.slot > 0 ? row.slot : '—'}</span>
                <span className="admin-row-meta">
                  <strong>{row.file.name}</strong>
                  <span>
                    {row.message ??
                      (row.status === 'pending' ? describeSlot(row.slot) : row.status)}
                  </span>
                </span>
                <span className="admin-bulk-state" aria-hidden>
                  {row.status === 'done' ? '✓' : row.status === 'error' || row.status === 'duplicate' ? '✕' : ''}
                </span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {error && <p className="admin-error">{error}</p>}
      {(progress || scanning) && <p className="admin-ok">{progress ?? 'Analizando…'}</p>}
      {finished && (
        <p className={errorCount > 0 ? 'admin-error' : 'admin-ok'}>
          {doneCount} creados
          {dupCount > 0 ? ` · ${dupCount} duplicadas` : ''}
          {errorCount > 0 ? ` · ${errorCount} con error` : ''}
        </p>
      )}

      <button
        className="admin-save"
        type="button"
        disabled={running || scanning || creatableCount === 0 || !seasonId}
        onClick={() => void createAll()}
      >
        {running
          ? 'Creando…'
          : finished && errorCount > 0
            ? `Reintentar ${pendingCount} restantes`
            : `Crear ${creatableCount} niveles`}
      </button>

      {finished && doneCount > 0 && (
        <button
          className="btn-ghost admin-link"
          type="button"
          onClick={() => navigate(`/admin/niveles?season=${seasonId}`)}
        >
          Ver los niveles
        </button>
      )}
    </main>
  );
}
