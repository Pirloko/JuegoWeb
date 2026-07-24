import type { CSSProperties } from 'react';
import './brand-logo.css';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'hero';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  /** Si true, el logo es el h1 de la página (home). */
  asHeading?: boolean;
  /** Animación de letras (entrada + shimmer). Default true. */
  animated?: boolean;
}

const SIZE_CLASS: Record<BrandLogoSize, string> = {
  sm: 'brand-logo--sm',
  md: 'brand-logo--md',
  lg: 'brand-logo--lg',
  hero: 'brand-logo--hero',
};

const WORD = 'puntocachero';

/** Logo oficial: órbita + wordmark (letras con motion). */
export default function BrandLogo({
  size = 'md',
  className = '',
  asHeading = false,
  animated = true,
}: BrandLogoProps) {
  const Tag = asHeading ? 'h1' : 'div';
  return (
    <Tag
      className={`brand-logo ${SIZE_CLASS[size]} ${animated ? 'brand-logo--animated' : ''} ${className}`.trim()}
    >
      <img
        className="brand-logo-mark"
        src="/icons/logo-mark.png"
        alt=""
        width={128}
        height={128}
        decoding="async"
        draggable={false}
        aria-hidden
      />
      <span className="brand-logo-word" aria-label="puntocachero">
        {WORD.split('').map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            className="brand-logo-letter"
            style={{ '--i': i } as CSSProperties}
          >
            {ch}
          </span>
        ))}
      </span>
    </Tag>
  );
}
