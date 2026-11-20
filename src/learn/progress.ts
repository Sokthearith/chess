import { useCallback, useSyncExternalStore } from 'react'

/**
 * Learning progress, kept in this browser only (localStorage). Nothing leaves
 * the machine; clearing site data resets it.
 */
export interface Progress {
  puzzleRating: number
  /** Puzzle ids solved without a mistake. */
  solved: string[]
  /** Puzzles attempted (any result). */
  attempted: number
  streak: number
  bestStreak: number
  /** Opening lesson id → 'learned' (walked through) or 'mastered' (practised with no mistakes). */
  openings: Record<string, 'learned' | 'mastered'>
  /** Endgame drill ids completed. */
  endgames: string[]
  /** Step lesson ids completed. */
  lessons: string[]
}

const KEY = 'counterplay.learn.v1'
const DEFAULT: Progress = { puzzleRating: 1200, solved: [], attempted: 0, streak: 0, bestStreak: 0, openings: {}, endgames: [], lessons: [] }

let current: Progress = read()
const listeners = new Set<() => void>()

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Progress>) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

/** The current progress, outside React. */
export const getProgressSnapshot = () => current

export function updateProgress(fn: (p: Progress) => Progress) {
  current = fn(current)
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode: progress lasts for this visit */
  }
  for (const l of listeners) l()
}

export function useProgress(): [Progress, typeof updateProgress] {
  const p = useSyncExternalStore(
    useCallback((l: () => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    }, []),
    () => current,
    () => DEFAULT,
  )
  return [p, updateProgress]
}

/** Elo against the puzzle's rating: K = 32 for the first 30 puzzles, 20 after. */
export function ratePuzzle(p: Progress, puzzleRating: number, won: boolean): number {
  const k = p.attempted < 30 ? 32 : 20
  const expected = 1 / (1 + 10 ** ((puzzleRating - p.puzzleRating) / 400))
  return Math.round(Math.max(400, Math.min(3200, p.puzzleRating + k * ((won ? 1 : 0) - expected))))
}

/** Back to a fresh start: rating 1200, nothing solved, nothing learned. */
export function resetProgress() {
  updateProgress(() => DEFAULT)
}
