import { milestonesForTotal, seasonProgress } from './progression';
import './season-progress.css';

interface Props {
  completed: number;
  total: number;
  /** `full` (Inicio) muestra ticks de hitos; `compact` (Niveles) es más bajo. */
  variant?: 'full' | 'compact';
}

export default function SeasonProgress({ completed, total, variant = 'full' }: Props) {
  const p = seasonProgress(completed, total);
  if (p.total === 0) return null;

  return (
    <div
      className={`season-progress is-${variant}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={p.total}
      aria-valuenow={p.completed}
      aria-label={`Progreso de temporada: ${p.completed} de ${p.total} niveles`}
    >
      <div className="season-progress-track">
        <div className="season-progress-fill" style={{ width: `${p.pct}%` }} />
        {variant === 'full' &&
          milestonesForTotal(p.total)
            .filter((m) => m < p.total)
            .map((m) => (
              <span
                key={m}
                className={`season-progress-tick${m <= p.completed ? ' is-reached' : ''}`}
                style={{ left: `${(m / p.total) * 100}%` }}
                aria-hidden
              />
            ))}
      </div>
      <div className="season-progress-meta">
        <span className="season-progress-count">
          {p.completed}/{p.total}
        </span>
        {p.nextMilestone != null ? (
          <span className="season-progress-next">Próximo hito: {p.nextMilestone}</span>
        ) : (
          <span className="season-progress-next is-done">Temporada completa</span>
        )}
      </div>
    </div>
  );
}
