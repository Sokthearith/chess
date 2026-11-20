import type { Color, PieceOn, Square } from '../game/types'
import { FILES, RANKS } from '../game/types'

export interface Motion {
  /** Changes each time, so CSS animations restart on the same square. */
  id: number
  /** Pieces that slide in, keyed by where they land; dx/dy in squares, display orientation, from the origin. */
  slides: Map<Square, { dx: number; dy: number }>
  /** Pieces that left the board, drawn once more on their square while they fade. */
  ghosts: Map<Square, PieceOn>
  /** Pieces that came back from nowhere (a capture undone): they fade in. */
  appears: Set<Square>
}

let nextId = 1

type Grid = (PieceOn | null)[][]

const same = (a: PieceOn | null, b: PieceOn | null) => a?.type === b?.type && a?.color === b?.color

/**
 * Work out how one position became the next. Pieces that vanished from one
 * square and appeared on another are matched by kind (then by colour, for a
 * promotion), nearest first. Anything bigger than one move in either
 * direction (a jump to the end of a game) returns null: it just cuts.
 */
export function diffPositions(before: Grid, after: Grid, orientation: Color, skip: Square | null = null): Motion | null {
  const removed: { sq: Square; p: PieceOn; f: number; r: number }[] = []
  const added: { sq: Square; p: PieceOn; f: number; r: number }[] = []
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const a = before[r]?.[f] ?? null
      const b = after[r]?.[f] ?? null
      if (same(a, b)) continue
      const sq = `${FILES[f]}${RANKS[r]}`
      if (a) removed.push({ sq, p: a, f, r })
      if (b) added.push({ sq, p: b, f, r })
    }
  }
  if (!added.length && !removed.length) return null
  if (added.length > 2 || removed.length > 3) return null

  const sign = orientation === 'w' ? 1 : -1
  const slides = new Map<Square, { dx: number; dy: number }>()
  const used = new Set<Square>()
  const unmatched: typeof added = []

  const match = (pass: 'kind' | 'colour') => {
    const pending = pass === 'kind' ? added : unmatched.splice(0)
    for (const a of pending) {
      let best: (typeof removed)[number] | null = null
      let bestD = Infinity
      for (const r of removed) {
        if (used.has(r.sq) || r.p.color !== a.p.color) continue
        if (pass === 'kind' && r.p.type !== a.p.type) continue
        if (pass === 'colour' && r.p.type !== 'p' && a.p.type !== 'p') continue
        const d = Math.hypot(r.f - a.f, r.r - a.r)
        if (d < bestD) {
          bestD = d
          best = r
        }
      }
      if (best) {
        used.add(best.sq)
        if (a.sq !== skip) slides.set(a.sq, { dx: (best.f - a.f) * sign, dy: (best.r - a.r) * sign })
      } else if (pass === 'kind') unmatched.push(a)
      else unmatched.push(a)
    }
  }
  match('kind')
  match('colour')

  const ghosts = new Map<Square, PieceOn>()
  for (const r of removed) if (!used.has(r.sq)) ghosts.set(r.sq, r.p)
  const appears = new Set(unmatched.map((a) => a.sq))
  if (!slides.size && !ghosts.size && !appears.size) return null
  return { id: nextId++, slides, ghosts, appears }
}
