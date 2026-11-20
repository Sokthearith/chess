import { randomBytes } from 'node:crypto'
import type { WebSocket } from 'ws'
import { RateLimiter, type Identity } from './auth.ts'
import { chatOf, gameById, liveGames, purgeChat, userById } from './db.ts'
import { GameRoom, playerInfo, viewOfRow, type Conn, type RoomHost } from './game.ts'
import { PROVISIONAL_RD } from './glicko.ts'
import {
  SPEEDS,
  timeControl,
  type ClientMessage,
  type LiveGameSummary,
  type OnlineTimeControl,
  type PlayerInfo,
  type SeekInfo,
  type ServerMessage,
  type UserInfo,
} from '../src/online/protocol.ts'

interface Seek {
  info: SeekInfo
  identity: Identity
  tc: OnlineTimeControl
}

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ID_RE = /^[A-Za-z0-9]{1,16}$/
const ENDED_KEEP_MS = 10 * 60_000
const CHALLENGE_KEEP_MS = 30 * 60_000
/** How often players in a live game get a lag probe. */
const LAG_PROBE_MS = 3000
/** Replies slower than this are a stall, not lag: ignored. */
const LAG_SAMPLE_MAX = 5000

function newId(len = 8): string {
  const bytes = randomBytes(len)
  let s = ''
  for (const b of bytes) s += ID_CHARS[b % ID_CHARS.length]
  return s
}

const identityOf = (p: PlayerInfo): Identity => ({ id: p.id, name: p.name, guest: p.guest })

export function userInfo(identity: Identity): UserInfo {
  if (identity.guest) return { id: identity.id, name: identity.name, guest: true, ratings: null }
  const user = userById(identity.id)
  if (!user) return { id: identity.id, name: identity.name, guest: false, ratings: null }
  const ratings = Object.fromEntries(
    SPEEDS.map((s) => {
      const r = user.ratings[s]
      return [s, { rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games, provisional: r.rd > PROVISIONAL_RD }]
    }),
  ) as UserInfo['ratings']
  return { id: user.id, name: user.username, guest: false, ratings, recovery: !!user.recoveryHash }
}

export class Hub implements RoomHost {
  conns = new Set<Conn>()
  rooms = new Map<string, GameRoom>()
  seeks = new Map<string, Seek>()
  /** user id → the live game they are playing. */
  liveByUser = new Map<string, string>()
  chatLimit = new RateLimiter(5, 0.5)
  msgLimit = new RateLimiter(40, 20)
  lobbyTimer: NodeJS.Timeout | null = null
  lagSeq = 0
  lastChatPurge = 0

  constructor() {
    for (const row of liveGames()) {
      const room = GameRoom.restore(row, this)
      if (!room) continue
      this.rooms.set(room.id, room)
      this.liveByUser.set(room.white!.id, room.id)
      this.liveByUser.set(room.black!.id, room.id)
    }
    if (this.rooms.size) console.log(`restored ${this.rooms.size} live game(s)`)
    setInterval(() => this.matchmake(), 2000).unref()
    setInterval(() => this.sweep(), 60_000).unref()
    setInterval(() => this.probeLag(), LAG_PROBE_MS).unref()
  }

  /* ---------------------------------------------------------- connections */

