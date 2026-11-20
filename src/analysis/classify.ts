import { Chess, type Move, type Square as CjsSquare } from 'chess.js'
import type { Color, PieceType, Square } from '../game/types'

/**
 * Material maths for the review's special grades. Static exchange evaluation
 * is done with chess.js legal moves, so pins and checks are respected.
 */
export const PIECE_VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

/** Net material the side to move wins by starting a capture sequence on `square`, least valuable attacker first. Never negative: they can decline. */
function seeAt(chess: Chess, square: Square, depth = 0): number {
  const target = chess.get(square as CjsSquare)
  if (!target || depth > 12) return 0
  const captures = (chess.moves({ verbose: true }) as Move[]).filter((m) => m.to === square && m.captured)
  if (!captures.length) return 0
  captures.sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece])
  const m = captures[0]
  chess.move(m)
  const gain = PIECE_VALUE[target.type] - seeAt(chess, square, depth + 1)
  chess.undo()
  return Math.max(0, gain)
}

export function staticExchange(fen: string, square: Square): number {
  try {
    return seeAt(new Chess(fen), square)
  } catch {
    return 0
  }
}

/** The same position with the other side to move, or null if that would be illegal (side to move in check). */
function nullMove(fen: string): string | null {
  if (inCheck(fen)) return null
  const parts = fen.split(' ')
  parts[1] = parts[1] === 'w' ? 'b' : 'w'
  parts[3] = '-'
  try {
    return new Chess(parts.join(' ')).fen()
  } catch {
    return null
  }
}

function hangingMaterial(fen: string, owner: Color, skip?: Square): Map<Square, number> {
  const out = new Map<Square, number>()
  let chess: Chess
  try {
    chess = new Chess(fen)
  } catch {
    return out
  }
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell || cell.color !== owner || cell.type === 'k' || cell.type === 'p' || cell.square === skip) continue
      const v = seeAt(chess, cell.square)
      if (v > 0) out.set(cell.square, v)
    }
  }
  return out
}

/**
 * How much material the mover offers with this move, in pawns: the moved
 * piece (less anything it just took) plus any piece newly left en prise.
 * A queen trade or an even recapture scores 0; Bxh7+ answered by Kxh7 scores 2.
 */
/**
 * What the mover wins straight back if the opponent takes on `square` with its cheapest piece:
 * the best single capture then available (by exchange value). A "sacrifice" that wins at least
 * this much back at once is a pseudo-sacrifice (18.Nd4 in Fischer v Spassky, game 6: ...cxd4 opens
 * the a3-e7 diagonal and the queen falls).
 */
export function recoupAfterTaking(fenAfter: string, square: Square): number {
  let chess: Chess
  try {
    chess = new Chess(fenAfter)
  } catch {
    return 0
  }
  const captures = (chess.moves({ verbose: true }) as Move[]).filter((m) => m.to === square && m.captured)
  if (!captures.length) return 0
  captures.sort((a, b) => PIECE_VALUE[a.piece] - PIECE_VALUE[b.piece])
  chess.move(captures[0])
  let best = 0
  for (const row of chess.board()) for (const cell of row) if (cell && cell.color !== chess.turn() && cell.type !== 'k') best = Math.max(best, seeAt(chess, cell.square))
  return best
}

export function sacrificeValue(fenBefore: string, fenAfter: string, to: Square, mover: Color, captured?: PieceType): number {
  const taken = captured ? PIECE_VALUE[captured] : 0
  let moved = Math.max(0, staticExchange(fenAfter, to) - taken)
  if (moved > 0 && recoupAfterTaking(fenAfter, to) >= moved) moved = 0
  const nowHanging = hangingMaterial(fenAfter, mover, to)
  if (!nowHanging.size) return moved
  const passed = nullMove(fenBefore)
  const before = passed ? hangingMaterial(passed, mover) : new Map<Square, number>()
  let left = 0
  for (const [sq, v] of nowHanging) left = Math.max(left, v - (before.get(sq) ?? 0))
  return Math.max(moved, left)
}

/** The most material (in pawns) the mover has en prise after the move, pawns and king excluded. */
export function largestHanging(fenAfter: string, mover: Color): number {
  let max = 0
  for (const [sq, v] of hangingMaterial(fenAfter, mover)) if (recoupAfterTaking(fenAfter, sq) < v) max = Math.max(max, v)
  return max
}

export function inCheck(fen: string): boolean {
  try {
    return new Chess(fen).inCheck()
  } catch {
    return false
  }
}

export function legalMoveCount(fen: string): number {
  try {
    return new Chess(fen).moves().length
  } catch {
    return 0
  }
}
