import { useSyncExternalStore } from 'react'

/**
 * Saved games: the ones a player wants to keep. Each keeps its own PGN, so it
 * survives the recent-analyses list rolling over, plus the route that opened it.
 */
export interface SavedGame {
  /** Same key as the review cache: `chesscom:<id>`, `pgn:<hash>`. */
  id: string
  title: string
  /** Where it came from: Chess.com, played here, a famous game, pasted. */
  source: string
  /** The page to open (Chess.com reviews keep their own route). */
  to?: string
  pgn?: string
  result?: string
  date?: string
  savedAt: number
}

const KEY = 'counterplay.saved.v1'
const listeners = new Set<() => void>()
let cache: SavedGame[] | null = null

function read(): SavedGame[] {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedGame[]
  } catch {
    cache = []
  }
  return cache
}

function write(list: SavedGame[]) {
  cache = list
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* private mode: kept for this visit */
  }
  for (const l of listeners) l()
}

export const isSaved = (id: string) => read().some((g) => g.id === id)

export function saveGame(g: Omit<SavedGame, 'savedAt'>) {
  write([{ ...g, savedAt: Date.now() }, ...read().filter((x) => x.id !== g.id)])
}

export function unsaveGame(id: string) {
  write(read().filter((g) => g.id !== id))
}

export function clearSaved() {
  write([])
}

export function useSavedGames(): SavedGame[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    read,
    () => [],
  )
}
