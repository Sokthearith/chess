import { useSyncExternalStore } from 'react'

/**
 * Where reviewed PGNs live. A game opened for review is kept under
 * `oukplay.pgn.<hash>` in localStorage (sessionStorage as a fallback), and
 * the last eight are listed on the analysis page as "Recently analysed".
 */
export const PGN_PREFIX = 'oukplay.pgn.'
const RECENT_KEY = 'oukplay.recent.v1'
const MAX_RECENT = 8

export interface RecentGame {
  key: string
  title: string
  /** Where it came from: pasted, played here, a famous game. */
  source: string
  at: number
}

export function hashKey(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

const listeners = new Set<() => void>()
let cache: RecentGame[] | null = null

function readRecent(): RecentGame[] {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentGame[]
  } catch {
    cache = []
  }
  return cache
}

function writeRecent(list: RecentGame[]) {
  cache = list
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* private mode */
  }
  for (const l of listeners) l()
}

/** Store a PGN for review and return its key. Throws only if no storage at all is available. */
export function storePgn(pgn: string, title: string, source: string): string {
  const key = hashKey(pgn)
  let stored = false
  try {
    localStorage.setItem(PGN_PREFIX + key, pgn)
    stored = true
  } catch {
    /* fall back to the session */
  }
  try {
    sessionStorage.setItem(PGN_PREFIX + key, pgn)
    stored = true
  } catch {
    /* nothing */
  }
  if (!stored) throw new Error('This browser will not keep the game in memory. Try again in a normal window.')
  const prev = readRecent().filter((r) => r.key !== key)
  const next = [{ key, title, source, at: Date.now() }, ...prev]
  for (const dropped of next.slice(MAX_RECENT)) {
    try {
      localStorage.removeItem(PGN_PREFIX + dropped.key)
    } catch {
      /* ignore */
    }
  }
  writeRecent(next.slice(0, MAX_RECENT))
  return key
}

export function loadPgn(key: string): string | null {
  try {
    return localStorage.getItem(PGN_PREFIX + key) ?? sessionStorage.getItem(PGN_PREFIX + key)
  } catch {
    return null
  }
}

export function forgetRecent(key: string) {
  try {
    localStorage.removeItem(PGN_PREFIX + key)
  } catch {
    /* ignore */
  }
  writeRecent(readRecent().filter((r) => r.key !== key))
}

export function useRecentGames(): RecentGame[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    readRecent,
    () => [],
  )
}

export function clearRecent() {
  for (const r of readRecent()) {
    try {
      localStorage.removeItem(PGN_PREFIX + r.key)
    } catch {
      /* ignore */
    }
  }
  writeRecent([])
}
