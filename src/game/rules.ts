import { Chess, type Move } from 'chess.js'
import type { MoveIntent, MoveRecord, Position, Square, GameResult, Color, PieceOn } from './types'

/**
 * The only file that talks to chess.js. Everything else sees plain data.
 */
export const START_FEN = new Chess().fen()

export function positionFromFen(fen: string, lastMove: Position['lastMove'] = null): Position {
  const chess = new Chess(fen)
  return snapshot(chess, lastMove)
}

export function snapshot(chess: Chess, lastMove: Position['lastMove']): Position {
  const board = chess.board()
  const grid: (PieceOn | null)[][] = board.map((rank) =>
    rank.map((cell) => (cell ? { type: cell.type, color: cell.color } : null)),
  )
  const turn = chess.turn()
  let checkSquare: Square | null = null
  if (chess.inCheck()) {
    const kings = chess.findPiece({ type: 'k', color: turn })
    checkSquare = kings[0] ?? null
  }
  return { fen: chess.fen(), grid, turn, lastMove, checkSquare }
}

export function legalTargets(fen: string, from: Square): { to: Square; capture: boolean }[] {
  const chess = new Chess(fen)
  const piece = chess.get(from as never)
  if (!piece || piece.color !== chess.turn()) return []
  const seen = new Map<string, boolean>()
  for (const m of chess.moves({ square: from as never, verbose: true }) as Move[]) {
    seen.set(m.to, seen.get(m.to) || Boolean(m.captured))
  }
  return [...seen].map(([to, capture]) => ({ to, capture }))
}

export function needsPromotion(fen: string, intent: MoveIntent): boolean {
  const chess = new Chess(fen)
  const piece = chess.get(intent.from as never)
  if (!piece || piece.type !== 'p') return false
  const targetRank = intent.to[1]
  if ((piece.color === 'w' && targetRank !== '8') || (piece.color === 'b' && targetRank !== '1')) return false
  return (chess.moves({ square: intent.from as never, verbose: true }) as Move[]).some(
    (m) => m.to === intent.to && m.promotion,
  )
}

export function tryMove(fen: string, intent: MoveIntent): { record: MoveRecord; fen: string } | null {
  const chess = new Chess(fen)
  let move: Move | null = null
  try {
    move = chess.move({ from: intent.from, to: intent.to, promotion: intent.promotion ?? 'q' })
  } catch {
    return null
  }
  if (!move) return null
  const record: MoveRecord = {
    san: move.san,
    from: move.from,
    to: move.to,
    color: move.color,
    captured: move.captured,
    promotion: move.promotion as MoveRecord['promotion'],
    fenAfter: chess.fen(),
  }
  return { record, fen: chess.fen() }
}

export function resultOf(fen: string): GameResult | null {
  const chess = new Chess(fen)
  if (chess.isCheckmate()) {
    const winner: Color = chess.turn() === 'w' ? 'b' : 'w'
    return { status: 'checkmate', winner, reason: 'checkmate' }
  }
  if (chess.isStalemate()) return { status: 'stalemate', winner: null, reason: 'stalemate' }
  if (chess.isThreefoldRepetition()) return { status: 'draw', winner: null, reason: 'threefold repetition' }
  if (chess.isInsufficientMaterial()) return { status: 'draw', winner: null, reason: 'insufficient material' }
  if (chess.isDrawByFiftyMoves()) return { status: 'draw', winner: null, reason: 'fifty-move rule' }
  if (chess.isDraw()) return { status: 'draw', winner: null, reason: 'draw' }
  return null
}

/** SAN for a long-algebraic move (e2e4, e7e8q) in the given position, or null if illegal. */
export function sanOf(fen: string, lan: string): string | null {
  try {
    const chess = new Chess(fen)
    const m = chess.move({ from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: (lan[4] as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined })
    return m?.san ?? null
  } catch {
    return null
  }
}
