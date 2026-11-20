import type { PieceType } from '../game/types'

/**
 * Original silhouette pieces on a 45 x 45 grid.
 * `body` is the filled silhouette (several subpaths; the halo trick hides the seams).
 * `detail` is drawn on top in the contrasting colour: an eye, a slit, a seam.
 */
export interface PieceShape {
  body: string
  detail?: string
}

const BASE = 'M11 39h23v-6h-23z'

export const PIECES: Record<PieceType, PieceShape> = {
  p: {
    body: [
      BASE,
      'M18 20h9l3.5 14h-16z',
      'M16 20.5h13v-3h-13z',
      'M17 12.5a5.5 5.5 0 1 1 11 0a5.5 5.5 0 1 1 -11 0z',
    ].join(''),
  },
  r: {
    body: [
      BASE,
      'M15.5 34h14l-1-17h-12z',
      'M12.5 17h20v-9h-4.5v3.5h-3.5v-3.5h-4v3.5h-3.5v-3.5h-4.5z',
    ].join(''),
    detail: 'M16.5 21h12',
  },
  n: {
    body: [
      BASE,
      'M11 34c3-1 5-3 6.5-6.5l-1-2.5-2.5-1-2 2-3-1v-3l4-5 6-5 2-5 3 4 4-3-1 7c4 5 6 10 6 17v6h-23z',
    ].join(''),
    detail: 'M19.5 16.5a1.2 1.2 0 1 1 0.01 0z M15 27.5l-1 5',
  },
  b: {
    body: [
      BASE,
      'M16 34h13l-2.5-11h-8z',
      'M15 23.5h15v-3h-15z',
      'M16 14a6.5 8 0 1 1 13 0a6.5 8 0 1 1 -13 0z',
      'M20.5 4.5a2 2 0 1 1 4 0a2 2 0 1 1 -4 0z',
    ].join(''),
    detail: 'M23 8.5l4 6.5',
  },
  q: {
    body: [
      BASE,
      'M15.5 34h14l-2-11.5h-10z',
      'M13 22.5h19l2-11-5 4.5-2.5-8-4 7.5-4-7.5-2.5 8-5-4.5z',
      'M9 9.5a1.9 1.9 0 1 1 3.8 0a1.9 1.9 0 1 1 -3.8 0z',
      'M16.6 5.5a1.9 1.9 0 1 1 3.8 0a1.9 1.9 0 1 1 -3.8 0z',
      'M24.6 5.5a1.9 1.9 0 1 1 3.8 0a1.9 1.9 0 1 1 -3.8 0z',
      'M32.2 9.5a1.9 1.9 0 1 1 3.8 0a1.9 1.9 0 1 1 -3.8 0z',
    ].join(''),
    detail: 'M15 26h15',
  },
  k: {
    body: [
      BASE,
      'M15.5 34h14l-2-13h-10z',
      'M13.5 21.5h18c1-5-2-8-5.5-7l-3.5 2.5-3.5-2.5c-3.5-1-6.5 2-5.5 7z',
      'M21 2.5h3v4.5h4.5v3h-4.5v6h-3v-6h-4.5v-3h4.5z',
    ].join(''),
    detail: 'M15 25h15',
  },
}

export const PIECE_NAMES: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
}
