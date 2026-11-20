import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { DEFAULT_GLICKO, type Glicko } from './glicko.ts'
import { SPEEDS, type Speed } from '../src/online/protocol.ts'

/**
 * SQLite through Node's built-in driver (no native module to compile).
 * One file under DATA_DIR; mount that directory on a volume in production.
 */
export const DATA_DIR = resolve(process.env.DATA_DIR ?? 'data')
mkdirSync(DATA_DIR, { recursive: true })

const db = new DatabaseSync(join(DATA_DIR, 'oukplay.db'))
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass TEXT NOT NULL,
    ratings TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    white_id TEXT NOT NULL,
    white_name TEXT NOT NULL,
    white_guest INTEGER NOT NULL,
    white_rating INTEGER,
    black_id TEXT NOT NULL,
    black_name TEXT NOT NULL,
    black_guest INTEGER NOT NULL,
    black_rating INTEGER,
    tc TEXT NOT NULL,
    rated INTEGER NOT NULL,
    status TEXT NOT NULL,
    moves TEXT NOT NULL DEFAULT '',
    clock_w INTEGER NOT NULL,
    clock_b INTEGER NOT NULL,
    winner TEXT,
    reason TEXT,
    white_diff INTEGER,
    black_diff INTEGER,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS games_white ON games(white_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS games_black ON games(black_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS games_status ON games(status);
`)

/* -------------------------------------------------------------------- meta */

/** A per-install secret for signing guest cookies, unless SESSION_SECRET is set. */
export function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get('secret') as { value: string } | undefined
  if (row) return row.value
  const value = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run('secret', value)
  return value
}

/* ------------------------------------------------------------------- users */

export type Ratings = Record<Speed, Glicko>

export interface UserRow {
  id: string
  username: string
  pass: string
  ratings: Ratings
  createdAt: number
}

function freshRatings(): Ratings {
  return Object.fromEntries(SPEEDS.map((s) => [s, { ...DEFAULT_GLICKO }])) as Ratings
}

function toUser(row: Record<string, unknown> | undefined): UserRow | null {
  if (!row) return null
  const stored = JSON.parse(String(row.ratings)) as Partial<Ratings>
  return {
    id: String(row.id),
    username: String(row.username),
    pass: String(row.pass),
    ratings: { ...freshRatings(), ...stored },
    createdAt: Number(row.created_at),
  }
}

export function createUser(username: string, pass: string): UserRow | null {
  const id = 'u' + randomBytes(8).toString('hex')
  try {
    db.prepare('INSERT INTO users (id, username, pass, ratings, created_at) VALUES (?, ?, ?, ?, ?)').run(
      id,
      username,
      pass,
      JSON.stringify(freshRatings()),
      Date.now(),
    )
  } catch (e) {
    if (String(e).includes('UNIQUE')) return null
    throw e
  }
  return userById(id)
}

export function userById(id: string): UserRow | null {
  return toUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined)
}

export function userByName(username: string): UserRow | null {
  return toUser(db.prepare('SELECT * FROM users WHERE username = ?').get(username) as Record<string, unknown> | undefined)
}

export function saveRatings(id: string, ratings: Ratings) {
  db.prepare('UPDATE users SET ratings = ? WHERE id = ?').run(JSON.stringify(ratings), id)
}

/* ---------------------------------------------------------------- sessions */

export function createSession(tokenHash: string, userId: string, expiresAt: number) {
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt)
}

export function sessionUser(tokenHash: string): string | null {
  const row = db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(tokenHash) as
    | { user_id: string; expires_at: number }
    | undefined
  if (!row) return null
  if (row.expires_at < Date.now()) {
    deleteSession(tokenHash)
    return null
  }
  return row.user_id
}

export function deleteSession(tokenHash: string) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

export function purgeSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now())
}

/* ------------------------------------------------------------------- games */

export interface GameRow {
  id: string
  whiteId: string
  whiteName: string
  whiteGuest: boolean
  whiteRating: number | null
  blackId: string
  blackName: string
  blackGuest: boolean
  blackRating: number | null
  tc: string
  rated: boolean
  status: 'live' | 'ended'
  moves: string[]
  clockW: number
  clockB: number
  winner: 'w' | 'b' | null
  reason: string | null
  whiteDiff: number | null
  blackDiff: number | null
  startedAt: number
  endedAt: number | null
}

function toGame(r: Record<string, unknown>): GameRow {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    id: String(r.id),
    whiteId: String(r.white_id),
    whiteName: String(r.white_name),
    whiteGuest: Boolean(r.white_guest),
    whiteRating: num(r.white_rating),
    blackId: String(r.black_id),
    blackName: String(r.black_name),
    blackGuest: Boolean(r.black_guest),
    blackRating: num(r.black_rating),
    tc: String(r.tc),
    rated: Boolean(r.rated),
    status: r.status === 'live' ? 'live' : 'ended',
    moves: r.moves ? String(r.moves).split(' ') : [],
    clockW: Number(r.clock_w),
    clockB: Number(r.clock_b),
    winner: r.winner === 'w' || r.winner === 'b' ? r.winner : null,
    reason: r.reason ? String(r.reason) : null,
    whiteDiff: num(r.white_diff),
    blackDiff: num(r.black_diff),
    startedAt: Number(r.started_at),
    endedAt: num(r.ended_at),
  }
}

export function insertGame(g: GameRow) {
  db.prepare(
    `INSERT INTO games (id, white_id, white_name, white_guest, white_rating, black_id, black_name, black_guest, black_rating,
      tc, rated, status, moves, clock_w, clock_b, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    g.id,
    g.whiteId,
    g.whiteName,
    g.whiteGuest ? 1 : 0,
    g.whiteRating,
    g.blackId,
    g.blackName,
    g.blackGuest ? 1 : 0,
    g.blackRating,
    g.tc,
    g.rated ? 1 : 0,
    g.status,
    g.moves.join(' '),
    Math.round(g.clockW),
    Math.round(g.clockB),
    g.startedAt,
  )
}

export function saveProgress(id: string, moves: string[], clockW: number, clockB: number) {
  db.prepare('UPDATE games SET moves = ?, clock_w = ?, clock_b = ? WHERE id = ?').run(moves.join(' '), Math.round(clockW), Math.round(clockB), id)
}

export function finishGame(
  id: string,
  f: { moves: string[]; clockW: number; clockB: number; winner: 'w' | 'b' | null; reason: string; whiteDiff: number | null; blackDiff: number | null },
) {
  db.prepare(
    `UPDATE games SET status = 'ended', moves = ?, clock_w = ?, clock_b = ?, winner = ?, reason = ?, white_diff = ?, black_diff = ?, ended_at = ?
     WHERE id = ?`,
  ).run(f.moves.join(' '), Math.round(f.clockW), Math.round(f.clockB), f.winner, f.reason, f.whiteDiff, f.blackDiff, Date.now(), id)
}

/** An aborted game leaves no record. */
export function deleteGame(id: string) {
  db.prepare('DELETE FROM games WHERE id = ?').run(id)
}

export function gameById(id: string): GameRow | null {
  const r = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return r ? toGame(r) : null
}

export function liveGames(): GameRow[] {
  return (db.prepare(`SELECT * FROM games WHERE status = 'live'`).all() as Record<string, unknown>[]).map(toGame)
}

export function gamesOf(userId: string, limit: number, before?: number): GameRow[] {
  const cutoff = before ?? Number.MAX_SAFE_INTEGER
  return (
    db
      .prepare(
        `SELECT * FROM games WHERE status = 'ended' AND (white_id = ? OR black_id = ?) AND started_at < ?
         ORDER BY started_at DESC LIMIT ?`,
      )
      .all(userId, userId, cutoff, limit) as Record<string, unknown>[]
  ).map(toGame)
}

export function recordOf(userId: string): { win: number; loss: number; draw: number } {
  const r = db
    .prepare(
      `SELECT
        SUM(CASE WHEN (white_id = ?1 AND winner = 'w') OR (black_id = ?1 AND winner = 'b') THEN 1 ELSE 0 END) AS win,
        SUM(CASE WHEN (white_id = ?1 AND winner = 'b') OR (black_id = ?1 AND winner = 'w') THEN 1 ELSE 0 END) AS loss,
        SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) AS draw
       FROM games WHERE status = 'ended' AND (white_id = ?1 OR black_id = ?1)`,
    )
    .get(userId) as { win: number | null; loss: number | null; draw: number | null }
  return { win: r.win ?? 0, loss: r.loss ?? 0, draw: r.draw ?? 0 }
}
