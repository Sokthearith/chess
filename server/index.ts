/**
 * Oukplay's server: the built site, a small JSON API for accounts and
 * profiles, and the WebSocket that runs online games. Run with Node 22.18+
 * (TypeScript is loaded directly): `node server/index.ts`.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { brotliCompressSync, gzipSync, constants as zlib } from 'node:zlib'
import { WebSocketServer } from 'ws'
import {
  DUMMY_HASH,
  RateLimiter,
  checkPassword,
  clientIp,
  endSession,
  hashPassword,
  identify,
  newGuest,
  newRecoveryCode,
  normalizeCode,
  sessionHashOf,
  startSession,
  type Identity,
} from './auth.ts'
import { createUser, deleteSessionsOf, gamesOf, purgeSessions, recordOf, saveProgress, setPassword, setRecovery, userById, userByName } from './db.ts'
import { Hub, userInfo } from './hub.ts'
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_RE,
  type EndReason,
  type GameSummary,
  type Profile,
  type WithRecoveryCode,
} from '../src/online/protocol.ts'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '0.0.0.0'
const DIST = resolve(process.env.DIST_DIR ?? 'dist')
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const PASSWORD_RULE = `Passwords are ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`
const passwordOk = (p: string) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX
const RESERVED = /^(guest|admin|administrator|mod|moderator|system|oukplay|anonymous|stockfish|support|root)/i

const hub = new Hub()
// Sign-in, sign-up and recovery attempts per address. AUTH_BURST raises it for the test script only.
const authLimit = new RateLimiter(Number(process.env.AUTH_BURST ?? 10), 10 / 60)
const connectLimit = new RateLimiter(30, 0.5)

/* ----------------------------------------------------------------- helpers */

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string | string[]> = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

/** Same-origin requests only (or the configured origins): blocks cross-site form posts and sockets. */
function originOk(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (!origin) return true
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    return new URL(origin).host === req.headers.host
  } catch {
    return false
  }
}

async function body(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return null
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 10_000) return null
    chunks.push(chunk as Buffer)
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString())
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/* --------------------------------------------------------------------- api */

