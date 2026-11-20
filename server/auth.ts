import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { createSession, deleteSession, secret, sessionUser, userById } from './db.ts'

export interface Identity {
  id: string
  name: string
  guest: boolean
}

export const SESSION_COOKIE = 'cp_session'
export const GUEST_COOKIE = 'cp_guest'
const SESSION_DAYS = 30
const SECURE = process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0'

/* --------------------------------------------------------------- passwords */

const N = 16384
const KEYLEN = 64

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((res, rej) => scrypt(password, salt, KEYLEN, { N, r: 8, p: 1 }, (err, key) => (err ? rej(err) : res(key))))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltB64, keyB64] = stored.split('$')
  if (kind !== 'scrypt' || !saltB64 || !keyB64) return false
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'))
  const want = Buffer.from(keyB64, 'base64')
  return want.length === key.length && timingSafeEqual(want, key)
}

/** A hash to compare against when the username does not exist, so timing does not reveal it. */
export const DUMMY_HASH = await hashPassword(randomBytes(12).toString('hex'))

/* ----------------------------------------------------------------- cookies */

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim())
    } catch {
      /* malformed cookie: ignore it */
    }
  }
  return out
}

export function cookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${SECURE ? '; Secure' : ''}`
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const sign = (s: string) => createHmac('sha256', secret()).update(s).digest('base64url')

/* ---------------------------------------------------------------- sessions */

/** Start a session; returns the Set-Cookie header. */
export function startSession(userId: string): string {
  const token = randomBytes(32).toString('base64url')
  createSession(sha256(token), userId, Date.now() + SESSION_DAYS * 86_400_000)
  return cookie(SESSION_COOKIE, token, SESSION_DAYS * 86_400)
}

export function endSession(req: IncomingMessage): string {
  const token = parseCookies(req)[SESSION_COOKIE]
  if (token) deleteSession(sha256(token))
  return cookie(SESSION_COOKIE, '', 0)
}

/* ------------------------------------------------------------------ guests */

export function newGuest(): { identity: Identity; setCookie: string } {
  const identity: Identity = { id: 'g' + randomBytes(8).toString('hex'), name: `Guest${randomInt(10000, 99999)}`, guest: true }
  const payload = Buffer.from(`${identity.id}.${identity.name}`).toString('base64url')
  return { identity, setCookie: cookie(GUEST_COOKIE, `${payload}.${sign(payload)}`, 365 * 86_400) }
}

function guestFrom(value: string | undefined): Identity | null {
  if (!value) return null
  const [payload, sig] = value.split('.')
  if (!payload || !sig) return null
  const want = Buffer.from(sign(payload))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  const [id, name] = Buffer.from(payload, 'base64url').toString().split('.')
  return id && name ? { id, name, guest: true } : null
}

/** Who is making this request: a signed-in user, a guest, or nobody yet. */
export function identify(req: IncomingMessage): Identity | null {
  const cookies = parseCookies(req)
  const token = cookies[SESSION_COOKIE]
  if (token) {
    const userId = sessionUser(sha256(token))
    const user = userId ? userById(userId) : null
    if (user) return { id: user.id, name: user.username, guest: false }
  }
  return guestFrom(cookies[GUEST_COOKIE])
}

/* -------------------------------------------------------------- rate limit */

/** A token bucket per key: `burst` actions at once, refilled at `perSecond`. */
export class RateLimiter {
  buckets = new Map<string, { tokens: number; at: number }>()
  burst: number
  perSecond: number

  constructor(burst: number, perSecond: number) {
    this.burst = burst
    this.perSecond = perSecond
    setInterval(() => {
      const cutoff = Date.now() - 10 * 60_000
      for (const [k, b] of this.buckets) if (b.at < cutoff) this.buckets.delete(k)
    }, 60_000).unref()
  }

  take(key: string): boolean {
    const now = Date.now()
    const b = this.buckets.get(key) ?? { tokens: this.burst, at: now }
    b.tokens = Math.min(this.burst, b.tokens + ((now - b.at) / 1000) * this.perSecond)
    b.at = now
    this.buckets.set(key, b)
    if (b.tokens < 1) return false
    b.tokens -= 1
    return true
  }
}

/** The client's address, trusting X-Forwarded-For only when TRUST_PROXY is set (behind a load balancer). */
export function clientIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY) {
    const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
    if (fwd) return fwd
  }
  return req.socket.remoteAddress ?? 'unknown'
}
