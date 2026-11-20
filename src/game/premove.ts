import type { Color, Square } from './types'

/**
 * Where a piece could go on its owner's next turn, before the opponent has
 * moved: the piece's movement pattern with nothing in the way. Blockers are
 * ignored (the opponent's move may clear the line), and so are own pieces on
 * the target (they may be captured first). Whether the move is really legal is
 * checked when it is played.
 */

const FILES = 'abcdefgh'

function parseBoard(fen: string): (string | null)[][] {
  // [file][rank], both 0-based from a1.
  const grid: (string | null)[][] = Array.from({ length: 8 }, () => Array<string | null>(8).fill(null))
  const rows = fen.split(' ')[0].split('/')
  rows.forEach((row, i) => {
    const rank = 7 - i
    let f = 0
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') f += Number(ch)
      else {
        if (f < 8) grid[f][rank] = ch
        f++
      }
    }
  })
  return grid
}

const sq = (f: number, r: number): Square => `${FILES[f]}${r + 1}`
const on = (f: number, r: number) => f >= 0 && f < 8 && r >= 0 && r < 8

const KNIGHT = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
]
const KING = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
]
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]]

/** Premove targets for the piece on `from`, which must belong to `side`. */
export function premoveTargets(fen: string, from: Square, side: Color): { to: Square; capture: boolean }[] {
  const grid = parseBoard(fen)
  const f0 = FILES.indexOf(from[0])
  const r0 = Number(from[1]) - 1
  if (!on(f0, r0)) return []
  const piece = grid[f0][r0]
  if (!piece) return []
  const color: Color = piece === piece.toUpperCase() ? 'w' : 'b'
  if (color !== side) return []
  const type = piece.toLowerCase()
  const out = new Map<Square, boolean>()
  const add = (f: number, r: number) => {
    if (!on(f, r) || (f === f0 && r === r0)) return
    const p = grid[f][r]
    const enemy = !!p && (p === p.toUpperCase() ? 'w' : 'b') !== side
    out.set(sq(f, r), enemy)
  }
  const ray = (dirs: number[][]) => {
    for (const [df, dr] of dirs) for (let k = 1; k < 8; k++) add(f0 + df * k, r0 + dr * k)
  }

  switch (type) {
    case 'n':
      for (const [df, dr] of KNIGHT) add(f0 + df, r0 + dr)
      break
    case 'b':
      ray(BISHOP)
      break
    case 'r':
      ray(ROOK)
      break
    case 'q':
      ray(ROOK)
      ray(BISHOP)
      break
    case 'k': {
      for (const [df, dr] of KING) add(f0 + df, r0 + dr)
      // Castling, while the right is still there: the king goes two squares.
      const rights = fen.split(' ')[2] ?? '-'
      const home = side === 'w' ? 0 : 7
      if (r0 === home && f0 === 4) {
        if (rights.includes(side === 'w' ? 'K' : 'k')) add(6, home)
        if (rights.includes(side === 'w' ? 'Q' : 'q')) add(2, home)
      }
      break
    }
    case 'p': {
      const dir = side === 'w' ? 1 : -1
      const start = side === 'w' ? 1 : 6
      add(f0, r0 + dir)
      if (r0 === start) add(f0, r0 + 2 * dir)
      add(f0 - 1, r0 + dir)
      add(f0 + 1, r0 + dir)
      break
    }
  }
  return [...out].map(([to, capture]) => ({ to, capture }))
}
