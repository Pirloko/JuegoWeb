import { useState } from 'react';
import { TUTORIAL_SLIDES } from './slides';
import './tutorial.css';

interface Props {
  onFinish: () => void;
  /** true = viene de Perfil (repetir); false = primera vez. */
  replaying?: boolean;
}

/** Carrusel de tutorial (React). Saltar o completar llama onFinish. */
export default function TutorialOverlay({ onFinish, replaying = false }: Props) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(Math.max(index, 0), TUTORIAL_SLIDES.length - 1);
  const slide = TUTORIAL_SLIDES[safeIndex]!;
  const isLast = safeIndex >= TUTORIAL_SLIDES.length - 1;

  function next() {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex((i) => i + 1);
  }

  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="tutorial" role="dialog" aria-modal="true" aria-label="Tutorial">
      <div className="tutorial-card">
        <header className="tutorial-top">
          <p className="tutorial-eyebrow">
            {replaying ? 'Repaso rápido' : 'Primera vez · tutorial'}
          </p>
          <button type="button" className="tutorial-skip" onClick={onFinish}>
            Saltar
          </button>
        </header>

        <div className="tutorial-mark" aria-hidden>
          {slide.mark}
        </div>
        <h2 className="tutorial-title">{slide.title}</h2>
        <p className="tutorial-body">{slide.body}</p>

        <div className="tutorial-dots" aria-hidden>
          {TUTORIAL_SLIDES.map((s, i) => (
            <span key={s.id} className={`tutorial-dot${i === safeIndex ? ' is-active' : ''}`} />
          ))}
        </div>

        <div className="tutorial-actions">
          {safeIndex > 0 ? (
            <button type="button" className="tutorial-btn ghost" onClick={prev}>
              Atrás
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="tutorial-btn primary" onClick={next}>
            {isLast ? '¡A jugar!' : 'Siguiente'}
          </button>
        </div>

        <p className="tutorial-step">
          {safeIndex + 1} / {TUTORIAL_SLIDES.length}
        </p>
      </div>
    </div>
  );
}
