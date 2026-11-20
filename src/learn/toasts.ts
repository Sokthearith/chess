import { useSyncExternalStore } from 'react'

/** Small pop-ups for XP, quests, the daily goal, level-ups and badges. */
export interface Toast {
  id: number
  kind: 'xp' | 'quest' | 'goal' | 'level' | 'badge' | 'streak'
  title: string
  sub?: string
  /** For merging quick XP toasts into one running total. */
  xp?: number
  at: number
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}
const LIFE: Record<Toast['kind'], number> = { xp: 2200, quest: 4200, goal: 4200, level: 5200, badge: 5200, streak: 4200 }

export function toast(t: Omit<Toast, 'id' | 'at'>) {
  if (typeof window === 'undefined') return
  const now = Date.now()
  const last = toasts[toasts.length - 1]
  // XP earned in quick succession reads as one running total.
  if (t.kind === 'xp' && last?.kind === 'xp' && now - last.at < 1500) {
    const xp = (last.xp ?? 0) + (t.xp ?? 0)
    toasts = [...toasts.slice(0, -1), { ...last, xp, title: `+${xp} XP`, sub: t.sub, at: now }]
    schedule(last.id, LIFE.xp)
  } else {
    const id = nextId++
    toasts = [...toasts, { ...t, id, at: now }].slice(-4)
    schedule(id, LIFE[t.kind])
  }
  emit()
}

const timers = new Map<number, number>()
function schedule(id: number, ms: number) {
  window.clearTimeout(timers.get(id))
  timers.set(
    id,
    window.setTimeout(() => dismiss(id), ms),
  )
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  timers.delete(id)
  emit()
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => toasts,
    () => toasts,
  )
}
