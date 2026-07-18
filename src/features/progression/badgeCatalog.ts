/**
 * Catálogo visual de medallas. La elegibilidad la decide la DB
 * (award_badges() en supabase/migrations/00015_user_badges.sql); aquí solo
 * viven ids, nombres, copy de marca e íconos. Añadir una medalla nueva =
 * ampliar la RPC + una entrada aquí.
 */

export type BadgeId =
  | 'first_conquest'
  | 'three_stars'
  | 'free_block'
  | 'season_10'
  | 'season_25'
  | 'season_50'
  | 'season_70'
  | 'first_special';

export interface BadgeDef {
  id: BadgeId;
  name: string;
  /** Cómo se gana (visible también en pendientes, sin spoiler de contenido). */
  description: string;
  /** Celebración corta al ganarla. Tono puntocachero: premium + juguetón. */
  earnedPhrase: string;
  /** Glifo simple para el círculo de la medalla (no emoji spam). */
  icon: string;
}

export const BADGE_CATALOG: Record<BadgeId, BadgeDef> = {
  first_conquest: {
    id: 'first_conquest',
    name: 'Primera conquista',
    description: 'Completa tu primer nivel.',
    earnedPhrase: 'La primera cae. Wena cachero.',
    icon: '⚑',
  },
  three_stars: {
    id: 'three_stars',
    name: 'Tres estrellas',
    description: 'Consigue 3★ en un nivel (conquista casi total).',
    earnedPhrase: 'Nivel impecable. Cachero fino.',
    icon: '★',
  },
  free_block: {
    id: 'free_block',
    name: 'Barrio libre',
    description: 'Completa el bloque free (niveles 1–7).',
    earnedPhrase: 'El bloque free es tuyo, cachero.',
    icon: '7',
  },
  season_10: {
    id: 'season_10',
    name: 'Diez conquistas',
    description: 'Completa 10 niveles de una temporada.',
    earnedPhrase: 'Diez y contando, cachero.',
    icon: '10',
  },
  season_25: {
    id: 'season_25',
    name: 'Veinticinco piezas',
    description: 'Completa 25 niveles de una temporada.',
    earnedPhrase: 'Un cuarto de temporada al bolsillo.',
    icon: '25',
  },
  season_50: {
    id: 'season_50',
    name: 'Mitad y más',
    description: 'Completa 50 niveles de una temporada.',
    earnedPhrase: 'Cincuenta. Esto va en serio, cachero.',
    icon: '50',
  },
  season_70: {
    id: 'season_70',
    name: 'Temporada completa',
    description: 'Completa los 70 niveles de una temporada.',
    earnedPhrase: 'Temporada entera. El cachero total.',
    icon: '70',
  },
  first_special: {
    id: 'first_special',
    name: 'Contenido especial',
    description: 'Revela tu primer GIF o video oculto.',
    earnedPhrase: 'Se movió la cosa, cachero.',
    icon: '▶',
  },
};

export const BADGE_ORDER: BadgeId[] = [
  'first_conquest',
  'three_stars',
  'free_block',
  'first_special',
  'season_10',
  'season_25',
  'season_50',
  'season_70',
];

export function isBadgeId(id: string): id is BadgeId {
  return id in BADGE_CATALOG;
}
