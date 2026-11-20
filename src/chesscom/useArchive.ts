import { useCallback, useEffect, useState } from 'react'
import {
  ChessComError,
  fetchArchives,
  fetchMonth,
  fetchProfile,
  fetchStats,
  type ArchiveMonth,
  type ChessComGame,
  type ChessComProfile,
  type ChessComStats,
} from './api'

const USER_KEY = 'counterplay.chesscom.username'

export function rememberedUsername(): string {
  try {
    return localStorage.getItem(USER_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberUsername(username: string) {
  try {
    if (username) localStorage.setItem(USER_KEY, username)
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* private mode */
  }
}

export interface PlayerData {
  profile: ChessComProfile
  stats: ChessComStats
  archives: ArchiveMonth[]
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Profile, stats and the list of archive months for one player. */
export function usePlayer(username: string) {
  const [data, setData] = useState<PlayerData | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!username) {
      setData(null)
      setStatus('idle')
      setError(null)
      return
    }
    const ctrl = new AbortController()
    setStatus('loading')
    setError(null)
    Promise.all([fetchProfile(username, ctrl.signal), fetchStats(username, ctrl.signal), fetchArchives(username, ctrl.signal)])
      .then(([profile, stats, archives]) => {
        setData({ profile, stats, archives: [...archives].reverse() })
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setData(null)
        setStatus('error')
        setError(e instanceof ChessComError ? e.message : 'Chess.com did not answer. Check the connection and try again.')
      })
    return () => ctrl.abort()
  }, [username])

  return { data, status, error }
}

const monthCache = new Map<string, ChessComGame[]>()

/** One month of games, cached for the session. */
export function useMonth(username: string, month: ArchiveMonth | null) {
  const key = month ? `${username}/${month.year}/${month.month}` : ''
  const [games, setGames] = useState<ChessComGame[] | null>(() => (key && monthCache.get(key)) || null)
  const [status, setStatus] = useState<Status>(key && monthCache.has(key) ? 'ready' : 'idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!key || !month) {
      setGames(null)
      setStatus('idle')
      return
    }
    const cached = monthCache.get(key)
    if (cached) {
      setGames(cached)
      setStatus('ready')
      return
    }
    const ctrl = new AbortController()
    setStatus('loading')
    setError(null)
    fetchMonth(username, month.year, month.month, ctrl.signal)
      .then((list) => {
        monthCache.set(key, list)
        setGames(list)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setStatus('error')
        setError(e instanceof ChessComError ? e.message : 'Could not load that month.')
      })
    return () => ctrl.abort()
  }, [key, username, month])

  return { games, status, error }
}

/** Find one game by month and id, through the same cache. */
export function useChessComGame(username: string, year: number, month: number, gameId: string) {
  const [game, setGame] = useState<ChessComGame | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(
    async (signal: AbortSignal) => {
      const key = `${username}/${year}/${month}`
      let list = monthCache.get(key)
      if (!list) {
        list = await fetchMonth(username, year, month, signal)
        monthCache.set(key, list)
      }
      return list.find((g) => g.url.endsWith(`/${gameId}`)) ?? null
    },
    [username, year, month, gameId],
  )
  useEffect(() => {
    const ctrl = new AbortController()
    setStatus('loading')
    setError(null)
    load(ctrl.signal)
      .then((g) => {
        if (!g) {
          setStatus('error')
          setError('That game is not in this archive month.')
          return
        }
        setGame(g)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setStatus('error')
        setError(e instanceof ChessComError ? e.message : 'Could not load the game.')
      })
    return () => ctrl.abort()
  }, [load])
  return { game, status, error }
}
