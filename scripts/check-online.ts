/**
 * End-to-end check of the online server: boots `server/index.ts` on a spare
 * port with a throwaway database and plays real games over WebSockets.
 * Run: npm run check:online
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import WebSocket from 'ws'
import type { ClientMessage, GameView, Profile, ServerMessage, UserInfo } from '../src/online/protocol.ts'

const PORT = 20000 + Math.floor(Math.random() * 20000)
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = `http://127.0.0.1:${PORT}`
const dataDir = mkdtempSync(join(tmpdir(), 'oukplay-check-'))
const oldDir = mkdtempSync(join(tmpdir(), 'oukplay-check-v1-'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let server: ChildProcess | null = null
let failures = 0

function startServer(dir = dataDir): Promise<void> {
  server = spawn(process.execPath, ['server/index.ts'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: dir, NODE_ENV: 'test', AUTH_BURST: '100' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('server did not start')), 10_000)
    server!.stdout!.on('data', (d: Buffer) => {
      if (String(d).includes('Oukplay on')) {
        clearTimeout(t)
        res()
      }
    })
  })
}

function stopServer(): Promise<void> {
  return new Promise((res) => {
    if (!server) return res()
    server.once('exit', () => res())
    server.kill('SIGTERM')
    server = null
  })
}

function check(cond: unknown, what: string) {
  if (cond) console.log(`  ok   ${what}`)
  else {
    failures++
    console.log(`  FAIL ${what}`)
  }
}

/** One browser: a cookie jar and a socket with a message inbox. */
class Client {
  cookie = ''
  ws: WebSocket | null = null
  inbox: ServerMessage[] = []
  waiters: { pred: (m: ServerMessage) => boolean; res: (m: ServerMessage) => void }[] = []
  user: UserInfo | null = null

  async http(path: string, init: { method?: string; body?: unknown; origin?: string } = {}) {
    const headers: Record<string, string> = { Cookie: this.cookie, Origin: init.origin ?? ORIGIN }
    if (init.body) headers['Content-Type'] = 'application/json'
    const r = await fetch(BASE + path, { method: init.method ?? 'GET', headers, body: init.body ? JSON.stringify(init.body) : undefined })
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const name = pair.split('=')[0]
      this.cookie = [...this.cookie.split('; ').filter((x) => x && !x.startsWith(name + '=')), pair].join('; ')
    }
    return { status: r.status, body: (await r.json()) as Record<string, unknown> }
  }

  async connect() {
    if (!this.cookie) this.user = (await this.http('/api/me')).body as unknown as UserInfo
    this.inbox = []
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: { Cookie: this.cookie, Origin: ORIGIN } })
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMessage
      const i = this.waiters.findIndex((w) => w.pred(m))
      if (i >= 0) this.waiters.splice(i, 1)[0].res(m)
      else this.inbox.push(m)
    })
    await this.next((m) => m.t === 'hello')
  }

  send(m: ClientMessage) {
    this.ws!.send(JSON.stringify(m))
  }

  next<T extends ServerMessage>(pred: (m: ServerMessage) => boolean, ms = 4000): Promise<T> {
    const i = this.inbox.findIndex(pred)
    if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0] as T)
    return new Promise((res, rej) => {
      const w = { pred, res: res as (m: ServerMessage) => void }
      this.waiters.push(w)
      setTimeout(() => {
        const k = this.waiters.indexOf(w)
        if (k >= 0) {
          this.waiters.splice(k, 1)
          rej(new Error('timed out waiting for a message'))
        }
      }, ms)
    })
  }

  /** The next game state for `id` that satisfies `pred`. */
  async game(id: string, pred: (g: GameView) => boolean = () => true): Promise<GameView> {
    const m = await this.next<{ t: 'game'; game: GameView }>((m) => m.t === 'game' && m.game.id === id && pred(m.game))
    return m.game
  }

  close() {
    this.ws?.close()
  }
}

async function pairedGame(a: Client, b: Client, tc: string, rated: boolean) {
  a.send({ t: 'seek', tc, rated })
  b.send({ t: 'seek', tc, rated })
  const sa = await a.next<{ t: 'start'; id: string }>((m) => m.t === 'start')
  const sb = await b.next<{ t: 'start'; id: string }>((m) => m.t === 'start')
  a.send({ t: 'watch', id: sa.id })
  b.send({ t: 'watch', id: sb.id })
  const ga = await a.game(sa.id, (g) => g.connected.w && g.connected.b)
  const white = ga.you === 'w' ? a : b
  const black = white === a ? b : a
  return { id: sa.id, sameId: sa.id === sb.id, white, black }
}

