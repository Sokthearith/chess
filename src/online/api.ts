import { reconnect } from './connection'
import type { Profile, UserInfo } from './protocol'

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

export async function register(username: string, password: string): Promise<UserInfo> {
  const user = await call<UserInfo>('/api/register', { username, password })
  reconnect()
  return user
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
