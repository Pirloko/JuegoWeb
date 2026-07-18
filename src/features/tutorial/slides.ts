export interface TutorialSlide {
  id: string;
  title: string;
  body: string;
  /** Letra/emoji visual simple del slide (sin assets externos). */
  mark: string;
}

export const TUTORIAL_SLIDES: TutorialSlide[] = [
  {
    id: 'goal',
    mark: '▣',
    title: 'Conquista y revela',
    body: 'Cierra áreas de territorio. Al llegar al % del nivel, revelas el contenido oculto. Wena cachero.',
  },
  {
    id: 'move',
    mark: '◎',
    title: 'Muévete desde el borde',
    body: 'Usa el joystick (o flechas en desktop). El borde ya conquistado es tu zona segura.',
  },
  {
    id: 'claim',
    mark: '◇',
    title: 'Cierra un área',
    body: 'Sal del borde, dibuja un rastro y vuelve a zona segura. El área cerrada queda conquistada.',
  },
  {
    id: 'danger',
    mark: '✕',
    title: 'Cuerpo y rastro',
    body: 'Si un enemigo te toca a ti o tu rastro abierto, pierdes una vida. Vuelve al borde a tiempo.',
  },
  {
    id: 'gallery',
    mark: '☆',
    title: 'Galería y más',
    body: 'Lo revelado vive en Galería. Ahí puedes ver el origen, dejar reseña y descubrir sitios amigos.',
  },
];
