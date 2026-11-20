import { reconnect } from './connection'
import type { Profile, UserInfo, WithRecoveryCode } from './protocol'

/** The account and profile endpoints. Every call is same-origin with the session cookie. */

async function call<T>(path: string, body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection.')
  }
  const data = (await r.json().catch(() => ({}))) as { error?: string }
  if (!r.ok) throw new Error(data.error ?? `The server answered ${r.status}.`)
  return data as T
}

/** A new account, signed in, and its recovery code (shown once). */
export async function register(username: string, password: string): Promise<WithRecoveryCode> {
  const out = await call<WithRecoveryCode>('/api/register', { username, password })
  reconnect()
  return out
}

/** Forgotten password: sets a new one, signs out everywhere else, and returns a new recovery code. */
export async function recover(username: string, code: string, password: string): Promise<WithRecoveryCode> {
  const out = await call<WithRecoveryCode>('/api/recover', { username, code, password })
  reconnect()
  return out
}

/** Signed in: change the password. Every other device is signed out. */
export async function changePassword(current: string, password: string): Promise<void> {
  await call('/api/password', { current, password })
}

/** Signed in: replace the recovery code. The old one stops working. */
export async function newRecoveryCode(current: string): Promise<string> {
  const out = await call<{ recoveryCode: string }>('/api/recovery-code', { current })
  reconnect()
  return out.recoveryCode
}

export async function login(username: string, password: string): Promise<UserInfo> {
  const user = await call<UserInfo>('/api/login', { username, password })
  reconnect()
  return user
}

export async function logout(): Promise<void> {
  await call('/api/logout', {})
  reconnect()
}

export function profile(username: string): Promise<Profile> {
  return call<Profile>(`/api/users/${encodeURIComponent(username)}`)
}
