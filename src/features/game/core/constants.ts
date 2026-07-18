export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const CELL = 16;
export const COLS = GAME_WIDTH / CELL; // 45
export const ROWS = GAME_HEIGHT / CELL; // 80
export const BORDER_CELLS = 2; // zona segura perimetral inicial

export const COLORS = {
  free: 0x171a2c,
  conquered: 0x37306b,
  trail: 0x6ee7b7,
  player: 0xffffff,
  enemy: 0xf472b6,
} as const;
