import type { Color } from './types'

/** Play setup: time controls and the last-used game settings, remembered in this browser. */
export interface TimeControl {
  id: string
  label: string
  kind: string
  minutes: number
  increment: number
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', label: 'No clock', kind: 'Untimed', minutes: 0, increment: 0 },
  { id: '1+0', label: '1 + 0', kind: 'Bullet', minutes: 1, increment: 0 },
  { id: '3+2', label: '3 + 2', kind: 'Blitz', minutes: 3, increment: 2 },
  { id: '5+0', label: '5 + 0', kind: 'Blitz', minutes: 5, increment: 0 },
  { id: '10+0', label: '10 + 0', kind: 'Rapid', minutes: 10, increment: 0 },
  { id: '15+10', label: '15 + 10', kind: 'Rapid', minutes: 15, increment: 10 },
  { id: '30+0', label: '30 + 0', kind: 'Classical', minutes: 30, increment: 0 },
]

export interface PlayConfig {
  opponent: 'computer' | 'friend'
  level: number
  side: Color | 'random'
  time: string
  showEval: boolean
}

const CONFIG_KEY = 'oukplay.play.v1'
export const DEFAULT_CONFIG: PlayConfig = { opponent: 'computer', level: 3, side: 'w', time: 'none', showEval: false }

export function readConfig(): PlayConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<PlayConfig>) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}


export function saveConfig(c: PlayConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  } catch {
    /* private mode */
  }
}
