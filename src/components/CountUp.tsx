import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** A number that counts up from zero the first time it appears, then holds. */
export function useCountUp(target: number | null, durationMs = 1100): number | null {
  const [shown, setShown] = useState<number | null>(target === null ? null : reduced() ? target : 0)
  const from = useRef(0)
  useEffect(() => {
    if (target === null) {
      setShown(null)
      return
    }
    if (reduced()) {
      setShown(target)
      return
    }
    const start = performance.now()
    const begin = from.current
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(begin + (target - begin) * eased)
      if (t < 1) raf = requestAnimationFrame(step)
      else from.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return shown
}
