import { Chess } from 'chess.js'
import type { Color, PieceType, Square } from '../game/types'

export interface PgnMove {
  ply: number
  san: string
  lan: string
  from: Square
  to: Square
  color: Color
  piece: PieceType
  captured?: PieceType
  fenBefore: string
  fenAfter: string
}

export interface ParsedGame {
  headers: Record<string, string>
  startFen: string
  moves: PgnMove[]
  /** Every position: index 0 is the start, index i is after ply i. */
  fens: string[]
}

/** Parse a PGN with chess.js. Throws with a readable message on failure. */
export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess()
  try {
    chess.loadPgn(pgn.trim())
  } catch (e) {
    throw new Error(`That PGN did not parse: ${(e as Error).message}`)
  }
  const rawHeaders = chess.getHeaders()
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawHeaders)) if (v != null && v !== '?') headers[k] = String(v)
  const history = chess.history({ verbose: true })
  const startFen = history.length ? history[0].before : chess.fen()
  const moves: PgnMove[] = history.map((m, i) => ({
    ply: i + 1,
    san: m.san,
    lan: m.lan,
    from: m.from,
    to: m.to,
    color: m.color,
    piece: m.piece,
    captured: m.captured,
    fenBefore: m.before,
    fenAfter: m.after,
  }))
  return { headers, startFen, moves, fens: [startFen, ...moves.map((m) => m.fenAfter)] }
}

/** Back to PGN text: the headers that matter, then the moves in SAN. */
export function pgnFromParsed(g: ParsedGame): string {
  const keep = ['Event', 'Site', 'Date', 'White', 'Black', 'Result', 'WhiteElo', 'BlackElo', 'TimeControl', 'ECO', 'SetUp', 'FEN']
  const head = keep.filter((k) => g.headers[k]).map((k) => `[${k} "${g.headers[k].replace(/"/g, "'")}"]`)
  const moves = g.moves.map((m, i) => {
    const white = m.color === 'w'
    const n = Math.ceil(m.ply / 2)
    return white ? `${n}. ${m.san}` : i === 0 ? `${n}... ${m.san}` : m.san
  })
  return `${head.join('\n')}\n\n${moves.join(' ')} ${g.headers.Result ?? '*'}`
}