async function play(id: string, white: Client, black: Client, moves: string[]) {
  for (const [i, uci] of moves.entries()) {
    const c = i % 2 === 0 ? white : black
    c.send({ t: 'move', id, uci, ply: i })
    await c.game(id, (g) => g.moves.length === i + 1 || g.status === 'ended')
  }
}

/** A database as the first online release left it: schema 1, no version number, one live game. */
function makeV1Database(dir: string) {
  const db = new DatabaseSync(join(dir, 'oukplay.db'))
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, pass TEXT NOT NULL, ratings TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
    CREATE TABLE games (id TEXT PRIMARY KEY, white_id TEXT NOT NULL, white_name TEXT NOT NULL, white_guest INTEGER NOT NULL, white_rating INTEGER,
      black_id TEXT NOT NULL, black_name TEXT NOT NULL, black_guest INTEGER NOT NULL, black_rating INTEGER, tc TEXT NOT NULL, rated INTEGER NOT NULL,
      status TEXT NOT NULL, moves TEXT NOT NULL DEFAULT '', clock_w INTEGER NOT NULL, clock_b INTEGER NOT NULL, winner TEXT, reason TEXT,
      white_diff INTEGER, black_diff INTEGER, started_at INTEGER NOT NULL, ended_at INTEGER);
    CREATE INDEX games_white ON games(white_id, started_at DESC);
    CREATE INDEX games_black ON games(black_id, started_at DESC);
    CREATE INDEX games_status ON games(status);
  `)
  db.prepare(
    `INSERT INTO games (id, white_id, white_name, white_guest, black_id, black_name, black_guest, tc, rated, status, moves, clock_w, clock_b, started_at)
     VALUES ('OldGame1', 'g1', 'Guest11111', 1, 'g2', 'Guest22222', 1, '5+0', 0, 'live', 'e2e4 e7e5 g1f3', 290000, 280000, ?)`,
  ).run(Date.now())
  db.close()
}

async function main() {
  console.log('upgrading a database from the first release')
  makeV1Database(oldDir)
  await startServer(oldDir)
  const peek = new Client()
  await peek.connect()
  peek.send({ t: 'watch', id: 'OldGame1' })
  const old = await peek.game('OldGame1')
  check(old.status === 'live' && old.moves.length === 3, 'a live game from the old schema is still playable')
  check(old.times.length === 3 && old.times[0] === 290000 && old.times[1] === 280000, 'old games get their clock list filled in')
  peek.close()
  await stopServer()
  const migrated = new DatabaseSync(join(oldDir, 'oukplay.db'), { readOnly: true })
  const version = migrated.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as { value: string } | undefined
  check(Number(version?.value) >= 3, `the schema version is recorded (${version?.value})`)
  migrated.close()
  const backups = existsSync(join(oldDir, 'backups')) ? readdirSync(join(oldDir, 'backups')) : []
  check(backups.some((f) => f.startsWith('pre-v2-')), 'a backup is taken before migrating')

  await startServer()

  console.log('guests: quick pairing and checkmate')
  const g1 = new Client()
  const g2 = new Client()
  await g1.connect()
  await g2.connect()
  check(g1.user?.guest && g1.user.name.startsWith('Guest'), 'a visitor becomes a guest')
  g1.send({ t: 'seek', tc: '3+0', rated: true })
  const refused = await g1.next<{ t: 'error'; message: string }>((m) => m.t === 'error')
  check(/sign in/i.test(refused.message), 'guests cannot seek rated games')
  const p = await pairedGame(g1, g2, '3+0', false)
  check(p.sameId, 'both guests are sent to the same game')
  p.white.send({ t: 'move', id: p.id, uci: 'e2e5', ply: 0 })
  const bad = await p.white.next<{ t: 'error'; message: string }>((m) => m.t === 'error')
  check(/legal/.test(bad.message), 'an illegal move is refused')
  p.black.send({ t: 'move', id: p.id, uci: 'e7e5', ply: 0 })
  const resent = await p.black.game(p.id)
  check(resent.moves.length === 0, 'moving out of turn changes nothing')
  p.white.send({ t: 'chat', id: p.id, text: 'good luck' })
  const line = await p.black.next<{ t: 'chat'; line: { text: string } }>((m) => m.t === 'chat')
  check(line.line.text === 'good luck', 'chat reaches the opponent')
  await play(p.id, p.white, p.black, ['f2f3', 'e7e5', 'g2g4', 'd8h4'])
  const mate = await p.white.game(p.id, (g) => g.status === 'ended')
  check(mate.result?.winner === 'b' && mate.result.reason === 'checkmate', "fool's mate ends the game, Black wins")
  check(mate.running === null, 'clocks stop at the end')

  console.log('rematch')
  p.white.send({ t: 'rematch', id: p.id, accept: true })
  p.black.send({ t: 'rematch', id: p.id, accept: true })
  const re = await p.white.game(p.id, (g) => !!g.rematchId)
  const reStart = await p.black.next<{ t: 'start'; id: string }>((m) => m.t === 'start')
  check(re.rematchId === reStart.id, 'both accepting starts a rematch')
  p.white.send({ t: 'watch', id: re.rematchId! })
  const reGame = await p.white.game(re.rematchId!)
  check(reGame.you === 'b', 'colours swap in the rematch')
  p.white.send({ t: 'abort', id: re.rematchId! })
  const aborted = await p.white.game(re.rematchId!, (g) => g.status === 'ended')
  check(aborted.result?.reason === 'aborted', 'a game can be aborted before both have moved')

  console.log('accounts and rated games')
  const alice = new Client()
  const bob = new Client()
  const reg = await alice.http('/api/register', { method: 'POST', body: { username: 'alice_test', password: 'correct horse' } })
  check(reg.status === 201, 'register')
  const regCode = String(reg.body.recoveryCode ?? '')
  check(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/.test(regCode), `sign-up hands out a recovery code (${regCode})`)
  check((reg.body.user as UserInfo | undefined)?.recovery === true, 'the account knows it has a recovery code')
  check((await bob.http('/api/register', { method: 'POST', body: { username: 'ALICE_test', password: 'whatever123' } })).status === 409, 'usernames are unique ignoring case')
  check((await bob.http('/api/register', { method: 'POST', body: { username: 'guest99', password: 'whatever123' } })).status === 400, 'guest-like usernames are reserved')
  check((await bob.http('/api/register', { method: 'POST', body: { username: 'bob_test', password: 'short' } })).status === 400, 'short passwords are refused')
  check((await bob.http('/api/register', { method: 'POST', body: { username: 'bob_test', password: 'battery staple' }, origin: 'https://evil.example' })).status === 403, 'cross-site posts are refused')
  check((await bob.http('/api/register', { method: 'POST', body: { username: 'bob_test', password: 'battery staple' } })).status === 201, 'second account')
  const fresh = new Client()
  check((await fresh.http('/api/login', { method: 'POST', body: { username: 'alice_test', password: 'wrong password' } })).status === 401, 'a wrong password is refused')
  const login = await fresh.http('/api/login', { method: 'POST', body: { username: 'Alice_Test', password: 'correct horse' } })
  check(login.status === 200 && (login.body as unknown as UserInfo).name === 'alice_test', 'log in, any case')
  await alice.connect()
  await bob.connect()
  check(alice.user === null || !alice.user.guest, 'a signed-in socket is not a guest')
  const r = await pairedGame(alice, bob, '5+0', true)
  await play(r.id, r.white, r.black, ['e2e4', 'e7e5'])
  const running = await r.white.game(r.id, (g) => g.moves.length === 2)
  check(running.running === 'w' && running.rated, 'the clock runs after both first moves; the game is rated')
  r.white.send({ t: 'draw', id: r.id, accept: true })
  const offered = await r.black.game(r.id, (g) => g.drawOffer === 'w')
  check(offered.drawOffer === 'w', 'a draw offer reaches the opponent')
  r.black.send({ t: 'draw', id: r.id, accept: false })
  await r.black.game(r.id, (g) => g.drawOffer === null)
  r.black.send({ t: 'resign', id: r.id })
  const resigned = await r.white.game(r.id, (g) => g.status === 'ended')
  check(resigned.result?.reason === 'resignation' && resigned.result.winner === 'w', 'resigning ends the game')
  const diff = resigned.result?.ratingDiff
  check(!!diff && diff.w > 0 && diff.b < 0, `ratings move (${diff?.w}, ${diff?.b})`)
  const db = new DatabaseSync(join(dataDir, 'oukplay.db'), { readOnly: true })
  const hist = db.prepare('SELECT user_id, rating FROM rating_history WHERE game_id = ?').all(r.id) as { rating: number }[]
  check(hist.length === 2, 'a rated game adds a rating-history point for each player')
  const stored = db.prepare('SELECT clocks FROM games WHERE id = ?').get(r.id) as { clocks: string }
  check(stored.clocks.split(' ').length === 2, 'the clock after every move is saved')
  db.close()
  const winnerName = r.white === alice ? 'alice_test' : 'bob_test'
  const prof = (await alice.http(`/api/users/${winnerName}`)).body as unknown as Profile
  check(prof.games?.length === 1 && prof.record.win === 1 && prof.ratings.blitz.rating > 1500, 'the profile shows the game and new blitz rating')

  console.log('recovery codes and passwords')
  const carol = new Client()
  const carolReg = await carol.http('/api/register', { method: 'POST', body: { username: 'carol_test', password: 'first password' } })
  const carolCode = String(carolReg.body.recoveryCode)
  await carol.connect()
  const carolClosed = new Promise<number>((res) => carol.ws!.on('close', (c) => res(c)))
  const thief = new Client()
  check(
    (await thief.http('/api/recover', { method: 'POST', body: { username: 'carol_test', code: 'AAAA-BBBB-CCCC', password: 'new password 1' } })).status === 401,
    'a wrong recovery code is refused',
  )
  const typed = carolCode.toLowerCase().replace(/-/g, ' ')
  const rec = await thief.http('/api/recover', { method: 'POST', body: { username: 'CAROL_TEST', code: typed, password: 'new password 1' } })
  const newCode = String(rec.body.recoveryCode ?? '')
  check(rec.status === 200 && newCode && newCode !== carolCode, 'the code resets the password, typed in any case and spacing, and a new code is issued')
  check(!(await thief.http('/api/me')).body.guest, 'the reset signs you in')
  check((await Promise.race([carolClosed, sleep(2000).then(() => -1)])) === 4001, "the account's open sockets are closed")
  check((await carol.http('/api/me')).body.guest === true, 'every other session is signed out')
  check(
    (await new Client().http('/api/recover', { method: 'POST', body: { username: 'carol_test', code: carolCode, password: 'new password 2' } })).status === 401,
    'a used recovery code stops working',
  )
  const laptop = new Client()
  check((await laptop.http('/api/login', { method: 'POST', body: { username: 'carol_test', password: 'new password 1' } })).status === 200, 'the new password signs in')
  check((await thief.http('/api/password', { method: 'POST', body: { current: 'wrong', password: 'new password 3' } })).status === 401, 'changing the password needs the current one')
  check((await thief.http('/api/password', { method: 'POST', body: { current: 'new password 1', password: 'new password 3' } })).status === 200, 'change the password')
  check((await thief.http('/api/me')).body.guest === false, 'the session that changed it stays signed in')
  check((await laptop.http('/api/me')).body.guest === true, 'other sessions are signed out by a password change')
  check((await thief.http('/api/recovery-code', { method: 'POST', body: { current: 'nope' } })).status === 401, 'a new recovery code needs the current password')
  const again = await thief.http('/api/recovery-code', { method: 'POST', body: { current: 'new password 3' } })
  check(again.status === 200 && String(again.body.recoveryCode) !== newCode, 'make a new recovery code')
  check(
    (await new Client().http('/api/recover', { method: 'POST', body: { username: 'carol_test', code: newCode, password: 'new password 4' } })).status === 401,
    'the replaced code stops working',
  )
  check((await new Client().http('/api/password', { method: 'POST', body: { current: 'x', password: 'new password 5' } })).status === 401, 'guests have no password to change')

  console.log('challenge links and spectators')
  alice.send({ t: 'challenge', tc: '10+0', rated: false, color: 'w' })
  const ch = await alice.next<{ t: 'challenge.created'; id: string }>((m) => m.t === 'challenge.created')
  alice.send({ t: 'watch', id: ch.id })
  await alice.game(ch.id, (g) => g.status === 'waiting')
  const guest = new Client()
  await guest.connect()
  guest.send({ t: 'watch', id: ch.id })
  const waiting = await guest.game(ch.id)
  check(waiting.status === 'waiting' && waiting.challenge?.by.name === 'alice_test', 'a friend opening the link sees the challenge')
  guest.send({ t: 'challenge.accept', id: ch.id })
  const live = await guest.game(ch.id, (g) => g.status === 'live')
  check(live.you === 'b' && live.white?.name === 'alice_test', 'accepting seats the friend; the creator got the side they asked for')
  const watcher = new Client()
  await watcher.connect()
  watcher.send({ t: 'watch', id: ch.id })
  const seen = await watcher.game(ch.id)
  check(seen.you === null && seen.status === 'live', 'anyone can watch a live game')
  const lobbyFan = new Client()
  await lobbyFan.connect()
  lobbyFan.send({ t: 'lobby.sub' })
  const lobby = await lobbyFan.next<{ t: 'lobby'; games: { id: string }[] }>((m) => m.t === 'lobby')
  check(lobby.games.some((g) => g.id === ch.id), 'the lobby lists live games')
  watcher.send({ t: 'chat', id: ch.id, text: 'hi' })
  const noChat = await watcher.next<{ t: 'error'; message: string }>((m) => m.t === 'error')
  check(/players/.test(noChat.message), 'spectators cannot chat')
  alice.send({ t: 'move', id: ch.id, uci: 'd2d4', ply: 0 })
  await guest.game(ch.id, (g) => g.moves.length === 1)
  guest.send({ t: 'move', id: ch.id, uci: 'd7d5', ply: 1 })
  await alice.game(ch.id, (g) => g.moves.length === 2)
  alice.send({ t: 'chat', id: ch.id, text: 'back after the restart' })
  await guest.next((m) => m.t === 'chat')

  console.log('a restart keeps live games')
  for (const c of [g1, g2, alice, bob, guest, watcher, lobbyFan]) c.close()
  await stopServer()
  await startServer()
  const back = new Client()
  back.cookie = alice.cookie
  await back.connect()
  const startAgain = await back.next<{ t: 'start'; id: string }>((m) => m.t === 'start')
  check(startAgain.id === ch.id, 'a player reconnecting is sent back to their game')
  back.send({ t: 'watch', id: ch.id })
  const restored = await back.game(ch.id)
  check(restored.status === 'live' && restored.moves.join(' ') === 'd2d4 d7d5', 'the game survives the restart with its moves')
  check(restored.clocks.w > 590_000 && restored.clocks.w <= 600_000, 'downtime is not charged to the clock')
  check(restored.times.length === 2, 'the clock list survives the restart')
  const history = await back.next<{ t: 'chat.history'; lines: { text: string }[] }>((m) => m.t === 'chat.history')
  check(history.lines.some((l) => l.text === 'back after the restart'), 'chat survives the restart')
  back.close()

  console.log('lag compensation')
  const l1 = new Client()
  const l2 = new Client()
  await l1.connect()
  await l2.connect()
  const lg = await pairedGame(l1, l2, '1+0', false)
  // Answer the first probe at once, then the next one 2 s late: the smoothed round trip is then about 500 ms.
  const first = await lg.white.next<{ t: 'lag'; n: number }>((m) => m.t === 'lag', 6000)
  lg.white.send({ t: 'lag', n: first.n })
  const second = await lg.white.next<{ t: 'lag'; n: number }>((m) => m.t === 'lag', 6000)
  await sleep(2000)
  lg.white.send({ t: 'lag', n: second.n })
  await play(lg.id, lg.white, lg.black, ['e2e4', 'e7e5'])
  await lg.white.game(lg.id, (g) => g.moves.length === 2)
  const t0 = Date.now()
  await sleep(1000)
  lg.white.send({ t: 'move', id: lg.id, uci: 'g1f3', ply: 2 })
  const after = await lg.black.game(lg.id, (g) => g.moves.length === 3)
  const elapsed = Date.now() - t0
  const used = 60_000 - after.times[2]
  const credit = elapsed - used
  check(credit > 150 && credit < 400, `a laggy player gets about half their round trip back (${credit} ms)`)
  check((after.ping.w ?? 0) > 300, `the measured ping is shown to both players (${after.ping.w} ms)`)
  l1.close()
  l2.close()

  await stopServer()
}

main()
  .catch((e) => {
    failures++
    console.error(e)
  })
  .finally(async () => {
    await stopServer()
    rmSync(dataDir, { recursive: true, force: true })
    rmSync(oldDir, { recursive: true, force: true })
    console.log(failures ? `\n${failures} check(s) failed` : '\nall online checks passed')
    process.exit(failures ? 1 : 0)
  })
