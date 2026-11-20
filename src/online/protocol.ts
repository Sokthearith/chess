/**
 * The online-play protocol, shared by the browser (src/online) and the game
 * server (server/). Plain types and pure helpers only: this file must not
 * import anything, so Node can load it directly.
 */

export type Side = 'w' | 'b'
export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical'
export const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical']

export interface OnlineTimeControl {
  id: string
  minutes: number
  increment: number
  speed: Speed
}

/** Lichess's thresholds: estimated game length = base + 40 × increment. */
export function speedOf(minutes: number, increment: number): Speed {
  const est = minutes * 60 + increment * 40
  if (est < 180) return 'bullet'
  if (est < 480) return 'blitz'
  if (est < 1500) return 'rapid'
  return 'classical'
}

const tc = (minutes: number, increment: number): OnlineTimeControl => ({
  id: `${minutes}+${increment}`,
  minutes,
  increment,
  speed: speedOf(minutes, increment),
})

/** The pool of time controls offered online. Quick pairing matches within one id. */
export const ONLINE_TIME_CONTROLS: OnlineTimeControl[] = [
  tc(1, 0),
  tc(2, 1),
  tc(3, 0),
  tc(3, 2),
  tc(5, 0),
  tc(5, 3),
  tc(10, 0),
  tc(10, 5),
  tc(15, 10),
  tc(30, 0),
]

export function timeControl(id: string): OnlineTimeControl | null {
  return ONLINE_TIME_CONTROLS.find((t) => t.id === id) ?? null
}

export const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,19}$/
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
export const CHAT_MAX = 140

export interface RatingInfo {
  rating: number
  /** Glicko rating deviation: high = uncertain. */
  rd: number
  games: number
  provisional: boolean
}

export interface UserInfo {
  id: string
  name: string
  guest: boolean
  ratings: Record<Speed, RatingInfo> | null
  /** Your own account only: whether a recovery code is set. */
  recovery?: boolean
}

/** Sign-up and password recovery answer with the account and its new recovery code (shown once). */
export interface WithRecoveryCode {
  user: UserInfo
  recoveryCode: string
}

/** A player as shown at the board or in a list. */
export interface PlayerInfo {
  id: string
  name: string
  guest: boolean
  /** Rating in the game's speed, or null for guests. */
  rating: number | null
  provisional: boolean
}

export type ColorChoice = Side | 'random'

export interface SeekInfo {
  id: string
  by: PlayerInfo
  tc: string
  rated: boolean
  createdAt: number
}

export interface LiveGameSummary {
  id: string
  white: PlayerInfo
  black: PlayerInfo
  tc: string
  rated: boolean
  plies: number
  spectators: number
}

export type EndReason =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'timeout-insufficient'
  | 'stalemate'
  | 'agreement'
  | 'repetition'
  | 'insufficient'
  | 'fifty-move'
  | 'abandoned'
  | 'aborted'

export interface GameResultInfo {
  winner: Side | null
  reason: EndReason
  /** Rating change per side, rated games only. */
  ratingDiff?: Record<Side, number>
}

export type GameStatus = 'waiting' | 'live' | 'ended'

export interface GameView {
  id: string
  status: GameStatus
  tc: string
  rated: boolean
  /** Waiting challenges only: who made it and which side they asked for. */
  challenge?: { by: PlayerInfo; color: ColorChoice }
  white: PlayerInfo | null
  black: PlayerInfo | null
  /** Every move so far in long algebraic notation (e2e4, e7e8q). */
  moves: string[]
  /** The mover's clock (ms) after each move, one per entry in `moves` (may be empty for old games). */
  times: number[]
  /** Milliseconds left per side at the moment the server sent this. */
  clocks: Record<Side, number>
  /** The side whose clock is running, if any. Clocks start after Black's first move. */
  running: Side | null
  /** Before both sides have moved: when the side to move will be aborted (ms from send). */
  firstMoveMs: number | null
  drawOffer: Side | null
  rematchOffer: Side | null
  /** Set once both players asked for a rematch: the new game. */
  rematchId: string | null
  result: GameResultInfo | null
  connected: Record<Side, boolean>
  /** Each player's measured round trip to the server, in ms (null until measured, or when offline). */
  ping: Record<Side, number | null>
  /** A player whose opponent has been gone this long can claim the win (ms from send), or 0 if they can now. */
  claimInMs: number | null
  spectators: number
  /** Your side, if you are playing in this game. */
  you: Side | null
}

export interface ChatLine {
  /** Display name, or "Spectator" lines from people not playing. */
  from: string
  side: Side | null
  text: string
  at: number
}

/* ---------------------------------------------------------------- messages */

export type ClientMessage =
  | { t: 'ping' }
  /** The answer to the server's lag probe, sent straight back. */
  | { t: 'lag'; n: number }
  | { t: 'lobby.sub' }
  | { t: 'lobby.unsub' }
  | { t: 'seek'; tc: string; rated: boolean }
  | { t: 'seek.cancel' }
  | { t: 'seek.accept'; id: string }
  | { t: 'challenge'; tc: string; rated: boolean; color: ColorChoice }
  | { t: 'challenge.accept'; id: string }
  | { t: 'challenge.cancel'; id: string }
  | { t: 'watch'; id: string }
  | { t: 'unwatch'; id: string }
  | { t: 'move'; id: string; uci: string; ply: number }
  | { t: 'resign'; id: string }
  | { t: 'abort'; id: string }
  | { t: 'draw'; id: string; accept: boolean }
  | { t: 'rematch'; id: string; accept: boolean }
  | { t: 'claim'; id: string }
  | { t: 'chat'; id: string; text: string }

export type ServerMessage =
  | { t: 'pong' }
  /** A lag probe during a game: answer at once with the same n. */
  | { t: 'lag'; n: number }
  | { t: 'hello'; user: UserInfo }
  | { t: 'lobby'; seeks: SeekInfo[]; games: LiveGameSummary[]; online: number; playing: number }
  | { t: 'seeking'; seek: SeekInfo | null }
  | { t: 'start'; id: string; resume?: boolean }
  | { t: 'challenge.created'; id: string }
  | { t: 'game'; game: GameView }
  | { t: 'gone'; id: string }
  | { t: 'chat.history'; id: string; lines: ChatLine[] }
  | { t: 'chat'; id: string; line: ChatLine }
  | { t: 'error'; message: string; id?: string }

export const REASON_WORDS: Record<EndReason, string> = {
  checkmate: 'checkmate',
  resignation: 'resignation',
  timeout: 'time',
  'timeout-insufficient': 'time against insufficient material',
  stalemate: 'stalemate',
  agreement: 'agreement',
  repetition: 'threefold repetition',
  insufficient: 'insufficient material',
  'fifty-move': 'the fifty-move rule',
  abandoned: 'abandonment',
  aborted: 'abort',
}

/* -------------------------------------------------------------------- http */

/** One finished game in a player's history, from that player's side. */
export interface GameSummary {
  id: string
  white: string
  black: string
  whiteRating: number | null
  blackRating: number | null
  tc: string
  rated: boolean
  winner: Side | null
  reason: EndReason
  plies: number
  endedAt: number
  /** The profile owner's side and rating change. */
  side: Side
  diff: number | null
}

export interface Profile {
  name: string
  createdAt: number
  ratings: Record<Speed, RatingInfo>
  record: { win: number; loss: number; draw: number }
  games: GameSummary[]
  online: boolean
  /** The live game they are in right now, if any. */
  playing: string | null
}
