/**
 * Chess.com public data API. No key, no login: a username is enough.
 * https://www.chess.com/news/view/published-data-api
 */
const BASE = 'https://api.chess.com/pub'

export interface ChessComProfile {
  username: string
  name?: string
  title?: string
  avatar?: string
  url: string
  country?: string
  joined: number
  last_online: number
}

export interface ChessComRecord {
  win: number
  loss: number
  draw: number
}

export interface ChessComStatBlock {
  last?: { rating: number; date: number; rd: number }
  best?: { rating: number; date: number; game: string }
  record?: ChessComRecord
}

export interface ChessComStats {
  chess_bullet?: ChessComStatBlock
  chess_blitz?: ChessComStatBlock
  chess_rapid?: ChessComStatBlock
  chess_daily?: ChessComStatBlock
}

export type ChessComResultCode =
  | 'win'
  | 'checkmated'
  | 'agreed'
  | 'repetition'
  | 'timeout'
  | 'resigned'
  | 'stalemate'
  | 'lose'
  | 'insufficient'
  | '50move'
  | 'abandoned'
  | 'kingofthehill'
  | 'threecheck'
  | 'timevsinsufficient'
  | 'bughousepartnerlose'

export interface ChessComSide {
  username: string
  rating: number
  result: ChessComResultCode
  uuid?: string
}

export interface ChessComGame {
  url: string
  pgn: string
  time_control: string
  end_time: number
  rated: boolean
  time_class: 'bullet' | 'blitz' | 'rapid' | 'daily'
  rules: string
  uuid: string
  white: ChessComSide
  black: ChessComSide
  accuracies?: { white: number; black: number }
  eco?: string
  fen?: string
}

export interface ArchiveMonth {
  year: number
  month: number
}

export class ChessComError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const msg = res.status === 404 ? 'No Chess.com player with that name.' : `Chess.com answered ${res.status}.`
    throw new ChessComError(msg, res.status)
  }
  return (await res.json()) as T
}

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '')
}

export function fetchProfile(username: string, signal?: AbortSignal) {
  return get<ChessComProfile>(`/player/${encodeURIComponent(username)}`, signal)
}

export function fetchStats(username: string, signal?: AbortSignal) {
  return get<ChessComStats>(`/player/${encodeURIComponent(username)}/stats`, signal)
}

export async function fetchArchives(username: string, signal?: AbortSignal): Promise<ArchiveMonth[]> {
  const data = await get<{ archives: string[] }>(`/player/${encodeURIComponent(username)}/games/archives`, signal)
  return data.archives
    .map((url) => {
      const m = /\/(\d{4})\/(\d{2})$/.exec(url)
      return m ? { year: Number(m[1]), month: Number(m[2]) } : null
    })
    .filter((x): x is ArchiveMonth => x !== null)
}

export async function fetchMonth(username: string, year: number, month: number, signal?: AbortSignal): Promise<ChessComGame[]> {
  const mm = String(month).padStart(2, '0')
  const data = await get<{ games: ChessComGame[] }>(`/player/${encodeURIComponent(username)}/games/${year}/${mm}`, signal)
  // Newest first.
  return [...data.games].sort((a, b) => b.end_time - a.end_time)
}

/** The numeric id at the end of a chess.com game URL. */
export function gameIdFromUrl(url: string): string {
  return url.split('/').pop() ?? url
}

export type Outcome = 'win' | 'loss' | 'draw'

/** Result from the given player's point of view. */
export function outcomeFor(game: ChessComGame, username: string): Outcome | null {
  const u = username.toLowerCase()
  const side = game.white.username.toLowerCase() === u ? game.white : game.black.username.toLowerCase() === u ? game.black : null
  if (!side) return null
  if (side.result === 'win') return 'win'
  if (DRAW_CODES.has(side.result)) return 'draw'
  return 'loss'
}

const DRAW_CODES = new Set<ChessComResultCode>(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'])

export function resultString(game: ChessComGame): string {
  if (game.white.result === 'win') return '1-0'
  if (game.black.result === 'win') return '0-1'
  return '½-½'
}

/** Plain words for how the game ended. */
export function terminationWords(game: ChessComGame): string {
  const loser = game.white.result === 'win' ? game.black : game.black.result === 'win' ? game.white : null
  const code = loser ? loser.result : game.white.result
  const words: Partial<Record<ChessComResultCode, string>> = {
    checkmated: 'checkmate',
    resigned: 'resignation',
    timeout: 'time',
    abandoned: 'abandonment',
    agreed: 'agreement',
    repetition: 'repetition',
    stalemate: 'stalemate',
    insufficient: 'insufficient material',
    '50move': 'fifty-move rule',
    timevsinsufficient: 'time against insufficient material',
    lose: 'loss',
  }
  return words[code] ?? code
}

export function timeControlWords(game: ChessComGame): string {
  // "180", "180+2", "1/86400" (daily, seconds per move)
  const tc = game.time_control
  if (tc.includes('/')) {
    const days = Math.round(Number(tc.split('/')[1]) / 86400)
    return `${days} day${days === 1 ? '' : 's'} per move`
  }
  const [base, inc] = tc.split('+').map(Number)
  const mins = base / 60
  const baseStr = Number.isInteger(mins) ? `${mins}` : mins.toFixed(1)
  return inc ? `${baseStr} + ${inc}` : `${baseStr} min`
}
