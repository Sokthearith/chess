export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Promotion = 'q' | 'r' | 'b' | 'n'
/** Algebraic square, e.g. "e4". */
export type Square = string

export interface PieceOn {
  type: PieceType
  color: Color
}

export interface MoveIntent {
  from: Square
  to: Square
  promotion?: Promotion
}

export interface MoveRecord {
  san: string
  from: Square
  to: Square
  color: Color
  captured?: PieceType
  promotion?: Promotion
  fenAfter: string
}

export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'timeout'

export interface GameResult {
  status: GameStatus
  winner: Color | null
  reason: string
}

/** Everything the board needs to draw one position. Plain data, no chess.js. */
export interface Position {
  fen: string
  /** 8 ranks from rank 8 (index 0) to rank 1 (index 7), each 8 files a..h. */
  grid: (PieceOn | null)[][]
  turn: Color
  lastMove: { from: Square; to: Square } | null
  /** The square of the king in check, if any. */
  checkSquare: Square | null
}

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const

export function squareAt(fileIndex: number, rankIndex: number): Square {
  return `${FILES[fileIndex]}${RANKS[rankIndex]}`
}

export function isDarkSquare(fileIndex: number, rankIndex: number): boolean {
  return (fileIndex + rankIndex) % 2 === 1
}
