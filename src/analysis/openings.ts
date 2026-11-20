/**
 * The opening book: every position on a named line of the lichess
 * chess-openings set (CC0, github.com/lichess-org/chess-openings), keyed by
 * the first three FEN fields. Built by hand from the TSVs, see
 * `openings.json`; loaded lazily so the play page never pays for it.
 */
export interface OpeningBook {
  /** "C60 Ruy Lopez" for a book position, null otherwise. */
  name(fen: string): string | null
}

interface Raw {
  names: string[]
  positions: Record<string, number>
}

let pending: Promise<OpeningBook> | null = null

export function bookKey(fen: string): string {
  return fen.split(' ').slice(0, 3).join(' ')
}

export function loadOpeningBook(): Promise<OpeningBook> {
  pending ??= import('./openings.json')
    .then((m) => {
      const raw = (m as unknown as { default: Raw }).default
      return {
        name(fen: string) {
          const i = raw.positions[bookKey(fen)]
          return i === undefined ? null : raw.names[i]
        },
      }
    })
    .catch(() => {
      pending = null
      return { name: () => null }
    })
  return pending
}

/**
 * Book names for each ply (index i = the position after move i + 1). The book
 * phase ends at the first move that leaves it: a later transposition back into
 * a known position is not book.
 */
export function bookLine(book: OpeningBook, fensAfter: string[]): (string | null)[] {
  const out: (string | null)[] = []
  let inBook = true
  for (const fen of fensAfter) {
    const n = inBook ? book.name(fen) : null
    if (!n) inBook = false
    out.push(n)
  }
  return out
}
