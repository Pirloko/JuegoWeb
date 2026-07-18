import './brand-logo.css';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'hero';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  /** Si true, el logo es el h1 de la página (home). */
  asHeading?: boolean;
}

const SIZE_CLASS: Record<BrandLogoSize, string> = {
  sm: 'brand-logo--sm',
  md: 'brand-logo--md',
  lg: 'brand-logo--lg',
  hero: 'brand-logo--hero',
};

/** Logo oficial puntocachero (incluye wordmark). */
export default function BrandLogo({
  size = 'md',
  className = '',
  asHeading = false,
}: BrandLogoProps) {
  const Tag = asHeading ? 'h1' : 'div';
  return (
    <Tag className={`brand-logo ${SIZE_CLASS[size]} ${className}`.trim()}>
      <img
        src="/icons/logo-brand.png"
        alt="puntocachero"
        width={720}
        height={480}
        decoding="async"
        draggable={false}
      />
    </Tag>
  );
}
