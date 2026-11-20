import { useSyncExternalStore } from 'react'
import { setVolume } from '../sound/sounds'

/**
 * Board preferences, kept in this browser. Coordinates and move hints are
 * CSS switches on <html> (data-coords, data-hints) so every board obeys them
 * without a prop; auto-queen is read by the board when a pawn reaches the
 * last rank.
 */
export interface Settings {
  coords: boolean
  hints: boolean
  autoQueen: boolean
  /** Pieces slide, kings topple, grades pop. Off: everything jumps into place. */
  animation: boolean
  /** Tint the two squares of the last move. */
  lastMove: boolean
  /** Sound volume, 0 to 1. */
  volume: number
}

const KEY = 'oukplay.settings.v1'
export const DEFAULT_SETTINGS: Settings = { coords: true, hints: true, autoQueen: false, animation: true, lastMove: true, volume: 0.8 }
const DEFAULT = DEFAULT_SETTINGS
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT
  } catch {
    return DEFAULT
  }
}

let current = read()

function apply(s: Settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.coords = s.coords ? 'on' : 'off'
  root.dataset.hints = s.hints ? 'on' : 'off'
  root.dataset.motion = s.animation ? 'on' : 'off'
  root.dataset.lastmove = s.lastMove ? 'on' : 'off'
  setVolume(s.volume)
}
apply(current)

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode */
  }
  apply(current)
  for (const l of listeners) l()
}

export const getSettings = () => current

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => current,
    () => DEFAULT,
  )
}
