/**
 * Puzzles from the lichess puzzle database (CC0, database.lichess.org):
 * a curated slice of well-rated, widely played positions, built into
 * `puzzles.json` and loaded lazily. The FEN is the position before the
 * opponent's move; `moves[0]` is that move and the solution follows.
 */
export interface Puzzle {
  id: string
  fen: string
  moves: string[]
  rating: number
  themes: string[]
  openings: string[]
}

interface Raw {
  themes: string[]
  openings: string[]
  puzzles: [string, string, string, number, number[], number[]][]
}

let pending: Promise<Puzzle[]> | null = null

export function loadPuzzles(): Promise<Puzzle[]> {
  pending ??= import('./puzzles.json').then((m) => {
    const raw = (m as unknown as { default: Raw }).default
    return raw.puzzles.map(([id, fen, moves, rating, t, o]) => ({
      id,
      fen,
      moves: moves.split(' '),
      rating,
      themes: t.map((i) => raw.themes[i]),
      openings: o.map((i) => raw.openings[i]),
    }))
  })
  return pending
}

export interface PuzzleFilter {
  theme?: string | null
  opening?: string | null
}

export function matches(p: Puzzle, f: PuzzleFilter): boolean {
  if (f.theme && !p.themes.includes(f.theme)) return false
  if (f.opening && !p.openings.includes(f.opening)) return false
  return true
}

/**
 * The next puzzle: unsolved, matching the filter, close to the player's rating
 * (a random pick from the nearest dozen, so the order is not fixed).
 */
export function nextPuzzle(all: Puzzle[], f: PuzzleFilter, rating: number, solved: Set<string>, skip: string | null): Puzzle | null {
  const pool = all.filter((p) => matches(p, f) && p.id !== skip)
  if (!pool.length) return null
  const fresh = pool.filter((p) => !solved.has(p.id))
  const from = fresh.length ? fresh : pool
  const near = [...from].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating)).slice(0, 12)
  return near[Math.floor(Math.random() * near.length)]
}

/** Human names for lichess opening tags. */
export function openingName(tag: string): string {
  return tag.replace(/_/g, ' ').replace(/\bQueens\b/, 'Queen’s').replace(/\bKings\b/, 'King’s').replace(/\bPetrovs\b/, 'Petrov’s')
}
