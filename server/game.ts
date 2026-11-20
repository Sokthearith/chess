import { Chess } from 'chess.js'
import type { WebSocket } from 'ws'
import type { Identity } from './auth.ts'
import { deleteGame, finishGame, insertGame, saveProgress, saveRatings, userById, type GameRow } from './db.ts'
import { PROVISIONAL_RD, update } from './glicko.ts'
import {
  CHAT_MAX,
  timeControl,
  type ChatLine,
  type ColorChoice,
  type EndReason,
  type GameResultInfo,
  type GameView,
  type OnlineTimeControl,
  type PlayerInfo,
  type ServerMessage,
  type Side,
} from '../src/online/protocol.ts'

/** One browser tab's connection. */
export interface Conn {
  ws: WebSocket
  identity: Identity
  ip: string
  watching: Set<string>
  lobby: boolean
  alive: boolean
  send(msg: ServerMessage): void
}

/** What a room needs from the hub that owns it. */
export interface RoomHost {
  started(room: GameRoom): void
  ended(room: GameRoom): void
  /** Start the rematch, or null when one of the players is already in another game. */
  rematch(room: GameRoom): GameRoom | null
}

/** Each side has this long to make their first move before the game is aborted. */
const FIRST_MOVE_MS = 30_000
/** A player gone this long (in a game both have moved in) can be claimed against. */
const CLAIM_MS = 30_000
const CHAT_KEEP = 200
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/

const other = (s: Side): Side => (s === 'w' ? 'b' : 'w')

export function playerInfo(identity: Identity, tc: OnlineTimeControl): PlayerInfo {
  if (identity.guest) return { id: identity.id, name: identity.name, guest: true, rating: null, provisional: false }
  const user = userById(identity.id)
  const r = user?.ratings[tc.speed]
  return {
    id: identity.id,
    name: user?.username ?? identity.name,
    guest: false,
    rating: r ? Math.round(r.rating) : 1500,
    provisional: r ? r.rd > PROVISIONAL_RD : true,
  }
}

/** True when this side cannot possibly mate: a bare king, or king and one minor piece. */
function cannotMate(chess: Chess, side: Side): boolean {
  const pieces = chess
    .board()
    .flat()
    .filter((p) => p && p.color === side && p.type !== 'k')
  if (pieces.length === 0) return true
  return pieces.length === 1 && (pieces[0]!.type === 'b' || pieces[0]!.type === 'n')
}

export class GameRoom {
  id: string
  tc: OnlineTimeControl
  rated: boolean
  host: RoomHost
  status: 'waiting' | 'live' | 'ended' = 'waiting'
  /** Waiting challenges: who made it and the side they asked for. */
  creator: PlayerInfo | null = null
  colorChoice: ColorChoice = 'random'
  white: PlayerInfo | null = null
  black: PlayerInfo | null = null
  chess = new Chess()
  moves: string[] = []
  clocks: Record<Side, number>
  /** When the side to move started thinking (wall clock). */
  turnStartedAt = 0
  firstMoveDeadline = 0
  drawOffer: Side | null = null
  lastDrawOfferPly: Record<Side, number> = { w: -99, b: -99 }
  rematchOffer: Side | null = null
  rematchId: string | null = null
  result: GameResultInfo | null = null
  goneSince: Record<Side, number | null> = { w: null, b: null }
  chat: ChatLine[] = []
  watchers = new Set<Conn>()
  createdAt = Date.now()
  endedAt = 0
  timer: NodeJS.Timeout | null = null

  constructor(id: string, tc: OnlineTimeControl, rated: boolean, host: RoomHost) {
    this.id = id
    this.tc = tc
    this.rated = rated
    this.host = host
    this.clocks = { w: tc.minutes * 60_000, b: tc.minutes * 60_000 }
  }

  /** A game waiting for someone to accept the link. */
  static challenge(id: string, tc: OnlineTimeControl, rated: boolean, by: Identity, color: ColorChoice, host: RoomHost): GameRoom {
    const room = new GameRoom(id, tc, rated && !by.guest, host)
    room.creator = playerInfo(by, tc)
    room.colorChoice = color
    return room
  }

  /** A game that was live when the server stopped. The downtime is not charged to anyone. */
  static restore(row: GameRow, host: RoomHost): GameRoom | null {
    const tc = timeControl(row.tc)
    if (!tc) return null
    const room = new GameRoom(row.id, tc, row.rated, host)
    room.white = { id: row.whiteId, name: row.whiteName, guest: row.whiteGuest, rating: row.whiteRating, provisional: false }
    room.black = { id: row.blackId, name: row.blackName, guest: row.blackGuest, rating: row.blackRating, provisional: false }
    try {
      for (const uci of row.moves) room.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    } catch {
      return null
    }
    room.moves = row.moves
    room.clocks = { w: row.clockW, b: row.clockB }
    room.status = 'live'
    room.turnStartedAt = Date.now()
    room.firstMoveDeadline = Date.now() + FIRST_MOVE_MS
    room.goneSince = { w: Date.now(), b: Date.now() }
    room.schedule()
    return room
  }