async function api(req: IncomingMessage, res: ServerResponse, path: string) {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && !originOk(req)) return json(res, 403, { error: 'Cross-site request refused.' })

  if (path === '/api/me' && method === 'GET') {
    const who = identify(req)
    if (who) return json(res, 200, userInfo(who))
    const guest = newGuest()
    return json(res, 200, userInfo(guest.identity), { 'Set-Cookie': guest.setCookie })
  }

  if ((path === '/api/register' || path === '/api/login') && method === 'POST') {
    if (!authLimit.take(clientIp(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' })
    const b = await body(req)
    const username = typeof b?.username === 'string' ? b.username.trim() : ''
    const password = typeof b?.password === 'string' ? b.password : ''
    if (path === '/api/register') {
      if (!USERNAME_RE.test(username)) return json(res, 400, { error: 'Usernames are 3 to 20 letters, digits, - or _, starting with a letter or digit.' })
      if (RESERVED.test(username)) return json(res, 400, { error: 'That username is reserved. Pick another.' })
      if (!passwordOk(password)) return json(res, 400, { error: PASSWORD_RULE })
      const user = createUser(username, await hashPassword(password))
      if (!user) return json(res, 409, { error: 'That username is taken.' })
      const recoveryCode = newRecoveryCode()
      setRecovery(user.id, await hashPassword(normalizeCode(recoveryCode)))
      const who: Identity = { id: user.id, name: user.username, guest: false }
      const out: WithRecoveryCode = { user: userInfo(who), recoveryCode }
      return json(res, 201, out, { 'Set-Cookie': startSession(user.id) })
    }
    const user = username && password.length <= PASSWORD_MAX ? userByName(username) : null
    const ok = await checkPassword(password, user?.pass ?? DUMMY_HASH)
    if (!user || !ok) return json(res, 401, { error: 'Wrong username or password.' })
    return json(res, 200, userInfo({ id: user.id, name: user.username, guest: false }), { 'Set-Cookie': startSession(user.id) })
  }

  // Forgotten password: username + recovery code + a new password. Signs out everywhere, issues a new code.
  if (path === '/api/recover' && method === 'POST') {
    if (!authLimit.take(clientIp(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' })
    const b = await body(req)
    const username = typeof b?.username === 'string' ? b.username.trim() : ''
    const code = typeof b?.code === 'string' ? normalizeCode(b.code) : ''
    const password = typeof b?.password === 'string' ? b.password : ''
    if (!passwordOk(password)) return json(res, 400, { error: PASSWORD_RULE })
    const user = username ? userByName(username) : null
    const ok = await checkPassword(code, user?.recoveryHash ?? DUMMY_HASH)
    if (!user || !user.recoveryHash || !ok) return json(res, 401, { error: 'That username and recovery code do not match.' })
    setPassword(user.id, await hashPassword(password))
    const recoveryCode = newRecoveryCode()
    setRecovery(user.id, await hashPassword(normalizeCode(recoveryCode)))
    deleteSessionsOf(user.id)
    hub.kickUser(user.id)
    const out: WithRecoveryCode = { user: userInfo({ id: user.id, name: user.username, guest: false }), recoveryCode }
    return json(res, 200, out, { 'Set-Cookie': startSession(user.id) })
  }

  // Signed in: change the password (other sessions end), or make a new recovery code. Both need the current password.
  if ((path === '/api/password' || path === '/api/recovery-code') && method === 'POST') {
    if (!authLimit.take(clientIp(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' })
    const who = identify(req)
    const user = who && !who.guest ? userById(who.id) : null
    if (!user) return json(res, 401, { error: 'Sign in first.' })
    const b = await body(req)
    const current = typeof b?.current === 'string' ? b.current : ''
    if (current.length > PASSWORD_MAX || !(await checkPassword(current, user.pass))) return json(res, 401, { error: 'Your current password is not right.' })
    if (path === '/api/password') {
      const next = typeof b?.password === 'string' ? b.password : ''
      if (!passwordOk(next)) return json(res, 400, { error: PASSWORD_RULE })
      setPassword(user.id, await hashPassword(next))
      const keep = sessionHashOf(req)
      deleteSessionsOf(user.id, keep)
      hub.kickUser(user.id, keep)
      return json(res, 200, { ok: true })
    }
    const recoveryCode = newRecoveryCode()
    setRecovery(user.id, await hashPassword(normalizeCode(recoveryCode)))
    return json(res, 200, { recoveryCode })
  }

  if (path === '/api/logout' && method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': endSession(req) })
  }

  const profile = /^\/api\/users\/([A-Za-z0-9_-]{1,20})$/.exec(path)
  if (profile && method === 'GET') {
    const user = userByName(profile[1])
    if (!user) return json(res, 404, { error: 'No player by that name.' })
    const info = userInfo({ id: user.id, name: user.username, guest: false })
    const games: GameSummary[] = gamesOf(user.id, 50).map((g) => {
      const side = g.whiteId === user.id ? 'w' : 'b'
      return {
        id: g.id,
        white: g.whiteName,
        black: g.blackName,
        whiteRating: g.whiteRating,
        blackRating: g.blackRating,
        tc: g.tc,
        rated: g.rated,
        winner: g.winner,
        reason: (g.reason ?? 'aborted') as EndReason,
        plies: g.moves.length,
        endedAt: g.endedAt ?? g.startedAt,
        side,
        diff: side === 'w' ? g.whiteDiff : g.blackDiff,
      }
    })
    const body: Profile = {
      name: user.username,
      createdAt: user.createdAt,
      ratings: info.ratings!,
      record: recordOf(user.id),
      games,
      online: hub.isOnline(user.id),
      playing: hub.liveByUser.get(user.id) ?? null,
    }
    return json(res, 200, body)
  }

  return json(res, 404, { error: 'Not found.' })
}

/* ------------------------------------------------------------------ static */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.wasm', '.txt'])
const cache = new Map<string, { raw: Buffer; br?: Buffer; gz?: Buffer; mtime: number }>()

async function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
  let rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '')
  let file = join(DIST, rel)
  if (!file.startsWith(DIST + sep) && file !== DIST) return json(res, 400, { error: 'Bad path.' })
  let info = await stat(file).catch(() => null)
  if (!info || info.isDirectory()) {
    // The app's own routes all render index.html; a missing asset is a real 404.
    if (extname(rel)) {
      res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain' })
      return res.end('Not found')
    }
    rel = 'index.html'
    file = join(DIST, rel)
    info = await stat(file).catch(() => null)
    if (!info) {
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      return res.end('The site is not built yet: run npm run build.')
    }
  }
  const ext = extname(file)
  let entry = cache.get(file)
  if (!entry || entry.mtime !== info.mtimeMs) {
    entry = { raw: await readFile(file), mtime: info.mtimeMs }
    if (COMPRESSIBLE.has(ext) && entry.raw.length > 1024) {
      entry.br = brotliCompressSync(entry.raw, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } })
      entry.gz = gzipSync(entry.raw, { level: 9 })
    }
    cache.set(file, entry)
  }
  const accept = String(req.headers['accept-encoding'] ?? '')
  const headers: Record<string, string> = {
    ...SECURITY_HEADERS,
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    // Vite fingerprints everything under assets/; the rest must be revalidated.
    'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    Vary: 'Accept-Encoding',
  }
  let out = entry.raw
  if (entry.br && /\bbr\b/.test(accept)) {
    out = entry.br
    headers['Content-Encoding'] = 'br'
  } else if (entry.gz && /\bgzip\b/.test(accept)) {
    out = entry.gz
    headers['Content-Encoding'] = 'gzip'
  }
  headers['Content-Length'] = String(out.length)
  res.writeHead(200, headers)
  res.end(req.method === 'HEAD' ? undefined : out)
}

/* ------------------------------------------------------------------ server */

const server = createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  try {
    if (path === '/healthz') return json(res, 200, { ok: true, games: hub.liveByUser.size / 2, online: hub.conns.size })
    if (path.startsWith('/api/')) return await api(req, res, path)
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed.' })
    return await serveStatic(req, res, path)
  } catch (e) {
    console.error(req.method, path, e)
    if (!res.headersSent) json(res, 500, { error: 'Server error.' })
    else res.end()
  }
})

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 })

