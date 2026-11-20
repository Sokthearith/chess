import { useSyncExternalStore } from 'react'
import type { ClientMessage, LiveGameSummary, SeekInfo, ServerMessage, UserInfo } from './protocol'

/**
 * The one WebSocket to the game server, shared by every online page. It opens
 * on first use, stays open while the tab lives, reconnects with backoff, and
 * replays the lobby and game subscriptions after a reconnect.
 */

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting'

export interface LobbyData {
  seeks: SeekInfo[]
  games: LiveGameSummary[]
  online: number
  playing: number
}

export interface OnlineState {
  status: ConnStatus
  /** Who the server thinks we are (a guest until signed in). */
  user: UserInfo | null
  seeking: SeekInfo | null
  lobby: LobbyData | null
  /** The live game we are playing, if any. */
  current: string | null
  /** The last error the server sent that was not about one game. */
  error: string | null
}

let state: OnlineState = { status: 'idle', user: null, seeking: null, lobby: null, current: null, error: null }
const stateListeners = new Set<() => void>()
const messageListeners = new Set<(m: ServerMessage) => void>()

let ws: WebSocket | null = null
let retry = 0
let retryTimer: number | null = null
let pingTimer: number | null = null
let lobbySubs = 0
/** Bumped by every open(), so an older attempt still waiting on /api/me gives way. */
let gen = 0
const watched = new Map<string, number>()
const outbox: ClientMessage[] = []

function set(patch: Partial<OnlineState>) {
  state = { ...state, ...patch }
  for (const l of stateListeners) l()
}

export function getOnline(): OnlineState {
  return state
}

export function useOnline(): OnlineState {
  return useSyncExternalStore(
    (l) => {
      stateListeners.add(l)
      return () => stateListeners.delete(l)
    },
    () => state,
  )
}

export function onMessage(fn: (m: ServerMessage) => void): () => void {
  messageListeners.add(fn)
  return () => messageListeners.delete(fn)
}

/** Make sure the server knows us (this sets the guest cookie), then open the socket. */
async function open() {
  if (ws) return
  const mine = ++gen
  set({ status: state.status === 'idle' ? 'connecting' : 'reconnecting' })
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' })
    if (!r.ok) throw new Error(String(r.status))
    const user = (await r.json()) as UserInfo
    if (mine !== gen) return
    set({ user })
  } catch {
    if (mine === gen) scheduleRetry()
    return
  }
  if (ws || mine !== gen) return
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const sock = new WebSocket(`${proto}//${location.host}/ws`)
  ws = sock
  sock.onopen = () => {
    retry = 0
    set({ status: 'open' })
    if (lobbySubs > 0) sock.send(JSON.stringify({ t: 'lobby.sub' }))
    for (const id of watched.keys()) sock.send(JSON.stringify({ t: 'watch', id }))
    while (outbox.length) sock.send(JSON.stringify(outbox.shift()))
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = window.setInterval(() => send({ t: 'ping' }), 25_000)
  }
  sock.onmessage = (e) => {
    let m: ServerMessage
    try {
      m = JSON.parse(String(e.data)) as ServerMessage
    } catch {
      return
    }
    switch (m.t) {
      case 'lag':
        // Answer before anything else runs, so the measured time is the network's.
        sock.send(JSON.stringify({ t: 'lag', n: m.n }))
        return
      case 'hello':
        set({ user: m.user })
        break
      case 'seeking':
        set({ seeking: m.seek })
        break
      case 'lobby':
        set({ lobby: { seeks: m.seeks, games: m.games, online: m.online, playing: m.playing } })
        break
      case 'start':
        set({ current: m.id, seeking: null })
        break
      case 'game':
        if (m.game.id === state.current && m.game.status === 'ended') set({ current: null })
        break
      case 'error':
        if (!m.id) set({ error: m.message })
        break
    }
    for (const l of messageListeners) l(m)
  }
  sock.onclose = () => {
    if (ws !== sock) return
    ws = null
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = null
    set({ seeking: null })
    scheduleRetry()
  }
}

function scheduleRetry() {
  ws = null
  set({ status: 'reconnecting' })
  if (retryTimer) return
  const delay = Math.min(8000, 500 * 2 ** retry) * (0.75 + Math.random() * 0.5)
  retry++
  retryTimer = window.setTimeout(() => {
    retryTimer = null
    void open()
  }, delay)
}

/** Learn who we are without opening the socket (for the nav). Quietly does nothing if there is no server. */
let meLoaded = false
export function loadMe() {
  if (meLoaded || state.user) return
  meLoaded = true
  fetch('/api/me', { credentials: 'same-origin' })
    .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
    .then((user: UserInfo | null) => {
      if (user && !state.user) set({ user })
    })
    .catch(() => {})
}

export function connect() {
  if (state.status === 'idle') void open()
}

/** Drop the socket and open a fresh one: after signing in or out, so the server sees the new identity. */
export function reconnect() {
  const old = ws
  ws = null
  if (old) {
    old.onclose = null
    old.close()
  }
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
  retry = 0
  set({ seeking: null, current: null, status: 'connecting' })
  void open()
}

export function send(m: ClientMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
  else if (m.t !== 'ping' && m.t !== 'watch' && m.t !== 'lobby.sub') {
    outbox.push(m)
    connect()
  }
}

export function clearError() {
  set({ error: null })
}

export function subscribeLobby(): () => void {
  connect()
  lobbySubs++
  if (lobbySubs === 1) send({ t: 'lobby.sub' })
  return () => {
    lobbySubs--
    if (lobbySubs === 0) send({ t: 'lobby.unsub' })
  }
}

export function watchGame(id: string): () => void {
  connect()
  const n = watched.get(id) ?? 0
  watched.set(id, n + 1)
  if (n === 0) send({ t: 'watch', id })
  return () => {
    const left = (watched.get(id) ?? 1) - 1
    if (left > 0) watched.set(id, left)
    else {
      watched.delete(id)
      send({ t: 'unwatch', id })
    }
  }
}
