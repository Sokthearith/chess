import { Chess, type Move } from 'chess.js'
import type { MoveIntent } from '../game/types'
import type { PgnMove } from './pgn'

function toPgnMove(m: Move, ply: number): PgnMove {
  return {
    ply,
    san: m.san,
    lan: m.lan,
    from: m.from,
    to: m.to,
    color: m.color,
    piece: m.piece,
    captured: m.captured,
    fenBefore: m.before,
    fenAfter: m.after,
  }
}

/** Play a move the user made on the review board. `ply` is the ply number the move will have. */
export function playMove(fen: string, intent: MoveIntent, ply: number): PgnMove | null {
  try {
    const c = new Chess(fen)
    const m = c.move({ from: intent.from, to: intent.to, promotion: intent.promotion ?? 'q' })
    return m ? toPgnMove(m, ply) : null
  } catch {
    return null
  }
}

/** Play a long-algebraic move (e2e4, e7e8q). */
export function playLan(fen: string, lan: string, ply: number): PgnMove | null {
  return playMove(fen, { from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: (lan[4] as MoveIntent['promotion']) || undefined }, ply)
}

/** An engine line in SAN, at most `max` plies. Stops quietly at the first move it cannot play. */
export function pvToSan(fen: string, pv: string[], max = 8): string[] {
  const out: string[] = []
  try {
    const c = new Chess(fen)
    for (const lan of pv.slice(0, max)) {
      const m = c.move({ from: lan.slice(0, 2), to: lan.slice(2, 4), promotion: (lan[4] as 'q' | 'r' | 'b' | 'n' | undefined) || undefined })
      if (!m) break
      out.push(m.san)
    }
  } catch {
    /* an illegal tail: keep what was played */
  }
  return out
}

/** Move-numbered SAN: "12… Nf6 13. Bxf6 gxf6". `ply` is the ply of the first move. */
export function numberLine(sans: string[], ply: number): string {
  return sans
    .map((san, i) => {
      const p = ply + i
      const n = Math.ceil(p / 2)
      if (p % 2 === 1) return `${n}. ${san}`
      return i === 0 ? `${n}… ${san}` : san
    })
    .join(' ')
}