  /* ------------------------------------------------------------ lifecycle */

  /** Seat two players and start. `a` gets `aSide` (or a random side). */
  start(a: Identity, b: Identity, aSide: ColorChoice) {
    const side: Side = aSide === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : aSide
    const [w, bl] = side === 'w' ? [a, b] : [b, a]
    this.rated = this.rated && !a.guest && !b.guest
    this.white = playerInfo(w, this.tc)
    this.black = playerInfo(bl, this.tc)
    this.creator = null
    this.status = 'live'
    this.turnStartedAt = Date.now()
    this.firstMoveDeadline = Date.now() + FIRST_MOVE_MS
    for (const s of ['w', 'b'] as Side[]) this.goneSince[s] = this.isConnected(s) ? null : Date.now()
    insertGame({
      id: this.id,
      whiteId: this.white.id,
      whiteName: this.white.name,
      whiteGuest: this.white.guest,
      whiteRating: this.white.rating,
      blackId: this.black.id,
      blackName: this.black.name,
      blackGuest: this.black.guest,
      blackRating: this.black.rating,
      tc: this.tc.id,
      rated: this.rated,
      status: 'live',
      moves: [],
      clockW: this.clocks.w,
      clockB: this.clocks.b,
      winner: null,
      reason: null,
      whiteDiff: null,
      blackDiff: null,
      startedAt: this.createdAt,
      endedAt: null,
    })
    this.schedule()
    this.host.started(this)
    this.broadcast()
  }

  get turn(): Side {
    return this.chess.turn()
  }

  /** Clocks run once both sides have made a move. */
  get clockRunning(): boolean {
    return this.status === 'live' && this.moves.length >= 2
  }

  sideOf(id: string): Side | null {
    if (this.white?.id === id) return 'w'
    if (this.black?.id === id) return 'b'
    return null
  }

  player(side: Side): PlayerInfo {
    return (side === 'w' ? this.white : this.black)!
  }

  /** Clocks as of now: the running side's thinking time is taken off. */
  currentClocks(now = Date.now()): Record<Side, number> {
    if (!this.clockRunning) return { ...this.clocks }
    const c = { ...this.clocks }
    c[this.turn] = Math.max(0, c[this.turn] - (now - this.turnStartedAt))
    return c
  }