  connect(ws: WebSocket, identity: Identity, ip: string) {
    const conn: Conn = {
      ws,
      identity,
      ip,
      watching: new Set(),
      lobby: false,
      alive: true,
      rtt: null,
      lagProbe: null,
      send(msg: ServerMessage) {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg))
      },
    }
    this.conns.add(conn)
    conn.send({ t: 'hello', user: userInfo(identity) })
    const seek = [...this.seeks.values()].find((s) => s.identity.id === identity.id)
    conn.send({ t: 'seeking', seek: seek?.info ?? null })
    const live = this.liveByUser.get(identity.id)
    if (live) conn.send({ t: 'start', id: live, resume: true })

    ws.on('pong', () => (conn.alive = true))
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      if (!this.msgLimit.take(`${identity.id}:${ip}`)) return
      let msg: ClientMessage
      try {
        msg = JSON.parse(String(data)) as ClientMessage
      } catch {
        return
      }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return
      try {
        this.handle(conn, msg)
      } catch (e) {
        console.error('message failed', msg.t, e)
        conn.send({ t: 'error', message: 'Something went wrong on the server.' })
      }
    })
    ws.on('close', () => this.disconnect(conn))
    this.lobbyChanged()
  }

  disconnect(conn: Conn) {
    this.conns.delete(conn)
    for (const id of [...conn.watching]) this.rooms.get(id)?.leave(conn)
    if (!this.isOnline(conn.identity.id)) this.cancelSeek(conn.identity.id)
    this.lobbyChanged()
  }

  /** Drop connections that stopped answering pings. */
  heartbeat() {
    for (const c of this.conns) {
      if (!c.alive) {
        c.ws.terminate()
        continue
      }
      c.alive = false
      c.ws.ping()
    }
  }

  /** Measure the round trip to every tab that is playing a live game. One probe in flight per tab. */
  probeLag() {
    const now = Date.now()
    for (const c of this.conns) {
      let playing = false
      for (const id of c.watching) {
        const room = this.rooms.get(id)
        if (room?.status === 'live' && room.sideOf(c.identity.id)) playing = true
      }
      if (!playing) continue
      // An unanswered probe counts as a slow reply once it is older than the cap.
      if (c.lagProbe && now - c.lagProbe.at < LAG_SAMPLE_MAX) continue
      c.lagProbe = { n: ++this.lagSeq, at: now }
      c.send({ t: 'lag', n: c.lagProbe.n })
    }
  }

  lagReply(conn: Conn, n: number) {
    const probe = conn.lagProbe
    if (!probe || probe.n !== n) return
    conn.lagProbe = null
    const sample = Date.now() - probe.at
    if (sample > LAG_SAMPLE_MAX) return
    conn.rtt = conn.rtt === null ? sample : conn.rtt * 0.75 + sample * 0.25
  }

  /** Close a user's sockets (after a password change or reset), except those on the session to keep. */
  kickUser(userId: string, keepSession?: string) {
    for (const c of this.conns) {
      if (c.identity.id === userId && (!keepSession || c.identity.session !== keepSession)) c.ws.close(4001, 'Signed out')
    }
  }

  isOnline(userId: string): boolean {
    for (const c of this.conns) if (c.identity.id === userId) return true
    return false
  }

  toUser(userId: string, msg: ServerMessage) {
    for (const c of this.conns) if (c.identity.id === userId) c.send(msg)
  }

  /* ------------------------------------------------------------- dispatch */

  handle(conn: Conn, msg: ClientMessage) {
    const fail = (message: string | null, id?: string) => {
      if (message) conn.send({ t: 'error', message, id })
    }
    const roomFor = (id: unknown): GameRoom | null => (typeof id === 'string' && ID_RE.test(id) ? (this.rooms.get(id) ?? null) : null)

    switch (msg.t) {
      case 'ping':
        return conn.send({ t: 'pong' })
      case 'lag':
        return this.lagReply(conn, Number(msg.n))
      case 'lobby.sub':
        conn.lobby = true
        return conn.send(this.lobbyMessage())
      case 'lobby.unsub':
        conn.lobby = false
        return
      case 'seek':
        return fail(this.seek(conn.identity, String(msg.tc), Boolean(msg.rated)))
      case 'seek.cancel':
        this.cancelSeek(conn.identity.id)
        return
      case 'seek.accept':
        return fail(this.acceptSeek(conn.identity, String(msg.id)))
      case 'challenge':
        return fail(this.challenge(conn, String(msg.tc), Boolean(msg.rated), msg.color))
      case 'challenge.accept': {
        const room = roomFor(msg.id)
        return fail(room ? this.acceptChallenge(conn.identity, room) : 'That challenge has gone.', msg.id)
      }
      case 'challenge.cancel': {
        const room = roomFor(msg.id)
        if (room && room.status === 'waiting' && room.creator?.id === conn.identity.id) {
          room.status = 'ended'
          room.result = { winner: null, reason: 'aborted' }
          room.broadcast()
          this.rooms.delete(room.id)
        }
        return
      }
      case 'watch': {
        if (typeof msg.id !== 'string' || !ID_RE.test(msg.id)) return conn.send({ t: 'gone', id: String(msg.id) })
        const room = this.rooms.get(msg.id)
        if (room) return room.join(conn)
        const row = gameById(msg.id)
        if (row && row.status === 'ended') {
          conn.send({ t: 'game', game: viewOfRow(row, conn.identity.id) })
          const lines = chatOf(row.id, 200).map((c) => ({ from: c.name, side: c.side, text: c.text, at: c.at }))
          return conn.send({ t: 'chat.history', id: row.id, lines })
        }
        return conn.send({ t: 'gone', id: msg.id })
      }
      case 'unwatch':
        roomFor(msg.id)?.leave(conn)
        return
      case 'move': {
        const room = roomFor(msg.id)
        return fail(room ? room.move(conn, msg.uci, Number(msg.ply)) : 'That game has ended.', msg.id)
      }
      case 'resign':
        return fail(roomFor(msg.id)?.resign(conn) ?? null, msg.id)
      case 'abort':
        return fail(roomFor(msg.id)?.abort(conn) ?? null, msg.id)
      case 'draw':
        return fail(roomFor(msg.id)?.draw(conn, Boolean(msg.accept)) ?? null, msg.id)
      case 'rematch':
        return fail(roomFor(msg.id)?.rematch(conn, Boolean(msg.accept)) ?? 'The rematch window has closed.', msg.id)
      case 'claim':
        return fail(roomFor(msg.id)?.claim(conn) ?? null, msg.id)
      case 'chat': {
        const room = roomFor(msg.id)
        if (!room) return
        if (!this.chatLimit.take(conn.identity.id)) return fail('Slow down a little.', msg.id)
        return fail(room.say(conn, String(msg.text)), msg.id)
      }
    }
  }

  /* ---------------------------------------------------------------- seeks */

  busy(identity: Identity): string | null {
    const live = this.liveByUser.get(identity.id)
    return live ? 'Finish your current game first.' : null
  }

  seek(identity: Identity, tcId: string, rated: boolean): string | null {
    const tc = timeControl(tcId)
    if (!tc) return 'Unknown time control.'
    if (rated && identity.guest) return 'Sign in to play rated games.'
    const busy = this.busy(identity)
    if (busy) return busy
    this.cancelSeek(identity.id, false)
    const info: SeekInfo = { id: newId(), by: playerInfo(identity, tc), tc: tc.id, rated, createdAt: Date.now() }
    this.seeks.set(info.id, { info, identity, tc })
    this.toUser(identity.id, { t: 'seeking', seek: info })
    this.matchmake()
    this.lobbyChanged()
    return null
  }

  cancelSeek(userId: string, notify = true) {
    for (const [id, s] of this.seeks) {
      if (s.identity.id !== userId) continue
      this.seeks.delete(id)
      if (notify) this.toUser(userId, { t: 'seeking', seek: null })
      this.lobbyChanged()
    }
  }

  acceptSeek(identity: Identity, id: string): string | null {
    const s = this.seeks.get(id)
    if (!s) return 'That seek has gone: someone else took it.'
    if (s.identity.id === identity.id) return 'That is your own seek.'
    if (s.info.rated && identity.guest) return 'Sign in to play rated games.'
    const busy = this.busy(identity)
    if (busy) return busy
    this.pair(s, identity)
    return null
  }

  /**
   * Quick pairing: oldest seeks first, same time control and rated flag.
   * Rated seeks only meet within a rating window that widens the longer they wait.
   */
  matchmake() {
    const list = [...this.seeks.values()].sort((a, b) => a.info.createdAt - b.info.createdAt)
    const now = Date.now()
    const window = (s: Seek) => Math.min(800, 150 + ((now - s.info.createdAt) / 1000) * 25)
    const used = new Set<string>()
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      if (used.has(a.info.id)) continue
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]
        if (used.has(b.info.id) || a.identity.id === b.identity.id) continue
        if (a.info.tc !== b.info.tc || a.info.rated !== b.info.rated) continue
        if (a.info.rated) {
          const gap = Math.abs((a.info.by.rating ?? 1500) - (b.info.by.rating ?? 1500))
          if (gap > Math.max(window(a), window(b))) continue
        }
        used.add(a.info.id)
        used.add(b.info.id)
        this.pair(a, b.identity)
        break
      }
    }
  }

  pair(s: Seek, opponent: Identity) {
    this.cancelSeek(s.identity.id)
    this.cancelSeek(opponent.id)
    const room = new GameRoom(this.freshId(), s.tc, s.info.rated, this)
    this.rooms.set(room.id, room)
    room.start(s.identity, opponent, 'random')
  }

  /* ----------------------------------------------------------- challenges */

  challenge(conn: Conn, tcId: string, rated: boolean, color: unknown): string | null {
    const tc = timeControl(tcId)
    if (!tc) return 'Unknown time control.'
    if (rated && conn.identity.guest) return 'Sign in to play rated games.'
    const busy = this.busy(conn.identity)
    if (busy) return busy
    const choice = color === 'w' || color === 'b' ? color : 'random'
    const room = GameRoom.challenge(this.freshId(), tc, rated, conn.identity, choice, this)
    this.rooms.set(room.id, room)
    conn.send({ t: 'challenge.created', id: room.id })
    return null
  }

  acceptChallenge(identity: Identity, room: GameRoom): string | null {
    if (room.status !== 'waiting' || !room.creator) return 'That challenge has already been taken.'
    if (room.creator.id === identity.id) return 'Send the link to a friend: you cannot accept your own challenge.'
    if (room.rated && identity.guest) return 'This challenge is rated: sign in to accept it.'
    const busy = this.busy(identity)
    if (busy) return busy
    const creator = identityOf(room.creator)
    if (!this.isOnline(creator.id)) return 'The player who made this challenge has left.'
    if (this.liveByUser.has(creator.id)) return 'The player who made this challenge is in another game.'
    room.start(creator, identity, room.colorChoice)
    return null
  }

  /* --------------------------------------------------------- room events */

  started(room: GameRoom) {
    for (const p of [room.white!, room.black!]) {
      this.liveByUser.set(p.id, room.id)
      this.cancelSeek(p.id)
      this.toUser(p.id, { t: 'start', id: room.id })
    }
    this.lobbyChanged()
  }

  ended(room: GameRoom) {
    for (const p of [room.white, room.black]) if (p && this.liveByUser.get(p.id) === room.id) this.liveByUser.delete(p.id)
    // Fresh ratings for both players' open tabs.
    if (room.rated) for (const p of [room.white!, room.black!]) this.toUser(p.id, { t: 'hello', user: userInfo(identityOf(p)) })
    if (room.result?.reason === 'aborted') {
      // An aborted game never existed; keep it a moment so the players see why.
      setTimeout(() => this.rooms.delete(room.id), 60_000).unref()
    }
    this.lobbyChanged()
  }

  rematch(room: GameRoom): GameRoom | null {
    if (this.liveByUser.has(room.white!.id) || this.liveByUser.has(room.black!.id)) return null
    const next = new GameRoom(this.freshId(), room.tc, room.rated, this)
    this.rooms.set(next.id, next)
    next.start(identityOf(room.black!), identityOf(room.white!), 'w')
    return next
  }

  freshId(): string {
    for (;;) {
      const id = newId()
      if (!this.rooms.has(id) && !gameById(id)) return id
    }
  }

  /** Forget finished games nobody is looking at, and stale challenges. */
  sweep() {
    const now = Date.now()
    if (now - this.lastChatPurge > 3600_000) {
      this.lastChatPurge = now
      const n = purgeChat(now)
      if (n) console.log(`deleted ${n} old chat line(s)`)
    }
    for (const [id, room] of this.rooms) {
      if (room.status === 'ended' && now - room.endedAt > ENDED_KEEP_MS && room.watchers.size === 0) this.rooms.delete(id)
      if (room.status === 'waiting' && now - room.createdAt > CHALLENGE_KEEP_MS) {
        room.status = 'ended'
        room.result = { winner: null, reason: 'aborted' }
        room.broadcast()
        this.rooms.delete(id)
      }
    }
  }

  /* ---------------------------------------------------------------- lobby */

  lobbyChanged() {
    if (this.lobbyTimer) return
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null
      const msg = this.lobbyMessage()
      for (const c of this.conns) if (c.lobby) c.send(msg)
    }, 400)
  }

  lobbyMessage(): ServerMessage {
    const seeks = [...this.seeks.values()].map((s) => s.info).sort((a, b) => a.createdAt - b.createdAt).slice(0, 60)
    const games: LiveGameSummary[] = []
    for (const r of this.rooms.values()) {
      if (r.status !== 'live') continue
      games.push({ id: r.id, white: r.white!, black: r.black!, tc: r.tc.id, rated: r.rated, plies: r.moves.length, spectators: r.spectatorCount() })
    }
    const strength = (g: LiveGameSummary) => (g.white.rating ?? 1200) + (g.black.rating ?? 1200)
    games.sort((a, b) => strength(b) - strength(a))
    const online = new Set([...this.conns].map((c) => c.identity.id)).size
    return { t: 'lobby', seeks, games: games.slice(0, 30), online, playing: this.liveByUser.size }
  }
}