server.on('upgrade', (req, socket, head) => {
  const reject = (code: number, text: string) => {
    socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`)
    socket.destroy()
  }
  if ((req.url ?? '').split('?')[0] !== '/ws') return reject(404, 'Not Found')
  if (!originOk(req)) return reject(403, 'Forbidden')
  const ip = clientIp(req)
  if (!connectLimit.take(ip)) return reject(429, 'Too Many Requests')
  const who = identify(req)
  if (!who) return reject(401, 'Unauthorized')
  wss.handleUpgrade(req, socket, head, (ws) => hub.connect(ws, who, ip))
})

setInterval(() => hub.heartbeat(), 30_000).unref()
setInterval(() => purgeSessions(), 6 * 3600_000).unref()

server.listen(PORT, HOST, () => console.log(`Oukplay on http://localhost:${PORT} (serving ${DIST})`))

/** On a deploy: save every live game's clocks, tell clients to reconnect, and stop. */
function shutdown(signal: string) {
  console.log(`${signal}: saving live games and closing`)
  for (const room of hub.rooms.values()) {
    if (room.status !== 'live') continue
    const c = room.currentClocks()
    saveProgress(room.id, room.moves, room.times, c.w, c.b)
  }
  for (const c of hub.conns) c.ws.close(1012, 'Server restarting')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