  /** One timer per room: the running clock's flag, or the first-move abort. */
  schedule() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.status !== 'live') return
    const now = Date.now()
    const ms = this.clockRunning ? this.currentClocks(now)[this.turn] : this.firstMoveDeadline - now
    this.timer = setTimeout(() => this.tick(), Math.max(0, ms) + 25)
  }

  tick() {
    if (this.status !== 'live') return
    const now = Date.now()
    if (this.clockRunning) {
      if (this.currentClocks(now)[this.turn] <= 0) this.flag(this.turn)
      else this.schedule()
    } else if (now >= this.firstMoveDeadline) {
      // Whoever failed to make a first move: the game simply did not happen.
      this.end({ winner: null, reason: 'aborted' })
    } else this.schedule()
  }

  flag(side: Side) {
    this.clocks = this.currentClocks()
    this.clocks[side] = 0
    const winner = other(side)
    if (cannotMate(this.chess, winner)) this.end({ winner: null, reason: 'timeout-insufficient' })
    else this.end({ winner, reason: 'timeout' })
  }

  end(result: GameResultInfo) {
    if (this.status === 'ended') return
    if (this.status === 'live') this.clocks = this.currentClocks()
    const wasLive = this.status === 'live'
    this.status = 'ended'
    this.endedAt = Date.now()
    this.drawOffer = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null

    if (wasLive && result.reason === 'aborted') deleteGame(this.id)
    else if (wasLive) {
      if (this.rated) result.ratingDiff = this.applyRatings(result.winner)
      finishGame(this.id, {
        moves: this.moves,
        clockW: this.clocks.w,
        clockB: this.clocks.b,
        winner: result.winner,
        reason: result.reason,
        whiteDiff: result.ratingDiff?.w ?? null,
        blackDiff: result.ratingDiff?.b ?? null,
      })
    }
    this.result = result
    this.broadcast()
    this.host.ended(this)
  }

  applyRatings(winner: Side | null): Record<Side, number> | undefined {
    const wUser = userById(this.white!.id)
    const bUser = userById(this.black!.id)
    if (!wUser || !bUser) return undefined
    const speed = this.tc.speed
    const wOld = wUser.ratings[speed]
    const bOld = bUser.ratings[speed]
    const score = winner === 'w' ? 1 : winner === 'b' ? 0 : 0.5
    const wNew = update(wOld, bOld, score)
    const bNew = update(bOld, wOld, 1 - score)
    wUser.ratings[speed] = wNew
    bUser.ratings[speed] = bNew
    saveRatings(wUser.id, wUser.ratings)
    saveRatings(bUser.id, bUser.ratings)
    return { w: Math.round(wNew.rating) - Math.round(wOld.rating), b: Math.round(bNew.rating) - Math.round(bOld.rating) }
  }

  /* -------------------------------------------------------------- actions */

  move(conn: Conn, uci: string, ply: number): string | null {
    const side = this.sideOf(conn.identity.id)
    if (this.status !== 'live' || !side) return 'This game is not being played.'
    if (ply !== this.moves.length || side !== this.turn) {
      // A stale or repeated move (a double click, a reconnect): resend the truth.
      conn.send({ t: 'game', game: this.view(conn.identity.id) })
      return null
    }
    if (typeof uci !== 'string' || !UCI_RE.test(uci)) return 'That is not a move.'
    const now = Date.now()
    if (this.clockRunning) {
      const left = this.currentClocks(now)[side]
      if (left <= 0) {
        this.flag(side)
        return null
      }
      this.clocks[side] = left + this.tc.increment * 1000
    }
    try {
      this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    } catch {
      return 'That move is not legal.'
    }
    this.moves.push(uci)
    this.turnStartedAt = now
    if (this.moves.length < 2) this.firstMoveDeadline = now + FIRST_MOVE_MS
    // Moving on is declining a draw that was offered to you.
    if (this.drawOffer && this.drawOffer !== side) this.drawOffer = null

    const c = this.chess
    if (c.isCheckmate()) this.end({ winner: side, reason: 'checkmate' })
    else if (c.isStalemate()) this.end({ winner: null, reason: 'stalemate' })
    else if (c.isInsufficientMaterial()) this.end({ winner: null, reason: 'insufficient' })
    else if (c.isThreefoldRepetition()) this.end({ winner: null, reason: 'repetition' })
    else if (c.isDrawByFiftyMoves()) this.end({ winner: null, reason: 'fifty-move' })
    else {
      saveProgress(this.id, this.moves, this.clocks.w, this.clocks.b)
      this.schedule()
      this.broadcast()
    }
    return null
  }

  resign(conn: Conn): string | null {
    const side = this.sideOf(conn.identity.id)
    if (this.status !== 'live' || !side) return 'Nothing to resign.'
    if (this.moves.length < 2) this.end({ winner: null, reason: 'aborted' })
    else this.end({ winner: other(side), reason: 'resignation' })
    return null
  }

  abort(conn: Conn): string | null {
    const side = this.sideOf(conn.identity.id)
    if (this.status !== 'live' || !side) return 'Nothing to abort.'
    if (this.moves.length >= 2) return 'Too late to abort: resign instead.'
    this.end({ winner: null, reason: 'aborted' })
    return null
  }

  draw(conn: Conn, accept: boolean): string | null {
    const side = this.sideOf(conn.identity.id)
    if (this.status !== 'live' || !side) return 'This game is not being played.'
    if (!accept) {
      if (this.drawOffer) {
        this.drawOffer = null
        this.broadcast()
      }
      return null
    }
    if (this.drawOffer === other(side)) {
      this.end({ winner: null, reason: 'agreement' })
      return null
    }
    if (this.drawOffer === side) return null
    if (this.moves.length < 2) return 'Make a move first.'
    if (this.moves.length - this.lastDrawOfferPly[side] < 4) return 'You offered a draw a moment ago.'
    this.lastDrawOfferPly[side] = this.moves.length
    this.drawOffer = side
    this.broadcast()
    return null
  }

  rematch(conn: Conn, accept: boolean): string | null {
    const side = this.sideOf(conn.identity.id)
    if (this.status !== 'ended' || !side || this.result?.reason === 'aborted') return 'No rematch here.'
    if (this.rematchId) return null
    if (!accept) {
      if (this.rematchOffer) {
        this.rematchOffer = null
        this.broadcast()
      }
      return null
    }
    if (this.rematchOffer === other(side)) {
      const next = this.host.rematch(this)
      this.rematchOffer = null
      if (!next) {
        this.broadcast()
        return 'One of you is already playing another game.'
      }
      this.rematchId = next.id
    } else this.rematchOffer = side
    this.broadcast()
    return null
  }

  claim(conn: Conn): string | null {
    const side = this.sideOf(conn.identity.id)
    if (this.status !== 'live' || !side) return 'This game is not being played.'
    const since = this.goneSince[other(side)]
    if (since === null || Date.now() - since < CLAIM_MS) return 'Your opponent is still here.'
    this.end({ winner: side, reason: 'abandoned' })
    return null
  }

  say(conn: Conn, text: string): string | null {
    const side = this.sideOf(conn.identity.id)
    if (!side) return 'Only the players can chat in a game.'
    const clean = String(text ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, CHAT_MAX)
    if (!clean) return null
    const line: ChatLine = { from: this.player(side).name, side, text: clean, at: Date.now() }
    this.chat.push(line)
    if (this.chat.length > CHAT_KEEP) this.chat.shift()
    for (const c of this.watchers) c.send({ t: 'chat', id: this.id, line })
    return null
  }

  /* ------------------------------------------------------------ watching */

  isConnected(side: Side): boolean {
    const p = side === 'w' ? this.white : this.black
    if (!p) return false
    for (const c of this.watchers) if (c.identity.id === p.id) return true
    return false
  }

  join(conn: Conn) {
    this.watchers.add(conn)
    conn.watching.add(this.id)
    this.presence()
    conn.send({ t: 'chat.history', id: this.id, lines: this.chat })
    this.broadcast()
  }

  leave(conn: Conn) {
    if (!this.watchers.delete(conn)) return
    conn.watching.delete(this.id)
    this.presence()
    this.broadcast()
  }

  /** Track when each player was last seen, for abandonment claims. */
  presence() {
    if (this.status !== 'live') return
    for (const s of ['w', 'b'] as Side[]) {
      const here = this.isConnected(s)
      if (here) this.goneSince[s] = null
      else if (this.goneSince[s] === null) this.goneSince[s] = Date.now()
    }
  }

  spectatorCount(): number {
    const ids = new Set<string>()
    for (const c of this.watchers) if (!this.sideOf(c.identity.id)) ids.add(c.identity.id)
    return ids.size
  }

  view(forId: string | null): GameView {
    const now = Date.now()
    const you = forId ? this.sideOf(forId) : null
    let claimInMs: number | null = null
    if (you && this.status === 'live' && this.moves.length >= 2) {
      const since = this.goneSince[other(you)]
      if (since !== null) claimInMs = Math.max(0, since + CLAIM_MS - now)
    }
    return {
      id: this.id,
      status: this.status,
      tc: this.tc.id,
      rated: this.rated,
      challenge: this.status === 'waiting' && this.creator ? { by: this.creator, color: this.colorChoice } : undefined,
      white: this.white,
      black: this.black,
      moves: this.moves,
      clocks: this.status === 'live' ? this.currentClocks(now) : { ...this.clocks },
      running: this.clockRunning ? this.turn : null,
      firstMoveMs: this.status === 'live' && this.moves.length < 2 ? Math.max(0, this.firstMoveDeadline - now) : null,
      drawOffer: this.drawOffer,
      rematchOffer: this.rematchOffer,
      rematchId: this.rematchId,
      result: this.result,
      connected: { w: this.isConnected('w'), b: this.isConnected('b') },
      claimInMs,
      spectators: this.spectatorCount(),
      you,
    }
  }

  broadcast() {
    for (const c of this.watchers) c.send({ t: 'game', game: this.view(c.identity.id) })
  }
}

/** The read-only view of a finished game from the database. */
export function viewOfRow(row: GameRow, forId: string | null): GameView {
  const you = forId === row.whiteId ? 'w' : forId === row.blackId ? 'b' : null
  return {
    id: row.id,
    status: 'ended',
    tc: row.tc,
    rated: row.rated,
    white: { id: row.whiteId, name: row.whiteName, guest: row.whiteGuest, rating: row.whiteRating, provisional: false },
    black: { id: row.blackId, name: row.blackName, guest: row.blackGuest, rating: row.blackRating, provisional: false },
    moves: row.moves,
    clocks: { w: row.clockW, b: row.clockB },
    running: null,
    firstMoveMs: null,
    drawOffer: null,
    rematchOffer: null,
    rematchId: null,
    result: {
      winner: row.winner,
      reason: (row.reason ?? 'aborted') as EndReason,
      ratingDiff: row.rated && row.whiteDiff !== null && row.blackDiff !== null ? { w: row.whiteDiff, b: row.blackDiff } : undefined,
    },
    connected: { w: false, b: false },
    claimInMs: null,
    spectators: 0,
    you,
  }
}
