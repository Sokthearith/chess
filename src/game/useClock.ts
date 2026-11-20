import { useCallback, useEffect, useRef, useState } from 'react'
import type { Color } from './types'

export interface ClockOptions {
  /** Starting time per side, in milliseconds. */
  initialMs: number
  /** Increment added after each move, in milliseconds. */
  incrementMs?: number
}

export interface ClockState {
  w: number
  b: number
  running: Color | null
}

/**
 * A two-sided chess clock. Wall-clock based so a throttled tab stays honest.
 * The clock knows nothing about the position: the page tells it who is to move.
 */
export function useClock({ initialMs, incrementMs = 0 }: ClockOptions, onFlag?: (loser: Color) => void) {
  const [state, setState] = useState<ClockState>({ w: initialMs, b: initialMs, running: null })
  const lastTick = useRef<number | null>(null)
  const flagged = useRef(false)
  const onFlagRef = useRef(onFlag)
  onFlagRef.current = onFlag

  useEffect(() => {
    if (!state.running) {
      lastTick.current = null
      return
    }
    lastTick.current = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const elapsed = now - (lastTick.current ?? now)
      lastTick.current = now
      setState((s) => {
        if (!s.running) return s
        const next = Math.max(0, s[s.running] - elapsed)
        const out = { ...s, [s.running]: next }
        if (next === 0 && !flagged.current) {
          flagged.current = true
          out.running = null
          queueMicrotask(() => onFlagRef.current?.(s.running!))
        }
        return out
      })
    }, 100)
    return () => window.clearInterval(id)
  }, [state.running])

  /** Hand the move over: stop `mover`, add their increment, start the other side. */
  const press = useCallback(
    (mover: Color) => {
      setState((s) => {
        const other: Color = mover === 'w' ? 'b' : 'w'
        return { ...s, [mover]: s[mover] + (s.running ? incrementMs : 0), running: other }
      })
    },
    [incrementMs],
  )

  const start = useCallback((side: Color) => setState((s) => ({ ...s, running: side })), [])
  const pause = useCallback(() => setState((s) => ({ ...s, running: null })), [])
  const reset = useCallback(() => {
    flagged.current = false
    setState({ w: initialMs, b: initialMs, running: null })
  }, [initialMs])

  return { clock: state, press, start, pause, reset }
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (ms < 10_000 && ms > 0) {
    const tenths = Math.floor((ms % 1000) / 100)
    return `${m}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${tenths}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
