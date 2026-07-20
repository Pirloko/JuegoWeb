import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  /** Si true, cubre el contenido al ocultar la pestaña (mitiga capturas rápidas). */
  obscureOnHide?: boolean;
}

/**
 * Mitigaciones anti-copia en web (no son DRM absoluto):
 * - sin menú contextual / drag
 * - overlay negro al ir a segundo plano
 */
export default function ContentShield({ children, className, obscureOnHide = true }: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!obscureOnHide) return;
    const onVis = () => setHidden(document.visibilityState === 'hidden');
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [obscureOnHide]);

  return (
    <div
      className={`content-shield${className ? ` ${className}` : ''}${hidden ? ' is-obscured' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      {hidden && <div className="content-shield-cover" aria-hidden />}
    </div>
  );
}
